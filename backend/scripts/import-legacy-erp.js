#!/usr/bin/env node
/**
 * Importa contratos legados (DSR + MIC BAN) do ERP antigo.
 *
 * FONTE: JSONs enriquecidos gerados por `convert-legacy-xlsx.py` a partir
 *        dos Excel originais. O JSON já traz endereço, descrição, CNO,
 *        responsável (nome/telefone/email), qtde de limpezas e data de
 *        entrega extraídos do texto de Observações.
 *
 * Regras:
 *  - Cliente: dedupe por CPF/CNPJ. Se já existe em `customers`, reutiliza.
 *             Se não, insere com endereço e contato. NUNCA sobrescreve
 *             clientes existentes (novos campos só entram em cliente novo).
 *  - Contrato: chave = numero prefixado (`DSR-2025/00026` / `MIC-2025/00026`).
 *      • sem --update-existing → PULA se já existe (comportamento antigo).
 *      • com --update-existing → UPDATE somente em campos hoje NULL/vazios.
 *  - `data_inicio` do contrato:
 *      • se JSON tem `data_entrega` → usa data_entrega.
 *      • senão → usa vigencia_inicial (como antes).
 *      • no --update-existing: só sobrescreve `data_inicio` se o valor atual
 *        no banco = vigencia_inicial do Excel (ou seja, nunca foi editado).
 *  - Empresas emissoras: lookup por CNPJ em `erp_companies`.
 *  - NUNCA deleta. Tudo dentro de transação; sem --apply é dry-run.
 *
 * Uso:
 *   node backend/scripts/import-legacy-erp.js
 *   node backend/scripts/import-legacy-erp.js --apply
 *   node backend/scripts/import-legacy-erp.js --update-existing
 *   node backend/scripts/import-legacy-erp.js --apply --update-existing
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');
const UPDATE_EXISTING = process.argv.includes('--update-existing');
const DATA_DIR = path.join(__dirname, 'legacy-data');

const SOURCES = [
  { file: 'dsr.json',    prefix: 'DSR', cnpj: '26907815000142', label: 'DSR (Debora de S Rodrigues)' },
  { file: 'micban.json', prefix: 'MIC', cnpj: '42264001000193', label: 'MIC BAN' },
];

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const c = {
  b:  s => `\x1b[34m${s}\x1b[0m`,
  g:  s => `\x1b[32m${s}\x1b[0m`,
  y:  s => `\x1b[33m${s}\x1b[0m`,
  r:  s => `\x1b[31m${s}\x1b[0m`,
  dim:s => `\x1b[2m${s}\x1b[0m`,
};

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return d.toISOString().slice(0, 10);
}
function parseNumber(v) {
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^\d,.\-]/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
}
function parseDia(v) {
  const n = parseInt(v, 10);
  if (!isFinite(n) || n < 1) return 10;
  return Math.min(n, 28);
}
function personType(doc) {
  return doc && doc.length === 11 ? 'PF' : 'PJ';
}
function situacaoToAtivo(s) {
  const norm = (s || '').toLowerCase();
  if (norm.startsWith('ativ'))   return { ativo: true,  motivo: null };
  if (norm.startsWith('susp'))   return { ativo: false, motivo: 'Migração: Suspenso no ERP anterior' };
  if (norm.startsWith('cancel')) return { ativo: false, motivo: 'Migração: Cancelado no ERP anterior' };
  return { ativo: true, motivo: null };
}
function isEmpty(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

async function findOrCreateCustomer(client, row, stats) {
  const doc = row.documento;
  const name = row.razao_social || row.nome_fantasia || 'Cliente sem nome';

  if (doc) {
    const found = await client.query(
      `SELECT id FROM customers WHERE regexp_replace(coalesce(document,''),'\\D','','g') = $1 LIMIT 1`,
      [doc]
    );
    if (found.rows[0]) {
      stats.customersReused++;
      return found.rows[0].id;
    }
  } else {
    const found = await client.query(
      `SELECT id FROM customers WHERE lower(customer_name) = lower($1) LIMIT 1`,
      [name]
    );
    if (found.rows[0]) {
      stats.customersReused++;
      return found.rows[0].id;
    }
  }

  if (!APPLY) {
    stats.customersNew++;
    return '00000000-0000-0000-0000-000000000000';
  }

  const ins = await client.query(
    `INSERT INTO customers (customer_name, document, person_type, email, contact_phone, address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [name, doc, personType(doc), row.responsavel_email || row.email,
     row.responsavel_telefone || row.telefone, row.endereco]
  );
  stats.customersNew++;
  return ins.rows[0].id;
}

/** monta observações limpas, prefixando os metadados */
function buildObservacoes(r) {
  const parts = [];
  if (r.quantidade_limpezas) parts.push(`Limpezas: ${r.quantidade_limpezas}`);
  if (r.observacoes) parts.push(r.observacoes);
  return parts.join('\n\n') || null;
}

async function importContract(client, src, r, stats) {
  const numeroPrefixado = `${src.prefix}-${r.numero}`;

  const existing = await client.query(
    `SELECT id, data_inicio, endereco_obra, cno, descricao,
            responsavel_nome, responsavel_telefone, responsavel_email,
            observacoes, motivo_encerramento, ativo
       FROM erp_contracts WHERE numero = $1 LIMIT 1`,
    [numeroPrefixado]
  );

  const customerId = await findOrCreateCustomer(client, r, stats);
  const { ativo, motivo } = situacaoToAtivo(r.situacao);
  const vigencia = parseDate(r.vigencia_inicial);
  const dataEntrega = r.data_entrega ? parseDate(r.data_entrega) : null;
  const dataInicio = dataEntrega || vigencia || new Date().toISOString().slice(0, 10);
  const observacoesFinal = buildObservacoes(r);

  if (existing.rows[0]) {
    if (!UPDATE_EXISTING) {
      stats.contractsSkipped++;
      return;
    }
    const cur = existing.rows[0];
    const sets = [];
    const vals = [];
    const tags = [];
    const push = (col, val, tag) => {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
      tags.push(tag);
    };

    if (isEmpty(cur.endereco_obra) && r.endereco)             push('endereco_obra', r.endereco, `+endereco`);
    if (isEmpty(cur.descricao)     && r.descricao)            push('descricao',     r.descricao, `+descricao`);
    if (isEmpty(cur.cno)           && r.cno)                  push('cno',           r.cno, `+cno=${r.cno}`);
    if (isEmpty(cur.responsavel_nome)     && r.responsavel_nome)     push('responsavel_nome',     r.responsavel_nome, `+resp:${r.responsavel_nome}`);
    if (isEmpty(cur.responsavel_telefone) && r.responsavel_telefone) push('responsavel_telefone', r.responsavel_telefone, `+tel:${r.responsavel_telefone}`);
    if (isEmpty(cur.responsavel_email)    && r.responsavel_email)    push('responsavel_email',    r.responsavel_email, `+email`);

    // data_inicio só sobrescreve se atual = vigencia_inicial (nunca editado) e temos data de entrega
    if (dataEntrega) {
      const curDataIso = cur.data_inicio ? new Date(cur.data_inicio).toISOString().slice(0,10) : null;
      if (curDataIso === vigencia && curDataIso !== dataEntrega) {
        push('data_inicio', dataEntrega, `+data_inicio=${dataEntrega}`);
      }
    }
    // observações: só concatena "Limpezas: X" se não estiver lá
    if (r.quantidade_limpezas && (!cur.observacoes || !/limpezas\s*:/i.test(cur.observacoes))) {
      const merged = [cur.observacoes, `Limpezas: ${r.quantidade_limpezas}`].filter(Boolean).join('\n');
      push('observacoes', merged, `+limpezas`);
    }

    if (sets.length === 0) {
      stats.contractsUpToDate++;
      return;
    }
    stats.contractsUpdated++;
    console.log(c.dim(`  ~ ${numeroPrefixado}  `) + tags.join(' '));
    if (APPLY) {
      vals.push(cur.id);
      await client.query(
        `UPDATE erp_contracts SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`,
        vals
      );
    }
    return;
  }

  // contrato novo
  const tags = [
    r.endereco ? '+end' : null,
    r.descricao ? '+desc' : null,
    r.cno ? `+cno` : null,
    r.responsavel_nome ? `+resp` : null,
    dataEntrega ? `+data_entrega` : null,
  ].filter(Boolean).join(' ');
  console.log(c.g(`  + ${numeroPrefixado}  `) + c.dim(tags));

  if (APPLY) {
    await client.query(
      `INSERT INTO erp_contracts
         (numero, company_id, customer_id, origem, tipo_contrato,
          data_inicio, dia_vencimento, valor_mensal,
          ativo, encerrado_em, motivo_encerramento, observacoes,
          endereco_obra, descricao, cno,
          responsavel_nome, responsavel_telefone, responsavel_email)
       VALUES ($1,$2,$3,'importacao','locacao',
               $4,$5,$6,
               $7, CASE WHEN $7=FALSE THEN NOW() ELSE NULL END, $8, $9,
               $10,$11,$12,
               $13,$14,$15)`,
      [numeroPrefixado, src.companyId, customerId,
       dataInicio, parseDia(r.dia_faturamento), parseNumber(r.valor_total),
       ativo, motivo, observacoesFinal,
       r.endereco, r.descricao, r.cno,
       r.responsavel_nome, r.responsavel_telefone, r.responsavel_email]
    );
  }
  stats.contractsNew++;
}

async function importSource(client, src, stats) {
  const rows = JSON.parse(fs.readFileSync(path.join(DATA_DIR, src.file), 'utf8'));
  console.log(c.b(`\n[${src.label}]`) + ` ${rows.length} linhas`);

  const comp = await client.query(
    `SELECT id, razao_social FROM erp_companies
      WHERE regexp_replace(cnpj,'\\D','','g') = $1 LIMIT 1`,
    [src.cnpj]
  );
  if (!comp.rows[0]) {
    throw new Error(`erp_companies: CNPJ ${src.cnpj} (${src.label}) não encontrado.`);
  }
  src.companyId = comp.rows[0].id;
  console.log(c.dim(`  empresa: ${comp.rows[0].razao_social}`));

  for (const r of rows) {
    try {
      await importContract(client, src, r, stats);
    } catch (e) {
      stats.errors.push({ numero: r.numero, msg: e.message });
      console.log(c.r(`  ✗ ${r.numero}: ${e.message}`));
    }
  }
}

(async () => {
  console.log(c.b(`\n=== Importação legada ERP === modo: ${APPLY ? c.g('APPLY') : c.y('DRY-RUN')}  ${UPDATE_EXISTING ? c.b('[UPDATE-EXISTING]') : c.dim('[skip-existing]')}`));
  const client = await pool.connect();
  const stats = {
    customersNew: 0, customersReused: 0,
    contractsNew: 0, contractsSkipped: 0,
    contractsUpdated: 0, contractsUpToDate: 0,
    errors: [],
  };
  try {
    await client.query('BEGIN');
    for (const src of SOURCES) await importSource(client, src, stats);
    if (APPLY) {
      await client.query('COMMIT');
      console.log(c.g('\n✅ COMMIT — dados persistidos.'));
    } else {
      await client.query('ROLLBACK');
      console.log(c.y('\n⚪ ROLLBACK (dry-run). Rode com --apply para persistir.'));
    }
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(c.r(`\n❌ ROLLBACK: ${e.message}`));
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n' + c.b('Resumo:'));
  console.log(`  Clientes novos:          ${stats.customersNew}`);
  console.log(`  Clientes reaproveitados: ${stats.customersReused}`);
  console.log(`  Contratos novos:         ${stats.contractsNew}`);
  console.log(`  Contratos pulados:       ${stats.contractsSkipped} (já existiam, sem --update-existing)`);
  console.log(`  Contratos atualizados:   ${stats.contractsUpdated}`);
  console.log(`  Contratos já completos:  ${stats.contractsUpToDate}`);
  console.log(`  Erros:                   ${stats.errors.length}`);
})();
