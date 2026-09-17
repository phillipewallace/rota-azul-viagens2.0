-- ============================================================
-- ERP · Aba Excel: dados processados das planilhas
-- Quando um documento tem arquivo xlsx/xls/csv/ods, o backend
-- analisa o arquivo (SheetJS) e guarda as abas/linhas em JSONB.
-- O arquivo ORIGINAL permanece intacto; edições feitas na aba
-- Excel são salvas aqui (edited = true) e podem ser restauradas
-- re-parseando o original.
-- Idempotente.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_spreadsheet_data (
  document_id UUID PRIMARY KEY
    REFERENCES public.erp_documents(id) ON DELETE CASCADE,
  -- processando | pronto | erro | sem_arquivo | nao_planilha
  status      TEXT NOT NULL DEFAULT 'processando',
  -- { sheets: [{ nome, rows: string[][], totalRows, truncated }] }
  sheets      JSONB,
  edited      BOOLEAN NOT NULL DEFAULT false,
  erro        TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS erp_spreadsheet_data_status_idx
  ON public.erp_spreadsheet_data (status);

GRANT ALL ON public.erp_spreadsheet_data TO lipe;

COMMIT;
