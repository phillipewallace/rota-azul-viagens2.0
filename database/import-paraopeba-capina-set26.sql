-- ============================================================================
-- IMPORTACAO PARAOPEBA CAPINA - Setembro/2026
-- Idempotente: cada contrato carrega chave [paraopeba-capina-set26#N] em observacoes.
-- ============================================================================

DO $$
DECLARE
  v_company uuid;
  v_company_snap jsonb;
  v_customer uuid;
  v_customer_snap jsonb;
  r RECORD;
  v_inseridos int := 0;
  v_clientes_criados int := 0;
  v_vinculados int := 0;
BEGIN
  -- Empresa emissora MIC BAN (cria se nao existir)
  SELECT id INTO v_company
    FROM erp_companies
   WHERE regexp_replace(COALESCE(cnpj,''), '\D', '', 'g') = '42264001000193'
      OR razao_social ILIKE '%MIC%BAN%'
      OR COALESCE(nome_fantasia,'') ILIKE '%MIC%BAN%'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO erp_companies (razao_social, nome_fantasia, cnpj, ativo)
    VALUES ('MIC BAN LOCACOES & SERVICOS LTDA', 'MIC BAN', '42.264.001/0001-93', TRUE)
    RETURNING id INTO v_company;
    RAISE NOTICE 'Empresa emissora MIC BAN criada: %', v_company;
  END IF;

  SELECT to_jsonb(e) INTO v_company_snap FROM erp_companies e WHERE e.id = v_company;

  FOR r IN (
    SELECT * FROM (VALUES
      (1, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (2 un.) - ATERRO SANITÁRIO DE CONTAGEM', 3400.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'Período planilha: 10/07/2026 á 09/08/2026 | CAPINA SETEMBRO/2026'),
      (2, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (2 un.) - ATERRO SANITÁRIO DE CONTAGEM', 3400.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 30/08/2026 á 29/09/2026 | CAPINA SETEMBRO/2026'),
      (3, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 01/09/2026 á 30/09/2026 | CAPINA SETEMBRO/2026'),
      (4, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 26/08/2026 á 25/09/2026 | CAPINA SETEMBRO/2026'),
      (5, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 25/08/2026 á 24/09/2026 | CAPINA SETEMBRO/2026'),
      (6, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 21/08/2026 á 20/09/2026 | CAPINA SETEMBRO/2026'),
      (7, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 18/08/2026 á 17/09/2026 | CAPINA SETEMBRO/2026'),
      (8, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 06/08/2026 á 05/09/2026 | CAPINA SETEMBRO/2026'),
      (9, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 24/08/2026 á 23/09/2026 | CAPINA SETEMBRO/2026'),
      (10, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (3 un.) - ATERRO SANITÁRIO DE CONTAGEM', 5100.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 27/08/2026 á 26/09/2026 | CAPINA SETEMBRO/2026'),
      (11, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 03/07/2026 Á 02/08/2026 | CAPINA SETEMBRO/2026'),
      (12, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (5 un.) - ATERRO SANITÁRIO DE CONTAGEM', 8500.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 24/07/2026 Á 23/08/2026 | CAPINA SETEMBRO/2026'),
      (13, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (7 un.) - ATERRO SANITÁRIO DE CONTAGEM', 11900.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 21/07/2026 Á 20/08/2026 | CAPINA SETEMBRO/2026'),
      (14, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - ATERRO SANITÁRIO DE CONTAGEM', 1700.00, 10, DATE '2026-09-01', 'ATERRO SANITÁRIO DE CONTAGEM', 'NF: 215 | Período planilha: 19/07/2026 Á 18/08/2026 | CAPINA SETEMBRO/2026')
    ) AS v(idx, cliente_nome, cliente_cnpj, descricao, valor_mensal, dia_vencimento, data_inicio, endereco_obra, obs_extra)
  ) LOOP
    v_customer := NULL;

    IF NULLIF(r.cliente_cnpj, '') IS NOT NULL THEN
      SELECT id INTO v_customer
        FROM customers
       WHERE regexp_replace(COALESCE(document,''), '\D', '', 'g')
             = regexp_replace(r.cliente_cnpj, '\D', '', 'g')
         AND regexp_replace(COALESCE(document,''), '\D', '', 'g') <> ''
       ORDER BY created_at ASC
       LIMIT 1;
    END IF;

    IF v_customer IS NULL THEN
      SELECT id INTO v_customer
        FROM customers
       WHERE lower(btrim(COALESCE(customer_name,''))) = lower(btrim(r.cliente_nome))
       ORDER BY created_at ASC
       LIMIT 1;
    END IF;

    IF v_customer IS NULL THEN
      INSERT INTO customers (customer_name, document, person_type, address, notes)
      VALUES (btrim(r.cliente_nome),
              NULLIF(r.cliente_cnpj, ''),
              'PJ',
              NULLIF(r.endereco_obra, ''),
              '[paraopeba-capina-set26]')
      RETURNING id INTO v_customer;
      v_clientes_criados := v_clientes_criados + 1;
    ELSIF NULLIF(r.cliente_cnpj, '') IS NOT NULL THEN
      UPDATE customers
         SET document = r.cliente_cnpj, updated_at = NOW()
       WHERE id = v_customer
         AND COALESCE(btrim(document), '') = '';
    END IF;

    SELECT to_jsonb(c) INTO v_customer_snap FROM customers c WHERE c.id = v_customer;

    INSERT INTO erp_contracts
      (numero, company_id, customer_id, origem, descricao,
       data_inicio, dia_vencimento, valor_mensal,
       renovacao_automatica, ativo, endereco_obra, observacoes,
       company_snapshot, customer_snapshot)
    SELECT
      erp_next_doc_number('CTR', v_company),
      v_company,
      v_customer,
      'excel_import_setembro',
      r.descricao,
      r.data_inicio,
      r.dia_vencimento,
      r.valor_mensal,
      TRUE,
      TRUE,
      NULLIF(r.endereco_obra, ''),
      concat_ws(' | ', NULLIF(r.obs_extra, ''),
                format('Cliente planilha: %s (CNPJ %s)', r.cliente_nome, NULLIF(r.cliente_cnpj,'')),
                format('[paraopeba-capina-set26#%s]', r.idx)),
      v_company_snap,
      v_customer_snap
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_contracts ec
       WHERE ec.observacoes LIKE format('%%[paraopeba-capina-set26#%s]%%', r.idx)
    );
    IF FOUND THEN v_inseridos := v_inseridos + 1; END IF;

    UPDATE erp_contracts ec
       SET customer_id = v_customer,
           customer_snapshot = COALESCE(ec.customer_snapshot, v_customer_snap),
           updated_at = NOW()
     WHERE ec.observacoes LIKE format('%%[paraopeba-capina-set26#%s]%%', r.idx)
       AND ec.customer_id IS DISTINCT FROM v_customer;
    IF FOUND THEN v_vinculados := v_vinculados + 1; END IF;
  END LOOP;

  RAISE NOTICE 'IMPORTACAO PARAOPEBA CAPINA - Setembro/2026: % novo(s) contrato(s), % cliente(s) criado(s), % vinculo(s) corrigido(s).',
    v_inseridos, v_clientes_criados, v_vinculados;
END $$;

-- Relatorio final
SELECT COUNT(*) AS contratos_paraopeba_capina_set26,
       COALESCE(SUM(valor_mensal), 0) AS total_mensal
  FROM erp_contracts
 WHERE COALESCE(observacoes,'') LIKE '%[paraopeba-capina-set26#%';
