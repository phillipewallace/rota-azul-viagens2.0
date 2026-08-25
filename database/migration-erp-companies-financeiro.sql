-- Contato do setor financeiro por empresa emissora.
-- Campo único de texto livre (nome / telefone / e-mail) exibido nos recibos.
ALTER TABLE erp_companies
  ADD COLUMN IF NOT EXISTS financeiro_contato TEXT;
