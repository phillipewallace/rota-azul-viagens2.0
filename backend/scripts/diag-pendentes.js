/**
 * Diagnóstico de Pendentes — somente leitura.
 *
 * Uso:  node scripts/diag-pendentes.js [competencia YYYY-MM]
 *       (default = mês atual)
 *
 * Mostra, para a competência informada, todo contrato ATIVO e o MOTIVO pelo
 * qual está (ou não) na lista de Pendentes:
 *   - quitado por RECIBO não cancelado (mostra número, tipo e status)
 *   - quitado por NF ATIVA vinculada
 *   - escondido pela primeira_competencia / data_inicio
 * Útil para descobrir por que um recibo cancelado "não voltou" aos Pendentes:
 * normalmente existe um recibo gêmeo ("sem validade") ou uma NF ativa vinculada.
 */
const fs = require('fs');
const path = require('path');

// Resolve o driver pg: no VPS usa o node_modules do backend; em dev local,
// cai para a instalação temporária usada nesta máquina.
function loadPg() {
  try { return require('pg'); } catch (_) { /* segue */ }
  return require(process.env.TEMP + '/pgdiag/node_modules/pg');
}
const { Pool } = loadPg();


// Lê DATABASE_URL do .env do backend se existir (produção/VPS)
let dbConfig;
try {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  if (m) dbConfig = { connectionString: m[1].trim() };
} catch (_) { /* usa default local */ }
if (!dbConfig) {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'roteirizador1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}
const pool = new Pool(dbConfig);

(async () => {
  try {
    const now = new Date();
    const comp = process.argv[2] ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(comp)) {
      console.error('Competência inválida. Use: node scripts/diag-pendentes.js 2026-08');
      process.exit(1);
    }

    console.log(`\n=== Diagnóstico de Pendentes · competência ${comp} ===\n`);

    const r = await pool.query(
      `SELECT c.id, c.numero AS contrato, emp.razao_social AS empresa,
              c.tipo_contrato, c.ativo, c.data_inicio, c.primeira_competencia,
              -- recibos (qualquer status) do contrato nesta competência
              (SELECT string_agg(rr.numero || ' [' || rr.status ||
                        COALESCE(' SV=' || COALESCE(rr.sem_validade::text,'f'), '') || ']'
                        || CASE WHEN bc.competencia IS NOT NULL THEN ' <vinc>' ELSE '' END,
                        ', ')
                 FROM erp_receipts rr
                 LEFT JOIN erp_receipt_billed_competences bc
                        ON bc.receipt_id = rr.id AND bc.competencia = $1
                WHERE rr.contract_id = c.id AND rr.competencia = $1
              ) AS recibos_na_comp,
              -- vínculos bc apontando para esta competência mesmo com recibo em outro mês
              (SELECT string_agg(rr.numero || ' [' || rr.status || '] comp=' || bc.competencia, ', ')
                 FROM erp_receipt_billed_competences bc
                 JOIN erp_receipts rr ON rr.id = bc.receipt_id
                WHERE bc.contract_id = c.id AND bc.competencia = $1
              ) AS vinculos_bc_comp,
              -- NFs ativas vinculadas a esta competência
              (SELECT string_agg(i.numero || ' emitida=' || TO_CHAR(i.data_emissao,'DD/MM/YYYY') ||
                        ' nf_comp=' || i.competencia, ', ')
                 FROM erp_invoice_billed_competences ibc
                 JOIN erp_invoices i ON i.id = ibc.invoice_id
                WHERE ibc.contract_id = c.id AND ibc.competencia = $1 AND i.status = 'ativa'
              ) AS nfs_ativas_vinculadas,
              EXISTS (
                SELECT 1 FROM erp_receipt_billed_competences bc
                  JOIN erp_receipts rr ON rr.id = bc.receipt_id
                 WHERE bc.contract_id = c.id AND bc.competencia = $1
                   AND rr.status <> 'cancelado'
              ) AS quitado_por_recibo,
              EXISTS (
                SELECT 1 FROM erp_invoice_billed_competences ibc
                  JOIN erp_invoices i ON i.id = ibc.invoice_id
                 WHERE ibc.contract_id = c.id AND ibc.competencia = $1
                   AND i.status = 'ativa'
              ) AS quitado_por_nf
         FROM erp_contracts c
         LEFT JOIN erp_companies emp ON emp.id = c.company_id
        WHERE c.ativo = TRUE
        ORDER BY c.numero`,
      [comp]
    );

    for (const row of r.rows) {
      const motivos = [];
      if (!row.ativo) motivos.push('contrato inativo');
      if (row.primeira_competencia && comp < row.primeira_competencia)
        motivos.push(`primeira_competencia=${row.primeira_competencia}`);
      if (row.quitado_por_recibo) motivos.push('RECIBO ativo quita a competência');
      if (row.quitado_por_nf) motivos.push('NF ATIVA vinculada quita a competência');
      const pendente = motivos.length === 0;
      console.log(
        `${pendente ? 'PENDENTE ' : 'ESCONDIDO'} · contrato ${row.contrato} (${row.empresa || '?'})`
      );
      if (row.recibos_na_comp) console.log(`    recibos na competência: ${row.recibos_na_comp}`);
      if (row.vinculos_bc_comp) console.log(`    vínculos bc nessa competência: ${row.vinculos_bc_comp}`);
      if (row.nfs_ativas_vinculadas) console.log(`    NFs ativas vinculadas: ${row.nfs_ativas_vinculadas}`);
      if (!pendente) console.log(`    motivo: ${motivos.join('; ')}`);
    }

    console.log('\nDica: um recibo CANCELADO nunca esconde pendência. Se a linha aparece como');
    console.log('"ESCONDIDO", olhe "recibos na competência" (gêmeo sem-validade ativo?) ou');
    console.log('"NFs ativas vinculadas" (canque/reexclua a NF ou use Reabrir no fluxo certo).');
  } catch (e) {
    console.error('ERRO:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
