-- ============================================================
-- ERP · Financeiro v2 — forma de pagamento, baixa parcial,
-- cancelamento, recorrências e categorias dinâmicas de gastos.
-- Idempotente.
-- ============================================================

-- 1) Recibos: forma de pagamento + status detalhado --------------------
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS forma_pagamento     TEXT;       -- pix | dinheiro | boleto | cartao | transferencia | outro
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS data_pagamento      DATE;       -- quando foi efetivamente pago
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS valor_pago          NUMERIC(12,2);  -- suporta baixa parcial
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS status              TEXT NOT NULL DEFAULT 'aberto'; -- aberto | pago | parcial | cancelado
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS cancelado_em        TIMESTAMPTZ;
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- Mantém `pago` para back-compat, mas derivado do status.
UPDATE erp_receipts
   SET status = CASE WHEN pago THEN 'pago' ELSE 'aberto' END
 WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_erp_receipts_status ON erp_receipts(status);
CREATE INDEX IF NOT EXISTS idx_erp_receipts_data_pag ON erp_receipts(data_pagamento);

-- 2) Categorias dinâmicas de gastos ------------------------------------
CREATE TABLE IF NOT EXISTS erp_expense_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  label       TEXT NOT NULL,
  color       TEXT,                 -- opcional, hex/hsl pra badge
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  ordem       INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_expense_categories TO lipe;

INSERT INTO erp_expense_categories(key, label, ordem) VALUES
  ('combustivel', 'Combustível', 10),
  ('aluguel',     'Aluguel',     20),
  ('folha',       'Folha de pagamento', 30),
  ('nf',          'Nota fiscal', 40),
  ('outros',      'Outros',      99)
ON CONFLICT (key) DO NOTHING;

-- 3) Gastos recorrentes -------------------------------------------------
CREATE TABLE IF NOT EXISTS erp_recurring_expenses (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria                   TEXT NOT NULL DEFAULT 'outros',
  descricao                   TEXT NOT NULL,
  valor                       NUMERIC(12,2) NOT NULL DEFAULT 0,
  dia_mes                     INT  NOT NULL DEFAULT 1 CHECK (dia_mes BETWEEN 1 AND 31),
  fornecedor                  TEXT,
  observacoes                 TEXT,
  ativo                       BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_competencia  CHAR(7),   -- 'YYYY-MM' do último gasto gerado
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_recurring_expenses TO lipe;
CREATE INDEX IF NOT EXISTS idx_erp_recurring_ativo ON erp_recurring_expenses(ativo);

-- liga gastos gerados à recorrência (rastreabilidade, evita duplicar)
ALTER TABLE erp_expenses ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES erp_recurring_expenses(id) ON DELETE SET NULL;
ALTER TABLE erp_expenses ADD COLUMN IF NOT EXISTS competencia CHAR(7);
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_expenses_recurring_comp
  ON erp_expenses(recurring_id, competencia)
  WHERE recurring_id IS NOT NULL;
