-- ============================================================
-- Correção: documentos criados por arrastar pasta (2+ arquivos)
-- antes da atualização do frontend ficaram sem arquivo principal
-- (arquivo_url NULL), o que fazia o botão "Editar"/preview não
-- aparecer. Este script vincula o primeiro arquivo da sub-pasta
-- como arquivo principal do documento.
--
-- Executar na VPS:
--   psql "$DATABASE_URL" -f fix-arquivo-url.sql
-- ============================================================

-- 1) Mostra quantos documentos serão corrigidos (antes)
SELECT COUNT(*) AS documentos_para_corrigir
FROM erp_documents d
WHERE (d.arquivo_url IS NULL OR d.arquivo_url = '')
  AND EXISTS (
    SELECT 1 FROM erp_document_files f
    WHERE f.document_id = d.id
      AND f.arquivo_url IS NOT NULL AND f.arquivo_url <> ''
  );

-- 2) Correção: pega o PRIMEIRO arquivo de cada sub-pasta (por created_at)
UPDATE erp_documents d
SET arquivo_url     = f.arquivo_url,
    arquivo_nome    = f.arquivo_nome,
    arquivo_tamanho = f.arquivo_tamanho,
    arquivo_tipo    = f.arquivo_tipo,
    updated_at      = NOW()
FROM (
  SELECT DISTINCT ON (document_id)
         document_id, arquivo_url, arquivo_nome, arquivo_tamanho, arquivo_tipo
  FROM erp_document_files
  WHERE arquivo_url IS NOT NULL AND arquivo_url <> ''
  ORDER BY document_id, created_at ASC
) f
WHERE d.id = f.document_id
  AND (d.arquivo_url IS NULL OR d.arquivo_url = '');

-- 3) Conferência (depois) — deve voltar vazio
SELECT d.id, d.nome, d.arquivo_nome, d.arquivo_url
FROM erp_documents d
WHERE (d.arquivo_url IS NULL OR d.arquivo_url = '');
