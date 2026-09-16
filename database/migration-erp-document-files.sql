-- ============================================================
-- ERP · Sub-pasta: múltiplos arquivos por documento
-- Idempotente. Cria a tabela erp_document_files, que guarda
-- os arquivos adicionais vinculados a um documento pai.
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

-- Normalização: sub-pasta só existe com 2+ arquivos (idempotente).
-- 1) Documento com arquivo vinculado E sub-pasta com arquivos: o vinculado é
--    movido para dentro da sub-pasta (sem duplicar), virando 2+ arquivos.
INSERT INTO public.erp_document_files
  (document_id, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo, created_by, created_at)
SELECT d.id, d.arquivo_url, d.arquivo_nome, d.arquivo_tamanho, d.arquivo_tipo,
       d.created_by, COALESCE(d.created_at, NOW())
  FROM public.erp_documents d
 WHERE d.arquivo_url IS NOT NULL AND d.arquivo_url <> ''
   AND EXISTS (SELECT 1 FROM public.erp_document_files x WHERE x.document_id = d.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.erp_document_files y
      WHERE y.document_id = d.id AND y.arquivo_url = d.arquivo_url
   );

UPDATE public.erp_documents d
   SET arquivo_url = NULL, arquivo_nome = NULL,
       arquivo_tamanho = NULL, arquivo_tipo = NULL, updated_at = NOW()
 WHERE d.arquivo_url IS NOT NULL AND d.arquivo_url <> ''
   AND EXISTS (SELECT 1 FROM public.erp_document_files x WHERE x.document_id = d.id);

-- 2) Registros antigos com apenas 1 arquivo na sub-pasta (e sem arquivo
--    principal) são promovidos a arquivo vinculado simples (fluxo original).
UPDATE public.erp_documents d
   SET arquivo_url = f.arquivo_url,
       arquivo_nome = f.arquivo_nome,
       arquivo_tamanho = f.arquivo_tamanho,
       arquivo_tipo = f.arquivo_tipo,
       updated_at = NOW()
  FROM public.erp_document_files f
 WHERE f.document_id = d.id
   AND (d.arquivo_url IS NULL OR d.arquivo_url = '')
   AND (SELECT COUNT(*) FROM public.erp_document_files x WHERE x.document_id = d.id) = 1;

DELETE FROM public.erp_document_files f
 USING public.erp_documents d
 WHERE f.document_id = d.id
   AND d.arquivo_url = f.arquivo_url
   AND (SELECT COUNT(*) FROM public.erp_document_files x WHERE x.document_id = d.id) = 1;

COMMIT;