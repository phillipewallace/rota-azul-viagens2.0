#!/usr/bin/env node
/**
 * Importa os contratos das planilhas de COBRANÇA (MICBAN / DSR) para o ERP.
 *
 * FONTE: JSONs gerados por `convert-cobranca-xlsx.py`
 *        (backend/scripts/legacy-data/cobranca-{micban,dsr}.json)
 *
 * Regras:
 *  - Cliente: dedupe por CNPJ (fallback: razão social). NUNCA sobrescreve
 *             cliente existente — só completa campos hoje vazios.
 *  - Contrato: 1 por (cliente + obra + tipo), número prefixado pela empresa
 *              emissora: `DSR-COB-2026/08-001` / `MIC-COB-2026/08-001`.
 *  - Tipo: sanitário químico -> `obra`; carretinha / caminhão pipa /
 *          apenas limpeza / não sanitário -> `outro`. O texto original da
 *          planilha vai SEMPRE na DESCRIÇÃO do contrato (sem tocar inventário).
 *  - Ativo: contrato presente na última competência da planilha = ativo.
 *           Caso contrário: inativo, com `encerrado_em` na última competência.
 *  - NUNCA deleta. Tudo em transação; sem --apply é dry-run (ROLLBACK).
 *
 * Uso:
 *   node backend/scripts/import-cobranca-erp.js                 # dry-run
 *   node backend/scripts/import-cobranca-erp.js --apply
 *   node backend/scripts/import-cobranca-erp.js --apply --update-existing
 *   node backend/scripts/import-cobranca-erp.js --only=DSR --limit=5
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const UPDATE_EXISTING = argv.includes('--update-existing');
// Meses de tolerância para considerar um contrato ATIVO. A planilha do mês
// corrente costuma estar incompleta no início do mês, então por padrão quem
// foi cobrado no mês anterior também entra como ativo. Use --grace=0 para
// exigir presença na última competência.
const GRACE = parseInt((argv.find(a => a.startsWith('--grace=')) || '').split('=')[1] || '1', 10);
// Confirmado pelo cliente: TODOS os contratos das duas planilhas estão ativos hoje.
// Por padrão importamos tudo como ativo. Use --use-grace para voltar ao corte por
// competência (ativo = cobrado nos últimos GRACE meses).
const ALL_ACTIVE = !argv.includes('--use-grace');
const ONLY = (argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || null;
const LIMIT = parseInt((argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10);
const DATA_DIR = path.join(__dirname, 'legacy-data');

const SOURCES = [
  { file: 'cobranca-dsr.json',    prefix: 'DSR', cnpj: '26907815000142', label: 'DSR (Debora de S Rodrigues)' },
  { file: 'cobranca-micban.json', prefix: 'MIC', cnpj: '42264001000193', label: 'MIC BAN' },
];

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const c = {
  b: s => `\x1b[34m${s}\x1b[0m`,
  g: s => `\x1b[32m${s}\x1b[0m`,
  y: s => `\x1b[33m${s}\x1b[0m`,
  r: s => `\x1b[31m${s}\x1b[0m`,
  dim: s => `\x1b[2m${s}\x1b[0m`,
};

const isEmpty = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const personType = doc => (doc && doc.length === 11 ? 'PF' : 'PJ');
// Trunca strings para caber nas colunas VARCHAR(n) do schema.
const cut = (v, n) => (typeof v === 'string' && v.length > n ? v.slice(0, n) : v);

// JSONs gerados pelo pandas podem conter "NaT" em campos de data vazios.
// Nunca envia valores inválidos ao PostgreSQL; datas ausentes viram null.
function validIsoDate(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [year, month, day] = v.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return v;
}


function lastDayOfCompetencia(comp) {
  if (!/^\d{4}-\d{2}$/.test(comp || '')) return null;
  const [y, m] = comp.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function firstDayOfCompetencia(comp) {
  if (!/^\d{4}-\d{2}$/.test(comp || '')) return null;
  return `${comp}-01`;
}

// Subtrai `n` meses de uma competência 'YYYY-MM'.
function shiftCompetencia(comp, n) {
  if (!/^\d{4}-\d{2}$/.test(comp || '')) return comp;
  const [y, m] = comp.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildObservacoes(r) {
  const parts = [];
  if (r.qtd) parts.push(`Qtde: ${r.qtd}`);
  if (r.limpezas) parts.push(`Limpezas/mês: ${r.limpezas}`);
  if (r.pedido_compra) parts.push(`Pedido/Ordem de compra: ${r.pedido_compra}`);
  if (Array.isArray(r.emails) && r.emails.length > 1) {
    parts.push(`E-mails NF: ${r.emails.join(', ')}`);
  }
  const obsHist = (r.historico || [])
    .filter(h => h.observacao)
    .map(h => `[${h.competencia}] ${h.observacao}`);
  const obsUnicas = [...new Set(obsHist)];
  if (obsUnicas.length) parts.push(`Observações da planilha:\n${obsUnicas.join('\n')}`);
  const nfs = (r.historico || []).filter(h => h.nf).map(h => `${h.competencia}: NF ${h.nf}`);
  if (nfs.length) parts.push(`Histórico de faturamento (planilha):\n${nfs.join('\n')}`);
  parts.push(`Importado da planilha de cobrança (${r.primeira_competencia} → ${r.ultima_competencia}).`);
  return parts.join('\n\n') || null;
}

async function findOrCreateCustomer(client, r, stats) {
  const doc = r.documento || null;
  const name = r.razao_social || r.empresa_planilha || 'Cliente sem nome';

  let found = null;
  if (doc) {
    const q = await client.query(
      `SELECT id, address, contact_phone, email FROM customers
        WHERE regexp_replace(coalesce(document,''),'\\D','','g') = $1 LIMIT 1`, [doc]);
    found = q.rows[0] || null;
  }
  if (!found) {
    const q = await client.query(
      `SELECT id, address, contact_phone, email FROM customers
        WHERE lower(customer_name) = lower($1) LIMIT 1`, [name]);
    found = q.rows[0] || null;
  }

  if (found) {
    stats.customersReused++;
    // completa somente campos vazios do cliente existente
    const sets = [];
    const vals = [];
    const push = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
    if (isEmpty(found.address) && r.endereco_cliente) push('address', r.endereco_cliente);
    if (isEmpty(found.contact_phone) && r.responsavel_telefone) push('contact_phone', cut(r.responsavel_telefone, 32));
    if (isEmpty(found.email) && r.responsavel_email) push('email', cut(r.responsavel_email, 160));
    if (sets.length) {
      stats.customersEnriched++;
      if (APPLY) {
        vals.push(found.id);
        await client.query(`UPDATE customers SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
      }
    }
    return found.id;
  }

  stats.customersNew++;
  if (!APPLY) return '00000000-0000-0000-0000-000000000000';
  const ins = await client.query(
    `INSERT INTO customers (customer_name, document, person_type, email, contact_phone, address)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [cut(name, 160), doc, personType(doc), cut(r.responsavel_email, 160), cut(r.responsavel_telefone, 32), r.endereco_cliente]
  );
  return ins.rows[0].id;
}


async function importRow(client, src, r, cutoffAtivo, stats) {
  const numero = r.numero;
  const ativo = ALL_ACTIVE || r.ultima_competencia >= cutoffAtivo;
  const encerradoEm = ativo ? null : lastDayOfCompetencia(r.ultima_competencia);
  const ultimoHist = (r.historico || [])[r.historico.length - 1] || {};
  const dataInicio = validIsoDate(r.data_entrega)
    || validIsoDate(ultimoHist.periodo_inicio)
    || firstDayOfCompetencia(r.primeira_competencia)
    || new Date().toISOString().slice(0, 10);
  const dataFim = validIsoDate(r.data_retirada) || (ativo ? null : encerradoEm);
  const observacoes = buildObservacoes(r);

  const existing = await client.query(
    `SELECT id, descricao, endereco_obra, cno, observacoes, data_inicio,
            responsavel_nome, responsavel_telefone, responsavel_email, tipo_contrato
       FROM erp_contracts WHERE numero = $1 LIMIT 1`, [numero]);

  const customerId = await findOrCreateCustomer(client, r, stats);

  if (existing.rows[0]) {
    if (!UPDATE_EXISTING) { stats.contractsSkipped++; return; }
    const cur = existing.rows[0];
    const sets = [], vals = [], tags = [];
    const push = (col, val, tag) => { vals.push(val); sets.push(`${col} = $${vals.length}`); tags.push(tag); };
    if (isEmpty(cur.descricao) && r.descricao) push('descricao', r.descricao, '+descricao');
    if (isEmpty(cur.endereco_obra) && r.endereco_obra) push('endereco_obra', r.endereco_obra, '+obra');
    if (isEmpty(cur.cno) && r.cno) push('cno', r.cno, '+cno');
    if (isEmpty(cur.responsavel_nome) && r.responsavel_nome) push('responsavel_nome', cut(r.responsavel_nome, 160), '+resp');
    if (isEmpty(cur.responsavel_telefone) && r.responsavel_telefone) push('responsavel_telefone', cut(r.responsavel_telefone, 32), '+tel');
    if (isEmpty(cur.responsavel_email) && r.responsavel_email) push('responsavel_email', cut(r.responsavel_email, 160), '+email');

    if (isEmpty(cur.observacoes) && observacoes) push('observacoes', observacoes, '+obs');
    if (!sets.length) { stats.contractsUpToDate++; return; }
    stats.contractsUpdated++;
    console.log(c.dim(`  ~ ${numero}  `) + tags.join(' '));
    if (APPLY) {
      vals.push(cur.id);
      await client.query(
        `UPDATE erp_contracts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
    }
    return;
  }

  console.log(
    (ativo ? c.g(`  + ${numero}`) : c.dim(`  + ${numero}`)) +
    c.dim(` [${r.tipo_contrato}] ${(r.razao_social || '').slice(0, 34)} · R$ ${r.valor_mensal} · ${r.primeira_competencia}→${r.ultima_competencia}${ativo ? '' : ' (encerrado)'}`)
  );

  if (APPLY) {
    await client.query(
      `INSERT INTO erp_contracts
         (numero, company_id, customer_id, origem, tipo_contrato, descricao,
          data_inicio, data_fim, dia_vencimento, valor_mensal,
          ativo, encerrado_em, motivo_encerramento, observacoes,
          endereco_obra, cno,
          responsavel_nome, responsavel_telefone, responsavel_email)
       VALUES ($1,$2,$3,'importacao',$4,$5,
               $6,$7,$8,$9,
               $10, $11, $12, $13,
               $14,$15,
               $16,$17,$18)`,
      [numero, src.companyId, customerId, r.tipo_contrato, r.descricao,
       dataInicio, dataFim,
       Math.min(28, Math.max(1, parseInt(r.dia_vencimento, 10) || 10)),
       r.valor_mensal || 0,
       ativo, encerradoEm,
       ativo ? null : `Migração: última cobrança em ${r.ultima_competencia}`,
       observacoes, r.endereco_obra, cut(r.cno, 60),
       cut(r.responsavel_nome, 160), cut(r.responsavel_telefone, 32), cut(r.responsavel_email, 160)]
    );

  }
  stats.contractsNew++;
  if (ativo) stats.contractsAtivos++;
}

async function importSource(client, src, stats) {
  const file = path.join(DATA_DIR, src.file);
  if (!fs.existsSync(file)) {
    console.log(c.y(`\n[${src.label}] ${src.file} não encontrado — rode o convert-cobranca-xlsx.py primeiro.`));
    return;
  }
  let rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (LIMIT > 0) rows = rows.slice(0, LIMIT);
  console.log(c.b(`\n[${src.label}]`) + ` ${rows.length} contratos candidatos`);

  const comp = await client.query(
    `SELECT id, razao_social FROM erp_companies
      WHERE regexp_replace(cnpj,'\\D','','g') = $1 LIMIT 1`, [src.cnpj]);
  if (!comp.rows[0]) throw new Error(`erp_companies: CNPJ ${src.cnpj} (${src.label}) não encontrado.`);
  src.companyId = comp.rows[0].id;
  console.log(c.dim(`  empresa emissora: ${comp.rows[0].razao_social}`));

  const ultimaCompGlobal = rows.reduce((m, r) => (r.ultima_competencia > m ? r.ultima_competencia : m), '');
  const cutoffAtivo = shiftCompetencia(ultimaCompGlobal, GRACE);
  console.log(c.dim(ALL_ACTIVE
    ? `  última competência da planilha: ${ultimaCompGlobal} · TODOS os contratos serão importados como ATIVOS (--use-grace para usar corte por competência)`
    : `  última competência da planilha: ${ultimaCompGlobal} · ativo = cobrado em >= ${cutoffAtivo} (grace ${GRACE} mês/es)`));

  for (const r of rows) {
    // Cada linha em SAVEPOINT: um erro não aborta a transação inteira.
    await client.query('SAVEPOINT row_sp');
    try {
      await importRow(client, src, r, cutoffAtivo, stats);
      await client.query('RELEASE SAVEPOINT row_sp');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT row_sp').catch(() => {});
      const det = [e.code && `code=${e.code}`, e.column && `col=${e.column}`,
        e.constraint && `constraint=${e.constraint}`, e.detail].filter(Boolean).join(' ');
      stats.errors.push({ numero: r.numero, msg: e.message, det });
      console.log(c.r(`  ✗ ${r.numero}: ${e.message}`) + (det ? c.dim(`  (${det})`) : ''));
    }
  }
}


(async () => {
  console.log(c.b(`\n=== Importação COBRANÇA → ERP === modo: ${APPLY ? c.g('APPLY') : c.y('DRY-RUN')} ${UPDATE_EXISTING ? c.b('[UPDATE-EXISTING]') : c.dim('[skip-existing]')}`));
  const client = await pool.connect();
  const stats = {
    customersNew: 0, customersReused: 0, customersEnriched: 0,
    contractsNew: 0, contractsAtivos: 0, contractsSkipped: 0,
    contractsUpdated: 0, contractsUpToDate: 0, errors: [],
  };
  try {
    await client.query('BEGIN');
    for (const src of SOURCES) {
      if (ONLY && src.prefix !== ONLY.toUpperCase()) continue;
      await importSource(client, src, stats);
    }
    if (APPLY) {
      await client.query('COMMIT');
      console.log(c.g('\n✅ COMMIT — dados persistidos.'));
    } else {
      await client.query('ROLLBACK');
      console.log(c.y('\n⚪ ROLLBACK (dry-run). Rode com --apply para persistir.'));
    }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(c.r(`\n❌ ROLLBACK: ${e.message}`));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n' + c.b('Resumo:'));
  console.log(`  Clientes novos:           ${stats.customersNew}`);
  console.log(`  Clientes reaproveitados:  ${stats.customersReused}`);
  console.log(`  Clientes complementados:  ${stats.customersEnriched}`);
  console.log(`  Contratos novos:          ${stats.contractsNew} (ativos: ${stats.contractsAtivos})`);
  console.log(`  Contratos pulados:        ${stats.contractsSkipped}`);
  console.log(`  Contratos atualizados:    ${stats.contractsUpdated}`);
  console.log(`  Contratos já completos:   ${stats.contractsUpToDate}`);
  console.log(`  Erros:                    ${stats.errors.length}`);
  if (stats.errors.length) {
    const byMsg = new Map();
    for (const e of stats.errors) {
      const k = `${e.msg} ${e.det || ''}`.trim();
      byMsg.set(k, (byMsg.get(k) || 0) + 1);
    }
    console.log('\n' + c.y('Erros agrupados:'));
    for (const [msg, n] of [...byMsg.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${n}x  ${msg}`);
    }
    // Evita que o deploy grave o marker de conclusão quando houve importação parcial.
    process.exitCode = 1;
  }
})();

