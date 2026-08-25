-- Migração para suporte a múltiplas fotos por item e histórico interligado
-- Adiciona suporte a múltiplas fotos na tabela erp_os_sanitarios se necessário (embora já existam tabelas de fotos, vamos garantir consistência)

-- Garantir que a tabela de fotos existe com as colunas necessárias
CREATE TABLE IF NOT EXISTS public.erp_sanitario_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sanitario_id UUID REFERENCES sanitarios(id) ON DELETE CASCADE,
    os_id UUID REFERENCES erp_service_orders(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    tipo_evento TEXT, -- 'entrega', 'recolhimento', 'manutencao', 'servico'
    estado_conservacao TEXT,
    observacoes TEXT,
    funcionario_id UUID,
    funcionario_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir índices para busca rápida no histórico do sanitário
CREATE INDEX IF NOT EXISTS idx_sanitario_fotos_sid ON erp_sanitario_fotos(sanitario_id);
CREATE INDEX IF NOT EXISTS idx_sanitario_fotos_osid ON erp_sanitario_fotos(os_id);

-- Se a tabela sanitarios não tiver a coluna id como UUID (em alguns casos legados pode ser serial),
-- a referência acima pode precisar de ajuste, mas seguiremos o padrão do sistema.

-- Adicionar coluna de fotos (array) na erp_os_sanitarios para cache rápido se preferir, 
-- mas usaremos a tabela erp_sanitario_fotos como fonte da verdade conforme pedido (interligado).

GRANT ALL ON public.erp_sanitario_fotos TO public;
