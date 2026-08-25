-- =====================================================
-- Migration V2 - FIXES finais (índices, defaults, integridade)
-- =====================================================
-- Aplicar no VPS com:
--   sudo -u postgres psql -d roteirizador1 -f database/migration-v2-fixes.sql
-- =====================================================

-- 1) Índice BRIN em tracking_locations (eficiente p/ inserts time-series)
CREATE INDEX IF NOT EXISTS idx_tracking_brin
  ON public.tracking_locations USING BRIN (recorded_at);

-- 2) Garantir colunas operacionais com defaults seguros
ALTER TABLE public.route_points
  ALTER COLUMN point_category SET DEFAULT 'obra',
  ALTER COLUMN operation_type SET DEFAULT 'entrega',
  ALTER COLUMN auto_removed   SET DEFAULT false;

UPDATE public.route_points SET point_category = 'obra'   WHERE point_category IS NULL;
UPDATE public.route_points SET operation_type = 'entrega' WHERE operation_type IS NULL;
UPDATE public.route_points SET auto_removed   = false    WHERE auto_removed   IS NULL;

-- 3) Garantir arrays não-nulos (mais barato pra app code)
ALTER TABLE public.route_points
  ALTER COLUMN sanitario_numbers     SET DEFAULT ARRAY[]::text[],
  ALTER COLUMN sanitario_recolhidos  SET DEFAULT ARRAY[]::text[];

UPDATE public.route_points SET sanitario_numbers    = ARRAY[]::text[] WHERE sanitario_numbers    IS NULL;
UPDATE public.route_points SET sanitario_recolhidos = ARRAY[]::text[] WHERE sanitario_recolhidos IS NULL;

-- 4) Constraint de unicidade defensiva: 1 sanitário por número
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sanitarios_numero_key') THEN
    ALTER TABLE public.sanitarios ADD CONSTRAINT sanitarios_numero_key UNIQUE (numero);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5) Permissões para o usuário lipe (idempotente)
GRANT ALL PRIVILEGES ON ALL TABLES   IN SCHEMA public TO lipe;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lipe;

DO $$ BEGIN RAISE NOTICE 'Migration v2-fixes aplicada com sucesso'; END $$;
