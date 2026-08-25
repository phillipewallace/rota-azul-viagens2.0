-- Tabela para histórico detalhado de OS
CREATE TABLE IF NOT EXISTS public.erp_os_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.erp_service_orders(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- 'STATUS_CHANGE', 'PHOTO_UPLOAD', 'NOTE', 'GPS_LOG'
    descricao TEXT,
    payload JSONB, -- Para armazenar metadados como URL da foto, lat/lng, status antigo/novo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id)
);

-- Tabela para notas internas específicas
CREATE TABLE IF NOT EXISTS public.erp_os_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    os_id UUID REFERENCES public.erp_service_orders(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id),
    author_name TEXT
);

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_os_history TO public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erp_os_notes TO public;

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_os_history_os_id ON public.erp_os_history(os_id);
CREATE INDEX IF NOT EXISTS idx_os_notes_os_id ON public.erp_os_notes(os_id);
