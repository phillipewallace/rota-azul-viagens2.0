-- Migration: recibo NORMAL e SEM VALIDADE podem coexistir na mesma competência
-- ----------------------------------------------------------------------------
-- Antes: UNIQUE (contract_id, competencia) impedia gerar o recibo oficial de
--        setembro quando já existia um recibo "sem validade jurídica" da mesma
--        competência (erro 409 "Recibo desta competência já existe").
-- Depois: unicidade passa a ser POR TIPO:
--   - 1 recibo normal       por (contract_id, competencia)
--   - 1 recibo sem validade por (contract_id, competencia)
-- Idempotente: pode rodar em todo deploy sem efeito colateral.
-- ----------------------------------------------------------------------------

-- Garante que a coluna existe (caso migration-erp-recibo-sem-validade.sql
-- ainda não tenha rodado neste banco).
ALTER TABLE erp_receipts ADD COLUMN IF NOT EXISTS sem_validade BOOLEAN NOT NULL DEFAULT FALSE;

-- Remove a constraint antiga (nome padrão gerado pelo Postgres).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'erp_receipts_contract_id_competencia_key'
       AND conrelid = 'erp_receipts'::regclass
  ) THEN
    ALTER TABLE erp_receipts DROP CONSTRAINT erp_receipts_contract_id_competencia_key;
  END IF;
END $$;

-- Unicidade por tipo (índices parciais). Como a constraint antiga já impedia
-- duplicatas de qualquer tipo, não há dados que violem os novos índices.
CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_receipts_contract_comp_normal
  ON erp_receipts (contract_id, competencia)
  WHERE COALESCE(sem_validade, FALSE) = FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_erp_receipts_contract_comp_sv
  ON erp_receipts (contract_id, competencia)
  WHERE sem_validade = TRUE;
