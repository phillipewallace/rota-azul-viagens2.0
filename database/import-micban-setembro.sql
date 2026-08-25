-- ============================================================================
-- IMPORTAÇÃO ONE-SHOT: Cobrança MIC BAN — Setembro/2026 (7 contratos, R$ 14.640,00)
-- Origem: planilha "COBRANÇA 2026 MICBAN (1).xlsx" — aba SETEMBRO 26
-- (CSV "COBRANÇA_2026_MICBAN_1_SETEMBRO_26.csv" enviado pelo usuário).
--
-- Clientes: cada contrato é vinculado ao cliente (match por CNPJ normalizado,
-- depois por nome; cadastra se não existir) e grava customer_snapshot.
-- Contratos já importados sem vínculo são corrigidos via backfill.
--
-- Idempotência: cada contrato carrega a chave "[import:micban-set26#N]" em
-- observacoes. Linhas já presentes são puladas (INSERT ... WHERE NOT EXISTS).
--
-- O deploy.sh executa este arquivo UMA única vez (marca de sucesso em
-- database/.imported-micban-set26).
--
-- Observações de parsing da planilha:
--  * Metrô BH: coluna VENCIMENTO ilegível ("o]1") -> dia 10 (ajustável no ERP)
--  * Encogel: colunas deslocadas na planilha (tipo/vencimento) -> COMUM, dia 10
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
  -- -------------------------------------------------------------------------
  -- 0) Empresa emissora MIC BAN (cria se não existir)
  -- -------------------------------------------------------------------------
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

  -- -------------------------------------------------------------------------
  -- Linhas da aba SETEMBRO 26
  -- -------------------------------------------------------------------------
  FOR r IN (
    SELECT * FROM (VALUES
      (1, 'LOCALIX SERVIÇOS AMBIENTAIS LTDA', '04.567.650/0001-74',
       'Locação Mensal - Sanitário Acoplado', 1960.00, 22, DATE '2026-09-01',
       'B: SÃO JOÃO BATISTA.',
       'TOTAL DE LIMPEZAS: 28 (7 limpezas R$: 70,00) | EMITIR NOTA NO DIA 01 | EMITIR NOTA ELETRONICA | NF: 227'),
      (2, 'Construtora Terrayama Ltda', '21.681.150/0001-88',
       'Serviço de Limpeza - Sanitário de propriedade do cliente (3 un.)', 3000.00, 1, DATE '2026-09-01',
       'Rua Pastor Muryllo Cassete, 195, B: São Bernardo, Belo Horizonte - MG.',
       '750 POR LIMPEZA | EMITIR NOTA ELETRONICA | NF: 228'),
      (3, 'METRÔ BH S/A', '46.574.475/0001-92',
       'Locação Mensal - Sanitário Com Pia (1 un.)', 950.00, 10, DATE '2026-07-29',
       'rua Jacuí e em Santa Efigênia',
       'Contrato cliente: 1254/2024 | ENVIAR MEDIÇÃO | Período cobrança: 29/07/2026 a 28/08/2026 | NF: 216'),
      (4, 'METRÔ BH S/A', '46.574.475/0001-92',
       'Locação Mensal - Sanitário Com Pia (1 un.)', 950.00, 10, DATE '2026-07-29',
       'R. Conselheiro Rocha, 2900 - Santa Tereza, Belo Horizonte - MG, 31010-272',
       'Contrato cliente: 1254/2024 | ENVIAR MEDIÇÃO | Período cobrança: 29/07/2026 a 28/08/2026 | NF: 216'),
      (5, 'METRÔ BH S/A', '46.574.475/0001-92',
       'Locação Mensal - Sanitário Com Pia (1 un.)', 950.00, 10, DATE '2026-07-29',
       'RUA SAPUCAI, ESTAÇÃO CENTRAL',
       'Contrato cliente: 1254/2024 | ENVIAR MEDIÇÃO | Período cobrança: 29/07/2026 a 28/08/2026 | NF: 216'),
      (6, 'METRÔ BH S/A', '46.574.475/0001-92',
       'Locação Mensal - Sanitário Com Pia (1 un.)', 950.00, 10, DATE '2026-07-29',
       'RUA JANUÁRIA 181, ED. SEDE, CCO',
       'Contrato cliente: 1254/2024 | ENVIAR MEDIÇÃO | Período cobrança: 29/07/2026 a 28/08/2026 | NF: 216'),
      (7, 'ENCOGEL EMPRESA DE CONSTRUÇÕES GERAIS LTDA', '21.335.336/0001-85',
       'Locação Mensal - Sanitário Comum (6 un.)', 5880.00, 10, DATE '2026-08-28',
       'VENDA NOVA - GERMA',
       'ENVIAR NOTA COM 15 DIAS DE ANTECEDENCIA | ENVIAR NOTAS PARA: RUA PADRE MARINHO, 37, SANTA EFIGENIA, 30.140.040 | CENTRO DE CUSTO: 3.0001.07 | Período cobrança: 28/08/2026 a 27/09/2026 | NF: 217')
    ) AS v(idx, cliente_nome, cliente_cnpj, descricao, valor_mensal, dia_vencimento, data_inicio, endereco_obra, obs_extra)
  ) LOOP
    -- -----------------------------------------------------------------------
    -- 1) Resolve (ou cria) o cliente: match por CNPJ (só dígitos) e depois
    --    por nome (case-insensitive). Se não existir, cadastra.
    -- -----------------------------------------------------------------------
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
              '[import:micban-set26]')
      RETURNING id INTO v_customer;
      v_clientes_criados := v_clientes_criados + 1;
    ELSIF NULLIF(r.cliente_cnpj, '') IS NOT NULL THEN
      -- completa o CNPJ em cadastros antigos que estavam sem documento
      UPDATE customers
         SET document = r.cliente_cnpj, updated_at = NOW()
       WHERE id = v_customer
         AND COALESCE(btrim(document), '') = '';
    END IF;

    SELECT to_jsonb(c) INTO v_customer_snap FROM customers c WHERE c.id = v_customer;

    -- -----------------------------------------------------------------------
    -- 2) Insere o contrato já vinculado ao cliente
    -- -----------------------------------------------------------------------
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
      -- Competência inicial: respeita a data original do excel
      r.data_inicio,
      r.dia_vencimento,
      r.valor_mensal,
      TRUE,
      TRUE,
      NULLIF(r.endereco_obra, ''),
      concat_ws(' | ', NULLIF(r.obs_extra, ''),
                format('Cliente planilha: %s (CNPJ %s)', r.cliente_nome, NULLIF(r.cliente_cnpj,'')),
                format('[import:micban-set26#%s]', r.idx)),
      v_company_snap,
      v_customer_snap
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_contracts ec
       WHERE ec.observacoes LIKE format('%%[import:micban-set26#%s]%%', r.idx)
    );
    IF FOUND THEN v_inseridos := v_inseridos + 1; END IF;

    -- -----------------------------------------------------------------------
    -- 3) Backfill: contratos já importados antes (sem vínculo) são corrigidos
    -- -----------------------------------------------------------------------
    UPDATE erp_contracts ec
       SET customer_id = v_customer,
           customer_snapshot = COALESCE(ec.customer_snapshot, v_customer_snap),
           updated_at = NOW()
     WHERE ec.observacoes LIKE format('%%[import:micban-set26#%s]%%', r.idx)
       AND ec.customer_id IS DISTINCT FROM v_customer;
    IF FOUND THEN v_vinculados := v_vinculados + 1; END IF;
  END LOOP;

  RAISE NOTICE 'Importação MIC BAN set/26: % novo(s) contrato(s), % cliente(s) criado(s), % vínculo(s) corrigido(s).',
    v_inseridos, v_clientes_criados, v_vinculados;
END $$;

-- Relatório final (aparece no log do deploy)
SELECT COUNT(*) AS contratos_micban_setembro,
       COALESCE(SUM(valor_mensal), 0) AS total_mensal
  FROM erp_contracts
 WHERE COALESCE(observacoes,'') LIKE '%[import:micban-set26#%';
