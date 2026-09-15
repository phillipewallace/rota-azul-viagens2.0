-- ============================================================
-- ERP · Sub-pasta: múltiplos arquivos por documento
-- Idempotente. Crea la tabla erp_document_files que guarda
-- los archivos adicionales vinculados a un documento padre.
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_document_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.erp_documents(id) ON DELETE CASCADE,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tamanho BIGINT,
  arquivo_tipo TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS erp_document_files_document_idx
  ON public.erp_document_files (document_id);

COMMIT;