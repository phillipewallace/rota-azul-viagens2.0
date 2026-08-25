-- ============================================================
-- ERP · Recibos sem validade jurídica
-- - Flag `sem_validade` no recibo (default FALSE = fluxo normal).
-- - `numero_display` = número exibido/impresso quando aplicável
--   (para recibos SV, começa em 0001 com contador próprio).
-- - `numero` (UNIQUE) recebe prefixo interno 'SV-' apenas para
--   garantir unicidade no banco. O PDF/UI mostram `numero_display`.
-- - Novo doc 'REC_SV' em `erp_doc_settings` com numeração própria.
-- Idempotente.
-- ============================================================

ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS sem_validade   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS numero_display TEXT;

CREATE INDEX IF NOT EXISTS idx_erp_receipts_sem_validade
  ON erp_receipts(sem_validade);

INSERT INTO erp_doc_settings(doc, start_number, include_year, padding, prefix)
  VALUES ('REC_SV', 0, FALSE, 4, NULL)
  ON CONFLICT (doc) DO NOTHING;
