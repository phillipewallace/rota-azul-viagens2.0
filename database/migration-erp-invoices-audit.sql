-- ============================================================
-- ERP · Notas Fiscais — colunas de auditoria (quem editou / cancelou).
-- Idempotente.
-- ============================================================

ALTER TABLE erp_invoices
  ADD COLUMN IF NOT EXISTS updated_by     TEXT,
  ADD COLUMN IF NOT EXISTS cancelado_por  TEXT;
