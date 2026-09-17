/**
 * ERP → Aba Excel: parse de planilhas (xlsx/xls/csv/ods) no backend.
 * Roda APÓS o upload (fire-and-forget): lê o arquivo original com SheetJS,
 * extrai as abas como matrizes de strings e grava em erp_spreadsheet_data.
 * O arquivo original NUNCA é alterado — a aba Excel edita o JSON e o
 * original continua disponível para "Restaurar".
 */
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { pool } from '../config/database';
import { logger } from '../utils/logger';

const uploadsDir = path.join(__dirname, '../../uploads');

export const SPREADSHEET_EXTS = ['xlsx', 'xls', 'csv', 'ods'] as const;

export const isSpreadsheetFile = (nome?: string | null): boolean => {
  if (!nome) return false;
  const ext = String(nome).split('.').pop()?.toLowerCase() || '';
  return (SPREADSHEET_EXTS as readonly string[]).includes(ext);
};

// Capas de segurança: planilhas gigantes não devem estourar memória/JSONB/UDP.
const MAX_SHEETS = 20;
const MAX_ROWS = 5000;
const MAX_COLS = 100;
const MAX_CELL = 2000; // caracteres por célula

export interface ParsedSheet {
  nome: string;
  rows: string[][];
  totalRows: number;
  totalCols: number;
  truncated: boolean;
}

export interface SpreadsheetPayload {
  sheets: ParsedSheet[];
}

/** Busca a URL do arquivo "principal" do documento (vinculado ou 1º da sub-pasta). */
async function getDocumentFileUrl(docId: string): Promise<{ url: string | null; nome: string | null }> {
  const docQ = await pool.query(
    `SELECT arquivo_url, arquivo_nome FROM erp_documents WHERE id = $1`,
    [docId],
  );
  if (docQ.rows[0]?.arquivo_url) {
    return { url: docQ.rows[0].arquivo_url, nome: docQ.rows[0].arquivo_nome };
  }
  const fQ = await pool.query(
    `SELECT arquivo_url, arquivo_nome FROM erp_document_files
      WHERE document_id = $1 AND arquivo_url IS NOT NULL AND arquivo_url <> ''
      ORDER BY created_at ASC LIMIT 1`,
    [docId],
  );
  if (fQ.rows[0]) return { url: fQ.rows[0].arquivo_url, nome: fQ.rows[0].arquivo_nome };
  return { url: null, nome: null };
}

/** Marca status na tabela (best-effort: nunca lança). */
async function setStatus(docId: string, status: string, sheets?: SpreadsheetPayload | null, erro?: string | null): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO erp_spreadsheet_data (document_id, status, sheets, erro, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (document_id) DO UPDATE
         SET status = EXCLUDED.status,
             -- Quando o novo estado NÃO é 'pronto', os dados antigos são
             -- descartados (ex.: arquivo substituído por um não-planilha).
             sheets = CASE WHEN EXCLUDED.status = 'pronto'
                           THEN COALESCE(EXCLUDED.sheets, erp_spreadsheet_data.sheets)
                           ELSE EXCLUDED.sheets END,
             erro = EXCLUDED.erro,
             updated_at = NOW()`,
      [docId, status, sheets ? JSON.stringify(sheets) : null, erro ?? null],
    );
  } catch (e: any) {
    logger.error('ERP-XLSX', 'Falha ao gravar status da planilha', { docId, error: e.message });
  }
}

/**
 * Analisa a planilha do documento e grava o resultado.
 * Idempotente: sobrescreve o parse anterior SEMPRE que rodar
 * (usado tanto no upload quanto no botão "Restaurar original").
 */
export async function parseSpreadsheetForDocument(docId: string): Promise<{ status: string }> {
  try {
    const { url, nome } = await getDocumentFileUrl(docId);
    if (!url) {
      await setStatus(docId, 'sem_arquivo', null, null);
      return { status: 'sem_arquivo' };
    }
    if (!isSpreadsheetFile(nome || url)) {
      await setStatus(docId, 'nao_planilha', null, null);
      return { status: 'nao_planilha' };
    }

    const fp = path.join(uploadsDir, path.basename(url));
    if (!fs.existsSync(fp)) {
      await setStatus(docId, 'sem_arquivo', null, 'Arquivo físico não encontrado');
      return { status: 'sem_arquivo' };
    }

    const buf = fs.readFileSync(fp);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, raw: false });

    const sheets: ParsedSheet[] = [];
    const sheetNames = wb.SheetNames.slice(0, MAX_SHEETS);
    for (const nomeAba of sheetNames) {
      const ws = wb.Sheets[nomeAba];
      if (!ws) continue;
      const aoa = XLSX.utils.sheet_to_json<string[]>(ws, {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false,
      });
      // Normaliza células para string curta e recorta colunas vazias à direita.
      let maxCols = 0;
      const capped = aoa.slice(0, MAX_ROWS).map((row) => {
        const cells = (row || []).slice(0, MAX_COLS).map((c) => String(c ?? '').slice(0, MAX_CELL));
        if (cells.length > maxCols) maxCols = cells.length;
        return cells;
      });
      // Remove linhas totalmente vazias no fim.
      while (capped.length > 0 && capped[capped.length - 1].every((c) => !c)) capped.pop();
      sheets.push({
        nome: nomeAba,
        rows: capped,
        totalRows: aoa.length,
        totalCols: maxCols,
        truncated: aoa.length > MAX_ROWS || wb.SheetNames.length > MAX_SHEETS,
      });
    }

    if (sheets.length === 0 || sheets.every((s) => s.rows.length === 0)) {
      await setStatus(docId, 'sem_dados', { sheets }, null);
      return { status: 'sem_dados' };
    }

    await setStatus(docId, 'pronto', { sheets }, null);
    logger.info('ERP-XLSX', 'Planilha processada', { docId, abas: sheets.length });
    return { status: 'pronto' };
  } catch (e: any) {
    logger.error('ERP-XLSX', 'Erro ao analisar planilha', { docId, error: e.message });
    await setStatus(docId, 'erro', null, e.message?.slice(0, 500));
    return { status: 'erro' };
  }
}

/** Engatilha o parse em background (fire-and-forget) quando o arquivo é planilha. */
export function maybeParseSpreadsheetAsync(docId: string, fileName?: string | null): void {
  if (!isSpreadsheetFile(fileName)) return;
  parseSpreadsheetForDocument(docId).catch(() => undefined);
}
