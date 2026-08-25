-- Histórico de PDFs assinados na aba ERP → Assinatura.
-- Cada geração salva o arquivo em backend/uploads/signed/ e registra aqui.
CREATE TABLE IF NOT EXISTS erp_signed_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES erp_companies(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  pages INTEGER,
  placements_count INTEGER,
  size_bytes BIGINT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_signed_pdfs_created_at ON erp_signed_pdfs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_erp_signed_pdfs_company ON erp_signed_pdfs(company_id);

GRANT SELECT, INSERT, DELETE ON erp_signed_pdfs TO lipe;
