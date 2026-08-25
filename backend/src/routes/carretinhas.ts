import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest } from '../middleware/requireAuth';

const router = Router();

// ============ LIST ============
router.get('/', requireAuth, async (_req, res) => {
  try {
    const r = await pool.query(`
      SELECT id, name, plate, model, year, status,
             current_customer_name AS "currentCustomerName",
             current_rental_start  AS "currentRentalStart",
             notes, created_at AS "createdAt", updated_at AS "updatedAt"
        FROM carretinhas ORDER BY name`);
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ CREATE ============
router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { name, plate, model, year, notes } = req.body;
    if (!name || !plate) return res.status(400).json({ error: 'Nome e placa obrigatórios' });
    const r = await pool.query(
      `INSERT INTO carretinhas (name, plate, model, year, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, String(plate).toUpperCase(), model || null, year || null, notes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ UPDATE (dados básicos) ============
router.put('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { name, plate, model, year, notes } = req.body;
    const r = await pool.query(
      `UPDATE carretinhas
          SET name=COALESCE($1,name), plate=COALESCE($2,plate),
              model=$3, year=$4, notes=$5, updated_at=NOW()
        WHERE id=$6 RETURNING *`,
      [name, plate ? String(plate).toUpperCase() : null, model || null, year || null, notes || null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ DELETE ============
router.delete('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    await pool.query('DELETE FROM carretinhas WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ LOCAR (dar entrada com cliente) ============
router.post('/:id/locar', requireAuth, async (req: AuthedRequest, res) => {
  const client = await pool.connect();
  try {
    const { customerName, startDate, notes } = req.body;
    if (!customerName || !startDate) return res.status(400).json({ error: 'Cliente e data são obrigatórios' });
    await client.query('BEGIN');
    await client.query(
      `UPDATE carretinhas
          SET status='locada', current_customer_name=$1, current_rental_start=$2,
              notes=COALESCE($3, notes), updated_at=NOW()
        WHERE id=$4`,
      [customerName, startDate, notes || null, req.params.id]
    );
    await client.query(
      `INSERT INTO carretinha_locacoes (carretinha_id, customer_name, start_date, notes)
       VALUES ($1,$2,$3,$4)`,
      [req.params.id, customerName, startDate, notes || null]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ============ DAR BAIXA (retornou ao galpão) ============
router.post('/:id/baixa', requireAuth, async (req: AuthedRequest, res) => {
  const client = await pool.connect();
  try {
    const { endDate, notes } = req.body;
    const end = endDate || new Date().toISOString().slice(0, 10);
    await client.query('BEGIN');
    // fecha a locação aberta mais recente
    await client.query(
      `UPDATE carretinha_locacoes
          SET end_date=$1, notes=COALESCE($2, notes)
        WHERE id = (
          SELECT id FROM carretinha_locacoes
           WHERE carretinha_id=$3 AND end_date IS NULL
           ORDER BY start_date DESC LIMIT 1
        )`,
      [end, notes || null, req.params.id]
    );
    await client.query(
      `UPDATE carretinhas
          SET status='galpao', current_customer_name=NULL,
              current_rental_start=NULL, updated_at=NOW()
        WHERE id=$1`,
      [req.params.id]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ============ HISTÓRICO ============
router.get('/:id/historico', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const r = await pool.query(
      `SELECT id, customer_name AS "customerName",
              start_date AS "startDate", end_date AS "endDate",
              notes, created_at AS "createdAt"
         FROM carretinha_locacoes
        WHERE carretinha_id=$1
        ORDER BY start_date DESC, created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ============ LOOKUP público por placa ============
router.get('/lookup/:plate', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, name, plate, model, year FROM carretinhas
        WHERE UPPER(REPLACE(plate,'-','')) = UPPER(REPLACE($1,'-','')) LIMIT 1`,
      [req.params.plate]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Carretinha não encontrada' });
    res.json(r.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
