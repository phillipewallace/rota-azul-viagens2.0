-- ============================================================
-- ERP · Competências efetivamente faturadas por recibo.
--
-- A tabela elimina ambiguidades entre a competência da cobrança e o período
-- apenas descritivo exibido no PDF. Também reconcilia os recibos históricos
-- que foram gravados com o mês inicial de um período que termina no mês
-- faturado. Idempotente e sem alterar/excluir recibos existentes.
-- ============================================================

CREATE TABLE IF NOT EXISTS erp_receipt_billed_competences (
  contract_id UUID NOT NULL REFERENCES erp_contracts(id) ON DELETE CASCADE,
  competencia CHAR(7) NOT NULL,
  receipt_id UUID NOT NULL REFERENCES erp_receipts(id) ON DELETE CASCADE,
  reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (receipt_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_receipt_billed_competences TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_receipt_billed_competences_receipt
  ON erp_receipt_billed_competences(receipt_id);

CREATE INDEX IF NOT EXISTS idx_erp_receipt_billed_competences_contract_comp
  ON erp_receipt_billed_competences(contract_id, competencia);

-- Todo recibo existente quita, no mínimo, a competência que está gravada nele.
INSERT INTO erp_receipt_billed_competences
  (contract_id, competencia, receipt_id, reconciled)
SELECT r.contract_id, r.competencia, r.id, FALSE
  FROM erp_receipts r
ON CONFLICT (receipt_id, competencia) DO NOTHING;

-- Reconciliação histórica: antes de a competência explícita ser obrigatória,
-- ciclos atravessando meses eram salvos pelo mês de inicio. Para esses recibos
-- já existentes no momento desta migration, o mês final também fica quitado.
WITH reconciled AS (
  INSERT INTO erp_receipt_billed_competences
    (contract_id, competencia, receipt_id, reconciled)
  SELECT r.contract_id,
         TO_CHAR(r.periodo_fim, 'YYYY-MM'),
         r.id,
         TRUE
    FROM erp_receipts r
   WHERE r.periodo_inicio IS NOT NULL
     AND r.periodo_fim IS NOT NULL
     -- Limite da correção que tornou a competência explícita no backend.
     -- Recibos posteriores podem legitimamente ter um ciclo que termina no
     -- mês seguinte e não devem quitar esse mês futuro.
     AND r.created_at < TIMESTAMPTZ '2026-08-24 11:59:17+00'
     AND r.competencia = TO_CHAR(r.periodo_inicio, 'YYYY-MM')
     AND TO_CHAR(r.periodo_fim, 'YYYY-MM') <> r.competencia
  ON CONFLICT (receipt_id, competencia) DO NOTHING
  RETURNING 1
)
SELECT COUNT(*) AS historical_receipts_reconciled FROM reconciled;