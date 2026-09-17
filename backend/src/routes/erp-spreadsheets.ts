/**
 * ERP → Aba Excel
 * Lista, lê, salva edições e restaura planilhas processadas
 * (erp_spreadsheet_data). O arquivo original nunca é alterado.
 */
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { sendError } from '../utils/apiError';
import { logger } from '../utils/logger';
import { parseSpreadsheetForDocument } from '../utils/spreadsheetParse';

const router = Router();
router.use(requireAuth);

const MAX_SHEETS = 20;
const MAX_ROWS = 5000;
const MAX_COLS = 100;

/** Valida o payload de abas enviado pelo frontend. */
const sanitizeSheets = (input: any): { ok: boolean; value?: any; error?: string } => {
  if (!input || !Array.isArray(input.sheets)) return { ok: false, error: 'Payload inválido: sheets ausente' };
  if (input.sheets.length > MAX_SHEETS) return { ok: false, error: `Máximo de ${MAX_SHEETS} abas` };
  const sheets = input.sheets.map((s: any, i: number) => {
    const nome = String(s?.nome ?? `Aba ${i + 1}`).slice(0, 120);
    const rows = Array.isArray(s?.rows) ? s.rows : [];
    if (rows.length > MAX_ROWS) return { ok: false as const, error: `Aba "${nome}": máximo de ${MAX_ROWS} linhas` };
    const clean = rows.map((row: any) =>
      (Array.isArray(row) ? row : []).slice(0, MAX_COLS).map((c: any) => String(c ?? '').slice(0, 2000)),
    );
    return { ok: true as const, value: { nome, rows: clean, totalRows: clean.length, totalCols: Math.max(0, ...clean.map((r: string[]) => r.length)), truncated: false } };
  });
  const bad = sheets.find((s: any) => !s.ok);
  if (bad) return { ok: false, error: (bad as any).error };
  return { ok: true, value: { sheets: sheets.map((s: any) => s.value) } };
};

// ── GET / → lista documentos com dados de planilha ──────────────────────────
router.get('/', async (req: any, res: any) => {
  try {
    const search = req.query.search ? `%${String(req.query.search).toLowerCase()}%` : null;
    const r = await pool.query(
      `SELECT d.id, d.nome, d.tipo,
              d.arquivo_url AS "arquivoUrl",
              COALESCE(d.arquivo_nome, d.nome) AS "arquivoNome",
              d.empresa_emissora AS "empresaEmissora",
              d.updated_at AS "updatedAt",
              s.status, s.edited, s.erro,
              CASE WHEN s.sheets ? 'sheets'
                   THEN jsonb_array_length(s.sheets->'sheets') ELSE 0 END AS "abasCount",
              CASE WHEN s.sheets ? 'sheets' THEN
                COALESCE((SELECT SUM((aba->>'totalRows')::int)
                   FROM jsonb_array_elements(s.sheets->'sheets') aba), 0)
                ELSE 0 END AS "linhasCount"
         FROM erp_spreadsheet_data s
         JOIN erp_documents d ON d.id = s.document_id
        WHERE ($1::text IS NULL OR LOWER(d.nome) LIKE $1
               OR LOWER(COALESCE(d.arquivo_nome,'')) LIKE $1)
        ORDER BY d.updated_at DESC
        LIMIT 500`,
      [search],
    );
    res.json(r.rows);
  } catch (e: any) {
    logger.error('ERP-XLSX', 'Erro ao listar planilhas', { error: e.message });
    sendError(res, e, '[erp-spreadsheets GET]');
  }
});

// ── GET /:id → dados das abas ────────────────────────────────────────────────
router.get('/:id', async (req: any, res: any) => {
  try {
    const r = await pool.query(
      `SELECT s.document_id AS "documentId", s.status, s.sheets, s.edited, s.erro,
              s.updated_at AS "updatedAt",
              d.nome, d.arquivo_nome AS "arquivoNome"
         FROM erp_spreadsheet_data s
         JOIN erp_documents d ON d.id = s.document_id
        WHERE s.document_id = $1`,
      [req.params.id],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Planilha não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) {
    sendError(res, e, '[erp-spreadsheets GET /:id]');
  }
});

// ── PUT /:id → salva edições (persiste para sempre) ─────────────────────────
router.put('/:id', async (req: any, res: any) => {
  try {
    const v = sanitizeSheets(req.body);
    if (!v.ok) return res.status(400).json({ error: v.error });
    const r = await pool.query(
      `UPDATE erp_spreadsheet_data
          SET sheets = $2, edited = true, status = 'pronto', erro = NULL, updated_at = NOW()
        WHERE document_id = $1
      RETURNING document_id AS "documentId", updated_at AS "updatedAt"`,
      [req.params.id, JSON.stringify(v.value)],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Planilha não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) {
    logger.error('ERP-XLSX', 'Erro ao salvar planilha', { error: e.message });
    sendError(res, e, '[erp-spreadsheets PUT /:id]');
  }
});

// ── POST /:id/parse → re-parseia o ORIGINAL (restaura edições) ───────────────
router.post('/:id/parse', async (req: any, res: any) => {
  try {
    const docQ = await pool.query(`SELECT id FROM erp_documents WHERE id = $1`, [req.params.id]);
    if (!docQ.rows[0]) return res.status(404).json({ error: 'Documento não encontrado' });
    const result = await parseSpreadsheetForDocument(req.params.id);
    const fresh = await pool.query(
      `SELECT document_id AS "documentId", status, sheets, edited, erro, updated_at AS "updatedAt"
         FROM erp_spreadsheet_data WHERE document_id = $1`,
      [req.params.id],
    );
    res.json(fresh.rows[0] || { documentId: req.params.id, status: result.status });
  } catch (e: any) {
    sendError(res, e, '[erp-spreadsheets POST /:id/parse]');
  }
});

export default router;
