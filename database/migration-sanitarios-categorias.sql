-- =====================================================
-- Migration: Categorias de Sanitários
-- =====================================================
-- Adiciona a coluna `categoria` em sanitarios e prepara
-- o app_settings para guardar o total físico por categoria.
--
-- Categorias suportadas:
--   comum | pne | pia | luxo | cabine_banho
-- =====================================================

ALTER TABLE public.sanitarios
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'comum';

CREATE INDEX IF NOT EXISTS idx_sanitarios_categoria
  ON public.sanitarios(categoria);

-- Garante a tabela de configurações globais
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO lipe;
GRANT ALL PRIVILEGES ON public.sanitarios TO lipe;
