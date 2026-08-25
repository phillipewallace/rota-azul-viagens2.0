-- Adiciona tipo_locacao (obra | evento | industria | outro) em orçamentos e OS
ALTER TABLE erp_quotes ADD COLUMN IF NOT EXISTS tipo_locacao TEXT;
ALTER TABLE erp_service_orders ADD COLUMN IF NOT EXISTS tipo_locacao TEXT;

CREATE INDEX IF NOT EXISTS idx_erp_quotes_tipo ON erp_quotes(tipo_locacao);
CREATE INDEX IF NOT EXISTS idx_erp_so_tipo ON erp_service_orders(tipo_locacao);
