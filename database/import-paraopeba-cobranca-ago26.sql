-- ============================================================================
-- IMPORTACAO PARAOPEBA COBRANCA - Agosto/2026 adaptado Setembro/2026
-- Idempotente: cada contrato carrega chave [paraopeba-cobranca-ago26#N] em observacoes.
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
      (1, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - RUA JATOBA 242 , VALE DO SERENO - NOVA LIMA', 1500.00, 10, DATE '2026-09-01', 'RUA JATOBA 242 , VALE DO SERENO - NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 18/08/2026 á 17/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (2, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - BANDEIRINHAS -BETIM -PREMOLDADOS SAMPAIO', 1500.00, 10, DATE '2026-09-01', 'BANDEIRINHAS -BETIM -PREMOLDADOS SAMPAIO', 'ENCARREGADO ADRIANO | NF: 207 | Período planilha: 16/08/2026 á 15/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (3, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - RUA MARIA DA CONCEIÇÃO DE SÃO JOSÉ 281, CENTRO ,CONTAGEM MG-', 980.00, 10, DATE '2026-09-01', 'RUA MARIA DA CONCEIÇÃO DE SÃO JOSÉ 281, CENTRO ,CONTAGEM MG- 32041-290', 'ENCARREGADO | NF: 212 | Período planilha: 23/08/2026 á 22/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (4, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - RUA MONTE CASTELO 1784 , VILA REAL (JUSTINOPOLIS) RIBEIRÃO D', 980.00, 10, DATE '2026-09-01', 'RUA MONTE CASTELO 1784 , VILA REAL (JUSTINOPOLIS) RIBEIRÃO DAS NEVES', 'ENCARREGADO YURE | NF: 211 | Período planilha: 01/09/2026 á 30/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (5, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - Pousada Mar Mineiro, Estrada da Servidão, 71 - Macacos, Nova', 1500.00, 10, DATE '2026-09-01', 'Pousada Mar Mineiro, Estrada da Servidão, 71 - Macacos, Nova Lima - MG, 34019-899', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 18/08/2026 á 17/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (6, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - RUA SAPUCAI 74 , VALE DO SERENO ,NOVA LIMA/MG', 1400.00, 10, DATE '2026-09-01', 'RUA SAPUCAI 74 , VALE DO SERENO ,NOVA LIMA/MG', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 02/09/2026 á 01/10/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (7, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - GARUJÁ MANSÕES', 1300.00, 10, DATE '2026-09-01', 'GARUJÁ MANSÕES', 'ENCARREGADO MAGNO | NF: 210 | Período planilha: 30/08/2026 á 29/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (8, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - RUA DA VEREDA ,NOVA LIMA ,VILA DA SERRA', 1300.00, 10, DATE '2026-09-01', 'RUA DA VEREDA ,NOVA LIMA ,VILA DA SERRA', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 15/07/2026 á 14/08/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (9, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (2 un.) - RUA WALTER DIAS RIBEIRO 41,VIENA,JUSTINOPOLIS ,RIBEIRÃO DAS ', 1960.00, 10, DATE '2026-09-01', 'RUA WALTER DIAS RIBEIRO 41,VIENA,JUSTINOPOLIS ,RIBEIRÃO DAS NEVES', 'ENCARREGADO YURE | NF: 211 | Período planilha: 09/08/2026 á 08/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (10, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - Local: R. Cinco, 300-561 - Chácara São Geraldo, Contagem -', 1200.00, 10, DATE '2026-09-01', 'Local: R. Cinco, 300-561 - Chácara São Geraldo, Contagem -', 'NF: 214 | Período planilha: 09/08/2026 á 08/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (11, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - Rua Levi Diniz Costa, Quinta Coloniais, Contagem -MG.', 1300.00, 10, DATE '2026-09-01', 'Rua Levi Diniz Costa, Quinta Coloniais, Contagem -MG.', 'ENCARREGADO IGOR MONTE VERDE | NF: 208 | Período planilha: 05/09/2026 á 04/10/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (12, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - Rua Cinco, 23, Chácaras São Geraldo, Contagem -MG.', 1300.00, 10, DATE '2026-09-01', 'Rua Cinco, 23, Chácaras São Geraldo, Contagem -MG.', 'ENCARREGADO IGOR MONTE VERDE | NF: 209 | Período planilha: 05/09/2026 á 04/10/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (13, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (4 un.) - RUA DOS ARTIFICES 63 ,A DEFINIR EM CAMPO , AGUA LIMPA', 5200.00, 10, DATE '2026-09-01', 'RUA DOS ARTIFICES 63 ,A DEFINIR EM CAMPO , AGUA LIMPA', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 25/08/2026 á 24/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (14, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - AGUA LIMPA NOVA LIMA', 1300.00, 10, DATE '2026-09-01', 'AGUA LIMPA NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 21/08/2026 á 20/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (15, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - BETIM-MG', 1300.00, 10, DATE '2026-09-01', 'BETIM-MG', 'ENCARREGADO DEMETRIUS | NF: 206 | Período planilha: 09/08/2026 á 08/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (16, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (1 un.) - VALE DAS ACACIAS ,RIBEIRÃO DAS NEVES', 1300.00, 10, DATE '2026-09-01', 'VALE DAS ACACIAS ,RIBEIRÃO DAS NEVES', 'ENCARREGADO YURE | NF: 211 | Período planilha: 10/08/2026 á 09/09/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026'),
      (17, 'CONSTRUTORA DRAGAGEM PARAOPEBA LTDA', '18.322.925/0001-14', 'Locação Mensal - Sanitário Comum (3 un.) - AGUA LIMPA NOVA LIMA', 3900.00, 10, DATE '2026-09-01', 'AGUA LIMPA NOVA LIMA', 'ENCARREGADO DEMETRIUS | NF: 205 | Período planilha: 01/08/2026 á 30/08/2026 | COBRANCA AGOSTO/2026 adaptado para SETEMBRO/2026')
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
              '[paraopeba-cobranca-ago26]')
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
                format('[paraopeba-cobranca-ago26#%s]', r.idx)),
      v_company_snap,
      v_customer_snap
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_contracts ec
       WHERE ec.observacoes LIKE format('%%[paraopeba-cobranca-ago26#%s]%%', r.idx)
    );
    IF FOUND THEN v_inseridos := v_inseridos + 1; END IF;

    UPDATE erp_contracts ec
       SET customer_id = v_customer,
           customer_snapshot = COALESCE(ec.customer_snapshot, v_customer_snap),
           updated_at = NOW()
     WHERE ec.observacoes LIKE format('%%[paraopeba-cobranca-ago26#%s]%%', r.idx)
       AND ec.customer_id IS DISTINCT FROM v_customer;
    IF FOUND THEN v_vinculados := v_vinculados + 1; END IF;
  END LOOP;

  RAISE NOTICE 'IMPORTACAO PARAOPEBA COBRANCA - Agosto/2026 adaptado Setembro/2026: % novo(s) contrato(s), % cliente(s) criado(s), % vinculo(s) corrigido(s).',
    v_inseridos, v_clientes_criados, v_vinculados;
END $$;

-- Relatorio final
SELECT COUNT(*) AS contratos_paraopeba_cobranca_ago26,
       COALESCE(SUM(valor_mensal), 0) AS total_mensal
  FROM erp_contracts
 WHERE COALESCE(observacoes,'') LIKE '%[paraopeba-cobranca-ago26#%';
