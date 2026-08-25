-- ============================================================
-- ERP · Auditoria mínima em recibos e notas fiscais.
-- Idempotente.
-- ============================================================

-- Recibos: quem alterou o pagamento pela última vez.
ALTER TABLE erp_receipts
  ADD COLUMN IF NOT EXISTS updated_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
