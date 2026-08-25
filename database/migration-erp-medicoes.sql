-- ============================================================
-- ERP · Medições — proposta de faturamento (pré-recibo)
-- Uma medição = 1 cliente + N contratos + itens (produto/qtd/valor).
-- Não emite recibo; é só um documento (PDF) enviado ao cliente.
-- Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS erp_medicoes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT UNIQUE NOT NULL,               -- MED-YYYY-NNNN
  cliente_documento TEXT,
  cliente_nome      TEXT,
  customer_id       UUID,
  company_id        UUID,
  competencia       CHAR(7),                            -- YYYY-MM
  periodo_inicio    DATE,
  periodo_fim       DATE,
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto          NUMERIC(12,2) NOT NULL DEFAULT 0,
  total             NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes       TEXT,
  snapshot          JSONB,                              -- empresa + cliente no momento
  pdf_gerado_em     TIMESTAMPTZ,
  created_by        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_medicoes TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_medicoes_cliente_doc ON erp_medicoes(cliente_documento);
CREATE INDEX IF NOT EXISTS idx_erp_medicoes_competencia ON erp_medicoes(competencia);
CREATE INDEX IF NOT EXISTS idx_erp_medicoes_customer   ON erp_medicoes(customer_id);
CREATE INDEX IF NOT EXISTS idx_erp_medicoes_company    ON erp_medicoes(company_id);

CREATE TABLE IF NOT EXISTS erp_medicao_itens (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicao_id       UUID NOT NULL REFERENCES erp_medicoes(id) ON DELETE CASCADE,
  contract_id      UUID,
  contract_numero  TEXT,
  descricao        TEXT NOT NULL,
  quantidade       NUMERIC(12,3) NOT NULL DEFAULT 1,
  unidade          TEXT DEFAULT 'UN',
  valor_unit       NUMERIC(12,2) NOT NULL DEFAULT 0,
  desconto_item    NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  periodo_inicio   DATE,
  periodo_fim      DATE,
  ordem            INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_medicao_itens TO lipe;

CREATE INDEX IF NOT EXISTS idx_erp_medicao_itens_medicao  ON erp_medicao_itens(medicao_id);
CREATE INDEX IF NOT EXISTS idx_erp_medicao_itens_contract ON erp_medicao_itens(contract_id);
