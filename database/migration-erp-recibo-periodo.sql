-- ============================================================
-- ERP · Recibos — período exato (data início / data fim)
-- Permite exibir competência como "14/01/2026 - 14/02/2026".
-- Compat: `competencia` (YYYY-MM) continua sendo derivada do
-- mês de `periodo_inicio` para manter a lógica de pendentes.
-- Idempotente.
-- ============================================================

ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS periodo_inicio DATE;
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS periodo_fim    DATE;

CREATE INDEX IF NOT EXISTS idx_erp_receipts_periodo
  ON erp_receipts(periodo_inicio, periodo_fim);
