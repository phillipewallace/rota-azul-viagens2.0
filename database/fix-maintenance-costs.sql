
-- Script para corrigir problemas de custos de manutenção
-- Execute este script se estiver tendo problemas com valores não numéricos

-- 1. Verificar e corrigir valores de custo inválidos na tabela maintenance
UPDATE maintenance 
SET cost = 0 
WHERE cost IS NULL 
   OR cost = '' 
   OR cost = 'NaN' 
   OR NOT (cost ~ '^[0-9]+\.?[0-9]*$');

-- 2. Garantir que a coluna cost seja do tipo numeric
ALTER TABLE maintenance 
ALTER COLUMN cost TYPE NUMERIC(10,2) 
USING CASE 
  WHEN cost ~ '^[0-9]+\.?[0-9]*$' THEN CAST(cost AS NUMERIC(10,2))
  ELSE 0
END;

-- 3. Definir valor padrão para novos registros
ALTER TABLE maintenance 
ALTER COLUMN cost SET DEFAULT 0;

-- 4. Verificar e corrigir campos obrigatórios
UPDATE maintenance 
SET maintenance_type = 'geral' 
WHERE maintenance_type IS NULL OR maintenance_type = '';

UPDATE maintenance 
SET status = 'pending' 
WHERE status IS NULL OR status = '';

UPDATE maintenance 
SET description = 'Sem descrição' 
WHERE description IS NULL;

-- 5. Garantir que datas sejam válidas
UPDATE maintenance 
SET scheduled_date = CURRENT_DATE 
WHERE scheduled_date IS NULL;

-- 6. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_id ON maintenance(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled_date ON maintenance(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_type ON maintenance(maintenance_type);

-- 7. Verificar integridade referencial
DELETE FROM maintenance 
WHERE truck_id NOT IN (SELECT id FROM trucks);

-- 8. Atualizar timestamps
UPDATE maintenance 
SET updated_at = CURRENT_TIMESTAMP 
WHERE updated_at IS NULL;

-- 9. Verificar estrutura da tabela routes
ALTER TABLE routes 
ALTER COLUMN total_distance TYPE NUMERIC(10,2) 
USING CASE 
  WHEN total_distance ~ '^[0-9]+\.?[0-9]*$' THEN CAST(total_distance AS NUMERIC(10,2))
  ELSE 0
END;

ALTER TABLE routes 
ALTER COLUMN total_distance SET DEFAULT 0;

-- 10. Garantir que campos JSON sejam válidos
UPDATE routes 
SET points = '[]'::jsonb 
WHERE points IS NULL OR points = '' OR NOT (points::text ~ '^\[.*\]$');

UPDATE routes 
SET optimized_order = '[]'::jsonb 
WHERE optimized_order IS NULL OR optimized_order = '' OR NOT (optimized_order::text ~ '^\[.*\]$');

-- 11. Limpar registros órfãos e dados inconsistentes
DELETE FROM route_assignments 
WHERE truck_id NOT IN (SELECT id FROM trucks) 
   OR route_id NOT IN (SELECT id FROM routes);

-- 12. Atualizar estatísticas da tabela
ANALYZE maintenance;
ANALYZE routes;
ANALYZE trucks;

-- Mostrar resultados da limpeza
SELECT 
  'maintenance' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN cost > 0 THEN 1 END) as records_with_cost,
  AVG(cost) as avg_cost,
  SUM(cost) as total_cost
FROM maintenance
UNION ALL
SELECT 
  'routes' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN total_distance > 0 THEN 1 END) as routes_with_distance,
  AVG(total_distance) as avg_distance,
  SUM(total_distance) as total_distance
FROM routes;
