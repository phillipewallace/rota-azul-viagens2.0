-- Atualizar o tipo de status se necessário (assumindo que seja VARCHAR por enquanto ou adicionando ao enum)
-- Se for ENUM, precisaríamos de ALTER TYPE, mas como estamos em uma VPS e usamos VARCHAR/CHECK em muitos lugares:

-- Garantir que a coluna 'tipo' exista em erp_service_orders para distinguir Entrega/Recolhimento
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_service_orders' AND column_name='tipo_operacao') THEN
        ALTER TABLE erp_service_orders ADD COLUMN tipo_operacao VARCHAR(20) DEFAULT 'ENTREGA';
    END IF;
END $$;

-- Adicionar coluna para data programada de recolhimento
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='erp_service_orders' AND column_name='data_recolhimento_programada') THEN
        ALTER TABLE erp_service_orders ADD COLUMN data_recolhimento_programada DATE;
    END IF;
END $$;

-- Garantir que o histórico de sanitários rastreie o status atual no estoque
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS status_atual VARCHAR(20) DEFAULT 'ESTOQUE';

GRANT ALL ON public.erp_service_orders TO public;
