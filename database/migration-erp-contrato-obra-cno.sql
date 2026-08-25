-- Contratos: endereço da obra/evento (separado do endereço do cliente)
-- e campo CNO / Ordem de Compra. Idempotente.
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS endereco_obra TEXT;
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS cno TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_contracts TO lipe;
