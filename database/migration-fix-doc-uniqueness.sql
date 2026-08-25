-- ============================================================
-- ERP · Numeração exclusivamente por empresa emissora
-- Corrige UNIQUE(numero) global para permitir o mesmo número em
-- empresas diferentes, mantendo unicidade dentro de cada empresa.
--
-- Produção: criar os índices antes de remover as constraints globais
-- evita janela sem proteção contra duplicidade por empresa.
-- ============================================================

-- 1) Garante suporte a contador por empresa e ao documento MED.
ALTER TABLE erp_doc_counters ADD COLUMN IF NOT EXISTS company_id UUID
  REFERENCES erp_companies(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND rel.relname = 'erp_doc_counters'
       AND con.conname = 'erp_doc_counters_pkey'
  ) THEN
    ALTER TABLE erp_doc_counters DROP CONSTRAINT erp_doc_counters_pkey;
  END IF;

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

INSERT INTO erp_doc_settings(doc, start_number, include_year, padding, prefix) VALUES
  ('MED', 0, TRUE, 4, 'MED')
ON CONFLICT (doc) DO NOTHING;

-- 2) Recibos passam a carregar a empresa emissora diretamente para a
-- constraint composta. Backfill preserva todos os dados existentes.
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES erp_companies(id) ON DELETE SET NULL;

UPDATE erp_receipts r
   SET company_id = c.company_id
  FROM erp_contracts c
 WHERE r.contract_id = c.id
   AND r.company_id IS NULL;

-- 3) Cria primeiro as novas unicidades por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_quotes_numero_company_unique
  ON erp_quotes(company_id, numero) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_service_orders_numero_company_unique
  ON erp_service_orders(company_id, numero) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_contracts_numero_company_unique
  ON erp_contracts(company_id, numero) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_receipts_numero_company_unique
  ON erp_receipts(company_id, numero) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_erp_medicoes_numero_company_unique
  ON erp_medicoes(company_id, numero) WHERE company_id IS NOT NULL;

-- 4) Remove as unicidades globais antigas em numero.
ALTER TABLE erp_quotes DROP CONSTRAINT IF EXISTS erp_quotes_numero_key;
ALTER TABLE erp_service_orders DROP CONSTRAINT IF EXISTS erp_service_orders_numero_key;
ALTER TABLE erp_contracts DROP CONSTRAINT IF EXISTS erp_contracts_numero_key;
ALTER TABLE erp_receipts DROP CONSTRAINT IF EXISTS erp_receipts_numero_key;
ALTER TABLE erp_medicoes DROP CONSTRAINT IF EXISTS erp_medicoes_numero_key;

-- 5) A função não usa mais fallback global. Sem company_id, falha cedo.
CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT, p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_start   INT;
  v_year_f  BOOLEAN;
  v_pad     INT;
  v_prefix  TEXT;
  v_ano     INT;
  v_n       INT;
  v_sigla   TEXT;
  v_sig_p   TEXT := '';
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id obrigatorio para numeracao por empresa'
      USING ERRCODE = '23502';
  END IF;

  SELECT COALESCE(start_number, 0),
         COALESCE(include_year, p_doc IN ('ORC','OS','MED')),
         COALESCE(padding, 4),
         COALESCE(prefix, CASE WHEN p_doc = 'REC_SV' THEN NULL ELSE p_doc END)
    INTO v_start, v_year_f, v_pad, v_prefix
    FROM erp_doc_settings_company
   WHERE company_id = p_company_id AND doc = p_doc;

  IF NOT FOUND THEN
    v_start := 0;
    v_year_f := p_doc IN ('ORC','OS','MED');
    v_pad := 4;
    v_prefix := CASE WHEN p_doc = 'REC_SV' THEN NULL ELSE p_doc END;
  END IF;

  SELECT UPPER(sigla) INTO v_sigla FROM erp_companies WHERE id = p_company_id;
  IF v_sigla IS NOT NULL AND v_sigla <> '' THEN
    v_sig_p := v_sigla || '-';
  END IF;

  v_ano := CASE WHEN v_year_f THEN EXTRACT(YEAR FROM CURRENT_DATE)::INT ELSE 0 END;

  INSERT INTO erp_doc_counters(doc, ano, ultimo, company_id)
       VALUES (p_doc, v_ano, v_start + 1, p_company_id)
  ON CONFLICT (company_id, doc, ano) WHERE company_id IS NOT NULL DO UPDATE
       SET ultimo = GREATEST(erp_doc_counters.ultimo + 1, EXCLUDED.ultimo)
  RETURNING ultimo INTO v_n;

  IF v_year_f THEN
    RETURN v_sig_p || COALESCE(v_prefix, p_doc) || '-' || v_ano || '-' || LPAD(v_n::TEXT, v_pad, '0');
  END IF;

  IF v_prefix IS NOT NULL AND v_prefix <> '' THEN
    RETURN v_sig_p || v_prefix || '-' || LPAD(v_n::TEXT, v_pad, '0');
  END IF;

  RETURN v_sig_p || LPAD(v_n::TEXT, v_pad, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT)
RETURNS TEXT AS $$
BEGIN
  RAISE EXCEPTION 'company_id obrigatorio para numeracao por empresa'
    USING ERRCODE = '23502';
END;
$$ LANGUAGE plpgsql;