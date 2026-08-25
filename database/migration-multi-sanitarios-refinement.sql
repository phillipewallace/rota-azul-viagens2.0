-- ============================================================================
-- MIGRATION MULTI-SANITÁRIOS REFINEMENT (SQL VERSION)
-- ============================================================================

DO $$
BEGIN
    -- 1. Garantir que a tabela erp_os_sanitarios existe
    CREATE TABLE IF NOT EXISTS public.erp_os_sanitarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        os_id uuid REFERENCES public.erp_service_orders(id) ON DELETE CASCADE,
        sanitario_id uuid REFERENCES public.sanitarios(id) ON DELETE CASCADE,
        alocado_em timestamp with time zone DEFAULT NOW(),
        devolvido_em timestamp with time zone,
        UNIQUE(os_id, sanitario_id)
    );

    -- 2. Adicionar coluna observacoes (relato_finalizacao) se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='erp_os_sanitarios' AND column_name='relato_finalizacao') THEN
        ALTER TABLE public.erp_os_sanitarios ADD COLUMN relato_finalizacao text;
    END IF;

    -- 3. Adicionar coluna foto_finalizacao_url se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='erp_os_sanitarios' AND column_name='foto_finalizacao_url') THEN
        ALTER TABLE public.erp_os_sanitarios ADD COLUMN foto_finalizacao_url text;
    END IF;

    -- 4. Garantir GRANTs
    GRANT ALL ON public.erp_os_sanitarios TO postgres;
    -- Se o banco for Supabase ou tiver roles específicas:
    -- GRANT ALL ON public.erp_os_sanitarios TO authenticated;
    -- GRANT ALL ON public.erp_os_sanitarios TO service_role;
END $$;
