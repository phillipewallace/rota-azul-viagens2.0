import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const VALID_STATUS = ['ativa', 'inativa', 'concluida'] as const;
const clean = (v: unknown): string => String(v ?? '').trim();

function pontoRow(p: any) {
  return {
    id: p.id,
    company: p.company ?? '',
    address: p.address ?? '',
    cleaning: p.cleaning ?? '',
    bathrooms: p.bathrooms ?? '',
    toilets: p.toilets ?? '',
    pieces: p.pieces ?? '',
    contact: p.contact ?? '',
    observation: p.observation ?? '',
    sanitarioNumber: p.sanitario_number ?? '',
    model: p.model ?? '',
    color: p.color ?? '',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// GET / — lista todas as rotas com seus pontos
router.get('/', async (_req, res) => {
  try {
    const rotas = await pool.query(`
      SELECT id, name, status, sort_order AS "sortOrder",
             created_at AS "createdAt", updated_at AS "updatedAt"
        FROM erp_rotas
       ORDER BY sort_order ASC, created_at ASC`);
    const pontos = await pool.query(`
      SELECT id, rota_id AS "rotaId", company, address, cleaning, bathrooms,
             toilets, pieces, contact, observation, sanitario_number,
             model, color, created_at, updated_at
        FROM erp_rotas_pontos
       ORDER BY rota_id, sort_order ASC`);
    const byRota = new Map<string, any[]>();
    for (const p of pontos.rows) {
      if (!byRota.has(p.rotaId)) byRota.set(p.rotaId, []);
      byRota.get(p.rotaId)!.push(pontoRow(p));
    }
    res.json(rotas.rows.map((r: any) => ({ ...r, pontos: byRota.get(r.id) ?? [] })));
  } catch (e: any) {
    console.error('[ERP rotas GET]', e);
    sendError(res, e);
  }
});

// POST / — criar rota (com pontos opcionais)
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const name = clean(b.name);
    if (!name) return res.status(400).json({ error: 'Nome da rota é obrigatório' });
    const status = (VALID_STATUS as readonly string[]).includes(b.status) ? b.status : 'ativa';
    const maxR = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM erp_rotas');
    const sortOrder = Number(maxR.rows[0]?.m ?? -1) + 1;
    const r = await pool.query(
      `INSERT INTO erp_rotas (name, status, sort_order)
       VALUES ($1, $2, $3)
       RETURNING id, name, status, sort_order AS "sortOrder",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [name, status, sortOrder]
    );
    const rota = { ...r.rows[0], pontos: [] as any[] };
    if (Array.isArray(b.pontos) && b.pontos.length) {
      rota.pontos = await insertPontos(rota.id, b.pontos);
    }
    res.status(201).json(rota);
  } catch (e: any) {
    console.error('[ERP rotas POST]', e);
    sendError(res, e);
  }
});

// PUT /:id — editar nome/status/ordem
router.put('/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [req.params.id];
    if (b.name !== undefined) {
      const name = clean(b.name);
      if (!name) return res.status(400).json({ error: 'Nome da rota é obrigatório' });
      params.push(name);
      sets.push(`name = $${params.length}`);
    }
    if (b.status !== undefined) {
      if (!(VALID_STATUS as readonly string[]).includes(b.status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }
      params.push(b.status);
      sets.push(`status = $${params.length}`);
    }
    if (b.sortOrder !== undefined) {
      params.push(Number(b.sortOrder) || 0);
      sets.push(`sort_order = $${params.length}`);
    }
    const r = await pool.query(
      `UPDATE erp_rotas SET ${sets.join(', ')} WHERE id = $1
       RETURNING id, name, status, sort_order AS "sortOrder",
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });
    const pontos = await pool.query(
      `SELECT id, rota_id AS "rotaId", company, address, cleaning, bathrooms,
              toilets, pieces, contact, observation, sanitario_number,
              model, color, created_at, updated_at
         FROM erp_rotas_pontos WHERE rota_id = $1 ORDER BY sort_order ASC`,
      [req.params.id]
    );
    res.json({ ...r.rows[0], pontos: pontos.rows.map(pontoRow) });
  } catch (e: any) {
    console.error('[ERP rotas PUT]', e);
    sendError(res, e);
  }
});

// DELETE /:id — excluir (pontos caem em cascata)
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM erp_rotas WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ERP rotas DELETE]', e);
    sendError(res, e);
  }
});

// --- Pontos ---

async function insertPontos(rotaId: string, pontos: any[]) {
  const created: any[] = [];
  const maxR = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) AS m FROM erp_rotas_pontos WHERE rota_id = $1',
    [rotaId]
  );
  let order = Number(maxR.rows[0]?.m ?? -1) + 1;
  for (const raw of pontos) {
    const p = raw || {};
    const r = await pool.query(
      `INSERT INTO erp_rotas_pontos
         (rota_id, sort_order, company, address, cleaning, bathrooms, toilets,
          pieces, contact, observation, sanitario_number, model, color)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, rota_id AS "rotaId", company, address, cleaning, bathrooms,
                 toilets, pieces, contact, observation, sanitario_number,
                 model, color, created_at, updated_at`,
      [
        rotaId, order,
        clean(p.company), clean(p.address), clean(p.cleaning),
        clean(p.bathrooms), clean(p.toilets), clean(p.pieces),
        clean(p.contact), clean(p.observation), clean(p.sanitarioNumber),
        clean(p.model), clean(p.color),
      ]
    );
    created.push(pontoRow(r.rows[0]));
    order += 1;
  }
  return created;
}

// POST /:id/pontos — adicionar ponto
router.post('/:id/pontos', async (req, res) => {
  try {
    const exists = await pool.query('SELECT id FROM erp_rotas WHERE id = $1', [req.params.id]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'Rota não encontrada' });
    const b = req.body || {};
    if (!clean(b.company) && !clean(b.address)) {
      return res.status(400).json({ error: 'Empresa e endereço: preencha ao menos um' });
    }
    const [created] = await insertPontos(req.params.id, [b]);
    await pool.query('UPDATE erp_rotas SET updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.status(201).json(created);
  } catch (e: any) {
    console.error('[ERP rotas ponto POST]', e);
    sendError(res, e);
  }
});

// POST /reorder — reordenar rotas (ANTES das rotas com :id, senão "reorder" vira id)
router.post('/reorder', async (req, res) => {
  try {
    const ids = (req.body?.ids || []) as string[];
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids deve ser um array' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < ids.length; i += 1) {
        await client.query('UPDATE erp_rotas SET sort_order = $2, updated_at = NOW() WHERE id = $1', [ids[i], i]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ERP rotas REORDER]', e);
    sendError(res, e);
  }
});

// PUT /:rotaId/pontos/:pontoId — editar ponto
router.put('/:rotaId/pontos/:pontoId', async (req, res) => {
  try {
    const b = req.body || {};
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [req.params.pontoId, req.params.rotaId];
    const map: Record<string, string> = {
      company: 'company', address: 'address', cleaning: 'cleaning',
      bathrooms: 'bathrooms', toilets: 'toilets', pieces: 'pieces',
      contact: 'contact', observation: 'observation',
      sanitarioNumber: 'sanitario_number', model: 'model', color: 'color',
    };
    for (const [key, col] of Object.entries(map)) {
      if (b[key] !== undefined) {
        params.push(clean(b[key]));
        sets.push(`${col} = $${params.length}`);
      }
    }
    const r = await pool.query(
      `UPDATE erp_rotas_pontos SET ${sets.join(', ')}
        WHERE id = $1 AND rota_id = $2
       RETURNING id, rota_id AS "rotaId", company, address, cleaning, bathrooms,
                 toilets, pieces, contact, observation, sanitario_number,
                 model, color, created_at, updated_at`,
      params
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Ponto não encontrado' });
    res.json(pontoRow(r.rows[0]));
  } catch (e: any) {
    console.error('[ERP rotas ponto PUT]', e);
    sendError(res, e);
  }
});

// DELETE /:rotaId/pontos/:pontoId — excluir ponto
router.delete('/:rotaId/pontos/:pontoId', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM erp_rotas_pontos WHERE id = $1 AND rota_id = $2 RETURNING id',
      [req.params.pontoId, req.params.rotaId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Ponto não encontrado' });
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[ERP rotas ponto DELETE]', e);
    sendError(res, e);
  }
});

// POST /:rotaId/pontos/:pontoId/move — mover ponto (up/down)
router.post('/:rotaId/pontos/:pontoId/move', async (req, res) => {
  try {
    const dir = req.body?.direction === 'down' ? 1 : -1;
    const list = await pool.query(
      'SELECT id FROM erp_rotas_pontos WHERE rota_id = $1 ORDER BY sort_order ASC',
      [req.params.rotaId]
    );
    const ids = list.rows.map((r: any) => r.id);
    const idx = ids.indexOf(req.params.pontoId);
    if (idx === -1) return res.status(404).json({ error: 'Ponto não encontrado' });
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return res.json({ ok: true, moved: false });
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (let i = 0; i < ids.length; i += 1) {
        await client.query('UPDATE erp_rotas_pontos SET sort_order = $2 WHERE id = $1', [ids[i], i]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ ok: true, moved: true });
  } catch (e: any) {
    console.error('[ERP rotas ponto MOVE]', e);
    sendError(res, e);
  }
});

// POST /import — importação em lote (pula nomes já existentes: sem duplicar)
router.post('/import', async (req, res) => {
  try {
    const items = (req.body?.items || []) as any[];
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items deve ser um array' });
    const created: any[] = [];
    for (const item of items) {
      const name = clean(item?.name) || 'Rota importada';
      const dup = await pool.query(
        'SELECT id FROM erp_rotas WHERE LOWER(name) = LOWER($1) LIMIT 1', [name]
      );
      if (dup.rows[0]) continue;
      const validPontos = (item?.pontos || []).filter(
        (p: any) => clean(p?.company) !== '' || clean(p?.address) !== ''
      );
      if (validPontos.length === 0) continue;
      const maxR = await pool.query('SELECT COALESCE(MAX(sort_order), -1) AS m FROM erp_rotas');
      const sortOrder = Number(maxR.rows[0]?.m ?? -1) + 1;
      const status = (VALID_STATUS as readonly string[]).includes(item?.status) ? item.status : 'ativa';
      const r = await pool.query(
        `INSERT INTO erp_rotas (name, status, sort_order)
         VALUES ($1, $2, $3)
         RETURNING id, name, status, sort_order AS "sortOrder",
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [name, status, sortOrder]
      );
      const pontos = await insertPontos(r.rows[0].id, validPontos);
      created.push({ ...r.rows[0], pontos });
    }
    res.status(201).json(created);
  } catch (e: any) {
    console.error('[ERP rotas IMPORT]', e);
    sendError(res, e);
  }
});

export default router;
