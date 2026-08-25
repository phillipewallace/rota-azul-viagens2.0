-- Adiciona coluna de quilometragem em manutenções
ALTER TABLE maintenance_records
  ADD COLUMN IF NOT EXISTS mileage INTEGER;
