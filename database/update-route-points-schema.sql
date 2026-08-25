-- Migration: Adicionar novos campos ao modelo de pontos de rota
-- Data: 2024
-- Descrição: Adiciona campos operacionais e de contato aos pontos de rota

-- 1. Adicionar novos campos à tabela route_points (se não existirem)
DO $$
BEGIN
    -- Campo: Nome do cliente/ponto
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'customer_name') THEN
        ALTER TABLE route_points ADD COLUMN customer_name VARCHAR(255);
        RAISE NOTICE 'Coluna customer_name adicionada';
    END IF;

    -- Campo: Quantidade de banheiros
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'restrooms_qty') THEN
        ALTER TABLE route_points ADD COLUMN restrooms_qty INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna restrooms_qty adicionada';
    END IF;

    -- Campo: Quantidade de limpezas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'cleanings_qty') THEN
        ALTER TABLE route_points ADD COLUMN cleanings_qty INTEGER DEFAULT 0;
        RAISE NOTICE 'Coluna cleanings_qty adicionada';
    END IF;

    -- Campo: Nome do responsável
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'contact_name') THEN
        ALTER TABLE route_points ADD COLUMN contact_name VARCHAR(255);
        RAISE NOTICE 'Coluna contact_name adicionada';
    END IF;

    -- Campo: Telefone do responsável
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'contact_phone') THEN
        ALTER TABLE route_points ADD COLUMN contact_phone VARCHAR(50);
        RAISE NOTICE 'Coluna contact_phone adicionada';
    END IF;

    -- Campo: Observações (notes) - renomear observation se existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'notes') THEN
        -- Verificar se observation existe e renomear
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'observation') THEN
            ALTER TABLE route_points RENAME COLUMN observation TO notes;
            RAISE NOTICE 'Coluna observation renomeada para notes';
        ELSE
            ALTER TABLE route_points ADD COLUMN notes TEXT;
            RAISE NOTICE 'Coluna notes adicionada';
        END IF;
    END IF;

    -- Campo: CEP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'cep') THEN
        ALTER TABLE route_points ADD COLUMN cep VARCHAR(10);
        RAISE NOTICE 'Coluna cep adicionada';
    END IF;

    -- Campo: Tipo de parada (para paradas extras do mobile)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'route_points' AND column_name = 'stop_type') THEN
        ALTER TABLE route_points ADD COLUMN stop_type VARCHAR(50);
        RAISE NOTICE 'Coluna stop_type adicionada';
    END IF;
END $$;

-- 2. Criar índices para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_route_points_customer_name ON route_points(customer_name);
CREATE INDEX IF NOT EXISTS idx_route_points_completed ON route_points(completed);

-- 3. Adicionar constraint de validação para campos numéricos
DO $$
BEGIN
    -- Constraint para restrooms_qty >= 0
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                   WHERE constraint_name = 'chk_restrooms_qty_positive') THEN
        ALTER TABLE route_points ADD CONSTRAINT chk_restrooms_qty_positive 
        CHECK (restrooms_qty IS NULL OR restrooms_qty >= 0);
    END IF;

    -- Constraint para cleanings_qty >= 0
    IF NOT EXISTS (SELECT 1 FROM information_schema.constraint_column_usage 
                   WHERE constraint_name = 'chk_cleanings_qty_positive') THEN
        ALTER TABLE route_points ADD CONSTRAINT chk_cleanings_qty_positive 
        CHECK (cleanings_qty IS NULL OR cleanings_qty >= 0);
    END IF;
END $$;

-- 4. Comentários nas colunas para documentação
COMMENT ON COLUMN route_points.customer_name IS 'Nome do cliente ou ponto de parada';
COMMENT ON COLUMN route_points.restrooms_qty IS 'Quantidade de banheiros no local';
COMMENT ON COLUMN route_points.cleanings_qty IS 'Quantidade de limpezas previstas';
COMMENT ON COLUMN route_points.contact_name IS 'Nome do responsável local';
COMMENT ON COLUMN route_points.contact_phone IS 'Telefone do responsável';
COMMENT ON COLUMN route_points.notes IS 'Observações gerais sobre o ponto';
COMMENT ON COLUMN route_points.cep IS 'CEP do endereço';
COMMENT ON COLUMN route_points.stop_type IS 'Tipo de parada (Coleta, Entrega, Serviço)';

-- 5. View para facilitar consultas com dados completos
CREATE OR REPLACE VIEW v_route_points_full AS
SELECT 
    rp.id,
    rp.route_id,
    rp.address,
    rp.lat,
    rp.lng,
    rp.point_order,
    rp.type,
    rp.completed,
    rp.completed_at,
    rp.customer_name,
    rp.restrooms_qty,
    rp.cleanings_qty,
    rp.contact_name,
    rp.contact_phone,
    rp.notes,
    rp.cep,
    rp.stop_type,
    rp.created_at,
    r.name as route_name,
    r.status as route_status
FROM route_points rp
JOIN routes r ON r.id = rp.route_id
ORDER BY rp.route_id, rp.point_order;

COMMENT ON VIEW v_route_points_full IS 'View completa dos pontos de rota com dados da rota pai';
