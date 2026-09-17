-- ============================================================
-- ERP · Correção do arquivo principal de documentos com sub-pasta
--
-- Documentos criados arrastando uma pasta inteira (2+ arquivos)
-- antes da correção do frontend ficaram com arquivo_url vazio,
-- o que fazia o preview/botão de edição não aparecer.
-- Esta migration promove o PRIMEIRO arquivo da sub-pasta
-- (created_at mais antigo) como arquivo principal, para
-- QUALQUER quantidade de arquivos (a migration-erp-document-files
-- só cobria o caso de exatamente 1 arquivo).
-- Idempotente: só preenche documento com arquivo_url vazio.
-- ============================================================

BEGIN;

UPDATE public.erp_documents d
   SET arquivo_url     = f.arquivo_url,
       arquivo_nome    = f.arquivo_nome,
       arquivo_tamanho = f.arquivo_tamanho,
       arquivo_tipo    = f.arquivo_tipo,
       updated_at      = NOW()
  FROM (
    SELECT DISTINCT ON (document_id)
           document_id, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo
      FROM public.erp_document_files
     WHERE arquivo_url IS NOT NULL AND arquivo_url <> ''
     ORDER BY document_id, created_at ASC NULLS LAST, id ASC
  ) f
 WHERE d.id = f.document_id
   AND (d.arquivo_url IS NULL OR d.arquivo_url = '');

COMMIT;
