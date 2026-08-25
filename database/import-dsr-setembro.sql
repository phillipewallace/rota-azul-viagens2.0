-- ============================================================================
-- IMPORTAÇÃO ONE-SHOT: Cobrança DSR — Setembro/2026 (aba SETEMBRO 26, 29 linhas)
-- Origem: planilha "COBRANÇA DSR - 2026 (1).xlsx" enviada pelo usuário.
--
-- Idempotência: cada contrato carrega a chave "[import:dsr-set26#N]" em
-- observacoes. Linhas já presentes são puladas (INSERT ... WHERE NOT EXISTS),
-- então o script pode rodar mais de uma vez sem duplicar.
--
-- O deploy.sh executa este arquivo UMA única vez (marca de sucesso em
-- database/.imported-dsr-set26).
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
  SELECT id INTO v_company
    FROM erp_companies
   WHERE ativo IS TRUE
     AND (razao_social ILIKE '%DSR%' OR COALESCE(nome_fantasia,'') ILIKE '%DSR%')
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Empresa emissora DSR não encontrada em erp_companies. Importação abortada.';
  END IF;

  SELECT to_jsonb(e) INTO v_company_snap FROM erp_companies e WHERE e.id = v_company;


  FOR r IN (
    SELECT * FROM (VALUES
      (1, 'GUSTAVO', '', 'Serviço de Caminhão Pipa', 15000.00, 10, DATE '2026-07-09', '', 'Período cobrança: 09/07/26 á 08/08/26'),
      (2, 'GND CONSTRUÇÕES LTDA', '04.569.147/0001-58', 'Locação Mensal - Sanitário Comum (1 un.)', 1100.00, 10, DATE '2026-01-26', 'RUA DOLOTITA 120 , VILA MAGNESITA PROOXIMO A VILMA', 'NF: 572 | Período cobrança: 26/08/26 Á 25/09/26'),
      (3, 'DM CONSTRUÇÕES E COMÉRFCIO LTDA', '24.669.434/0001-47', 'Locação Mensal - Sanitário Comum (3 un.)', 3000.00, 10, DATE '2026-04-17', 'REGIÃO DO VILA PEROLA, PEDIR LOCALIZAÇÃO.', 'tirar notas junto, tem uma no sitema | NF: 88-604 | Período cobrança: 17/08/26 á 16/09/26'),
      (4, 'CONSERVASOLO ENGENHARIA DE PROJETOS E CONSULTORIA TÉC. LTDA', '21.728.225/0001-39', 'Locação Mensal - Sanitário Comum (1 un.)', 980.00, 10, DATE '2026-08-01', 'ORDEM DE COMPRA : 400 CNO: 90.015.89629/71 Rua Primordial Nº 99, Olaria do Barreiro', 'TRANFERIDO DA ,ROD ANEL RODOVIARIO CELSO MELLO AZEVEDO ,KM231 ,SÃO FRANCISCO ,BELO HORIZONTE Dia 29/04/26 | NF: 594 | Período cobrança: 16/08/26 Á 15/09/26'),
      (5, 'GPO Mercantil e Engenharia Ltda', '06.964.275/0001-21', 'Locação Mensal - Sanitário Comum (1 un.)', 980.00, 10, DATE '2026-03-09', 'AV. CRISTIANO MACHADO (REF. CATEDRAL CRISTO REI) - AO LADO DO MCDONALD´S SENTIDO BELO HORIZONTE/LAGOA SANTA', 'NF: 573 | Período cobrança: 09/08/26 Á 08/09/26'),
      (6, 'BAIKAL CONSTRUÇÕES', '10.714.060/0001-20', 'Locação Mensal - Sanitário Comum (1 un.)', 1300.00, 10, DATE '2026-01-27', 'RUA SENADOR GIOVANNI AGNELLI, 906 CEP 32681 - 080 - BETIM - MG', 'NF: 597 | Período cobrança: 27/08/2026 Á 26/09/2026'),
      (7, 'AMM CONSTRUCOES LTDA', '51.525.945/0001-68', 'Locação Mensal - Sanitário Comum (1 un.)', 800.00, 10, DATE '2026-02-04', 'Endereço da obra: Praça Afonso Arinos - Poliedrico', 'ENVIAR RECIBO E BOLETO POR EMAIL E WHATZAPP TIRAR NOTAS JUNTOS | NF: 598 | Período cobrança: 04/09/2026 Á 03/10/2026'),
      (8, 'GABIOTEC PROJETOS E CONSTRUÇÕES LTDA', '16.535.155/0001-62', 'Locação Mensal - Sanitário Comum (1 un.)', 1150.00, 10, DATE '2026-02-23', 'RUA REDELVIM ANDRADE ,300 ,HORTO ,BETIM -MG, CEP:32.604.142', 'NF: 577 | Período cobrança: 23/08/2026 22/09/2026'),
      (9, 'CONSTRUTORA REMO LTDA', '18.225.557/0001-96', 'Locação Mensal - Sanitário Com Pia (2 un.)', 1700.00, 10, DATE '2026-02-20', 'RUA URUGUAI ,55 ,B: INDUSTRIAL,CONTAGEM/MG', 'NF: 578 | Período cobrança: 20/08/2026 Á 19/09/2026'),
      (10, 'construtora nexo ltda', '38.417.301/0001-98', 'Locação Mensal - Sanitário Comum (1 un.)', 800.00, 10, DATE '2026-01-16', 'PRAÇA SILVINO HOYOS PILOTO , LOCALIZADA NA RUA OSÔRIO DUQUE ESTRADA ,131 ,B:CAMPO ALEGRE ,REGIÃO DA PAMPULHA', 'NF: 579 | Período cobrança: 16/07/2026 Á 15/08/2026'),
      (11, 'CONSERVASOLO ENGENHARIA DE PROJETOS E CONSULTORIA TÉC. LTDA', '21.728.225/0001-39', 'Locação Mensal - Sanitário Comum (1 un.)', 980.00, 10, DATE '2026-08-01', 'ORDEM DE COMPRA : 426 CNO: 90.015.89629/71 ,R Blumenau ,Bairro: Copacabana n°67 Horizonte - MG', '/TRANSFERIDO DA RUA OLARIA DO BARREIRO 464 ,OLARIA ,BELO HORIZONTE/MG ,DIA 16/06/26 | NF: 595 | Período cobrança: 23/08/26 Á 22/09/26'),
      (12, 'Engecon Engenharia e Comércio LTDA', '16.594.889/0001-12', 'Locação Mensal - Sanitário Comum (5 un.)', 4900.00, 10, DATE '2025-08-21', 'FINAL DA ANDRADAS POMPEIA', 'TIRAR NOTA JUNTO FECHADO POR FLAVIANO ENVIAR NOTA COM 15 DIAS DE ANTECENDENCIA | NF: 580 | Período cobrança: 21/08/2026 20/09/2026'),
      (13, 'CONSORCIO INOVA CONTAGEM', '58.374.852/0001-29', 'Locação Mensal - Sanitário Comum (2 un.)', 1960.00, 10, DATE '2025-08-27', 'COLOCAR CNO NA NOTA 90.023.69123/77 ORDEM DE COMPRA:387 VIA EXPRESSA DE CONTAGEM 1501 ,CONJ AGUA BRANCA ,PARQUE INDUSTRIAL ,CONTAGEM', 'SO PODE TIRAR NOTA QUANDO O PERIODO SE ENCERRAR 15 DIAS PARA PAGAMENTO APÓS A EMISSÃO DO BOLETO EMITIR UM BOLETO PARA CADA NOTA | NF: 89-605 | Período cobrança: 08/08/26 Á 07/09/26'),
      (14, 'SINGULARE ENGENHARIA E ARQUITETURA LTDA', '47.306.420/0001-64', 'Locação Mensal - Sanitário Rede de Esgoto (1 un.)', 750.00, 10, DATE '2025-07-29', 'RUA ALAMEDA DAS JABOTICABEIRAS ,150 ,CONDOMINIO ESTÂNCIA SAN REMO ,CONTAGEM', 'NF: 599 | Período cobrança: 29/08/2026 Á 28/09/26'),
      (15, 'CONSORCIO INOVA CONTAGEM', '58.374.852/0001-29', 'Locação Mensal - Sanitário Comum (2 un.)', 1960.00, 10, DATE '2025-07-22', 'COLOCAR CNO NA NOTA 90.023.69123/77 ORDEM DE COMPRA:194 VIA EXPRESSA DE CONTAGEM 1501 ,CONJ AGUA BRANCA ,PARQUE INDUSTRIAL ,CONTAGEM', 'SO PODE TIRAR NOTA QUANDO O PERIODO SE ENCERRAR 15 DIAS PARA PAGAMENTO APÓS A EMISSÃO DO BOLETO EMITIR UM BOLETO PARA CADA NOTA | NF: 89-605 | Período cobrança: 08/08/26 Á 07/09/26'),
      (16, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (2 un.)', 3000.00, 10, DATE '2026-02-20', 'OBRA:423 PEDIDO DE COMPRA:68770 RUA ARTHUR CAMPOS ,1037 ,PARQUE ESTRELA DO SUL , IBIRITE-MG', 'TIRAR TODAS NOTAS DA OBRA 423 JUNTAS 20 DIAS PARA PAGAMENTO | Contrato cliente: 90131/2025 | NF: 581 | Período cobrança: 20/08/26 Á 19/09/26'),
      (17, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (1 un.)', 1500.00, 10, DATE '2026-02-23', 'OBRA:423 PEDIDO DE COMPRA:68770 RUA ARTHUR CAMPOS ,1037 ,PARQUE ESTRELA DO SUL , IBIRITE-MG', 'TIRAR TODAS NOTAS DA OBRA 423 JUNTAS 20 DIAS PARA PAGAMENTO | Contrato cliente: 90131/2025 | NF: 581 | Período cobrança: 23/08/26 Á 22/09/26'),
      (18, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (1 un.)', 1250.00, 10, DATE '2025-07-02', 'PEDIDO DE COMPRA:59887 RODOVIA MG 030,KM 25 , N°20,CHACARA BOM RETIRO , NOVA LIMA-MG', 'TIRAR TODAS NOTAS DA OBRA 406 JUNTAS 20 DIAS PARA PAGAMENTO | Contrato cliente: 90131/2025 | NF: 582 | Período cobrança: 02/09/26 Á 01/10/26'),
      (19, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (2 un.)', 2500.00, 10, DATE '2025-07-21', 'RODOVIA JOSÉ FRANCISCO DA SILVA 20 ,CHACARA BOM RETIRO , NOVA LIMA-MG', 'TIRAR TODAS NOTAS DA OBRA 406 JUNTAS 20 DIAS PARA PAGAMENTO | NF: 582 | Período cobrança: 21/08/26 Á 20/09/26'),
      (20, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (2 un.)', 2500.00, 10, DATE '2025-07-17', 'OBRA 406 RODOVIA JOSÉ FRANCISCO DA SILVA 20 ,CHACARA BOM RETIRO , NOVA LIMA-MG', 'TIRAR TODAS NOTAS DA OBRA 406 JUNTAS 20 DIAS PARA PAGAMENTO | NF: 582 | Período cobrança: 17/08/26 Á 16/09/26'),
      (21, 'CONSERVASOLO ENGENHARIA DE PROJETOS E CONSULTORIA TÉC. LTDA', '21.728.225/0001-39', 'Locação Mensal - Sanitário Comum (1 un.)', 980.00, 10, DATE '2025-07-29', 'CNO 90.015.89629/71 - Endereço da obra: ORDEM DE COMPRA:433: RUA BERNARDINO OLIVEIRA PENA 245 , B: SÃO JOÃO BATISTA', 'TRANFERIDO DA AV TEREZA CRISTINA ,118 ,CIDADE INDUSTRIAL ,BELO HORIZONTE-MG BACIA DO INDUSTRIAL PARA RUA BERNARDINO OLIVEIRA PENA 245 , B: SÃO JOÃO BATISTA | NF: 596 | Período cobrança: 29/08/26 Á 28/09/26'),
      (22, 'CITY SOL SERVIÇOS DE MANUTENÇÃO', '35.139.148/0001-96', 'Locação Mensal - Sanitário Comum (2 un.)', 1960.00, 10, DATE '2026-08-01', 'CNO/CEI DA OBRA: 90.022.38699/78 RUA DAS CONTENDAS 1980 , CHACARAS CAMPESTRE ,CONTAGEM/MG', 'CADASTRO ERA EM NOME DA TIVIOLI /BOLETO PARA 28 DIAS A POS EMISSÃO DO BOLETO TIRAR NOTAS JUNTO | NF: 90-606 | Período cobrança: 23/08/2026 22/09/2026'),
      (23, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (5 un.)', 6250.00, 10, DATE '2025-05-29', 'PROXIMO A RODOVIA JOSÉ FRANCISCO DA SILVA 74, PADRE OSVALDO B PENA ,NOVA LIMA/MG', 'TIRAR TODAS NOTAS DA OBRA 406 JUNTAS 20 DIAS PARA PAGAMENTO | NF: 582 | Período cobrança: 29/08/26 Á 28/09/26'),
      (24, 'ENG APOIO ADMINISTRATIVO LTDA', '30.624.331/0001-63', 'Locação Mensal - Sanitário Comum (1 un.)', 980.00, 10, DATE '2025-04-02', 'LOCALIZAÇÃO ,PROX A BR040', 'Contrato cliente: 90171-2025 | NF: 587 | Período cobrança: 02/08/2026 á 01/09/2026'),
      (25, 'GPO Mercantil e Engenharia Ltda', '06.964.275/0001-21', 'Locação Mensal - Sanitário Comum (2 un.)', 1960.00, 10, DATE '2025-02-27', 'PEDIR LOCALIZAÇÃO. BANHEIRO ESTÁ NA REGIÃO DO BARREIRO.', 'PASSOU PARA DUAS LIMPEZAS DIAS 10/10/25 | Contrato cliente: 90168-2025 | NF: 574 | Período cobrança: 27/07 Á 26/08'),
      (26, 'GPO Mercantil e Engenharia Ltda', '06.964.275/0001-21', 'Locação Mensal - Sanitário Comum (1 un.)', 980.00, 10, DATE '2025-04-09', 'RUA DOUTOR AGUINALDO MONTEIRO, 215, B: CASTELO.', 'Contrato cliente: 90168-2025 | NF: 575 | Período cobrança: 09/08/2026 á 08/09/2026'),
      (27, 'CONSTRUTORA SINARCO LTDA', '03.367.118/0001-40', 'Locação Mensal - Sanitário Comum (18 un.)', 22500.00, 10, DATE '2025-02-27', 'RODOVIA MG 030,KM 25 , N°20,CHACARA BOM RETIRO , NOVA LIMA-MG', 'OBRA 342 TIRAR NOTAS JUNTO 20 DIAS PARA PAGAMENTO | Contrato cliente: 90131/2025 | NF: 583 | Período cobrança: 27/08/26 Á 26/09/26'),
      (28, 'Gontijo, serviços, locações e construções Ltda', '04.440.422/0001-39', 'Locação Mensal - Sanitário Comum (1 un.)', 800.00, 14, DATE '2024-10-16', 'Endereço: Rua P, 245 - Conj. Confisco, Contagem - MG, 31360-580', 'NF: 87-603 | Período cobrança: 16/08 Á 15/09/2026'),
      (29, 'Progeter Serviços e Consultoria Ltda', '07.985.926/0001-22', 'Locação de Carretinha', 800.00, 10, DATE '2026-08-01', 'CLIENTE BUSCOU NO GALPÃO', 'NF: 601 | Período cobrança: 08/08/2026 Á 07/09/2026')
    ) AS v(idx, cliente_nome, cliente_cnpj, descricao, valor_mensal, dia_vencimento, data_inicio, endereco_obra, obs_extra)
  ) LOOP
    -- ---------------------------------------------------------------------
    -- 1) Resolve (ou cria) o cliente: match por CNPJ (só dígitos) e depois
    --    por nome (case-insensitive). Se não existir, cadastra.
    -- ---------------------------------------------------------------------
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
              '[import:dsr-set26]')
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

    -- ---------------------------------------------------------------------
    -- 2) Insere o contrato já vinculado ao cliente
    -- ---------------------------------------------------------------------
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
                format('[import:dsr-set26#%s]', r.idx)),
      v_company_snap,
      v_customer_snap
    WHERE NOT EXISTS (
      SELECT 1 FROM erp_contracts ec
       WHERE ec.observacoes LIKE format('%%[import:dsr-set26#%s]%%', r.idx)
    );
    IF FOUND THEN v_inseridos := v_inseridos + 1; END IF;

    -- ---------------------------------------------------------------------
    -- 3) Backfill: contratos já importados antes (sem vínculo) são corrigidos
    -- ---------------------------------------------------------------------
    UPDATE erp_contracts ec
       SET customer_id = v_customer,
           customer_snapshot = COALESCE(ec.customer_snapshot, v_customer_snap),
           updated_at = NOW()
     WHERE ec.observacoes LIKE format('%%[import:dsr-set26#%s]%%', r.idx)
       AND ec.customer_id IS DISTINCT FROM v_customer;
    IF FOUND THEN v_vinculados := v_vinculados + 1; END IF;
  END LOOP;

  RAISE NOTICE 'Importação DSR set/26: % novo(s) contrato(s), % cliente(s) criado(s), % vínculo(s) corrigido(s).',
    v_inseridos, v_clientes_criados, v_vinculados;
END $$;
