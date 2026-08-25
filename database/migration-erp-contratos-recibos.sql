-- ============================================================
-- ERP · Contratos + Recibos + Numeração configurável + Logos
-- Idempotente. Pode rodar várias vezes com segurança.
-- ============================================================

-- 1) Configuração de numeração por tipo de documento ----------
CREATE TABLE IF NOT EXISTS erp_doc_settings (
  doc            TEXT PRIMARY KEY,        -- 'ORC', 'OS', 'CTR', 'REC'
  start_number   INT  NOT NULL DEFAULT 0, -- próximo será start_number + 1
  include_year   BOOLEAN NOT NULL DEFAULT TRUE,
  padding        INT  NOT NULL DEFAULT 4,
  prefix         TEXT,                    -- opcional, se NULL usa o próprio doc
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_doc_settings TO lipe;

INSERT INTO erp_doc_settings(doc, start_number, include_year, padding) VALUES
  ('ORC', 0, TRUE, 4),
  ('OS',  0, TRUE, 4),
  ('CTR', 0, FALSE, 4),
  ('REC', 0, FALSE, 4)
ON CONFLICT (doc) DO NOTHING;

-- 2) Função de numeração: considera start_number do settings ---
-- (substitui a função anterior)
CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT) RETURNS TEXT AS $$
DECLARE
  v_set     RECORD;
  v_ano     INT;
  v_n       INT;
  v_prefix  TEXT;
BEGIN
  SELECT COALESCE(s.start_number,0)  AS start_number,
         COALESCE(s.include_year,TRUE) AS include_year,
         COALESCE(s.padding,4) AS padding,
         COALESCE(s.prefix, p_doc) AS prefix
    INTO v_set
    FROM erp_doc_settings s WHERE s.doc = p_doc;

  IF NOT FOUND THEN
    -- defaults se não houver settings (back-compat)
    v_set.start_number := 0;
    v_set.include_year := TRUE;
    v_set.padding := 4;
    v_set.prefix := p_doc;
  END IF;

  IF v_set.include_year THEN
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE);
  ELSE
    v_ano := 0;
  END IF;

  -- Inicializa contador com start_number caso ainda não exista
  INSERT INTO erp_doc_counters(doc, ano, ultimo)
       VALUES (p_doc, v_ano, v_set.start_number + 1)
    ON CONFLICT (doc, ano) DO UPDATE
       SET ultimo = GREATEST(erp_doc_counters.ultimo + 1, EXCLUDED.ultimo)
    RETURNING ultimo INTO v_n;

  v_prefix := v_set.prefix;

  IF v_set.include_year THEN
    RETURN v_prefix || '-' || v_ano || '-' || LPAD(v_n::TEXT, v_set.padding, '0');
  ELSE
    RETURN LPAD(v_n::TEXT, v_set.padding, '0');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3) Logo nas empresas emissoras (já existe logo_url; adicionamos campo opcional logo_dataurl) --
ALTER TABLE erp_companies ADD COLUMN IF NOT EXISTS logo_dataurl TEXT;

-- 4) Contratos -----------------------------------------------
CREATE TABLE IF NOT EXISTS erp_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                TEXT UNIQUE NOT NULL,
  company_id            UUID REFERENCES erp_companies(id) ON DELETE SET NULL,
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL,
  os_id                 UUID REFERENCES erp_service_orders(id) ON DELETE SET NULL,
  origem                TEXT NOT NULL DEFAULT 'manual',  -- manual | sistema
  descricao             TEXT,
  data_inicio           DATE NOT NULL,
  data_fim              DATE,                            -- NULL = vigente
  dia_vencimento        INT  NOT NULL DEFAULT 10,        -- 1-28
  valor_mensal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  renovacao_automatica  BOOLEAN NOT NULL DEFAULT TRUE,
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  encerrado_em          TIMESTAMPTZ,
  motivo_encerramento   TEXT,
  pdf_url               TEXT,                            -- contrato assinado (upload)
  observacoes           TEXT,
  company_snapshot      JSONB,
  customer_snapshot     JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_contracts TO lipe;
CREATE INDEX IF NOT EXISTS idx_erp_contracts_ativo     ON erp_contracts(ativo);
CREATE INDEX IF NOT EXISTS idx_erp_contracts_customer  ON erp_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_erp_contracts_os        ON erp_contracts(os_id);

-- 5) Recibos -------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          TEXT UNIQUE NOT NULL,
  contract_id     UUID NOT NULL REFERENCES erp_contracts(id) ON DELETE CASCADE,
  competencia     CHAR(7) NOT NULL,        -- 'YYYY-MM'
  data_emissao    DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  valor           NUMERIC(12,2) NOT NULL DEFAULT 0,
  pago            BOOLEAN NOT NULL DEFAULT TRUE,
  snapshot        JSONB,                   -- dados congelados na emissão
  pdf_gerado_em   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_id, competencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_receipts TO lipe;
CREATE INDEX IF NOT EXISTS idx_erp_receipts_contract  ON erp_receipts(contract_id);
CREATE INDEX IF NOT EXISTS idx_erp_receipts_competencia ON erp_receipts(competencia);
