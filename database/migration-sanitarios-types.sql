-- Garantir colunas na tabela sanitarios
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'comum';
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS tipo_locacao_alvo TEXT;
ALTER TABLE public.sanitarios ADD COLUMN IF NOT EXISTS estado_atual TEXT DEFAULT 'bom';

-- Tabela de tipos (categorias) de sanitários para o dropdown
CREATE TABLE IF NOT EXISTS public.erp_sanitario_tipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    descricao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill: a tabela pode existir com slug NOT NULL (criada por migration-new-flow.sql)
UPDATE public.erp_sanitario_tipos
   SET slug = lower(regexp_replace(nome, '[^a-zA-Z0-9]+', '_', 'g'))
 WHERE slug IS NULL OR slug = '';

-- Inserir tipos padrão (SEMPRE com slug — a coluna é NOT NULL no schema vigente).
-- ON CONFLICT DO NOTHING cobre conflitos de nome E de slug (idempotente).
INSERT INTO public.erp_sanitario_tipos (nome, slug) VALUES
('Comum', 'comum'),
('PNE', 'pne'),
('Pia', 'com_pia'),
('Luxo', 'luxo'),
('Banho', 'cabine_banho'),
('Rede Esgoto', 'rede_esgoto')
ON CONFLICT DO NOTHING;

-- Garantir GRANTs para a VPS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sanitarios TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_sanitario_tipos TO public;
