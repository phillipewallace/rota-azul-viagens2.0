-- ============================================================
-- Migration: Clientes completos (CPF/CNPJ) + ERP Orçamentos + OS mínima
-- Idempotente. Pode ser executada várias vezes com segurança.
-- ============================================================

-- ---------- 1. Expansão da tabela customers ----------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS person_type TEXT DEFAULT 'PJ';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ie TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS im TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS restrooms_qty INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cleanings_qty INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS complemento TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS responsavel_cpf TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tipo_cliente TEXT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='customers' AND column_name='name') THEN
    EXECUTE 'UPDATE customers SET customer_name = COALESCE(customer_name, name) WHERE customer_name IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='customers' AND column_name='phone') THEN
    EXECUTE 'UPDATE customers SET contact_phone = COALESCE(contact_phone, phone) WHERE contact_phone IS NULL';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_document_unique
  ON customers (document) WHERE document IS NOT NULL AND document <> '';

-- ---------- 2. Orçamentos ----------
CREATE TABLE IF NOT EXISTS erp_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES erp_companies(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB,
  company_snapshot JSONB,
  modalidade TEXT NOT NULL DEFAULT 'mensal',  -- diaria | mensal
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  validade_dias INT NOT NULL DEFAULT 15,
  observacoes TEXT,
  condicoes_pagamento TEXT,
  desconto_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  frete NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho',     -- rascunho|enviado|aprovado|recusado|convertido
  pdf_gerado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_quotes_status ON erp_quotes(status);
CREATE INDEX IF NOT EXISTS idx_erp_quotes_customer ON erp_quotes(customer_id);

CREATE TABLE IF NOT EXISTS erp_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES erp_quotes(id) ON DELETE CASCADE,
  produto TEXT NOT NULL,
  descricao TEXT,
  quantidade NUMERIC(12,3) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_erp_quote_items_quote ON erp_quote_items(quote_id);

-- ---------- 3. Ordens de Serviço (mínima, p/ atraso de diária) ----------
CREATE TABLE IF NOT EXISTS erp_service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  quote_id UUID REFERENCES erp_quotes(id) ON DELETE SET NULL,
  company_id UUID REFERENCES erp_companies(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_snapshot JSONB,
  modalidade TEXT NOT NULL DEFAULT 'diaria',   -- diaria | mensal
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_prevista DATE,
  data_fechamento DATE,
  status TEXT NOT NULL DEFAULT 'aberta',        -- aberta | fechada | cancelada
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_erp_so_status ON erp_service_orders(status);
CREATE INDEX IF NOT EXISTS idx_erp_so_customer ON erp_service_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_erp_so_overdue
  ON erp_service_orders(data_fim_prevista) WHERE status = 'aberta';

CREATE TABLE IF NOT EXISTS erp_os_sanitarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id UUID NOT NULL REFERENCES erp_service_orders(id) ON DELETE CASCADE,
  sanitario_id UUID NOT NULL REFERENCES sanitarios(id) ON DELETE CASCADE,
  alocado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  devolvido_em TIMESTAMPTZ,
  UNIQUE (os_id, sanitario_id)
);
CREATE INDEX IF NOT EXISTS idx_erp_os_san_open
  ON erp_os_sanitarios(sanitario_id) WHERE devolvido_em IS NULL;

-- ---------- 4. GRANTs (PostgREST/Express user) ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_quotes TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_quote_items TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_service_orders TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_os_sanitarios TO lipe;

-- ---------- 5. Sequência para numeração anual ----------
CREATE TABLE IF NOT EXISTS erp_doc_counters (
  doc TEXT NOT NULL,
  ano INT NOT NULL,
  ultimo INT NOT NULL DEFAULT 0,
  PRIMARY KEY (doc, ano)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_doc_counters TO lipe;

CREATE OR REPLACE FUNCTION erp_next_doc_number(p_doc TEXT) RETURNS TEXT AS $$
DECLARE
  v_ano INT := EXTRACT(YEAR FROM CURRENT_DATE);
  v_n   INT;
BEGIN
  INSERT INTO erp_doc_counters(doc, ano, ultimo) VALUES (p_doc, v_ano, 1)
    ON CONFLICT (doc, ano) DO UPDATE SET ultimo = erp_doc_counters.ultimo + 1
    RETURNING ultimo INTO v_n;
  RETURN p_doc || '-' || v_ano || '-' || LPAD(v_n::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
