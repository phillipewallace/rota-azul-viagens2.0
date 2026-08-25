-- ============================================================
-- ERP · Numeração de documentos por EMPRESA emissora (opt-in)
-- Idempotente e retrocompatível: se a empresa não tiver
-- configuração, cai no setting global (comportamento atual).
-- ============================================================

-- 1) Configuração por (empresa, documento) --------------------
CREATE TABLE IF NOT EXISTS erp_doc_settings_company (
  company_id   UUID NOT NULL REFERENCES erp_companies(id) ON DELETE CASCADE,
  doc          TEXT NOT NULL,
  start_number INT  NOT NULL DEFAULT 0,
  include_year BOOLEAN NOT NULL DEFAULT FALSE,
  padding      INT  NOT NULL DEFAULT 4,
  prefix       TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, doc)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_doc_settings_company TO lipe;

-- 2) Contador por (empresa, documento, ano) -------------------
-- Preserva contadores globais existentes: company_id NULL = global.
ALTER TABLE erp_doc_counters ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES erp_companies(id) ON DELETE CASCADE;

-- Remove a unique antiga (doc, ano) se existir; cria unique nova incluindo company_id.
-- Usamos duas unique parciais: uma para linhas globais (company_id IS NULL),
-- outra para linhas por empresa. Assim, não perdemos os contadores globais.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'erp_doc_counters_doc_ano_key'
  ) THEN
    ALTER TABLE erp_doc_counters DROP CONSTRAINT erp_doc_counters_doc_ano_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_doc_counters_global
  ON erp_doc_counters(doc, ano) WHERE company_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_doc_counters_by_company
  ON erp_doc_counters(company_id, doc, ano) WHERE company_id IS NOT NULL;

-- 3) Nova função com overload por empresa ---------------------
-- Mantém a assinatura antiga (SEM company_id) intacta para não quebrar
-- caller nenhum; internamente, a antiga chama a nova com NULL.
CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT, p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_start   INT;
  v_year_f  BOOLEAN;
  v_pad     INT;
  v_prefix  TEXT;
  v_ano     INT;
  v_n       INT;
BEGIN
  -- 1) resolve settings: empresa → global → defaults
  IF p_company_id IS NOT NULL THEN
    SELECT COALESCE(start_number,0), COALESCE(include_year,FALSE),
           COALESCE(padding,4), COALESCE(prefix, p_doc)
      INTO v_start, v_year_f, v_pad, v_prefix
      FROM erp_doc_settings_company
     WHERE company_id = p_company_id AND doc = p_doc;
  END IF;

  IF v_pad IS NULL THEN
    SELECT COALESCE(start_number,0), COALESCE(include_year,TRUE),
           COALESCE(padding,4), COALESCE(prefix, p_doc)
      INTO v_start, v_year_f, v_pad, v_prefix
      FROM erp_doc_settings
     WHERE doc = p_doc;
  END IF;

  IF v_pad IS NULL THEN
    v_start := 0; v_year_f := TRUE; v_pad := 4; v_prefix := p_doc;
  END IF;

  v_ano := CASE WHEN v_year_f THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT ELSE 0 END;

  -- 2) upsert no contador correto (por empresa ou global)
  IF p_company_id IS NULL THEN
    INSERT INTO erp_doc_counters(doc, ano, ultimo, company_id)
         VALUES (p_doc, v_ano, v_start + 1, NULL)
    ON CONFLICT (doc, ano) WHERE company_id IS NULL DO UPDATE
         SET ultimo = GREATEST(erp_doc_counters.ultimo + 1, EXCLUDED.ultimo)
    RETURNING ultimo INTO v_n;
  ELSE
    INSERT INTO erp_doc_counters(doc, ano, ultimo, company_id)
         VALUES (p_doc, v_ano, v_start + 1, p_company_id)
    ON CONFLICT (company_id, doc, ano) WHERE company_id IS NOT NULL DO UPDATE
         SET ultimo = GREATEST(erp_doc_counters.ultimo + 1, EXCLUDED.ultimo)
    RETURNING ultimo INTO v_n;
  END IF;

  IF v_year_f THEN
    RETURN v_prefix || '-' || v_ano || '-' || LPAD(v_n::TEXT, v_pad, '0');
  ELSE
    RETURN LPAD(v_n::TEXT, v_pad, '0');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Overload retrocompatível: mesma assinatura antiga (sem company_id).
CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT)
RETURNS TEXT AS $$
  SELECT erp_next_doc_number(p_doc, NULL::UUID);
$$ LANGUAGE sql;
