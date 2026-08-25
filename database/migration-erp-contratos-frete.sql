-- ============================================================
-- ERP · Frete por contrato (cobrança UMA ÚNICA VEZ no 1º recibo)
-- Idempotente.
-- ============================================================
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS frete NUMERIC(12,2) NOT NULL DEFAULT 0;
