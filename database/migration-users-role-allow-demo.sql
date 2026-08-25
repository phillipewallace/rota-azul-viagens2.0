-- Permite role='demo' na tabela users (o ensure-demo-user.js falhava no CHECK).
-- Idempotente: recria o CHECK só se necessário.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
    FROM pg_constraint
   WHERE conrelid = 'public.users'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%role%'
   LIMIT 1;

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin','manager','user','demo','operator','driver'));
END
$$;
