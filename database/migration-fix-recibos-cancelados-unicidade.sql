-- ============================================================
-- ERP · Correção estrutural de cancelamento × pendentes × reemissão.
--
-- Problemas corrigidos (idempotente, preserva 100% dos dados):
--   1) A constraint/índices únicos originais consideravam recibos CANCELADOS,
--      impedindo reemitir um recibo após cancelamento (violação de unicidade).
--      → Índices passam a ignorar cancelados (parciais por status).
--   2) Vínculos de competência faturada podem ter ficado faltando para
--      recibos válidos históricos → reconciliação via INSERT ... ON CONFLICT.
--
-- OBS.: vínculos órfãos apontando para recibos cancelados são inofensivos —
-- a consulta de Pendentes filtra por join com status; a rota /cancel já
-- remove os vínculos no ato do cancelamento.
--
-- Segura para o deploy automático: apenas recria índices e insere vínculos
-- faltantes; nenhum comando destrutivo de dados.
-- ============================================================

-- 1) Constraint legada da criação da tabela (não distinguia cancelados).
ALTER TABLE erp_receipts
  DROP CONSTRAINT IF EXISTS erp_receipts_contract_id_competencia_key;

-- 2) Unicidade POR TIPO somente entre recibos VÁLIDOS (status <> 'cancelado').
DROP INDEX IF EXISTS uq_erp_receipts_contract_comp_normal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_receipts_contract_comp_normal
  ON erp_receipts (contract_id, competencia)
  WHERE COALESCE(sem_validade, FALSE) = FALSE
    AND COALESCE(status, 'aberto') <> 'cancelado';

DROP INDEX IF EXISTS uq_erp_receipts_contract_comp_sv;
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_receipts_contract_comp_sv
  ON erp_receipts (contract_id, competencia)
  WHERE sem_validade = TRUE
    AND COALESCE(status, 'aberto') <> 'cancelado';

-- 3) Reconcilia vínculos faltantes: todo recibo VÁLIDO quita, no mínimo,
--    a competência gravada nele.
INSERT INTO erp_receipt_billed_competences
  (contract_id, competencia, receipt_id, reconciled)
SELECT r.contract_id, r.competencia, r.id, FALSE
  FROM erp_receipts r
 WHERE COALESCE(r.status, 'aberto') <> 'cancelado'
ON CONFLICT (receipt_id, competencia) DO NOTHING;

-- 4) Diagnóstico pós-migration (aparece no log do deploy).
SELECT
  (SELECT COUNT(*) FROM erp_receipts WHERE status = 'cancelado') AS recibos_cancelados,
  (SELECT COUNT(*) FROM erp_receipts r
     WHERE COALESCE(r.status,'aberto') <> 'cancelado'
       AND NOT EXISTS (
         SELECT 1 FROM erp_receipt_billed_competences bc
          WHERE bc.receipt_id = r.id AND bc.competencia = r.competencia
       )) AS recibos_validos_sem_vinculo,
  EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE indexname = 'uq_erp_receipts_contract_comp_normal'
       AND indexdef ILIKE '%status%cancelado%'
  ) AS indice_unicidade_ok;
