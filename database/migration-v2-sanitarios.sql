-- =====================================================
-- Migration V2 - Gerenciamento de Sanitários (Banheiros químicos)
-- =====================================================
-- Cria:
--   * tabela sanitarios (cadastro mestre por número)
--   * tabela sanitario_movimentacoes (histórico de localização)
--   * coluna route_points.sanitario_numbers (numeração informada na rota)
--   * tabela tracking_locations (rastreamento em background)
-- =====================================================

-- 1) Cadastro mestre dos sanitários
CREATE TABLE IF NOT EXISTS public.sanitarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  modelo TEXT,
  status TEXT NOT NULL DEFAULT 'disponivel',
    -- 'disponivel' | 'em_cliente' | 'manutencao' | 'inativo'
  current_route_point_id UUID,
  current_customer_name TEXT,
  current_address TEXT,
  current_lat DOUBLE PRECISION,
  current_lng DOUBLE PRECISION,
  installed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanitarios_status ON public.sanitarios(status);
CREATE INDEX IF NOT EXISTS idx_sanitarios_numero ON public.sanitarios(numero);

-- 2) Histórico completo de movimentações
CREATE TABLE IF NOT EXISTS public.sanitario_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sanitario_id UUID NOT NULL REFERENCES public.sanitarios(id) ON DELETE CASCADE,
  sanitario_numero TEXT NOT NULL,
  operation_type TEXT NOT NULL,  -- 'entrega' | 'recolhimento' | 'manutencao' | 'transferencia'
  route_id UUID,
  route_point_id UUID,
  customer_name TEXT,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  driver_id UUID,
  driver_name TEXT,
  truck_id UUID,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_mov_sanitario ON public.sanitario_movimentacoes(sanitario_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_mov_numero ON public.sanitario_movimentacoes(sanitario_numero);
CREATE INDEX IF NOT EXISTS idx_mov_route ON public.sanitario_movimentacoes(route_id);

-- 3) Numeração dos sanitários no ponto da rota (array)
ALTER TABLE public.route_points
  ADD COLUMN IF NOT EXISTS sanitario_numbers TEXT[];

ALTER TABLE public.route_points
  ADD COLUMN IF NOT EXISTS sanitario_recolhidos TEXT[];

-- 4) Rastreamento em background
CREATE TABLE IF NOT EXISTS public.tracking_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID,
  truck_id UUID,
  driver_id UUID,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_route ON public.tracking_locations(route_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_truck ON public.tracking_locations(truck_id, recorded_at DESC);

-- 5) Permissões para o usuário lipe
GRANT ALL PRIVILEGES ON public.sanitarios TO lipe;
GRANT ALL PRIVILEGES ON public.sanitario_movimentacoes TO lipe;
GRANT ALL PRIVILEGES ON public.tracking_locations TO lipe;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lipe;
