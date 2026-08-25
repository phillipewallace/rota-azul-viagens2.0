-- ============================================
-- ANALYTICS & HISTORY SCHEMA
-- Sistema de histórico de execuções e estatísticas
-- ============================================

-- Tabela de execuções de rotas (histórico completo)
CREATE TABLE IF NOT EXISTS route_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  truck_id UUID NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  
  -- Snapshot da rota no momento da execução
  route_name VARCHAR(255) NOT NULL,
  route_description TEXT,
  total_points INTEGER NOT NULL DEFAULT 0,
  total_distance DECIMAL(10, 2),
  estimated_duration INTEGER, -- minutos
  
  -- Dados de execução
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress', -- in_progress, completed, cancelled
  
  -- Estatísticas de execução
  points_completed INTEGER NOT NULL DEFAULT 0,
  actual_duration INTEGER, -- minutos calculados
  completion_percentage DECIMAL(5, 2) DEFAULT 0.00,
  
  -- Snapshot dos pontos (JSON array)
  points_snapshot JSONB NOT NULL DEFAULT '[]',
  
  -- Metadados
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  CONSTRAINT valid_percentage CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

-- Tabela de estatísticas diárias consolidadas
CREATE TABLE IF NOT EXISTS daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stat_date DATE NOT NULL UNIQUE,
  
  -- Estatísticas de rotas
  total_routes_executed INTEGER NOT NULL DEFAULT 0,
  routes_completed INTEGER NOT NULL DEFAULT 0,
  routes_cancelled INTEGER NOT NULL DEFAULT 0,
  routes_in_progress INTEGER NOT NULL DEFAULT 0,
  
  -- Estatísticas de pontos
  total_points_planned INTEGER NOT NULL DEFAULT 0,
  total_points_completed INTEGER NOT NULL DEFAULT 0,
  
  -- Estatísticas de distância e tempo
  total_distance_km DECIMAL(10, 2) DEFAULT 0.00,
  total_duration_minutes INTEGER DEFAULT 0,
  avg_completion_percentage DECIMAL(5, 2) DEFAULT 0.00,
  
  -- Estatísticas de veículos
  trucks_used INTEGER NOT NULL DEFAULT 0,
  drivers_active INTEGER NOT NULL DEFAULT 0,
  
  -- Metadados
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_route_executions_route_id ON route_executions(route_id);
CREATE INDEX IF NOT EXISTS idx_route_executions_truck_id ON route_executions(truck_id);
CREATE INDEX IF NOT EXISTS idx_route_executions_driver_id ON route_executions(driver_id);
CREATE INDEX IF NOT EXISTS idx_route_executions_status ON route_executions(status);
CREATE INDEX IF NOT EXISTS idx_route_executions_started_at ON route_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_executions_completed_at ON route_executions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_route_executions_updated_at
  BEFORE UPDATE ON route_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_stats_updated_at
  BEFORE UPDATE ON daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para consolidar estatísticas diárias (chamada automaticamente)
CREATE OR REPLACE FUNCTION consolidate_daily_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
  stats_record RECORD;
BEGIN
  -- Calcular estatísticas do dia
  SELECT 
    COUNT(*) as total_routes,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
    COALESCE(SUM(total_points), 0) as total_points,
    COALESCE(SUM(points_completed), 0) as completed_points,
    COALESCE(SUM(total_distance), 0) as total_dist,
    COALESCE(SUM(actual_duration), 0) as total_time,
    COALESCE(AVG(completion_percentage), 0) as avg_completion,
    COUNT(DISTINCT truck_id) as trucks,
    COUNT(DISTINCT driver_id) FILTER (WHERE driver_id IS NOT NULL) as drivers
  INTO stats_record
  FROM route_executions
  WHERE DATE(started_at) = target_date;
  
  -- Inserir ou atualizar estatísticas do dia
  INSERT INTO daily_stats (
    stat_date,
    total_routes_executed,
    routes_completed,
    routes_cancelled,
    routes_in_progress,
    total_points_planned,
    total_points_completed,
    total_distance_km,
    total_duration_minutes,
    avg_completion_percentage,
    trucks_used,
    drivers_active
  ) VALUES (
    target_date,
    stats_record.total_routes,
    stats_record.completed,
    stats_record.cancelled,
    stats_record.in_progress,
    stats_record.total_points,
    stats_record.completed_points,
    stats_record.total_dist,
    stats_record.total_time,
    stats_record.avg_completion,
    stats_record.trucks,
    stats_record.drivers
  )
  ON CONFLICT (stat_date) DO UPDATE SET
    total_routes_executed = EXCLUDED.total_routes_executed,
    routes_completed = EXCLUDED.routes_completed,
    routes_cancelled = EXCLUDED.routes_cancelled,
    routes_in_progress = EXCLUDED.routes_in_progress,
    total_points_planned = EXCLUDED.total_points_planned,
    total_points_completed = EXCLUDED.total_points_completed,
    total_distance_km = EXCLUDED.total_distance_km,
    total_duration_minutes = EXCLUDED.total_duration_minutes,
    avg_completion_percentage = EXCLUDED.avg_completion_percentage,
    trucks_used = EXCLUDED.trucks_used,
    drivers_active = EXCLUDED.drivers_active,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger para consolidar estatísticas automaticamente quando uma execução é concluída/cancelada
CREATE OR REPLACE FUNCTION trigger_consolidate_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Consolidar stats do dia da execução
  PERFORM consolidate_daily_stats(DATE(NEW.started_at));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_consolidate_stats
  AFTER INSERT OR UPDATE ON route_executions
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'cancelled'))
  EXECUTE FUNCTION trigger_consolidate_stats();

-- Comentários para documentação
COMMENT ON TABLE route_executions IS 'Histórico completo de execuções de rotas com snapshot dos dados';
COMMENT ON TABLE daily_stats IS 'Estatísticas consolidadas por dia para dashboard e relatórios';
COMMENT ON COLUMN route_executions.points_snapshot IS 'Array JSON com snapshot completo dos pontos da rota no momento da execução';
COMMENT ON COLUMN route_executions.completion_percentage IS 'Percentual de conclusão calculado (points_completed / total_points * 100)';
