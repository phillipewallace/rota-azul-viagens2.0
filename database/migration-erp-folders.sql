-- ============================================================
-- ERP · Explorer de Documentos — pastas hierárquicas
-- Idempotente. Cria a tabela erp_folders (árvore de pastas) e a
-- coluna erp_documents.folder_id (NULL = documento na raiz).
-- Nenhum dado existente é alterado: todos os documentos atuais
-- ficam na raiz (folder_id NULL) até serem movidos na UI.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  parent_id UUID REFERENCES public.erp_folders(id) ON DELETE CASCADE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS erp_folders_parent_idx
  ON public.erp_folders (parent_id);

CREATE INDEX IF NOT EXISTS erp_folders_nome_idx
  ON public.erp_folders (LOWER(nome));

-- Pasta de destino do documento. ON DELETE SET NULL: excluir a pasta
-- devolve os documentos para a raiz (nunca perde documento).
ALTER TABLE public.erp_documents
  ADD COLUMN IF NOT EXISTS folder_id UUID
  REFERENCES public.erp_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS erp_documents_folder_idx
  ON public.erp_documents (folder_id);

GRANT ALL PRIVILEGES ON public.erp_folders TO lipe;
GRANT ALL PRIVILEGES ON public.erp_documents TO lipe;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lipe;

COMMIT;
