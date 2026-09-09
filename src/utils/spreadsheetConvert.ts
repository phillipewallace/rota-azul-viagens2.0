/**
 * Conversão entre arquivos de planilha (XLSX/XLS/CSV/ODS) e o modelo de dados
 * do editor Univer. Usa SheetJS (Community Edition) para ler/gravar os arquivos
 * e monta a estrutura IWorkbookData esperada pelo Univer (células com valor,
 * fórmula e tipo). Também reconstrói o arquivo a partir do estado editado.
 */
import * as XLSX from 'xlsx';

/** Tipos de célula do Univer (CellValueType): STRING=1, NUMBER=2, BOOLEAN=3, FORCE_STRING=4 */
const T_STRING = 1;
const T_NUMBER = 2;
const T_BOOLEAN = 3;

export interface UniverCellData {
  v?: string | number | boolean | null;
  f?: string | null; // fórmula SEM o '=' (padrão SheetJS); o '=' é adicionado aqui
  t?: number;
}

export interface UniverSheetModel {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  cellData: Record<number, Record<number, UniverCellData>>;
}

const MAX_ROWS = 20_000;
const MAX_COLS = 200;

const toIsoDate = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Lê um buffer de planilha e devolve o modelo de abas pronto para o Univer.
 * Preserva valores, fórmulas e datas (datas viram texto ISO para exibição fiel).
 */
export function spreadsheetFileToSheets(buffer: ArrayBuffer): UniverSheetModel[] {
  const wb = XLSX.read(new Uint8Array(buffer), {
    type: 'array',
    cellFormula: true,
    cellStyles: false,
    cellDates: true,
  });

  return wb.SheetNames.map((name, idx) => {
    const ws = wb.Sheets[name];
    const ref = ws?.['!ref'];
    const cellData: Record<number, Record<number, UniverCellData>> = {};
    let maxRow = 0;
    let maxCol = 0;

    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let r = range.s.r; r <= range.e.r; r += 1) {
        for (let c = range.s.c; c <= range.e.c; c += 1) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = ws[addr] as XLSX.CellObject | undefined;
          if (!cell || cell.v === undefined || cell.v === null) continue;

          let value: string | number | boolean;
          let t: number;
          if (cell.t === 'n') {
            value = Number(cell.v);
            t = T_NUMBER;
          } else if (cell.t === 'b') {
            value = Boolean(cell.v);
            t = T_BOOLEAN;
          } else if (cell.t === 'd') {
            value = toIsoDate(cell.v as unknown as Date);
            t = T_STRING;
          } else {
            value = String(cell.v ?? '');
            t = T_STRING;
          }

          const data: UniverCellData = { v: value, t };
          if (cell.f) data.f = `=${cell.f}`;
          cellData[r] = cellData[r] || {};
          cellData[r][c] = data;
          if (r > maxRow) maxRow = r;
          if (c > maxCol) maxCol = c;
        }
      }
    }

    return {
      id: `sheet-${idx}`,
      name: name || `Planilha${idx + 1}`,
      rowCount: Math.min(Math.max(maxRow + 200, 500), MAX_ROWS),
      columnCount: Math.min(Math.max(maxCol + 20, 26), MAX_COLS),
      cellData,
    };
  });
}

/** Normaliza o nome de aba para o SheetJS (sem caracteres inválidos). */
const safeSheetName = (name: string, idx: number): string => {
  const cleaned = (name || '').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || `Planilha${idx + 1}`;
};

export interface SheetExport {
  name: string;
  /** Matriz de valores (saída de FRange.getValues()). */
  values: unknown[][];
  /** Matriz de fórmulas (saída de FRange.getFormulas()) — strings COM '=' ou ''. */
  formulas: string[][];
}

/** Recorta linhas/colunas vazias do fim da matriz. */
function trimAoa(rows: unknown[][]): unknown[][] {
  let lastRow = -1;
  let lastCol = -1;
  rows.forEach((row, r) => {
    if (!Array.isArray(row)) return;
    row.forEach((v, c) => {
      if (v !== null && v !== undefined && v !== '') {
        if (r > lastRow) lastRow = r;
        if (c > lastCol) lastCol = c;
      }
    });
  });
  if (lastRow < 0 || lastCol < 0) return [];
  return rows.slice(0, lastRow + 1).map((row) => {
    const arr = Array.isArray(row) ? row : [];
    const out = arr.slice(0, lastCol + 1);
    while (out.length < lastCol + 1) out.push(null);
    return out;
  });
}

/** Converte o estado editado do Univer em um WorkBook do SheetJS. */
export function sheetExportsToWorkbook(sheets: SheetExport[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet, idx) => {
    const aoa: (XLSX.CellObject | string | number | boolean | null)[][] = [];
    const values = Array.isArray(sheet.values) ? sheet.values : [];
    const formulas = Array.isArray(sheet.formulas) ? sheet.formulas : [];
    for (let r = 0; r < values.length; r += 1) {
      const row: (XLSX.CellObject | string | number | boolean | null)[] = [];
      const vRow = values[r] || [];
      const fRow = formulas[r] || [];
      for (let c = 0; c < vRow.length; c += 1) {
        const raw = vRow[c];
        const formula = typeof fRow[c] === 'string' ? fRow[c] : '';
        // FRange.getValues pode devolver RichTextValue/objetos — extrai o valor plano.
        const plain =
          raw !== null && typeof raw === 'object' && !(raw instanceof Date)
            ? (raw as { v?: unknown }).v ?? null
            : raw;
        if (formula) {
          const cell: XLSX.CellObject = {
            f: String(formula).replace(/^=/, ''),
            t: typeof plain === 'number' ? 'n' : typeof plain === 'boolean' ? 'b' : 's',
          };
          if (plain !== null && plain !== undefined && plain !== '') {
            if (typeof plain === 'number') cell.v = plain;
            else if (typeof plain === 'boolean') cell.v = plain;
            else cell.v = String(plain);
          }
          row.push(cell);
        } else {
          row.push(plain === undefined ? null : (plain as string | number | boolean | null));
        }
      }
      aoa.push(row);
    }
    const trimmed = trimAoa(aoa);
    const ws = trimmed.length
      ? XLSX.utils.aoa_to_sheet(trimmed as XLSX.CellObject[][])
      : XLSX.utils.aoa_to_sheet([[]]);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(sheet.name, idx));
  });
  return wb;
}

export type SpreadsheetFormat = 'xlsx' | 'xls' | 'csv' | 'ods';

/** Descobre o formato de exportação a partir do nome do arquivo original. */
export function spreadsheetFormatFor(fileName: string): SpreadsheetFormat {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xls') return 'xls';
  if (ext === 'ods') return 'ods';
  return 'xlsx';
}

export const spreadsheetMime = (format: SpreadsheetFormat): string =>
  ({
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    ods: 'application/vnd.oasis.opendocument.spreadsheet',
  } as const)[format];

/** Gera o Blob do arquivo final (planilha editada) pronto para upload. */
export function buildSpreadsheetBlob(sheets: SheetExport[], format: SpreadsheetFormat): Blob {
  const wb = sheetExportsToWorkbook(sheets);
  if (format === 'csv') {
    const firstName = wb.SheetNames[0];
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[firstName]);
    return new Blob([`\uFEFF${csv}`], { type: spreadsheetMime('csv') });
  }
  const out = XLSX.write(wb, { bookType: format, type: 'array' });
  return new Blob([out], { type: spreadsheetMime(format) });
}

export const SPREADSHEET_EXTS = ['xlsx', 'xls', 'csv', 'ods'];
export const OFFICE_DOC_EXTS = ['docx', 'doc', 'odt', 'rtf', 'pptx', 'odp'];
