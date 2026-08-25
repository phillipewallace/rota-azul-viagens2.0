-- ============================================================
-- ERP · Tipos de contrato (locação/evento) + módulo de Gastos
-- Idempotente.
-- ============================================================

-- 1) Tipo de contrato + dados específicos de evento ------------
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'locacao';
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS data_evento DATE;
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS local_evento TEXT;
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS data_recolhimento DATE;
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS hora_entrega TEXT;
ALTER TABLE erp_contracts ADD COLUMN IF NOT EXISTS valor_total_evento NUMERIC(12,2);

-- 2) Tabela de gastos manuais (NFs, despesas avulsas) ----------
CREATE TABLE IF NOT EXISTS erp_expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria     TEXT NOT NULL DEFAULT 'outros', -- combustivel | aluguel | folha | nf | outros
  descricao     TEXT NOT NULL,
  valor         NUMERIC(12,2) NOT NULL DEFAULT 0,
  data          DATE NOT NULL DEFAULT CURRENT_DATE,
  fornecedor    TEXT,
  nota_fiscal   TEXT,
  anexo_url     TEXT,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_expenses TO lipe;
CREATE INDEX IF NOT EXISTS idx_erp_expenses_data ON erp_expenses(data DESC);
CREATE INDEX IF NOT EXISTS idx_erp_expenses_categoria ON erp_expenses(categoria);
