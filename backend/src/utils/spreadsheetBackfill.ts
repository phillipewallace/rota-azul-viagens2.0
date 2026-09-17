/**
 * ERP → Aba Excel: backfill de planilhas antigas.
 * No boot do servidor, encontra documentos cujo arquivo é planilha
 * (xlsx/xls/csv/ods) mas que ainda NÃO têm registro em erp_spreadsheet_data
 * (ex.: enviados antes desta feature existir) e os processa em sequência.
 * Eles aparecem na aba Excel imediatamente como "Processando…" e viram
 * "Pronta" conforme o parse roda — sem precisar reenviar nada.
 */
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { isSpreadsheetFile, parseSpreadsheetForDocument } from './spreadsheetParse';

export async function backfillSpreadsheets(): Promise<{ queued: number }> {
  // Documentos com arquivo (principal ou 1º da sub-pasta) e sem registro de parse.
  const q = await pool.query(
    `SELECT d.id,
            COALESCE(
              d.arquivo_nome,
              (SELECT f.arquivo_nome FROM erp_document_files f
                WHERE f.document_id = d.id
                  AND f.arquivo_url IS NOT NULL AND f.arquivo_url <> ''
                ORDER BY f.created_at ASC NULLS LAST LIMIT 1)
            ) AS nome
       FROM erp_documents d
      WHERE (d.arquivo_url IS NOT NULL AND d.arquivo_url <> ''
             OR EXISTS (SELECT 1 FROM erp_document_files f
                         WHERE f.document_id = d.id
                           AND f.arquivo_url IS NOT NULL AND f.arquivo_url <> ''))
        AND NOT EXISTS (SELECT 1 FROM erp_spreadsheet_data s WHERE s.document_id = d.id)`,
  );

  const candidates = (q.rows || []).filter((r: any) => isSpreadsheetFile(r?.nome));
  if (candidates.length === 0) return { queued: 0 };

  // Reserva as vagas como "processando" — a listagem da aba Excel já as exibe.
  for (const row of candidates) {
    await pool.query(
      `INSERT INTO erp_spreadsheet_data (document_id, status, updated_at)
       VALUES ($1, 'processando', NOW())
       ON CONFLICT (document_id) DO NOTHING`,
      [row.id],
    ).catch(() => undefined);
  }
  logger.info('ERP-XLSX', `Backfill: ${candidates.length} planilha(s) antiga(s) na fila`);

  // Processa em sequência para não estourar memória/CPU com arquivos grandes.
  let ok = 0;
  for (const row of candidates) {
    const res = await parseSpreadsheetForDocument(row.id).catch(() => ({ status: 'erro' }));
    if ((res as any)?.status === 'pronto') ok += 1;
  }
  logger.info('ERP-XLSX', `Backfill concluído: ${ok}/${candidates.length} prontas`);
  return { queued: candidates.length };
}
