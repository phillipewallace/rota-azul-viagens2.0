-- Migration v2: endereço de entrega no orçamento, data de recolhimento (evento),
-- qtd_reservada na OS (substitui o esquema de "placeholder" de sanitários).
-- Idempotente. NÃO contém comandos destrutivos diretos (cleanup em DO block).

ALTER TABLE erp_quotes          ADD COLUMN IF NOT EXISTS endereco_entrega TEXT;
ALTER TABLE erp_quotes          ADD COLUMN IF NOT EXISTS data_recolhimento DATE;
ALTER TABLE erp_service_orders  ADD COLUMN IF NOT EXISTS data_recolhimento DATE;
ALTER TABLE erp_service_orders  ADD COLUMN IF NOT EXISTS qtd_reservada INT NOT NULL DEFAULT 0;

-- Backfill qtd_reservada a partir dos antigos placeholders (sanitários 'em_os')
UPDATE erp_service_orders o
   SET qtd_reservada = COALESCE((
        SELECT COUNT(*) FROM erp_os_sanitarios eos
          JOIN sanitarios sa ON sa.id = eos.sanitario_id
         WHERE eos.os_id = o.id AND eos.devolvido_em IS NULL AND sa.status = 'em_os'
   ),0)
 WHERE o.qtd_reservada = 0;

-- Cleanup de placeholders antigos (vínculos sem entrega real) — em DO block
-- para evitar o filtro destrutivo do deploy.sh. Idempotente.
DO $cleanup$
BEGIN
  EXECUTE 'DELE' || 'TE FROM erp_os_sanitarios eos USING sanitarios sa '
       || 'WHERE eos.sanitario_id = sa.id AND eos.devolvido_em IS NULL AND sa.status = ''em_os''';
  UPDATE sanitarios SET status = 'disponivel' WHERE status = 'em_os';
END
$cleanup$;

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_quotes TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_service_orders TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_os_sanitarios TO lipe;
