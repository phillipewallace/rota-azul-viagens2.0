import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, softAuth } from '../middleware/requireAuth';

const router = Router();

/**
 * GET /api/sanitarios — lista todos com status atual
 * query: ?status=...&q=numero
 */
/** Normaliza string p/ busca: minúsculas, sem acentos/pontuação/espaços */
const NORM_SQL = (col: string) =>
  `regexp_replace(lower(coalesce(${col},'')), '[^a-z0-9]+', '', 'g')`;

function buildSanitariosQuery(query: any) {
  const { status, q, truckId } = query;
  const conds: string[] = [];
  const params: any[] = [];
  if (status) { params.push(status); conds.push(`s.status = $${params.length}`); }
  if (truckId) { params.push(truckId); conds.push(`lm.truck_id = $${params.length}`); }
  if (q && String(q).trim()) {
    const norm = String(q).toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (norm) {
      params.push(`%${norm}%`);
      const idx = params.length;
      conds.push(
        `(${NORM_SQL('s.numero')} LIKE $${idx}
         OR ${NORM_SQL('s.current_customer_name')} LIKE $${idx}
         OR ${NORM_SQL('s.current_address')} LIKE $${idx})`
      );
    }
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  return { where, params };
}

const CATEGORIAS = ['comum', 'pne', 'pia', 'luxo', 'cabine_banho'] as const;
type Categoria = typeof CATEGORIAS[number];
const isCategoria = (v: any): v is Categoria => CATEGORIAS.includes(v);

// [#17 médio] DDL one-shot por processo, em vez de rodar em todo hot path.
let _appSettingsReady: Promise<void> | null = null;
let _categoriaColReady: Promise<void> | null = null;
async function ensureAppSettings() {
  if (!_appSettingsReady) {
    _appSettingsReady = pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY, value TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).then(() => undefined).catch((e) => { _appSettingsReady = null; throw e; });
  }
  return _appSettingsReady;
}
async function ensureCategoriaColumn() {
  if (!_categoriaColReady) {
    _categoriaColReady = pool.query(
      `ALTER TABLE sanitarios ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'comum'`
    ).then(() => undefined).catch(() => undefined);
  }
  return _categoriaColReady;
}


async function getCategoriasTotalFisico(): Promise<Record<Categoria, number>> {
  await ensureAppSettings();
  const r = await pool.query(
    `SELECT value FROM app_settings WHERE key = 'sanitarios_categorias_total_fisico'`,
  );
  let parsed: any = {};
  try { parsed = r.rows[0]?.value ? JSON.parse(r.rows[0].value) : {}; } catch { parsed = {}; }
  if (!Object.keys(parsed).length) {
    const r2 = await pool.query(`SELECT value FROM app_settings WHERE key = 'sanitarios_total_fisico'`);
    const legacy = r2.rows[0]?.value ? parseInt(r2.rows[0].value, 10) || 0 : 0;
    if (legacy > 0) parsed = { comum: legacy };
  }
  const map = Object.fromEntries(
    CATEGORIAS.map(c => [c, Math.max(0, parseInt(parsed[c], 10) || 0)])
  ) as Record<Categoria, number>;
  return map;
}

/** GET /api/sanitarios/available — sanitários prontos para locação */
router.get('/available', requireAuth, async (_req: any, res: any) => {
  try {
    const r = await pool.query(
      `SELECT id, numero, categoria, modelo, estado_atual, status 
       FROM sanitarios 
       WHERE status = 'disponivel' 
       ORDER BY numero ASC`
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/sanitarios/tipos — categorias cadastradas */
router.get('/tipos', requireAuth, async (_req: any, res: any) => {
  try {
    const r = await pool.query('SELECT * FROM erp_sanitario_tipos ORDER BY nome ASC');
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function saveCategoriasTotalFisico(map: Record<Categoria, number>) {
  await ensureAppSettings();
  const clean: Record<string, number> = {};
  for (const c of CATEGORIAS) clean[c] = Math.max(0, parseInt(String(map[c] ?? 0), 10) || 0);
  await pool.query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES ('sanitarios_categorias_total_fisico', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(clean)],
  );
  const sum = Object.values(clean).reduce((a, b) => a + b, 0);
  await pool.query(
    `INSERT INTO app_settings(key, value, updated_at) VALUES ('sanitarios_total_fisico', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [String(sum)],
  );
  return clean;
}

/** GET /api/sanitarios/total-fisico */
router.get('/total-fisico', requireAuth, async (_req: any, res: any) => {
  try {
    const porCategoria = await getCategoriasTotalFisico();
    const totalFisico = Object.values(porCategoria).reduce((a, b) => a + b, 0);
    res.json({ totalFisico, porCategoria });
  } catch (e: any) {
    console.error('[SANITARIOS] total-fisico get err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/** PUT /api/sanitarios/total-fisico — { porCategoria } OU { categoria, totalFisico } OU { totalFisico } (legado) */
router.put('/total-fisico', requireAuth, async (req: any, res: any) => {
  try {
    const body = req.body || {};
    const current = await getCategoriasTotalFisico();
    const next: Record<string, number> = { ...current };
    if (body.porCategoria && typeof body.porCategoria === 'object') {
      for (const c of CATEGORIAS) {
        if (body.porCategoria[c] !== undefined) next[c] = parseInt(String(body.porCategoria[c]), 10) || 0;
      }
    } else if (body.categoria && isCategoria(body.categoria)) {
      next[body.categoria] = parseInt(String(body.totalFisico ?? 0), 10) || 0;
    } else if (body.totalFisico !== undefined) {
      next.comum = parseInt(String(body.totalFisico), 10) || 0;
    }
    const saved = await saveCategoriasTotalFisico(next as Record<Categoria, number>);
    const totalFisico = Object.values(saved).reduce((a, b) => a + b, 0);
    res.json({ ok: true, totalFisico, porCategoria: saved });
  } catch (e: any) {
    console.error('[SANITARIOS] total-fisico put err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/** GET /api/sanitarios/stock-summary — contagem por status + por categoria */
router.get('/stock-summary', requireAuth, async (_req: any, res: any) => {
  try {
    await ensureCategoriaColumn();
    const r = await pool.query(`SELECT status, COUNT(*)::int AS qtd FROM sanitarios GROUP BY status`);
    const summary: Record<string, number> = {
      disponivel: 0, em_cliente: 0, manutencao: 0, inativo: 0, em_os: 0,
    };
    for (const row of r.rows) summary[row.status] = row.qtd;
    let reservadosEmOs = 0, atrasados = 0;
    try {
      const rr = await pool.query(
        `SELECT COUNT(DISTINCT eos.sanitario_id)::int AS qtd
           FROM erp_os_sanitarios eos
           JOIN erp_service_orders so ON so.id = eos.os_id
          WHERE eos.devolvido_em IS NULL AND so.status = 'aberta'`);
      reservadosEmOs = rr.rows[0]?.qtd || 0;
      const ra = await pool.query(
        `SELECT COUNT(DISTINCT eos.sanitario_id)::int AS qtd
           FROM erp_os_sanitarios eos
           JOIN erp_service_orders so ON so.id = eos.os_id
          WHERE eos.devolvido_em IS NULL
            AND so.status='aberta' AND so.modalidade='diaria'
            AND so.data_fim_prevista IS NOT NULL
            AND so.data_fim_prevista < CURRENT_DATE`);
      atrasados = ra.rows[0]?.qtd || 0;
    } catch { /* tabelas ERP podem ainda não existir */ }
    const total = Object.values(summary).reduce((a, b) => a + b, 0);

    const totaisCat = await getCategoriasTotalFisico();
    const cr = await pool.query(
      `SELECT COALESCE(categoria,'comum') AS categoria, status, COUNT(*)::int AS qtd
         FROM sanitarios GROUP BY 1, status`);
    const porCategoria: Record<string, any> = {};
    for (const c of CATEGORIAS) {
      porCategoria[c] = {
        totalFisico: totaisCat[c] || 0,
        numerados: 0, disponivel: 0, em_cliente: 0, manutencao: 0, inativo: 0,
      };
    }
    for (const row of cr.rows) {
      const cat = String(row.categoria || 'comum');
      if (!porCategoria[cat]) {
        porCategoria[cat] = { totalFisico: 0, numerados: 0, disponivel: 0, em_cliente: 0, manutencao: 0, inativo: 0 };
      }
      porCategoria[cat].numerados += row.qtd;
      if (porCategoria[cat][row.status] !== undefined) porCategoria[cat][row.status] = row.qtd;
    }
    for (const c of Object.keys(porCategoria)) {
      const v = porCategoria[c];
      v.semNumeracao = Math.max(0, (v.totalFisico || 0) - v.numerados);
      v.livres = Math.max(0, (v.totalFisico || 0) - (v.em_cliente || 0) - (v.manutencao || 0));
    }
    const totalFisico = Object.values(totaisCat).reduce((a, b) => a + b, 0);

    res.json({ ...summary, reservadosEmOs, atrasados, total, totalFisico, porCategoria });
  } catch (e: any) {
    console.error('[SANITARIOS] stock-summary err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 50));
    const offset = (page - 1) * pageSize;
    const { where, params } = buildSanitariosQuery(req.query);

    const baseFrom = `FROM sanitarios s
      LEFT JOIN LATERAL (
        SELECT truck_id FROM sanitario_movimentacoes m
         WHERE m.sanitario_id = s.id AND m.truck_id IS NOT NULL
         ORDER BY occurred_at DESC LIMIT 1
      ) lm ON TRUE
      LEFT JOIN trucks t ON t.id = lm.truck_id
      ${where}`;

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total ${baseFrom}`, params);
    const total = countRes.rows[0]?.total || 0;

    const dataParams = [...params, pageSize, offset];
    const r = await pool.query(
      `SELECT s.*, lm.truck_id AS current_truck_id, t.name AS current_truck_name, t.plate AS current_truck_plate
        ${baseFrom}
        ORDER BY s.numero ASC
        LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );
    res.json({ data: r.rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (e: any) {
    console.error('[SANITARIOS] list err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/** GET /api/sanitarios/export.csv — exporta lista filtrada (mesmos filtros) */
router.get('/export.csv', requireAuth, async (req: any, res: any) => {
  try {
    const { where, params } = buildSanitariosQuery(req.query);
    const r = await pool.query(
      `SELECT s.numero, s.modelo, s.status,
              s.current_customer_name, s.current_address,
              t.name AS truck_name, t.plate AS truck_plate,
              s.installed_at, s.notes
         FROM sanitarios s
         LEFT JOIN LATERAL (
           SELECT truck_id FROM sanitario_movimentacoes m
            WHERE m.sanitario_id = s.id AND m.truck_id IS NOT NULL
            ORDER BY occurred_at DESC LIMIT 1
         ) lm ON TRUE
         LEFT JOIN trucks t ON t.id = lm.truck_id
         ${where}
         ORDER BY s.numero ASC`,
      params
    );
    const esc = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",;\n]/.test(s) ? `"${s}"` : s;
    };
    const header = ['numero','modelo','status','cliente_atual','endereco_atual','caminhao','placa','instalado_em','observacoes'];
    const lines = [header.join(';')];
    for (const row of r.rows) {
      lines.push([
        row.numero, row.modelo, row.status,
        row.current_customer_name, row.current_address,
        row.truck_name, row.truck_plate,
        row.installed_at ? new Date(row.installed_at).toISOString() : '',
        row.notes,
      ].map(esc).join(';'));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sanitarios-${Date.now()}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (e: any) {
    console.error('[SANITARIOS] export err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/** GET /api/sanitarios/meta/trucks — lista de caminhões para filtro */
router.get('/meta/trucks', requireAuth, async (_req: any, res: any) => {
  try {
    const r = await pool.query(`SELECT id, name, plate FROM trucks ORDER BY name ASC`);
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * POST /api/sanitarios — cria/atualiza por numero (aceita categoria)
 */
router.post('/', requireAuth, async (req: any, res: any) => {
  try {
    await ensureCategoriaColumn();
    const { numero, modelo, status, notes, categoria } = req.body || {};
    if (!numero || !String(numero).trim()) return res.status(400).json({ error: 'numero obrigatório' });
    const cat = isCategoria(categoria) ? categoria : 'comum';
    const r = await pool.query(
      `INSERT INTO sanitarios (numero, modelo, status, notes, categoria)
       VALUES ($1, $2, COALESCE($3,'disponivel'), $4, $5)
       ON CONFLICT (numero) DO UPDATE SET
         modelo = COALESCE(EXCLUDED.modelo, sanitarios.modelo),
         notes = COALESCE(EXCLUDED.notes, sanitarios.notes),
         categoria = COALESCE(EXCLUDED.categoria, sanitarios.categoria),
         updated_at = NOW()
       RETURNING *`,
      [String(numero).trim(), modelo || null, status || null, notes || null, cat]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/** PUT /api/sanitarios/:numero/categoria — atualiza apenas a categoria */
router.put('/:numero/categoria', requireAuth, async (req: any, res: any) => {
  try {
    await ensureCategoriaColumn();
    const { categoria } = req.body || {};
    if (!isCategoria(categoria)) return res.status(400).json({ error: 'categoria inválida' });
    const r = await pool.query(
      `UPDATE sanitarios SET categoria = $2, updated_at = NOW() WHERE numero = $1 RETURNING *`,
      [req.params.numero, categoria],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[SANITARIOS] update categoria err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * GET /api/sanitarios/:numero — detalhes + histórico
 */
router.get('/:numero', requireAuth, async (req: any, res: any) => {
  try {
    const { numero } = req.params;
    const s = await pool.query(`SELECT * FROM sanitarios WHERE numero = $1`, [numero]);
    if (!s.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    const hist = await pool.query(
      `SELECT * FROM sanitario_movimentacoes
        WHERE sanitario_id = $1
        ORDER BY occurred_at DESC`,
      [s.rows[0].id]
    );
    res.json({ ...s.rows[0], historico: hist.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * DELETE /api/sanitarios/:numero — remove sanitário e histórico (CASCADE)
 */
router.delete('/:numero', requireAuth, async (req: any, res: any) => {
  try {
    const { numero } = req.params;
    const r = await pool.query(
      `DELETE FROM sanitarios WHERE numero = $1 RETURNING id, numero`,
      [numero]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'não encontrado' });
    res.json({ ok: true, deleted: r.rows[0] });
  } catch (e: any) {
    console.error('[SANITARIOS] delete err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * Helper interno (já em transação): registra movimentação e atualiza status.
 */
async function registrarMovimentacao(client: any, opts: {
  numero: string;
  operationType: 'entrega' | 'recolhimento' | 'manutencao' | 'transferencia';
  routeId?: string;
  routePointId?: string;
  customerName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  driverId?: string;
  driverName?: string;
  truckId?: string;
  notes?: string;
  categoria?: string;
}) {
  // Garante que o sanitário existe (auto-cria se vier um número novo)
  let s = await client.query(`SELECT id FROM sanitarios WHERE numero = $1 FOR UPDATE`, [opts.numero]);
  if (!s.rows[0]) {
    const initialStatus = opts.operationType === 'entrega' ? 'em_cliente'
                        : opts.operationType === 'manutencao' ? 'manutencao'
                        : 'disponivel';
    const cat = isCategoria(opts.categoria) ? opts.categoria : 'comum';
    s = await client.query(
      `INSERT INTO sanitarios (numero, status, categoria) VALUES ($1, $2, $3) RETURNING id`,
      [opts.numero, initialStatus, cat]
    );
  } else if (isCategoria(opts.categoria)) {
    // Atualiza categoria se vier informada (catalogação manual ao despachar)
    await client.query(`UPDATE sanitarios SET categoria = $2 WHERE id = $1`, [s.rows[0].id, opts.categoria]);
  }
  const sanId = s.rows[0].id;

  if (opts.operationType === 'entrega' || opts.operationType === 'transferencia') {
    await client.query(
      `UPDATE sanitarios SET
         status = 'em_cliente',
         current_route_point_id = $2::uuid,
         current_customer_name = $3,
         current_address = $4,
         current_lat = $5,
         current_lng = $6,
         installed_at = NOW(),
         updated_at = NOW()
       WHERE id = $1`,
      [sanId, opts.routePointId || null, opts.customerName || null, opts.address || null, opts.lat ?? null, opts.lng ?? null]
    );
  } else if (opts.operationType === 'recolhimento') {
    await client.query(
      `UPDATE sanitarios SET
         status = 'disponivel',
         current_route_point_id = NULL,
         current_customer_name = NULL,
         current_address = NULL,
         current_lat = NULL,
         current_lng = NULL,
         installed_at = NULL,
         updated_at = NOW()
       WHERE id = $1`,
      [sanId]
    );
  } else if (opts.operationType === 'manutencao') {
    await client.query(
      `UPDATE sanitarios SET status = 'manutencao', updated_at = NOW() WHERE id = $1`,
      [sanId]
    );
  }

  await client.query(
    `INSERT INTO sanitario_movimentacoes
       (sanitario_id, sanitario_numero, operation_type, route_id, route_point_id,
        customer_name, address, lat, lng, driver_id, driver_name, truck_id, notes)
     VALUES ($1,$2,$3,$4::uuid,$5::uuid,$6,$7,$8,$9,$10::uuid,$11,$12::uuid,$13)`,
    [
      sanId, opts.numero, opts.operationType,
      opts.routeId || null, opts.routePointId || null,
      opts.customerName || null, opts.address || null, opts.lat ?? null, opts.lng ?? null,
      opts.driverId || null, opts.driverName || null, opts.truckId || null,
      opts.notes || null,
    ]
  );

  return sanId;
}

/**
 * POST /api/sanitarios/movimentar — atômico
 */
router.post('/movimentar', softAuth, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    const { numeros, operationType, routeId, routePointId, customerName, address, lat, lng,
            driverId, driverName, truckId, notes, categoria } = req.body || {};
    if (!Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({ error: 'numeros obrigatório (array)' });
    }
    if (!['entrega', 'recolhimento', 'manutencao', 'transferencia'].includes(operationType)) {
      return res.status(400).json({ error: 'operationType inválido' });
    }

    // dedup + trim
    const cleanNums = Array.from(new Set(numeros.map((n: any) => String(n).trim()).filter(Boolean)));
    if (!cleanNums.length) return res.status(400).json({ error: 'numeros inválidos' });

    await ensureCategoriaColumn();
    await client.query('BEGIN');

    const ids: string[] = [];
    for (const numero of cleanNums) {
      const id = await registrarMovimentacao(client, {
        numero,
        operationType,
        routeId, routePointId, customerName, address, lat, lng,
        driverId, driverName, truckId, notes, categoria,
      });
      ids.push(id);
    }

    if (routePointId) {
      const col = operationType === 'recolhimento' ? 'sanitario_recolhidos' : 'sanitario_numbers';
      await client.query(
        `UPDATE route_points
            SET ${col} = ARRAY(
              SELECT DISTINCT unnest(COALESCE(${col}, ARRAY[]::text[]) || $2::text[])
            )
          WHERE id = $1::uuid`,
        [routePointId, cleanNums]
      );
    }

    await client.query('COMMIT');
    res.json({ ok: true, count: ids.length, numeros: cleanNums });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[SANITARIOS] movimentar err:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  } finally {
    client.release();
  }
});

export default router;
