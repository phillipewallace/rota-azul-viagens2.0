-- Clientes: compatibilidade entre schema antigo (name/phone) e ERP atual
-- (customer_name/contact_phone). Idempotente e seguro.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cep TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS restrooms_qty INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cleanings_qty INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'name'
  ) THEN
    UPDATE customers
       SET customer_name = name
     WHERE customer_name IS NULL AND name IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'phone'
  ) THEN
    UPDATE customers
       SET contact_phone = phone
     WHERE contact_phone IS NULL AND phone IS NOT NULL;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO lipe;