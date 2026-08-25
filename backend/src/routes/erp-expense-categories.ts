import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SEL = `id, key, label, color, ativo, ordem, created_at AS "createdAt"`;

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(
      `SELECT ${SEL} FROM erp_expense_categories ORDER BY ordem ASC, label ASC`
    );
    res.json(r.rows);
  } catch (e: any) { sendError(res, e); }
});

router.post('/', async (req, res) => {
  try {
    const { key, label, color, ordem } = req.body || {};
    const norm = String(key || label || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!norm || !label) return res.status(400).json({ error: 'key e label obrigatórios' });
    const r = await pool.query(
      `INSERT INTO erp_expense_categories(key, label, color, ordem)
         VALUES ($1, $2, $3, COALESCE($4, 50))
       ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, color = EXCLUDED.color
       RETURNING ${SEL}`,
      [norm, String(label).trim(), color || null, ordem != null ? Number(ordem) : null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.put('/:id', async (req, res) => {
  try {
    const { label, color, ativo, ordem } = req.body || {};
    await pool.query(
      `UPDATE erp_expense_categories
          SET label = COALESCE($2, label),
              color = $3,
              ativo = COALESCE($4, ativo),
              ordem = COALESCE($5, ordem),
              updated_at = NOW()
        WHERE id = $1`,
      [req.params.id, label || null, color || null, ativo, ordem != null ? Number(ordem) : null]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    // proteção: categorias seed (key fixa) só ficam inativas
    const r = await pool.query(`SELECT key FROM erp_expense_categories WHERE id=$1`, [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Categoria não encontrada' });
    const protegidas = new Set(['combustivel','aluguel','folha','nf','outros']);
    if (protegidas.has(r.rows[0].key)) {
      await pool.query(`UPDATE erp_expense_categories SET ativo = FALSE WHERE id=$1`, [req.params.id]);
      return res.json({ ok: true, inactivated: true });
    }
    await pool.query(`DELETE FROM erp_expense_categories WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

export default router;
