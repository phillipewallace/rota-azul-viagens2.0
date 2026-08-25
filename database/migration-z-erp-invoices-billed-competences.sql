-- ============================================================
-- ERP · Competências efetivamente faturadas por Nota Fiscal.
--
-- Mantém a competência de cobrança explícita e independente da data de
-- emissão do documento. A carga inicial preserva exatamente a competência
-- já registrada na NF; casos sem evidência segura não são movidos de mês.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS erp_invoice_billed_competences (
  invoice_id UUID NOT NULL REFERENCES erp_invoices(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES erp_contracts(id) ON DELETE CASCADE,
  competencia CHAR(7) NOT NULL,
  reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (invoice_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_invoice_billed_competences TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_invoice_billed_comp_contract_comp
  ON erp_invoice_billed_competences(contract_id, competencia);

-- Corrige automaticamente o caso produzido pelo antigo diálogo da Regra dos
-- 10: a linha era do mês seguinte, mas a NF recebia o mês selecionado no topo.
-- A movimentação só ocorre para NFs recentes e com evidência inequívoca:
--   a) o primeiro faturamento do contrato é justamente o mês seguinte; OU
--   b) o mês gravado já estava quitado por recibo.
-- O destino também precisa estar livre. `reconciled=TRUE` impede novo avanço.
WITH candidates AS (
  SELECT i.id AS invoice_id,
         i.contract_id,
         i.competencia AS old_competencia,
         TO_CHAR((i.competencia || '-01')::date + INTERVAL '1 month', 'YYYY-MM') AS new_competencia
    FROM erp_invoices i
    JOIN erp_contracts c ON c.id = i.contract_id
   WHERE i.status = 'ativa'
     AND i.created_at >= TIMESTAMPTZ '2026-08-24 00:00:00+00'
     AND COALESCE(c.tipo_contrato, 'locacao') <> 'evento'
     AND NOT EXISTS (
       SELECT 1 FROM erp_invoice_billed_competences done
        WHERE done.invoice_id = i.id AND done.reconciled = TRUE
     )
     AND (
       c.primeira_competencia = TO_CHAR((i.competencia || '-01')::date + INTERVAL '1 month', 'YYYY-MM')
       OR EXISTS (
         SELECT 1 FROM erp_receipt_billed_competences rbc
          WHERE rbc.contract_id = i.contract_id
            AND rbc.competencia = i.competencia
       )
     )
     AND NOT EXISTS (
       SELECT 1 FROM erp_receipt_billed_competences rbc
        WHERE rbc.contract_id = i.contract_id
          AND rbc.competencia = TO_CHAR((i.competencia || '-01')::date + INTERVAL '1 month', 'YYYY-MM')
     )
     AND NOT EXISTS (
       SELECT 1 FROM erp_invoices other
        WHERE other.contract_id = i.contract_id
          AND other.competencia = TO_CHAR((i.competencia || '-01')::date + INTERVAL '1 month', 'YYYY-MM')
          AND other.status = 'ativa'
          AND other.id <> i.id
     )
), moved AS (
  UPDATE erp_invoices i
     SET competencia = c.new_competencia,
         updated_at = NOW()
    FROM candidates c
   WHERE i.id = c.invoice_id
  RETURNING i.id, i.contract_id, i.competencia
)
INSERT INTO erp_invoice_billed_competences
  (invoice_id, contract_id, competencia, reconciled)
SELECT id, contract_id, competencia, TRUE
  FROM moved
ON CONFLICT (invoice_id, competencia)
DO UPDATE SET contract_id = EXCLUDED.contract_id, reconciled = TRUE;

-- Reconcilia todas as NFs históricas sem alterar o mês originalmente salvo.
INSERT INTO erp_invoice_billed_competences
  (invoice_id, contract_id, competencia, reconciled)
SELECT i.id, i.contract_id, i.competencia, TRUE
  FROM erp_invoices i
ON CONFLICT (invoice_id, competencia)
DO UPDATE SET contract_id = EXCLUDED.contract_id;

-- Diagnóstico seguro para revisão manual: NFs cuja competência não coincide
-- com a emissão. A diferença pode ser legítima, portanto não há UPDATE cego.
SELECT COUNT(*) AS invoices_competencia_diferente_da_emissao
  FROM erp_invoices
 WHERE competencia <> TO_CHAR(data_emissao, 'YYYY-MM');