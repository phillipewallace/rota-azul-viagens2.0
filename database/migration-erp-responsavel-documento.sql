-- Responsável (contato do pedido) por documento — contrato e orçamento.
-- Guardado no próprio documento pois a mesma empresa/cliente pode ter
-- solicitantes diferentes em cada locação.

ALTER TABLE erp_contracts
  ADD COLUMN IF NOT EXISTS responsavel_nome     VARCHAR(160),
  ADD COLUMN IF NOT EXISTS responsavel_telefone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS responsavel_email    VARCHAR(160);

ALTER TABLE erp_quotes
  ADD COLUMN IF NOT EXISTS responsavel_nome     VARCHAR(160),
  ADD COLUMN IF NOT EXISTS responsavel_telefone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS responsavel_email    VARCHAR(160);
