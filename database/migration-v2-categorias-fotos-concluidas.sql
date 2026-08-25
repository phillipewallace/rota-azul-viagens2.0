-- ============================================================
-- MIGRATION V2: Categorias, Fotos e Rotas Concluídas
-- Execute no VPS:
--   sudo -u postgres psql -d roteirizador1 -f database/migration-v2-categorias-fotos-concluidas.sql
--   sudo -u postgres psql -d roteirizador1 -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lipe; GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lipe;"
-- ============================================================

-- 1) Categorias e operações nos pontos
ALTER TABLE route_points
  ADD COLUMN IF NOT EXISTS point_category TEXT DEFAULT 'obra',         -- 'obra' | 'evento'
  ADD COLUMN IF NOT EXISTS operation_type TEXT DEFAULT 'entrega',      -- 'entrega' | 'recolhimento' | 'manutencao'
  ADD COLUMN IF NOT EXISTS recolhido_qty  INTEGER,                     -- qtd recolhida (para recolhimento parcial)
  ADD COLUMN IF NOT EXISTS auto_removed   BOOLEAN DEFAULT false;       -- se saiu da rota automaticamente

-- 2) Fotos por ponto
CREATE TABLE IF NOT EXISTS point_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id        UUID NOT NULL,
  point_id        UUID NOT NULL,
  file_path       TEXT NOT NULL,                  -- caminho relativo dentro de /uploads
  file_url        TEXT NOT NULL,                  -- URL pública
  operation_type  TEXT,                           -- entrega/recolhimento/manutencao
  uploaded_at     TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by     TEXT
);
CREATE INDEX IF NOT EXISTS idx_point_photos_route ON point_photos(route_id);
CREATE INDEX IF NOT EXISTS idx_point_photos_point ON point_photos(point_id);

-- 3) Rotas concluídas (snapshot)
CREATE TABLE IF NOT EXISTS completed_routes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id         UUID NOT NULL,
  route_name       TEXT NOT NULL,
  truck_id         UUID,
  truck_plate      TEXT,
  driver_id        UUID,
  driver_name      TEXT,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  total_distance   NUMERIC(10,2),
  total_duration   INTEGER,
  points_snapshot  JSONB DEFAULT '[]'::jsonb,
  photos_count     INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'in_progress',     -- 'in_progress' | 'finished'
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_completed_routes_route ON completed_routes(route_id);
CREATE INDEX IF NOT EXISTS idx_completed_routes_truck ON completed_routes(truck_id);
CREATE INDEX IF NOT EXISTS idx_completed_routes_status ON completed_routes(status);

DO $$ BEGIN RAISE NOTICE 'Migration v2 aplicada com sucesso'; END $$;
