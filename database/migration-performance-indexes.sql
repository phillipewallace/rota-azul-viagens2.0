-- ============================================================
-- Migration: Performance — índices para as listagens paginadas
-- Idempotente e SEM LOCK de escrita (CREATE INDEX CONCURRENTLY).
--
-- IMPORTANTE:
--   * NÃO envolva este arquivo em BEGIN/COMMIT — CONCURRENTLY
--     não pode rodar dentro de bloco transacional.
--   * Rode com:  psql -d roteirizador1 -f migration-performance-indexes.sql
--   * Se algum comando falhar no meio, o Postgres pode deixar um índice
--     em estado INVALID. Cheque com:
--       SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
--     e remova com DROP INDEX <nome>; depois rode a migration de novo.
-- ============================================================

-- Extensão para trigram (acelera ILIKE '%foo%'). Não trava tabela.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- customers ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_lower
  ON customers ((lower(customer_name)));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_person_type
  ON customers (person_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_created_at
  ON customers (created_at);

-- GIN trigram para busca livre nas colunas mais consultadas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_name_trgm
  ON customers USING gin (lower(coalesce(customer_name,'')) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_address_trgm
  ON customers USING gin (lower(coalesce(address,'')) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_contact_name_trgm
  ON customers USING gin (lower(coalesce(contact_name,'')) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_email_lower
  ON customers ((lower(coalesce(email,''))));

-- Documento e telefone: match por dígitos (regexp_replace)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_document_digits
  ON customers ((regexp_replace(coalesce(document,''), '\D', '', 'g')));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_phone_digits
  ON customers ((regexp_replace(coalesce(contact_phone,''), '\D', '', 'g')));

-- ---------- sanitarios ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sanitarios_current_customer_lower
  ON sanitarios ((lower(coalesce(current_customer_name,''))));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sanitarios_status_em_cliente
  ON sanitarios ((lower(coalesce(current_customer_name,''))))
  WHERE status = 'em_cliente';

-- ---------- erp_expenses ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erp_expenses_created_at
  ON erp_expenses (created_at DESC);

-- ---------- erp_receipts ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erp_receipts_created_at
  ON erp_receipts (created_at DESC);

-- ---------- erp_signed_pdfs ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erp_signed_pdfs_created_by
  ON erp_signed_pdfs (created_by);

-- ---------- erp_service_orders ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erp_so_created_at
  ON erp_service_orders (created_at DESC);

-- ---------- erp_quotes ----------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_erp_quotes_created_at
  ON erp_quotes (created_at DESC);

-- ============================================================
-- Após aplicar, rode em produção:
--   ANALYZE customers, sanitarios, erp_expenses, erp_receipts,
--           erp_signed_pdfs, erp_service_orders, erp_quotes;
-- ============================================================
