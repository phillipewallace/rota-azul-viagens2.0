/**
 * Leitor inteligente de planilhas Excel para a aba "Rotas" do ERP.
 *
 * REGRA PRINCIPAL:
 *   - Cada ABA (sheet) do arquivo vira UMA Rota (o nome da aba = nome da rota).
 *   - Cada LINHA da aba vira UM PONTO dessa rota.
 *
 * O parser é "inteligente": detecta automaticamente a linha de cabeçalho e
 * mapeia as colunas para os campos do Ponto por similaridade de nome
 * (ignora acentos, maiúsculas e pontuação). Suporta sinônimos em português.
 */
import * as XLSX from 'xlsx';
import { RotaStatus } from '@/types/rota';

/** Campos de um Ponto (sem o id, que é gerado depois). */
export type PontoField =
  | 'company'
  | 'address'
  | 'cleaning'
  | 'bathrooms'
  | 'toilets'
  | 'pieces'
  | 'contact'
  | 'observation'
  | 'sanitarioNumber'
  | 'model'
  | 'color';

export interface ImportedPonto {
  [key: string]: string;
}

export interface ParsedColumn {
  field: PontoField | null;
  columnIndex: number;
  header: string;
}

export interface ParsedRota {
  sheetName: string;
  name: string;
  status: RotaStatus;
  pontos: ImportedPonto[];
  /** Índice (0-based) da linha usada como cabeçalho (-1 se não detectado). */
  headerRowIndex: number;
  /** Mapeamento campo -> coluna detectado (para preview/ diagnóstico). */
  columnMap: ParsedColumn[];
}

// Limites de segurança para não travar com arquivos gigantes.
const MAX_SHEETS = 100;
const MAX_ROWS_PER_SHEET = 1000;
// Quantas primeiras linhas inspecionar para achar o cabeçalho.
const HEADER_SCAN_LIMIT = 15;

/** Remove acentos, pontuação e normaliza espaços. */
const normalize = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // tira acentos
    .replace(/[^a-z0-9 ]/g, ' ') // pontuação -> espaço
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Palavras-chave por campo. O mapeamento usa o casamento MAIS LONGO
 * (mais específico ganha): ex. "QTD LIMPEZA" casa 'limpeza' (7)
 * contra 'qtd' (3) → vai para Limpezas, não Banheiros.
 *
 * 'genericQty' é um pseudo-campo: cabeçalhos genéricos de quantidade
 * ("QTD", "TOTAL", "Nº"...) caem no PRIMEIRO campo de quantidade ainda
 * livre da aba (banheiros → sanitários → peças).
 */
type ColumnField = PontoField | 'genericQty';

const COLUMN_KEYWORDS: { field: ColumnField; keywords: string[] }[] = [
  {
    field: 'sanitarioNumber',
    keywords: [
      'numero sanitario', 'num sanitario', 'n sanitario', 'numero do sanitario',
      'numero sanit', 'num sanit', 'n sanit', 'codigo sanitario', 'cod sanitario',
      'id sanitario', 'identificacao sanitario', 'patrimonio', 'tombamento', 'sanitario',
    ],
  },
  { field: 'observation', keywords: ['observacao', 'observacoes', 'obs'] },
  {
    field: 'bathrooms',
    keywords: [
      'quantidade banheiros', 'qtd banheiros', 'qtde banheiros', 'n banheiros',
      'banheiros', 'banheiro', 'banh',
    ],
  },
  {
    field: 'toilets',
    keywords: [
      'quantidade sanitarios', 'qtd sanitarios', 'qtde sanitarios', 'n sanitarios',
      'sanitarios', 'sanitario', 'sanit', 'vaso', 'vasos',
    ],
  },
  {
    field: 'pieces',
    keywords: [
      'quantidade pecas', 'qtd pecas', 'qtde pecas', 'n pecas',
      'pecas', 'peca',
    ],
  },
  {
    field: 'genericQty',
    keywords: [
      'quantidade', 'qtde', 'qtd', 'quant', 'qte', 'qnt', 'qntd', 'total',
      'unidade', 'unidades', 'wc',
    ],
  },
  {
    field: 'cleaning',
    keywords: [
      'quantidade limpeza', 'qtd limpeza', 'quantidade limpezas', 'qtd limpezas',
      'limpeza', 'limpezas', 'limpar', 'limp', 'frequencia', 'freq',
      'faxina', 'higienizacao', 'coleta',
    ],
  },
  {
    field: 'address',
    keywords: [
      'endereco', 'enderec', 'logradouro', 'lograd', 'localizacao',
      'avenida', 'bairro', 'cidade', 'cep', 'local', 'rua',
    ],
  },
  {
    field: 'contact',
    keywords: ['contato', 'telefone', 'tel', 'celular', 'responsavel', 'whatsapp', 'fone', 'zap'],
  },
  {
    field: 'company',
    keywords: ['razao social', 'empresa', 'cliente', 'fantasia', 'estabelecimento', 'nome'],
  },
  { field: 'model', keywords: ['modelo'] },
  { field: 'color', keywords: ['cor', 'cores'] },
];

/**
 * Verifica se a palavra-chave aparece no cabeçalho normalizado.
 * Palavras curtas (<=3 letras: qtd, cor, tel, wc, obs...) só casam como
 * palavra inteira — evita "cor" casar com "acordo" ou "tel" com "hotel".
 */
function matchesKeyword(normalized: string, kw: string): boolean {
  if (kw.includes(' ')) return normalized.includes(kw);
  if (kw.length <= 3) return normalized.split(' ').includes(kw);
  return normalized.includes(kw);
}

/**
 * Mapeia as células de um cabeçalho para campos do Ponto.
 * Cada campo é usado no máximo uma vez (o casamento com a palavra-chave
 * MAIS LONGA ganha — ex.: "QTD LIMPEZA" vai para Limpezas, pois 'limpeza'
 * é maior que 'qtd').
 */
function mapHeaderRow(row: unknown[]): ParsedColumn[] {
  const usedFields = new Set<PontoField>();
  // Ordem de preferência para cabeçalhos genéricos de quantidade
  // ("QTD", "TOTAL", "Nº"...): banheiros → sanitários → peças.
  const qtyOrder = ['bathrooms', 'toilets', 'pieces'] as const;
  return row.map((cell, columnIndex) => {
    const header = String(cell ?? '').trim();
    const normalized = normalize(cell);
    if (!normalized) return { field: null, columnIndex, header };

    let bestField: ColumnField | null = null;
    let bestLength = 0;
    for (const { field, keywords } of COLUMN_KEYWORDS) {
      if (field !== 'genericQty' && usedFields.has(field)) continue;
      for (const kw of keywords) {
        if (!matchesKeyword(normalized, kw)) continue;
        if (kw.length > bestLength) {
          bestLength = kw.length;
          bestField = field;
        }
      }
    }
    if (bestField === 'genericQty') {
      // Direciona para o primeiro campo de quantidade ainda livre.
      const fallback = qtyOrder.find((f) => !usedFields.has(f));
      if (!fallback) return { field: null, columnIndex, header };
      usedFields.add(fallback);
      return { field: fallback, columnIndex, header };
    }
    if (bestField) {
      usedFields.add(bestField);
      return { field: bestField, columnIndex, header };
    }
    return { field: null, columnIndex, header };
  });
}


/**
 * Pontuação de um mapeamento: quantos campos distintos foram reconhecidos.
 * Bônus quando empresa + endereço (os obrigatórios) aparecem juntos.
 */
function scoreOf(map: ParsedColumn[]): number {
  const fields = new Set(map.map((c) => c.field).filter(Boolean));
  let score = fields.size;
  if (fields.has('company') && fields.has('address')) score += 2;
  if (fields.has('company')) score += 1;
  return score;
}

/** Remove linhas totalmente vazias de uma matriz (array de arrays). */
const dropEmptyRows = (rows: unknown[][]): unknown[][] =>
  rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));

/**
 * Converte uma matriz (array de arrays) de uma aba em uma ParsedRota.
 * Detecta o cabeçalho nas primeiras linhas e mapeia as colunas.
 */
function sheetToRota(sheetName: string, rows: unknown[][]): ParsedRota {
  const clean = dropEmptyRows(rows).slice(0, MAX_ROWS_PER_SHEET);

  // 1) Achar a linha de cabeçalho (mais campos reconhecidos nas primeiras N linhas).
  let headerRowIndex = -1;
  let bestMap: ParsedColumn[] = [];
  let bestScore = 0;
  const scanEnd = Math.min(clean.length, HEADER_SCAN_LIMIT);
  for (let i = 0; i < scanEnd; i += 1) {
    const map = mapHeaderRow(clean[i]);
    const score = scoreOf(map);
    if (score > bestScore) {
      bestScore = score;
      bestMap = map;
      headerRowIndex = i;
    }
  }

  // Fallback posicional quando nenhum cabeçalho é reconhecido — ou quando o
  // "cabeçalho" detectado está na ÚLTIMA linha (não sobra linha de dados:
  // quase certamente a linha é de dados, não de cabeçalho — ex.: aba sem
  // cabeçalho cuja primeira célula contém "Empresa ...").
  if (headerRowIndex === -1 || headerRowIndex >= clean.length - 1) {
    const positional: PontoField[] = ['company', 'address', 'cleaning', 'bathrooms', 'contact', 'observation'];
    const width = clean.reduce((m, r) => Math.max(m, r?.length ?? 0), 0);
    bestMap = Array.from({ length: width }, (_, columnIndex) => ({
      field: columnIndex < positional.length ? positional[columnIndex] : null,
      columnIndex,
      header: '',
    }));
    headerRowIndex = -1;
  }

  // 2) Ler as linhas de dados (a partir da linha seguinte ao cabeçalho).
  const dataStart = headerRowIndex + 1;
  const pontos: ImportedPonto[] = [];
  for (let r = Math.max(dataStart, 0); r < clean.length; r += 1) {
    const row = clean[r];
    const ponto: ImportedPonto = {};
    let hasAny = false;
    for (const col of bestMap) {
      if (!col.field) continue;
      const value = String(row?.[col.columnIndex] ?? '').trim();
      if (value) hasAny = true;
      ponto[col.field] = value;
    }
    if (hasAny) pontos.push(ponto);
  }

  return {
    sheetName,
    name: sheetName.trim() || 'Rota importada',
    status: 'ativa' as RotaStatus,
    pontos,
    headerRowIndex,
    columnMap: bestMap.filter((c) => c.field),
  };
}

/**
 * Faz o parse de um arquivo Excel (ArrayBuffer/Uint8Array) e devolve uma rota
 * por aba. Abas sem nenhum ponto são ignoradas.
 */
export function parseRotasWorkbook(data: ArrayBuffer | Uint8Array): ParsedRota[] {
  const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: false });
  const sheetNames = wb.SheetNames.slice(0, MAX_SHEETS);

  const rotas: ParsedRota[] = [];
  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
    if (!rows.length) continue;
    const rota = sheetToRota(sheetName, rows);
    if (rota.pontos.length > 0) rotas.push(rota);
  }
  return rotas;
}

/** Rótulos legíveis dos campos (para mensagens de erro/ preview). */
export const FIELD_LABELS: Record<PontoField, string> = {
  company: 'Empresa',
  address: 'Endereço',
  cleaning: 'Limpezas',
  bathrooms: 'Banheiros',
  toilets: 'Sanitários',
  pieces: 'Peças',
  contact: 'Contato',
  observation: 'Observação',
  sanitarioNumber: 'Nº Sanitário',
  model: 'Modelo',
  color: 'Cor',
};

