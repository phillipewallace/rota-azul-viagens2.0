
-- ========================================
-- SCRIPT DE CORREÇÃO E VALIDAÇÃO DE INTEGRIDADE
-- PONTOS DE ROTA E ESTADOS DE CONCLUSÃO
-- ========================================

-- 1️⃣ VERIFICAR PONTOS ÓRFÃOS (sem rota válida)
SELECT 
    rp.id as point_id,
    rp.route_id,
    rp.address,
    rp.point_order,
    rp.completed,
    'PONTO ÓRFÃO - ROTA NÃO EXISTE' as issue
FROM route_points rp
LEFT JOIN routes r ON rp.route_id = r.id
WHERE r.id IS NULL;

-- 2️⃣ VERIFICAR INCONSISTÊNCIAS DE TIPOS BOOLEAN
SELECT 
    id as point_id,
    route_id,
    address,
    completed,
    completed_at,
    CASE 
        WHEN completed IS NULL THEN 'NULL_VALUE'
        WHEN completed = true OR completed = 't' OR completed = 'true' THEN 'TRUE_VALUE'
        WHEN completed = false OR completed = 'f' OR completed = 'false' THEN 'FALSE_VALUE'
        ELSE 'INVALID_VALUE'
    END as completed_status,
    'VERIFICAR TIPO BOOLEAN' as issue
FROM route_points
WHERE completed IS NULL 
   OR (completed_at IS NOT NULL AND (completed = false OR completed = 'f' OR completed = 'false'))
   OR (completed_at IS NULL AND (completed = true OR completed = 't' OR completed = 'true'));

-- 3️⃣ VERIFICAR PONTOS COM ORDEM DUPLICADA NA MESMA ROTA
SELECT 
    route_id,
    point_order,
    COUNT(*) as duplicate_count,
    'ORDEM DUPLICADA NA ROTA' as issue
FROM route_points
GROUP BY route_id, point_order
HAVING COUNT(*) > 1;

-- 4️⃣ VERIFICAR ROTAS ATIVAS SEM PONTOS
SELECT 
    r.id as route_id,
    r.name as route_name,
    r.status,
    COUNT(rp.id) as points_count,
    'ROTA SEM PONTOS' as issue
FROM routes r
LEFT JOIN route_points rp ON r.id = rp.route_id
WHERE r.status = 'active'
GROUP BY r.id, r.name, r.status
HAVING COUNT(rp.id) = 0;

-- 5️⃣ VERIFICAR CAMINHÕES COM ROTAS INEXISTENTES
SELECT 
    t.id as truck_id,
    t.name as truck_name,
    t.plate,
    t.current_route_id,
    'CAMINHÃO COM ROTA INEXISTENTE' as issue
FROM trucks t
LEFT JOIN routes r ON t.current_route_id = r.id
WHERE t.current_route_id IS NOT NULL AND r.id IS NULL;

-- ========================================
-- CORREÇÕES AUTOMÁTICAS
-- ========================================

-- CORREÇÃO 1: Limpar referências de rotas inexistentes nos caminhões
UPDATE trucks 
SET current_route_id = NULL, status = 'available'
WHERE current_route_id IS NOT NULL 
  AND current_route_id NOT IN (SELECT id FROM routes);

-- CORREÇÃO 2: Remover pontos órfãos (sem rota válida)
DELETE FROM route_points 
WHERE route_id NOT IN (SELECT id FROM routes);

-- CORREÇÃO 3: Normalizar valores boolean inconsistentes
UPDATE route_points 
SET completed = false, completed_at = NULL
WHERE completed IS NULL;

UPDATE route_points 
SET completed_at = NULL
WHERE completed = false AND completed_at IS NOT NULL;

UPDATE route_points 
SET completed_at = CURRENT_TIMESTAMP
WHERE completed = true AND completed_at IS NULL;

-- CORREÇÃO 4: Corrigir ordens duplicadas (renumerar sequencialmente)
WITH ordered_points AS (
    SELECT 
        id,
        route_id,
        ROW_NUMBER() OVER (PARTITION BY route_id ORDER BY point_order, created_at) - 1 as new_order
    FROM route_points
)
UPDATE route_points 
SET point_order = op.new_order
FROM ordered_points op
WHERE route_points.id = op.id;

-- CORREÇÃO 5: Garantir que existe pelo menos uma coluna de controle de integridade
ALTER TABLE route_points 
ADD COLUMN IF NOT EXISTS integrity_check_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- CORREÇÃO 6: Criar índices para performance (se não existirem)
CREATE INDEX IF NOT EXISTS idx_route_points_completed_status ON route_points(route_id, completed);
CREATE INDEX IF NOT EXISTS idx_route_points_integrity ON route_points(route_id, point_order, completed);
CREATE INDEX IF NOT EXISTS idx_trucks_current_route ON trucks(current_route_id) WHERE current_route_id IS NOT NULL;

-- ========================================
-- VERIFICAÇÃO FINAL DE INTEGRIDADE
-- ========================================

-- Contar problemas restantes
SELECT 
    'PONTOS_ÓRFÃOS' as check_type,
    COUNT(*) as issues_count
FROM route_points rp
LEFT JOIN routes r ON rp.route_id = r.id
WHERE r.id IS NULL

UNION ALL

SELECT 
    'BOOLEAN_INCONSISTENTE' as check_type,
    COUNT(*) as issues_count
FROM route_points
WHERE completed IS NULL 
   OR (completed_at IS NOT NULL AND completed = false)
   OR (completed_at IS NULL AND completed = true)

UNION ALL

SELECT 
    'ORDENS_DUPLICADAS' as check_type,
    COUNT(*) as issues_count
FROM (
    SELECT route_id, point_order, COUNT(*) as cnt
    FROM route_points
    GROUP BY route_id, point_order
    HAVING COUNT(*) > 1
) duplicates

UNION ALL

SELECT 
    'CAMINHÕES_ROTA_INEXISTENTE' as check_type,
    COUNT(*) as issues_count
FROM trucks t
LEFT JOIN routes r ON t.current_route_id = r.id
WHERE t.current_route_id IS NOT NULL AND r.id IS NULL;

-- ========================================
-- ATUALIZAR TIMESTAMPS DE INTEGRIDADE
-- ========================================

UPDATE route_points 
SET integrity_check_at = CURRENT_TIMESTAMP;

UPDATE routes 
SET updated_at = CURRENT_TIMESTAMP 
WHERE id IN (SELECT DISTINCT route_id FROM route_points);

-- LOG FINAL
SELECT 
    'CORREÇÃO_COMPLETA' as status,
    CURRENT_TIMESTAMP as executed_at,
    (SELECT COUNT(*) FROM route_points) as total_points,
    (SELECT COUNT(*) FROM routes) as total_routes,
    (SELECT COUNT(*) FROM trucks WHERE current_route_id IS NOT NULL) as trucks_with_routes;
