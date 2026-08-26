-- ============================================================
-- ERP · Competências manualmente marcadas como faturadas.
--
-- Quando um recibo é gerado mas a pendência não sai da aba
-- Pendentes (vínculo não registrado / competência faturada
-- errada), o botão "Forçar saída" cria um registro aqui.
-- A query /pending exclui essas competências, fazendo o
-- pendente desaparecer sem alterar recibos existentes.
-- ============================================================

CREATE TABLE IF NOT EXISTS erp_manual_billed_competences (
  contract_id UUID NOT NULL REFERENCES erp_contracts(id) ON DELETE CASCADE,
  competencia CHAR(7) NOT NULL,
  motivo TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_manual_billed_competences TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_manual_billed_competences_contract_comp
  ON erp_manual_billed_competences(contract_id, competencia);