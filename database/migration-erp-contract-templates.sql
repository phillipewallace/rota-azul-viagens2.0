-- Modelos editáveis de contrato (globais)
CREATE TABLE IF NOT EXISTS public.erp_contract_templates (
  tipo            TEXT PRIMARY KEY CHECK (tipo IN ('obra', 'evento')),
  titulo          TEXT NOT NULL,
  corpo_html      TEXT NOT NULL,
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_contract_templates TO lipe;
