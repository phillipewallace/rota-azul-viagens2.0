-- Campos extras para gestão profissional de manutenção
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS mileage INTEGER;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS next_maintenance_km INTEGER;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS items JSONB;
