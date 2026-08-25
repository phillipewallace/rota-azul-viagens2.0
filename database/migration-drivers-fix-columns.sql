-- ============================================================================
-- Migration: garantir colunas usadas pelo endpoint GET /api/drivers
-- ----------------------------------------------------------------------------
-- Sintoma: GET /api/drivers retorna 500 "Erro ao buscar motoristas".
-- Causa:   instalações antigas (database/complete-schema.sql) criaram a tabela
--          apenas com `license`, sem `license_number`, `license_category`,
--          `email` ou `hire_date`. O SELECT do backend referencia essas
--          colunas e estoura "column does not exist".
--
-- Rodar em produção UMA vez:
--   psql -U lipe -d alchemy -f database/migration-drivers-fix-columns.sql
-- ============================================================================

BEGIN;

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_number   VARCHAR(50);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS license_category VARCHAR(10);
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS hire_date        DATE DEFAULT CURRENT_DATE;

-- Backfill: instalações que tinham `license` (TEXT) recebem o valor copiado
-- para `license_number` para não perder o histórico.
UPDATE public.drivers
   SET license_number = license
 WHERE license_number IS NULL
   AND license IS NOT NULL;

-- Sanidade: log do estado final.
DO $$
DECLARE
  total INT;
  sem_lic INT;
BEGIN
  SELECT COUNT(*) INTO total   FROM public.drivers;
  SELECT COUNT(*) INTO sem_lic FROM public.drivers WHERE license_number IS NULL;
  RAISE NOTICE 'drivers: % registros, % sem license_number', total, sem_lic;
END $$;

COMMIT;
