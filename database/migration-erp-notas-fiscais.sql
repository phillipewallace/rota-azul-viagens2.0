-- ============================================================
-- ERP · Notas Fiscais (emitidas fora do sistema, no portal do
-- governo). Vinculadas a um contrato + competência, com PDF.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS erp_invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id            UUID NOT NULL REFERENCES erp_contracts(id) ON DELETE CASCADE,
  competencia            CHAR(7) NOT NULL,           -- YYYY-MM
  numero                 TEXT NOT NULL,
  serie                  TEXT,
  data_emissao           DATE NOT NULL,
  valor                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pagamento        TEXT,                       -- pix | boleto | transferencia | dinheiro | cartao | outro
  observacoes            TEXT,
  pdf_url                TEXT NOT NULL,              -- /uploads/invoices/<uuid>.pdf
  pdf_original_filename  TEXT,
  pdf_stored_filename    TEXT,
  pdf_size_bytes         BIGINT,
  status                 TEXT NOT NULL DEFAULT 'ativa',  -- ativa | cancelada
  cancelado_em           TIMESTAMPTZ,
  motivo_cancelamento    TEXT,
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_invoices TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_invoices_contract     ON erp_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_competencia  ON erp_invoices(competencia);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_status       ON erp_invoices(status);
CREATE INDEX IF NOT EXISTS idx_erp_invoices_data_emissao ON erp_invoices(data_emissao);

-- Apenas UMA NF "ativa" por contrato+competência (canceladas não bloqueiam).
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_invoices_ativa_por_comp
  ON erp_invoices(contract_id, competencia)
  WHERE status = 'ativa';
