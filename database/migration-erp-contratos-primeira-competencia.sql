-- Contratos: mês do primeiro faturamento (opcional).
-- Formato YYYY-MM. Quando preenchido, o contrato só entra na lista de
-- pendentes do Financeiro a partir dessa competência, mesmo que a
-- data_inicio seja anterior. Idempotente.
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS primeira_competencia TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_contracts TO lipe;
