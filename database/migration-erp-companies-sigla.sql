-- Sigla curta por empresa (aparece prefixando os números de documentos)
-- Ex.: MIC-ORC-2026-0001, DSR-REC-0001
BEGIN;

ALTER TABLE erp_companies
  ADD COLUMN IF NOT EXISTS sigla TEXT;

-- Limita formato quando preenchida (1 a 6 chars, letras/numeros/_-)
ALTER TABLE erp_companies
  DROP CONSTRAINT IF EXISTS erp_companies_sigla_chk;
ALTER TABLE erp_companies
  ADD CONSTRAINT erp_companies_sigla_chk
  CHECK (sigla IS NULL OR sigla ~ '^[A-Za-z0-9_-]{1,6}$');

-- Numeração: prefixa com sigla da empresa quando existir.
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

COMMIT;
