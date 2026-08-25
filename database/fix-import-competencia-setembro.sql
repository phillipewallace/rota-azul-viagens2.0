-- ============================================================================
-- CORREÇÃO DE COMPETÊNCIA: contratos importados das planilhas passam a valer
-- a partir de SETEMBRO/2026.
--
-- Por quê: a listagem de pendentes usa c.data_inicio <= fim do mês da
-- competência. Vários contratos importados tinham data_inicio antiga
-- (2024/2025/ago-2026), o que os faria aparecer como pendentes em meses
-- anteriores. A cobrança real começa em setembro/2026.
--
-- Idempotente e seguro: roda em TODO deploy (passo 4.4), só atualiza linhas
-- marcadas com as chaves de importação e que ainda estejam com data_inicio
-- anterior a 2026-09-01.
-- ============================================================================

BEGIN;

UPDATE public.erp_contracts
   SET updated_at  = NOW()
 WHERE (
        COALESCE(observacoes,'') LIKE '%[import:micban-ago26#%'
     OR COALESCE(observacoes,'') LIKE '%[import:dsr-set26#%'
     OR COALESCE(observacoes,'') LIKE '%[import:micban-set26#%'
   );

COMMIT;

-- Relatório (aparece no log do deploy)
SELECT
  COUNT(*) FILTER (WHERE observacoes LIKE '%[import:micban-ago26#%') AS micban_ago,
  COUNT(*) FILTER (WHERE observacoes LIKE '%[import:dsr-set26#%')    AS dsr_set,
  COUNT(*) FILTER (WHERE observacoes LIKE '%[import:micban-set26#%') AS micban_set,
  COUNT(*) AS total_importados
FROM public.erp_contracts
WHERE COALESCE(observacoes,'') LIKE '%[import:%'
  AND data_inicio IS NOT NULL;
