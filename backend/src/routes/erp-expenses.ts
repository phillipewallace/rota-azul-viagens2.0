import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';
import { parsePagination, sendPaginated } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const SEL = `
  id, categoria, descricao, valor, data, fornecedor,
  nota_fiscal AS "notaFiscal", anexo_url AS "anexoUrl",
  observacoes, created_at AS "createdAt"
`;

/**
 * Monta o SQL combinado (manuais + manutenção) parametrizado.
 * Retorna { sql, params, countSql } prontos para paginar.
 *
 * Reaproveitado por GET / (lista) e GET /stats/kpis (agregados).
 */
function buildCombinedQuery(q: any) {
  const { from, to, categoria, origem, search, fornecedor } = q || {};
  const wantManual = !origem || origem === 'manual' || origem === 'all';
  const wantManut  = !origem || origem === 'manutencao' || origem === 'all';

  const parts: string[] = [];
  const params: any[] = [];
  const push = (v: any) => { params.push(v); return `$${params.length}`; };

  if (wantManual) {
    const conds: string[] = [];
    if (from)                              conds.push(`data >= ${push(from)}`);
    if (to)                                conds.push(`data <= ${push(to)}`);
    if (categoria && categoria !== 'all' && categoria !== 'manutencao')
                                           conds.push(`categoria = ${push(categoria)}`);
    if (fornecedor)                        conds.push(`LOWER(COALESCE(fornecedor,'')) LIKE ${push(`%${String(fornecedor).toLowerCase()}%`)}`);
    if (search) {
      const s = push(`%${String(search).toLowerCase()}%`);
      conds.push(`(LOWER(COALESCE(descricao,'')) LIKE ${s}
                OR LOWER(COALESCE(fornecedor,'')) LIKE ${s}
                OR LOWER(COALESCE(nota_fiscal,'')) LIKE ${s})`);
    }
    // Só empurra o bloco de manuais se categoria não estiver fixada em "manutencao".
    if (!(categoria && categoria === 'manutencao')) {
      parts.push(`
        SELECT ${SEL}, 'manual' AS origem
          FROM erp_expenses
          ${conds.length ? `WHERE ${conds.join(' AND ')}` : ''}
      `);
    }
  }

  if (wantManut) {
    const conds: string[] = [];
    const fromD = push(from || '1900-01-01');
    const toD   = push(to   || '2999-12-31');
    conds.push(`COALESCE(m.cost,0) > 0`);
    conds.push(`COALESCE(m.completed_date, m.maintenance_date, m.created_at::date) BETWEEN ${fromD} AND ${toD}`);
    if (fornecedor) conds.push(`LOWER(COALESCE(t.name,'')) LIKE ${push(`%${String(fornecedor).toLowerCase()}%`)}`);
    if (search) {
      const s = push(`%${String(search).toLowerCase()}%`);
      conds.push(`(LOWER(COALESCE(m.description,'')) LIKE ${s}
                OR LOWER(COALESCE(t.name,'')) LIKE ${s})`);
    }
    // Só empurra manutenção se a categoria (quando fixada) for "manutencao" ou "all".
    if (!categoria || categoria === 'all' || categoria === 'manutencao') {
      parts.push(`
        SELECT m.id, 'manutencao' AS categoria,
               COALESCE(m.description, 'Manutenção ' || COALESCE(m.maintenance_type, m.type, '')) AS descricao,
               COALESCE(m.cost, 0) AS valor,
               COALESCE(m.completed_date, m.maintenance_date, m.created_at::date) AS data,
               COALESCE(t.name, 'Frota') AS fornecedor,
               NULL AS "notaFiscal", NULL AS "anexoUrl",
               m.performed_by AS observacoes,
               m.created_at AS "createdAt",
               'manutencao' AS origem
          FROM maintenance_records m
          LEFT JOIN trucks t ON t.id = m.truck_id
          WHERE ${conds.join(' AND ')}
      `);
    }
  }

  const unionSql = parts.length
    ? parts.join(' UNION ALL ')
    : `SELECT NULL::uuid AS id, ''::text AS categoria, ''::text AS descricao,
              0::numeric AS valor, CURRENT_DATE AS data, NULL::text AS fornecedor,
              NULL::text AS "notaFiscal", NULL::text AS "anexoUrl",
              NULL::text AS observacoes, NOW() AS "createdAt", 'manual' AS origem
       WHERE FALSE`;

  return { unionSql, params };
}

// Lista combinada: gastos manuais + manutenção — paginação opt-in.
router.get('/', async (req, res) => {
  try {
    const { unionSql, params } = buildCombinedQuery(req.query);
    const pg = parsePagination(req, params.length);
    const rowsQ = await pool.query(
      `SELECT * FROM (${unionSql}) AS combined
       ORDER BY data DESC, "createdAt" DESC NULLS LAST
       ${pg.sql}`,
      [...params, ...pg.params],
    );
    if (pg.paginated) {
      const totalQ = await pool.query(
        `SELECT COUNT(*)::int AS c FROM (${unionSql}) AS combined`,
        params,
      );
      return sendPaginated(res, rowsQ.rows, totalQ.rows[0].c, pg);
    }
    res.json(rowsQ.rows);
  } catch (e: any) { sendError(res, e); }
});

// KPIs agregados — mesmos filtros da listagem, sem paginação.
router.get('/stats/kpis', async (req, res) => {
  try {
    const { unionSql, params } = buildCombinedQuery(req.query);
    const q = await pool.query(`
      SELECT
        COUNT(*)::int                                                              AS total,
        COALESCE(SUM(valor), 0)::float                                             AS "totalValor",
        COUNT(*) FILTER (WHERE origem = 'manual')::int                             AS "qtdManual",
        COUNT(*) FILTER (WHERE origem = 'manutencao')::int                         AS "qtdManutencao",
        COALESCE(SUM(CASE WHEN origem = 'manual'     THEN valor ELSE 0 END), 0)::float AS "totalManual",
        COALESCE(SUM(CASE WHEN origem = 'manutencao' THEN valor ELSE 0 END), 0)::float AS "totalManutencao"
      FROM (${unionSql}) AS combined`, params);
    res.json(q.rows[0] || {
      total: 0, totalValor: 0, qtdManual: 0, qtdManutencao: 0,
      totalManual: 0, totalManutencao: 0,
    });
  } catch (e: any) { sendError(res, e); }
});

router.post('/', async (req, res) => {
  try {
    const e = req.body || {};
    if (!e.descricao || e.valor == null) return res.status(400).json({ error: 'descricao e valor obrigatórios' });
    const r = await pool.query(
      `INSERT INTO erp_expenses(categoria, descricao, valor, data, fornecedor, nota_fiscal, anexo_url, observacoes)
       VALUES (COALESCE($1,'outros'), $2, $3, COALESCE($4,CURRENT_DATE), $5, $6, $7, $8)
       RETURNING ${SEL}`,
      [e.categoria || null, e.descricao, Number(e.valor) || 0, e.data || null,
       e.fornecedor || null, e.notaFiscal || null, e.anexoUrl || null, e.observacoes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.put('/:id', async (req, res) => {
  try {
    const e = req.body || {};
    await pool.query(
      `UPDATE erp_expenses SET
         categoria = COALESCE($2, categoria),
         descricao = COALESCE($3, descricao),
         valor = COALESCE($4, valor),
         data = COALESCE($5, data),
         fornecedor = $6, nota_fiscal = $7, anexo_url = $8, observacoes = $9,
         updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, e.categoria || null, e.descricao || null,
       e.valor != null ? Number(e.valor) : null, e.data || null,
       e.fornecedor || null, e.notaFiscal || null, e.anexoUrl || null, e.observacoes || null]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    await pool.query('DELETE FROM erp_expenses WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

export default router;
