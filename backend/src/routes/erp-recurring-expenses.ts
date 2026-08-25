import { sendError } from '../utils/apiError';
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth, requireRole } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

const SEL = `
  id, categoria, descricao, valor, dia_mes AS "diaMes",
  fornecedor, observacoes, ativo,
  last_generated_competencia AS "lastGeneratedCompetencia",
  created_at AS "createdAt"
`;

const competenciaAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

router.get('/', async (_req, res) => {
  try {
    const r = await pool.query(`SELECT ${SEL} FROM erp_recurring_expenses ORDER BY ativo DESC, descricao ASC`);
    res.json(r.rows);
  } catch (e: any) { sendError(res, e); }
});

router.post('/', requireRole('admin','manager'), async (req, res) => {
  try {
    const e = req.body || {};
    if (!e.descricao || e.valor == null) return res.status(400).json({ error: 'descricao e valor obrigatórios' });
    const dia = Math.min(31, Math.max(1, Number(e.diaMes) || 1));
    const r = await pool.query(
      `INSERT INTO erp_recurring_expenses(categoria, descricao, valor, dia_mes, fornecedor, observacoes, ativo)
         VALUES (COALESCE($1,'outros'), $2, $3, $4, $5, $6, COALESCE($7, TRUE))
       RETURNING ${SEL}`,
      [e.categoria || null, e.descricao, Number(e.valor) || 0, dia, e.fornecedor || null, e.observacoes || null, e.ativo]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.put('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    const e = req.body || {};
    await pool.query(
      `UPDATE erp_recurring_expenses
          SET categoria = COALESCE($2, categoria),
              descricao = COALESCE($3, descricao),
              valor = COALESCE($4, valor),
              dia_mes = COALESCE($5, dia_mes),
              fornecedor = $6,
              observacoes = $7,
              ativo = COALESCE($8, ativo),
              updated_at = NOW()
        WHERE id = $1`,
      [
        req.params.id, e.categoria || null, e.descricao || null,
        e.valor != null ? Number(e.valor) : null,
        e.diaMes != null ? Math.min(31, Math.max(1, Number(e.diaMes))) : null,
        e.fornecedor || null, e.observacoes || null, e.ativo,
      ]
    );
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

router.delete('/:id', requireRole('admin','manager'), async (req, res) => {
  try {
    await pool.query(`DELETE FROM erp_recurring_expenses WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

/**
 * POST /run?competencia=YYYY-MM
 * Materializa todas as recorrências ativas em erp_expenses para a competência.
 * Idempotente: unique index (recurring_id, competencia) evita duplicar.
 */
router.post('/run', requireRole('admin','manager'), async (req, res) => {
  const competencia = String((req.query as any).competencia || (req.body || {}).competencia || competenciaAtual());
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ativos = await client.query(
      `SELECT ${SEL} FROM erp_recurring_expenses WHERE ativo = TRUE`
    );
    const [ano, mes] = competencia.split('-').map(Number);
    if (!ano || !mes) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'competencia inválida' }); }
    const ultimoDia = new Date(ano, mes, 0).getDate();
    let geradas = 0;
    for (const rec of ativos.rows) {
      const dia = Math.min(Number(rec.diaMes) || 1, ultimoDia);
      const data = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const r = await client.query(
        `INSERT INTO erp_expenses(categoria, descricao, valor, data, fornecedor, observacoes, recurring_id, competencia)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [rec.categoria, rec.descricao, Number(rec.valor) || 0, data, rec.fornecedor, rec.observacoes, rec.id, competencia]
      );
      if (r.rowCount && r.rowCount > 0) {
        geradas++;
        await client.query(
          `UPDATE erp_recurring_expenses SET last_generated_competencia = $2 WHERE id = $1`,
          [rec.id, competencia]
        );
      }
    }
    await client.query('COMMIT');
    res.json({ ok: true, competencia, geradas, totalAtivas: ativos.rowCount });
  } catch (e: any) {
    await client.query('ROLLBACK');
    sendError(res, e);
  } finally { client.release(); }
});

export default router;
