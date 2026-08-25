-- Identidade explícita para recibos realmente gerados como unificados.
-- numero_display continua sendo apenas o número mostrado no PDF/UI.
ALTER TABLE erp_receipts
  ADD COLUMN IF NOT EXISTS unified_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_erp_receipts_unified_group
  ON erp_receipts (unified_group_id)
  WHERE unified_group_id IS NOT NULL;

-- Reconcilia grupos históricos: somente conjuntos com mais de um recibo da
-- mesma empresa/tipo e exatamente o mesmo número exibido são unificados.
WITH legacy_groups AS (
  SELECT company_id,
         COALESCE(sem_validade, FALSE) AS sem_validade,
         numero_display,
         gen_random_uuid() AS group_id
    FROM erp_receipts
   WHERE unified_group_id IS NULL
     AND NULLIF(BTRIM(numero_display), '') IS NOT NULL
   GROUP BY company_id, COALESCE(sem_validade, FALSE), numero_display
  HAVING COUNT(*) > 1
)
UPDATE erp_receipts r
   SET unified_group_id = g.group_id
  FROM legacy_groups g
 WHERE r.unified_group_id IS NULL
   AND r.company_id = g.company_id
   AND COALESCE(r.sem_validade, FALSE) = g.sem_validade
   AND r.numero_display = g.numero_display;