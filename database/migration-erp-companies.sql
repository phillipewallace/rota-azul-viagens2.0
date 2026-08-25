-- Cadastro de até 3 CNPJs emissores para Orçamentos e Ordens de Serviço
CREATE TABLE IF NOT EXISTS erp_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  inscricao_estadual TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  telefone TEXT,
  email TEXT,
  logo_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_companies TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_companies_ativo ON erp_companies(ativo);

-- Garante limite de 3 cadastros ativos (regra de negócio reforçada também na API)
CREATE OR REPLACE FUNCTION erp_companies_enforce_limit() RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM erp_companies) > 3 THEN
    RAISE EXCEPTION 'Limite de 3 empresas emissoras atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_erp_companies_limit ON erp_companies;
CREATE TRIGGER trg_erp_companies_limit
AFTER INSERT ON erp_companies
FOR EACH ROW EXECUTE FUNCTION erp_companies_enforce_limit();
