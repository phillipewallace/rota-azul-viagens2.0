-- ============================================================================
-- Importação one-shot: Contratos MIC BAN — Agosto/2026 (6 contratos, R$ 8.010,00)
-- Rodada automaticamente pelo deploy.sh (passo 4.1).
-- 100% idempotente: cada linha tem uma chave única gravada em observacoes
-- ([import:micban-ago26#N]) — rodar N vezes nunca duplica.
-- Usa apenas colunas garantidas pelo schema (sem metadata/document em companies).
-- ============================================================================

DO $$
DECLARE
  v_company_id UUID;
  v_customer_id UUID;
  v_numero TEXT;
  v_key TEXT;
  v_inserted INT := 0;
  r RECORD;
BEGIN
  -- ── 1) Empresa emissora MIC BAN ───────────────────────────────────────────
  SELECT id INTO v_company_id
    FROM public.erp_companies
   WHERE regexp_replace(COALESCE(cnpj,''), '\D', '', 'g') = '42264001000193'
      OR razao_social ILIKE '%MIC%BAN%'
      OR nome_fantasia ILIKE '%MIC%BAN%'
   ORDER BY created_at
   LIMIT 1;

  IF v_company_id IS NULL THEN
    INSERT INTO public.erp_companies (razao_social, nome_fantasia, cnpj, ativo)
    VALUES ('MIC BAN LOCACOES & SERVICOS LTDA', 'MIC BAN', '42.264.001/0001-93', TRUE)
    RETURNING id INTO v_company_id;
    RAISE NOTICE 'Empresa MIC BAN criada: %', v_company_id;
  END IF;

  -- ── 2) Contratos de Agosto/2026 ───────────────────────────────────────────
  FOR r IN
    SELECT * FROM (VALUES
      (1, 'FLAT ENGENHARIA E CONSTRUCAO LTDA',            '22.091.248/0001-04', 'Locação Mensal - Sanitário Comum (1 un.)',                                   1100.00, 15, DATE '2026-08-01'),
      (2, 'FLAT ENGENHARIA E CONSTRUCAO LTDA',            '22.091.248/0001-04', 'Locação Mensal - Sanitário Comum (1 un.)',                                   1100.00, 15, DATE '2026-08-01'),
      (3, 'CONSTRUTORA SERVCOPA',                         '21.054.432/0001-07', 'Locação Mensal - Sanitário Comum (1 un.)',                                   1960.00, 22, DATE '2026-08-01'),
      (4, 'CONSTRUTORA RNV',                              '07.135.295/0001-37', 'Aluguel de Carretinha (4 un.) - Placas RGD9D72, RGD9D70, RGD9D71, RTK6A34',   2000.00, 10, DATE '2026-08-01'),
      (5, 'CONSTRUTORA RNV',                              '07.135.295/0001-37', 'Locação Mensal - Sanitário Comum (1 un.)',                                   1400.00, 10, DATE '2026-08-01'),
      (6, 'SUPERMERCADOS BH COMERCIO DE ALIMENTOS S/A',   '04.641.376/0001-36', 'Locação Mensal - Sanitário Comum (1 un.)',                                    450.00, 20, DATE '2026-08-01')
    ) AS t(idx, cliente, doc, descricao, valor, venc, data_referencia)
  LOOP
    v_key := '[import:micban-ago26#' || r.idx || ']';

    -- já importado? pula
    IF EXISTS (
      SELECT 1 FROM public.erp_contracts
       WHERE COALESCE(observacoes,'') LIKE '%' || v_key || '%'
    ) THEN
      CONTINUE;
    END IF;

    -- cliente (busca por CNPJ normalizado, depois por nome)
    SELECT id INTO v_customer_id
      FROM public.customers
     WHERE regexp_replace(COALESCE(document,''), '\D', '', 'g') = regexp_replace(r.doc, '\D', '', 'g')
     LIMIT 1;

    IF v_customer_id IS NULL THEN
      SELECT id INTO v_customer_id
        FROM public.customers
       WHERE customer_name ILIKE split_part(r.cliente, ' ', 1) || '%'
         AND customer_name ILIKE '%' || split_part(r.cliente, ' ', 2) || '%'
       LIMIT 1;
    END IF;

    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (customer_name, document, person_type)
      VALUES (r.cliente, r.doc, 'PJ')
      RETURNING id INTO v_customer_id;
    END IF;

    -- número do contrato: usa o numerador do ERP; se falhar, gera manualmente
    BEGIN
      SELECT erp_next_doc_number('CTR', v_company_id) INTO v_numero;
    EXCEPTION WHEN OTHERS THEN
      v_numero := NULL;
    END;

    IF v_numero IS NULL OR EXISTS (SELECT 1 FROM public.erp_contracts WHERE numero = v_numero) THEN
      v_numero := 'CTR-AGO26-' || lpad(r.idx::TEXT, 3, '0');
      WHILE EXISTS (SELECT 1 FROM public.erp_contracts WHERE numero = v_numero) LOOP
        v_numero := v_numero || '-B';
      END LOOP;
    END IF;

    INSERT INTO public.erp_contracts
      (numero, company_id, customer_id, origem, descricao, data_inicio,
       dia_vencimento, valor_mensal, renovacao_automatica, ativo, observacoes)
    VALUES
      (v_numero, v_company_id, v_customer_id, 'sistema', r.descricao, r.data_referencia,
       r.venc, r.valor, TRUE, TRUE, 'Importação Excel Agosto/2026 ' || v_key);

    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'MIC BAN Agosto/2026 — contratos inseridos nesta execução: %', v_inserted;
END $$;

-- Relatório final (aparece no log do deploy)
SELECT COUNT(*) AS contratos_micban_agosto,
       COALESCE(SUM(valor_mensal), 0) AS total_mensal
  FROM public.erp_contracts
 WHERE COALESCE(observacoes,'') LIKE '%[import:micban-ago26#%';
