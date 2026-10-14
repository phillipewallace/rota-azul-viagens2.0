-- ============================================================
-- ERP · Rotas (cards de rota + pontos/paradas)
-- Idempotente. Cria erp_rotas (card) e erp_rotas_pontos (paradas).
-- Nenhum dado existente é alterado. O deploy.sh aplica sozinho.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.erp_rotas_pontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id UUID NOT NULL REFERENCES public.erp_rotas(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  company TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  cleaning TEXT NOT NULL DEFAULT '',
  bathrooms TEXT NOT NULL DEFAULT '',
  toilets TEXT NOT NULL DEFAULT '',
  pieces TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  observation TEXT NOT NULL DEFAULT '',
  sanitario_number TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas novas para bancos que já tenham as tabelas (idempotente)
ALTER TABLE public.erp_rotas_pontos
  ADD COLUMN IF NOT EXISTS toilets TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pieces TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS erp_rotas_status_idx
  ON public.erp_rotas (status);
CREATE INDEX IF NOT EXISTS erp_rotas_sort_idx
  ON public.erp_rotas (sort_order);
CREATE INDEX IF NOT EXISTS erp_rotas_pontos_rota_idx
  ON public.erp_rotas_pontos (rota_id, sort_order);

GRANT ALL PRIVILEGES ON public.erp_rotas TO lipe;
GRANT ALL PRIVILEGES ON public.erp_rotas_pontos TO lipe;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lipe;

COMMIT;
