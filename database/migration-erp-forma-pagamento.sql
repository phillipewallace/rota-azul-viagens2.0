-- Migration: forma de pagamento padronizada (cartao | pix | boleto).
-- Idempotente. Mantém condicoes_pagamento (texto livre) para histórico, mas o
-- sistema passa a usar forma_pagamento como fonte da verdade.
-- Boleto = vencimento sempre 28 dias após a data de entrega (calculado em runtime).

ALTER TABLE erp_quotes          ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE erp_service_orders  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;

-- Backfill: se condicoes_pagamento contém palavras-chave reconhecíveis, infere.
UPDATE erp_quotes
   SET forma_pagamento = CASE
        WHEN forma_pagamento IS NOT NULL THEN forma_pagamento
        WHEN condicoes_pagamento ILIKE '%boleto%' THEN 'boleto'
        WHEN condicoes_pagamento ILIKE '%pix%'    THEN 'pix'
        WHEN condicoes_pagamento ILIKE '%cart%'   THEN 'cartao'
        ELSE forma_pagamento
   END
 WHERE forma_pagamento IS NULL;

CREATE INDEX IF NOT EXISTS idx_erp_quotes_forma_pag ON erp_quotes(forma_pagamento);
CREATE INDEX IF NOT EXISTS idx_erp_so_forma_pag      ON erp_service_orders(forma_pagamento);

GRANT SELECT, INSERT, UPDATE, DELETE ON erp_quotes TO lipe;
GRANT SELECT, INSERT, UPDATE, DELETE ON erp_service_orders TO lipe;
