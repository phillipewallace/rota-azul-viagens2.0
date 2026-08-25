import { sendError } from '../utils/apiError';
import { parsePagination, sendPaginated } from '../utils/pagination';
/**
 * ERP · Medições — proposta de faturamento (pré-recibo).
 * CRUD + numeração sequencial (MED-YYYY-NNNN). Sem fluxo de pagamento:
 * a medição é apenas gerada e armazenada.
 */
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SEL = `
  m.id, m.numero,
  m.cliente_documento AS "clienteDocumento",
  m.cliente_nome      AS "clienteNome",
  m.customer_id       AS "customerId",
  m.company_id        AS "companyId",
  m.competencia,
  m.periodo_inicio    AS "periodoInicio",
  m.periodo_fim       AS "periodoFim",
  m.subtotal, m.desconto, m.total,
  m.observacoes, m.snapshot,
  m.pdf_gerado_em     AS "pdfGeradoEm",
  m.created_by        AS "createdBy",
  m.created_at        AS "createdAt",
  m.updated_at        AS "updatedAt",
  emp.razao_social    AS "companyRazaoSocial",
  emp.cnpj            AS "companyCnpj",
  cu.customer_name    AS "customerName",
  cu.document         AS "customerDocument"
`;

function requireCompanyId(value: any) {
  const companyId = typeof value === 'string' ? value.trim() : '';
  if (!UUID_RE.test(companyId)) {
    const err: any = new Error('Empresa emissora obrigatória para numeração por empresa.');
    err.status = 400;
    throw err;
  }
  return companyId;
}

// Constrói WHERE reutilizável para GET / e /stats/kpis.
function buildMedicoesWhere(q: any) {
  const conds: string[] = [];
  const params: any[] = [];
  const { competencia, clienteDoc, customerId, companyId, from, to, search } = q || {};
  if (competencia) { params.push(competencia); conds.push(`m.competencia = $${params.length}`); }
  if (clienteDoc)  { params.push(clienteDoc);  conds.push(`m.cliente_documento = $${params.length}`); }
  if (customerId)  { params.push(customerId);  conds.push(`m.customer_id = $${params.length}`); }
  if (companyId)   { params.push(companyId);   conds.push(`m.company_id = $${params.length}`); }
  if (from)        { params.push(from);        conds.push(`m.created_at::date >= $${params.length}`); }
  if (to)          { params.push(to);          conds.push(`m.created_at::date <= $${params.length}`); }
  if (search) {
    params.push(`%${String(search).toLowerCase()}%`);
    const n = params.length;
    conds.push(`(LOWER(m.numero) LIKE $${n}
              OR LOWER(COALESCE(m.cliente_nome,'')) LIKE $${n}
              OR LOWER(COALESCE(cu.customer_name,'')) LIKE $${n}
              OR LOWER(COALESCE(emp.razao_social,'')) LIKE $${n})`);
  }
  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

// GET / — lista
router.get('/', async (req, res) => {
  try {
    const { where, params } = buildMedicoesWhere(req.query);
    const fromSql = `FROM erp_medicoes m
         LEFT JOIN erp_companies emp ON emp.id = m.company_id
         LEFT JOIN customers cu ON cu.id = m.customer_id
         ${where}`;
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT ${SEL},
              (SELECT COUNT(*) FROM erp_medicao_itens i WHERE i.medicao_id = m.id)::int AS "itensCount"
         ${fromSql}
         ORDER BY m.created_at DESC ${pg.sql}`,
      [...params, ...pg.params],
    );
    if (pg.paginated) {
      const totalQ = await pool.query(`SELECT COUNT(*)::int AS c ${fromSql}`, params);
      return sendPaginated(res, rowsQ.rows, totalQ.rows[0].c, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) { sendError(res, e); }
});

// KPIs (respeitam os mesmos filtros)
router.get('/stats/kpis', async (req, res) => {
  try {
    const { where, params } = buildMedicoesWhere(req.query);
    const q = await pool.query(`
      SELECT
        COUNT(*)::int                           AS total,
        COALESCE(SUM(m.total), 0)::float        AS "totalValor",
        COALESCE(AVG(m.total), 0)::float        AS "ticketMedio",
        COUNT(DISTINCT COALESCE(m.customer_id::text, m.cliente_documento))::int AS "clientesDistintos"
      FROM erp_medicoes m
      LEFT JOIN erp_companies emp ON emp.id = m.company_id
      LEFT JOIN customers cu ON cu.id = m.customer_id
      ${where}`, params);
    res.json(q.rows[0] || { total: 0, totalValor: 0, ticketMedio: 0, clientesDistintos: 0 });
  } catch (e: any) { sendError(res, e); }
});

// GET /:id — detalhe com itens
router.get('/:id', async (req, res) => {
  try {
    const m = await pool.query(
      `SELECT ${SEL}
         FROM erp_medicoes m
         LEFT JOIN erp_companies emp ON emp.id = m.company_id
         LEFT JOIN customers cu ON cu.id = m.customer_id
        WHERE m.id = $1`,
      [req.params.id],
    );
    if (!m.rows[0]) return res.status(404).json({ error: 'medição não encontrada' });
    const items = await pool.query(
      `SELECT id, medicao_id AS "medicaoId", contract_id AS "contractId",
              contract_numero AS "contractNumero", descricao, quantidade, unidade,
              valor_unit AS "valorUnit", desconto_item AS "descontoItem",
              valor_total AS "valorTotal",
              periodo_inicio AS "periodoInicio", periodo_fim AS "periodoFim", ordem
         FROM erp_medicao_itens
        WHERE medicao_id = $1 ORDER BY ordem ASC, created_at ASC`,
      [req.params.id],
    );
    res.json({ ...m.rows[0], items: items.rows });
  } catch (e: any) { sendError(res, e); }
});

// POST /preview — gera itens sugeridos a partir de contractIds + competência.
// Retorna um payload que o front pode ajustar antes de POST /.
router.post('/preview', async (req, res) => {
  try {
    const { contractIds, competencia } = req.body || {};
    if (!Array.isArray(contractIds) || contractIds.length === 0) {
      return res.status(400).json({ error: 'contractIds obrigatórios' });
    }
    const r = await pool.query(
      `SELECT c.id, c.numero, c.descricao, c.valor_mensal AS "valorMensal",
              c.data_inicio AS "dataInicio", c.customer_id AS "customerId",
              c.company_id AS "companyId",
              c.endereco_obra AS "enderecoObra", c.local_evento AS "localEvento",
              cu.customer_name AS "customerName", cu.document AS "customerDocument"
         FROM erp_contracts c
         LEFT JOIN customers cu ON cu.id = c.customer_id
        WHERE c.id = ANY($1::uuid[])`,
      [contractIds],
    );
    res.json({ competencia, contracts: r.rows });
  } catch (e: any) { sendError(res, e); }
});

// POST / — cria medição + itens (snapshot empresa/cliente)
router.post('/', async (req, res) => {
  const {
    customerId, companyId, competencia,
    periodoInicio, periodoFim, desconto = 0, observacoes,
    items,
  } = req.body || {};
  let validCompanyId: string;
  try {
    validCompanyId = requireCompanyId(companyId);
  } catch (e: any) {
    return res.status(e.status || 400).json({ error: e.message || 'Empresa emissora inválida.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items obrigatórios' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // snapshot empresa + cliente
    let snapCompany: any = null, snapCustomer: any = null;
    let clienteDoc: string | null = null, clienteNome: string | null = null;
    const c = await client.query(
      `SELECT razao_social AS "razaoSocial", cnpj, endereco, cidade, estado, cep,
              telefone, email, inscricao_estadual AS "inscricaoEstadual",
              logo_url AS "logoUrl", logo_dataurl AS "logoDataUrl",
              assinatura_url AS "assinaturaUrl"
         FROM erp_companies WHERE id = $1`, [validCompanyId]);
    snapCompany = c.rows[0] || null;
    if (!snapCompany) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Empresa emissora não encontrada.' });
    }
    if (customerId) {
      const cu = await client.query(
        `SELECT customer_name AS "name", document, address, numero, bairro, cidade, estado, cep
           FROM customers WHERE id = $1`, [customerId]);
      snapCustomer = cu.rows[0] || null;
      clienteDoc = snapCustomer?.document || null;
      clienteNome = snapCustomer?.name || null;
    }

    const itemsCalc = items.map((it: any, idx: number) => {
      const qtd = Number(it.quantidade ?? 1);
      const vu  = Number(it.valorUnit  ?? 0);
      const dsc = Number(it.descontoItem ?? 0);
      const tot = Math.max(0, qtd * vu - dsc);
      return { ...it, ordem: idx, quantidade: qtd, valorUnit: vu, descontoItem: dsc, valorTotal: tot };
    });
    const subtotal = itemsCalc.reduce((s: number, it: any) => s + it.valorTotal, 0);
    const total    = Math.max(0, subtotal - Number(desconto || 0));

    const numRes = await client.query(
      `SELECT erp_next_doc_number('MED', $1::uuid) AS num`,
      [validCompanyId],
    );
    const numero = numRes.rows[0].num;
    const ins = await client.query(
      `INSERT INTO erp_medicoes
         (numero, cliente_documento, cliente_nome, customer_id, company_id,
          competencia, periodo_inicio, periodo_fim,
          subtotal, desconto, total, observacoes, snapshot,
          created_by, pdf_gerado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       RETURNING id, numero`,
      [
        numero, clienteDoc, clienteNome, customerId || null, validCompanyId,
        competencia || null, periodoInicio || null, periodoFim || null,
        subtotal, Number(desconto || 0), total, observacoes || null,
        { company: snapCompany, customer: snapCustomer },
        (req as any).user?.username || null,
      ],
    );
    const medicaoId = ins.rows[0].id as string;

    for (const it of itemsCalc) {
      await client.query(
        `INSERT INTO erp_medicao_itens
           (medicao_id, contract_id, contract_numero, descricao, quantidade, unidade,
            valor_unit, desconto_item, valor_total, periodo_inicio, periodo_fim, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          medicaoId, it.contractId || null, it.contractNumero || null,
          it.descricao || '—', it.quantidade, it.unidade || 'UN',
          it.valorUnit, it.descontoItem, it.valorTotal,
          it.periodoInicio || null, it.periodoFim || null, it.ordem,
        ],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true, id: medicaoId, numero });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('[erp-medicoes create]', e);
    sendError(res, e);
  } finally { client.release(); }
});

// PUT /:id — atualiza (regrava itens)
router.put('/:id', async (req, res) => {
  const { desconto = 0, observacoes, items, periodoInicio, periodoFim, competencia } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items obrigatórios' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id FROM erp_medicoes WHERE id = $1', [req.params.id]);
    if (!cur.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'não encontrada' }); }

    const itemsCalc = items.map((it: any, idx: number) => {
      const qtd = Number(it.quantidade ?? 1);
      const vu  = Number(it.valorUnit  ?? 0);
      const dsc = Number(it.descontoItem ?? 0);
      const tot = Math.max(0, qtd * vu - dsc);
      return { ...it, ordem: idx, quantidade: qtd, valorUnit: vu, descontoItem: dsc, valorTotal: tot };
    });
    const subtotal = itemsCalc.reduce((s: number, it: any) => s + it.valorTotal, 0);
    const total    = Math.max(0, subtotal - Number(desconto || 0));

    await client.query(
      `UPDATE erp_medicoes SET
         competencia    = COALESCE($2, competencia),
         periodo_inicio = $3, periodo_fim = $4,
         subtotal = $5, desconto = $6, total = $7,
         observacoes = $8, updated_at = NOW(), pdf_gerado_em = NOW()
       WHERE id = $1`,
      [req.params.id, competencia || null, periodoInicio || null, periodoFim || null,
       subtotal, Number(desconto || 0), total, observacoes || null],
    );
    await client.query('DELETE FROM erp_medicao_itens WHERE medicao_id = $1', [req.params.id]);
    for (const it of itemsCalc) {
      await client.query(
        `INSERT INTO erp_medicao_itens
           (medicao_id, contract_id, contract_numero, descricao, quantidade, unidade,
            valor_unit, desconto_item, valor_total, periodo_inicio, periodo_fim, ordem)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [req.params.id, it.contractId || null, it.contractNumero || null,
         it.descricao || '—', it.quantidade, it.unidade || 'UN',
         it.valorUnit, it.descontoItem, it.valorTotal,
         it.periodoInicio || null, it.periodoFim || null, it.ordem],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK');
    sendError(res, e);
  } finally { client.release(); }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM erp_medicoes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

export default router;
