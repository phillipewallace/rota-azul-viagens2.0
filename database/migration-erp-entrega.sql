-- Migration: data de entrega + limpezas semanais (mensal) em quotes/OS
-- Idempotente.

ALTER TABLE erp_quotes          ADD COLUMN IF NOT EXISTS data_entrega DATE;
ALTER TABLE erp_quotes          ADD COLUMN IF NOT EXISTS limpezas_semanais INT;
ALTER TABLE erp_service_orders  ADD COLUMN IF NOT EXISTS data_entrega DATE;
ALTER TABLE erp_service_orders  ADD COLUMN IF NOT EXISTS limpezas_semanais INT;
ALTER TABLE erp_service_orders  ADD COLUMN IF NOT EXISTS endereco_entrega TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_quotes TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_service_orders TO lipe;
