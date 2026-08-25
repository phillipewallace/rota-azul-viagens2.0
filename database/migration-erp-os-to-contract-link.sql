-- OS → Contrato: liga automaticamente a OS ao contrato gerado a partir dela.
-- - Adiciona rastreabilidade (converted_contract_id / converted_at) na OS.
-- - Garante 1 contrato por OS via índice único parcial (permitindo NULL).
-- Idempotente.

ALTER TABLE erp_service_orders
  ADD COLUMN IF NOT EXISTS converted_contract_id UUID
    REFERENCES erp_contracts(id) ON DELETE SET NULL;

ALTER TABLE erp_service_orders
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_contracts_os_id_unique
  ON erp_contracts(os_id) WHERE os_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_erp_service_orders_converted_contract
  ON erp_service_orders(converted_contract_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_service_orders TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_contracts TO lipe;
