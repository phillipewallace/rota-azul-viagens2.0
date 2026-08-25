-- Migration: Adicionar campo optimization_mode nas rotas
-- Este campo controla se a rota deve manter a ordem fixa ou ser otimizada
-- Data: 2025-01-24

-- Adicionar coluna optimization_mode
ALTER TABLE routes 
ADD COLUMN IF NOT EXISTS optimization_mode VARCHAR(20) DEFAULT 'optimized' 
CHECK (optimization_mode IN ('fixed', 'optimized'));

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_routes_optimization_mode ON routes(optimization_mode);

-- Comentário explicativo
COMMENT ON COLUMN routes.optimization_mode IS 'Modo de otimização: fixed (ordem mantida) ou optimized (otimização automática)';

-- Atualizar rotas existentes para 'optimized' (comportamento atual)
UPDATE routes SET optimization_mode = 'optimized' WHERE optimization_mode IS NULL;

-- Confirmar alteração
SELECT COUNT(*) as total_routes, optimization_mode 
FROM routes 
GROUP BY optimization_mode;
