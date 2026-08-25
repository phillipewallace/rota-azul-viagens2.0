#!/usr/bin/env node
/**
 * ROLLBACK da importação das planilhas de COBRANÇA (MICBAN / DSR).
 *
 * Apaga SOMENTE o que o import-cobranca-erp.js gravou:
 *   - erp_contracts com origem='importacao' E numero LIKE '%-COB-%'
 *   - registros filhos que apontam para esses contratos (descobertos via FK)
 *   - opcional: clientes órfãos criados pela importação (--purge-customers)
 *
 * Uso (dentro de /var/www/rota-azul-viagens/backend):
 *   node scripts/rollback-cobranca-erp.js                 # DRY-RUN (não apaga nada)
 *   node scripts/rollback-cobranca-erp.js --apply         # apaga contratos COB + filhos
 *   node scripts/rollback-cobranca-erp.js --apply --purge-customers --since 2026-08-01
 *
 * Nunca toca em: users, contratos legados (MIC-2025/xxxx), rotas, sanitários.
 */
require('dotenv').config();
const { Pool } = require('pg');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const PURGE_CUSTOMERS = args.includes('--purge-customers');
const sinceIdx = args.indexOf('--since');
const SINCE = sinceIdx >= 0 ? args[sinceIdx + 1] : null;

const c = {
  b: (s) => `\x1b[34m${s}\x1b[0m`, g: (s) => `\x1b[32m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'roteirizador1',
  user: process.env.DB_USER || 'lipe',
  password: process.env.DB_PASSWORD,
});

const CONTRACT_FILTER = `origem = 'importacao' AND numero LIKE '%-COB-%'`;

async function childTables(client, targetTable) {
  const { rows } = await client.query(
    `SELECT src.relname AS table_name, att.attname AS column_name
       FROM pg_constraint con
       JOIN pg_class src ON src.oid = con.conrelid
       JOIN pg_class tgt ON tgt.oid = con.confrelid
       JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND tgt.relname = $1
      ORDER BY src.relname`, [targetTable]);
  return rows;
}

(async () => {
  const client = await pool.connect();
  console.log(c.b(`\n=== ROLLBACK COBRANÇA === modo: ${APPLY ? c.r('APPLY (apaga)') : c.y('DRY-RUN')}`));
  try {
    await client.query('BEGIN');

    const { rows: [{ count: total }] } = await client.query(
      `SELECT COUNT(*)::int AS count FROM erp_contracts WHERE ${CONTRACT_FILTER}`);
    console.log(`Contratos de cobrança encontrados: ${c.b(total)}`);

    const sample = await client.query(
      `SELECT numero FROM erp_contracts WHERE ${CONTRACT_FILTER} ORDER BY numero LIMIT 5`);
    sample.rows.forEach((r) => console.log(c.dim(`  · ${r.numero}`)));
    if (total > 5) console.log(c.dim(`  … e mais ${total - 5}`));

    if (!total) {
      console.log(c.y('Nada a fazer.'));
      await client.query('ROLLBACK');
      return;
    }

    // 1) filhos dos contratos
    const kids = await childTables(client, 'erp_contracts');
    for (const k of kids) {
      const sel = `SELECT COUNT(*)::int AS count FROM ${k.table_name} WHERE ${k.column_name} IN
                     (SELECT id FROM erp_contracts WHERE ${CONTRACT_FILTER})`;
      const { rows: [{ count }] } = await client.query(sel);
      if (!count) continue;
      console.log(`${APPLY ? c.r('DEL') : c.y('would del')} ${k.table_name}.${k.column_name}: ${count}`);
      if (APPLY) {
        await client.query(`DELETE FROM ${k.table_name} WHERE ${k.column_name} IN
                              (SELECT id FROM erp_contracts WHERE ${CONTRACT_FILTER})`);
      }
    }

    // 2) contratos
    console.log(`${APPLY ? c.r('DEL') : c.y('would del')} erp_contracts: ${total}`);
    if (APPLY) await client.query(`DELETE FROM erp_contracts WHERE ${CONTRACT_FILTER}`);

    // 3) clientes órfãos criados pela importação (opcional)
    if (PURGE_CUSTOMERS) {
      const custKids = (await childTables(client, 'customers')).filter((k) => k.table_name !== 'customers');
      const notRef = custKids
        .map((k) => `NOT EXISTS (SELECT 1 FROM ${k.table_name} x WHERE x.${k.column_name} = cu.id)`)
        .join(' AND ') || 'TRUE';
      const sinceClause = SINCE ? `AND cu.created_at >= '${SINCE}'::date` : '';
      const q = `FROM customers cu WHERE ${notRef} ${sinceClause}`;
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*)::int AS count ${q}`);
      console.log(`${APPLY ? c.r('DEL') : c.y('would del')} customers órfãos${SINCE ? ` (created_at >= ${SINCE})` : ''}: ${count}`);
      if (APPLY && count) {
        await client.query(`DELETE FROM customers cu WHERE cu.id IN (SELECT cu.id ${q})`);
      }
    } else {
      console.log(c.dim('customers: preservados (use --purge-customers --since AAAA-MM-DD para limpar órfãos)'));
    }

    if (APPLY) {
      await client.query('COMMIT');
      console.log(c.g('\n✅ COMMIT — rollback aplicado.'));
    } else {
      await client.query('ROLLBACK');
      console.log(c.y('\n↩️  DRY-RUN — nada foi alterado. Rode com --apply para efetivar.'));
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(c.r(`Erro: ${e.message}`));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
