import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';
import { parsePagination, sendPaginated } from '../utils/pagination';

const router = Router();
router.use(requireAuth);

const CUSTOMER_SELECT = `
  id,
  customer_name as "customerName",
  address, cep, lat, lng,
  restrooms_qty as "restroomsQty",
  cleanings_qty as "cleaningsQty",
  contact_name as "contactName",
  contact_phone as "contactPhone",
  notes,
  person_type as "personType",
  document, ie, im, email,
  numero, complemento, bairro, cidade, estado,
  responsavel_nome as "responsavelNome",
  responsavel_cpf as "responsavelCpf",
  tipo_cliente as "tipoCliente",
  created_at as "createdAt",
  updated_at as "updatedAt"
`;

/** normalização p/ ILIKE por dígitos (doc/cep/telefone) */
const digitsOnly = (s: any) => String(s ?? '').replace(/\D/g, '');

interface Filters {
  search?: string;
  filter?: 'all' | 'pf' | 'pj' | 'withSan' | 'noCoords';
  onlyDuplicates?: boolean;
}

function buildWhere(q: any, paramOffset = 0): { where: string; params: any[] } {
  const conds: string[] = [];
  const params: any[] = [];
  const push = (v: any) => { params.push(v); return `$${paramOffset + params.length}`; };

  const search = String(q.search || '').trim();
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    const digits = digitsOnly(search);
    const p1 = push(like);
    let clause =
      `(lower(coalesce(c.customer_name,'')) LIKE ${p1}
        OR lower(coalesce(c.address,'')) LIKE ${p1}
        OR lower(coalesce(c.cidade,'')) LIKE ${p1}
        OR lower(coalesce(c.bairro,'')) LIKE ${p1}
        OR lower(coalesce(c.email,'')) LIKE ${p1}
        OR lower(coalesce(c.contact_name,'')) LIKE ${p1})`;
    if (digits) {
      const p2 = push(`%${digits}%`);
      clause = `(${clause}
        OR regexp_replace(coalesce(c.document,''), '\\D', '', 'g') LIKE ${p2}
        OR regexp_replace(coalesce(c.contact_phone,''), '\\D', '', 'g') LIKE ${p2}
        OR regexp_replace(coalesce(c.cep,''), '\\D', '', 'g') LIKE ${p2})`;
    }
    conds.push(clause);
  }

  const filter = String(q.filter || 'all');
  if (filter === 'pf') conds.push(`c.person_type = 'PF'`);
  else if (filter === 'pj') conds.push(`coalesce(c.person_type,'PJ') = 'PJ'`);
  else if (filter === 'noCoords') conds.push(`(c.lat IS NULL OR c.lng IS NULL)`);
  else if (filter === 'withSan') {
    conds.push(`EXISTS (
      SELECT 1 FROM sanitarios s
       WHERE s.status = 'em_cliente'
         AND lower(s.current_customer_name) = lower(c.customer_name)
    )`);
  }

  if (String(q.onlyDuplicates) === '1' || q.onlyDuplicates === 'true') {
    conds.push(`c.id IN (SELECT id FROM dup_ids)`);
  }

  return { where: conds.length ? `WHERE ${conds.join(' AND ')}` : '', params };
}

/** CTE que identifica ids duplicados (por documento ou por nome quando sem doc). */
const DUP_CTE = `
  WITH dup_ids AS (
    SELECT id FROM (
      SELECT id,
             COUNT(*) FILTER (WHERE coalesce(document,'') <> '')
               OVER (PARTITION BY regexp_replace(coalesce(document,''), '\\D', '', 'g')) AS doc_cnt,
             COUNT(*) FILTER (WHERE coalesce(document,'') = '' AND coalesce(customer_name,'') <> '')
               OVER (PARTITION BY lower(coalesce(customer_name,''))) AS name_cnt
        FROM customers
    ) x WHERE doc_cnt > 1 OR name_cnt > 1
  )
`;

// ============================================================
// GET /customers/stats/kpis
// ============================================================
router.get('/stats/kpis', async (req: Request, res: Response) => {
  try {
    const { where, params } = buildWhere(req.query, 0);
    const sql = `
      ${DUP_CTE}
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.person_type = 'PF')::int AS pf,
        COUNT(*) FILTER (WHERE coalesce(c.person_type,'PJ') = 'PJ')::int AS pj,
        COUNT(*) FILTER (WHERE c.lat IS NULL OR c.lng IS NULL)::int AS "semCoord",
        COUNT(*) FILTER (WHERE c.id IN (SELECT id FROM dup_ids))::int AS duplicados
      FROM customers c
      ${where}
    `;
    const r = await pool.query(sql, params);
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[GET /customers/stats/kpis]', e);
    res.status(500).json({ error: 'Erro ao carregar KPIs' });
  }
});

// ============================================================
// GET /customers/:id/history
// ============================================================
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const cust = await pool.query(`SELECT id, customer_name FROM customers WHERE id = $1`, [id]);
    if (!cust.rows[0]) { res.status(404).json({ error: 'cliente não encontrado' }); return; }
    const name = cust.rows[0].customer_name;
    if (!name) { res.json({ current: [], history: [] }); return; }

    const current = await pool.query(
      `SELECT id, numero, status, current_address, installed_at
         FROM sanitarios
        WHERE status = 'em_cliente' AND lower(current_customer_name) = lower($1)
        ORDER BY installed_at DESC NULLS LAST`, [name]);
    const history = await pool.query(
      `SELECT id, sanitario_numero, operation_type, address, driver_name, occurred_at, notes
         FROM sanitario_movimentacoes
        WHERE lower(customer_name) = lower($1)
        ORDER BY occurred_at DESC
        LIMIT 200`, [name]);
    res.json({ current: current.rows, history: history.rows });
  } catch (e: any) {
    console.error('[customers/:id/history]', e);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// ============================================================
// GET /customers — paginado (opt-in) OU lista completa (legado)
// ============================================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const pg = parsePagination(req);
    const { where, params } = buildWhere(req.query, 0);

    // Cada linha vem com isDuplicate para destaque visual sem carregar tudo.
    const selectExtra = `,
      (c.id IN (SELECT id FROM dup_ids)) AS "isDuplicate"`;

    if (pg.paginated) {
      const dataSql = `
        ${DUP_CTE}
        SELECT ${CUSTOMER_SELECT}${selectExtra}
        FROM customers c
        ${where}
        ORDER BY c.customer_name ASC
        ${pg.sql.replace(/\$(\d+)/g, (_, n) => `$${params.length + Number(n)}`)}
      `;
      const dataR = await pool.query(dataSql, [...params, ...pg.params]);
      const countR = await pool.query(
        `${DUP_CTE} SELECT COUNT(*)::int AS c FROM customers c ${where}`, params,
      );
      sendPaginated(res, dataR.rows, countR.rows[0].c, pg);
      return;
    }

    // Legado (sem paginação): retorna array direto — usado por selects/autocompletes.
    const r = await pool.query(
      `SELECT ${CUSTOMER_SELECT} FROM customers ORDER BY customer_name ASC`,
    );
    res.json(r.rows);
  } catch (error) {
    console.error('[GET /customers] Erro:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
});

// ============================================================
// Individual: POST / PATCH / DELETE
// ============================================================
async function upsertCustomer(c: any, executor: { query: (sql: string, params?: any[]) => Promise<any> } = pool) {
  const doc = c.document ? String(c.document).replace(/\D/g, '') : null;
  const values = [
    c.id,
    (c.customerName || '').trim() || null,
    (c.address || '').trim() || null,
    c.cep ? String(c.cep).replace(/\D/g, '') : null,
    c.lat ?? null, c.lng ?? null,
    c.restroomsQty ?? null, c.cleaningsQty ?? null,
    (c.contactName || '').trim() || null,
    c.contactPhone ? String(c.contactPhone).trim() : null,
    c.notes || null,
    c.personType || 'PJ', doc, c.ie || null, c.im || null,
    c.email ? String(c.email).trim().toLowerCase() : null,
    c.numero || null, c.complemento || null, c.bairro || null,
    c.cidade || null, c.estado || null,
    c.responsavelNome || null, c.responsavelCpf || null, c.tipoCliente || null,
  ];
  await executor.query(`
    INSERT INTO customers (
      id, customer_name, address, cep, lat, lng,
      restrooms_qty, cleanings_qty, contact_name, contact_phone, notes,
      person_type, document, ie, im, email,
      numero, complemento, bairro, cidade, estado,
      responsavel_nome, responsavel_cpf, tipo_cliente
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
    ON CONFLICT (id) DO UPDATE SET
      customer_name=EXCLUDED.customer_name, address=EXCLUDED.address, cep=EXCLUDED.cep,
      lat=EXCLUDED.lat, lng=EXCLUDED.lng,
      restrooms_qty=EXCLUDED.restrooms_qty, cleanings_qty=EXCLUDED.cleanings_qty,
      contact_name=EXCLUDED.contact_name, contact_phone=EXCLUDED.contact_phone, notes=EXCLUDED.notes,
      person_type=EXCLUDED.person_type, document=EXCLUDED.document, ie=EXCLUDED.ie, im=EXCLUDED.im,
      email=EXCLUDED.email, numero=EXCLUDED.numero, complemento=EXCLUDED.complemento,
      bairro=EXCLUDED.bairro, cidade=EXCLUDED.cidade, estado=EXCLUDED.estado,
      responsavel_nome=EXCLUDED.responsavel_nome, responsavel_cpf=EXCLUDED.responsavel_cpf,
      tipo_cliente=EXCLUDED.tipo_cliente,
      updated_at=NOW()
  `, values);
  const r = await executor.query(`SELECT ${CUSTOMER_SELECT} FROM customers WHERE id = $1`, [c.id]);
  return r.rows[0];
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const c = req.body || {};
    if (!c.id) { res.status(400).json({ error: 'id obrigatório' }); return; }
    const saved = await upsertCustomer(c);
    res.json(saved);
  } catch (e: any) {
    console.error('[POST /customers]', e);
    res.status(500).json({ error: e?.message || 'Erro ao criar cliente' });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const cur = await pool.query(`SELECT ${CUSTOMER_SELECT} FROM customers WHERE id = $1`, [id]);
    if (!cur.rows[0]) { res.status(404).json({ error: 'cliente não encontrado' }); return; }

    // conflito otimista opcional (mesmo padrão do bulk PUT)
    const clientUpdatedAt = req.body?.updatedAt ? new Date(req.body.updatedAt) : null;
    const serverUpdatedAt = new Date(cur.rows[0].updatedAt);
    if (clientUpdatedAt && serverUpdatedAt.getTime() > clientUpdatedAt.getTime() + 500) {
      res.status(409).json({
        error: 'Outro usuário modificou este cliente. Recarregue antes de salvar.',
        serverUpdatedAt: serverUpdatedAt.toISOString(),
      });
      return;
    }

    const merged = { ...cur.rows[0], ...req.body, id };
    const saved = await upsertCustomer(merged);
    res.json(saved);
  } catch (e: any) {
    console.error('[PATCH /customers/:id]', e);
    res.status(500).json({ error: e?.message || 'Erro ao atualizar cliente' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(`DELETE FROM customers WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!r.rows[0]) { res.status(404).json({ error: 'cliente não encontrado' }); return; }
    res.json({ ok: true, id: r.rows[0].id });
  } catch (e: any) {
    console.error('[DELETE /customers/:id]', e);
    res.status(500).json({ error: e?.message || 'Erro ao remover cliente' });
  }
});

// ============================================================
// PUT /customers — bulk legado (mantido p/ retrocompatibilidade)
// ============================================================
router.put('/', async (req: Request, res: Response) => {
  const { customers, clientLoadedAt } = req.body as {
    customers: any[];
    clientLoadedAt?: string;
  };
  if (!Array.isArray(customers)) { res.status(400).json({ error: 'Lista de clientes inválida' }); return; }

  const sentIds = customers.map(c => c?.id).filter(Boolean);
  if (customers.length > 0 && sentIds.length === 0) {
    res.status(400).json({ error: 'Payload inválido: nenhum cliente possui id' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const conflicts: Array<{ id: string; serverUpdatedAt: string; clientUpdatedAt: string | null }> = [];
    if (sentIds.length > 0) {
      const placeholders = sentIds.map((_, i) => `$${i + 1}`).join(',');
      const cur = await client.query(
        `SELECT id, updated_at FROM customers WHERE id IN (${placeholders}) FOR UPDATE`, sentIds,
      );
      const serverMap = new Map<string, Date>(cur.rows.map(r => [String(r.id), new Date(r.updated_at)]));
      for (const c of customers) {
        const server = serverMap.get(String(c.id));
        if (!server) continue;
        const clientTs = c.updatedAt ? new Date(c.updatedAt) : null;
        if (!clientTs || server.getTime() > clientTs.getTime() + 500) {
          conflicts.push({
            id: c.id,
            serverUpdatedAt: server.toISOString(),
            clientUpdatedAt: clientTs ? clientTs.toISOString() : null,
          });
        }
      }
    }
    if (conflicts.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Conflito de edição concorrente.', conflicts });
      return;
    }

    if (sentIds.length > 0) {
      const params: any[] = [...sentIds];
      let cutoffClause = '';
      if (clientLoadedAt) {
        params.push(clientLoadedAt);
        cutoffClause = ` AND created_at <= $${params.length}`;
      }
      await client.query(
        `DELETE FROM customers WHERE id NOT IN (${sentIds.map((_, i) => `$${i + 1}`).join(',')})${cutoffClause}`,
        params,
      );
    } else if (clientLoadedAt) {
      await client.query(`DELETE FROM customers WHERE created_at <= $1`, [clientLoadedAt]);
    } else {
      await client.query('DELETE FROM customers');
    }

    for (const c of customers) {
      await upsertCustomer(c, client);
    }
    await client.query('COMMIT');
    const result = await pool.query(`SELECT ${CUSTOMER_SELECT} FROM customers ORDER BY customer_name ASC`);
    res.json({ success: true, customers: result.rows });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[PUT /customers] Erro:', error);
    res.status(500).json({ error: error?.message || 'Erro ao salvar clientes' });
  } finally {
    client.release();
  }
});

export default router;
