-- ============================================================
-- Migration: Permitir clientes com mesmo documento
-- A duplicação passa a ser tratada pela UX (modal de confirmação),
-- não mais por uma constraint hard do banco.
-- ============================================================

DROP INDEX IF EXISTS idx_customers_document_unique;

-- Índice não-único para manter performance de busca por documento.
CREATE INDEX IF NOT EXISTS idx_customers_document
  ON customers (document) WHERE document IS NOT NULL AND document <> '';
