-- 1. Tabela de Funcionários (CPF como login)
CREATE TABLE IF NOT EXISTS erp_funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    telefone TEXT,
    email TEXT,
    tipo TEXT NOT NULL DEFAULT 'operacional', -- 'motorista', 'ajudante', 'financeiro', 'admin'
    password_hash TEXT,
    first_login BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Histórico de Fotos e Estados do Sanitário
CREATE TABLE IF NOT EXISTS erp_sanitario_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sanitario_id UUID REFERENCES sanitarios(id) ON DELETE CASCADE,
    os_id UUID REFERENCES erp_service_orders(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    tipo_evento TEXT NOT NULL, -- 'registro_estoque', 'entrega', 'recolhimento', 'manutencao'
    estado_conservacao TEXT,
    observacoes TEXT,
    funcionario_id UUID REFERENCES erp_funcionarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Melhoria na Tabela Sanitários
ALTER TABLE sanitarios ADD COLUMN IF NOT EXISTS tipo_locacao_alvo TEXT; -- 'obra' ou 'evento'
ALTER TABLE sanitarios ADD COLUMN IF NOT EXISTS estado_atual TEXT DEFAULT 'bom'; -- 'bom', 'danificado', 'critico'

-- 4. Extensão das Movimentações (Fotos e Dados Mobile)
ALTER TABLE sanitario_movimentacoes ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES erp_service_orders(id);
ALTER TABLE sanitario_movimentacoes ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]';
ALTER TABLE sanitario_movimentacoes ADD COLUMN IF NOT EXISTS estado_conservacao TEXT;

-- 5. Tipos Dinâmicos de Sanitários
CREATE TABLE IF NOT EXISTS erp_sanitario_tipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL, -- 'Comum', 'PNE', 'Luxo', etc.
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO erp_sanitario_tipos (nome, slug) VALUES 
('Comum', 'comum'),
('PNE', 'pne'),
('Com Pia', 'com_pia'),
('Luxo', 'luxo'),
('Cabine de Banho', 'cabine_banho'),
('Ligação Rede Esgoto', 'rede_esgoto')
ON CONFLICT DO NOTHING;

-- 6. Atualização de status da OS para o novo fluxo
-- Status possíveis: 'aberta', 'despachada', 'entregue', 'recolhimento_solicitado', 'fechada'
ALTER TABLE erp_service_orders ADD COLUMN IF NOT EXISTS data_recolhimento_solicitada DATE;

GRANT ALL ON public.erp_funcionarios TO postgres;
GRANT ALL ON public.erp_sanitario_fotos TO postgres;
GRANT ALL ON public.erp_sanitario_tipos TO postgres;
