import { sendError } from '../utils/apiError';
import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest, requireRole } from '../middleware/requireAuth';

const router = Router();

// Autenticação para todo o módulo; escrita restrita a admin/manager por rota.
// (leituras liberadas p/ qualquer usuário autenticado — consistente com o resto do ERP.)
router.use(requireAuth);
const WRITE = requireRole('admin', 'manager');

// ============ CATEGORIAS ============
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`SELECT id, name, description, icon,
      tracks_expiry AS "tracksExpiry",
      requires_signed_term AS "requiresSignedTerm",
      created_at AS "createdAt"
      FROM erp_categories ORDER BY name`);
    res.json(r.rows);
  } catch (e: any) {
    console.error('[ERP categories GET]', e);
    sendError(res, e);
  }
});

router.post('/categories', WRITE, async (req: Request, res: Response) => {
  try {
    const { name, description, icon, tracksExpiry, requiresSignedTerm } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await pool.query(
      `INSERT INTO erp_categories (name, description, icon, tracks_expiry, requires_signed_term)
       VALUES ($1,$2,COALESCE($3,'package'),COALESCE($4,FALSE),COALESCE($5,FALSE))
       RETURNING *`,
      [name, description || null, icon || null, !!tracksExpiry, !!requiresSignedTerm]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    console.error('[ERP categories POST]', e);
    sendError(res, e);
  }
});

router.put('/categories/:id', WRITE, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, icon, tracksExpiry, requiresSignedTerm } = req.body;
    const r = await pool.query(
      `UPDATE erp_categories SET
         name=COALESCE($2,name), description=$3, icon=COALESCE($4,icon),
         tracks_expiry=COALESCE($5,tracks_expiry),
         requires_signed_term=COALESCE($6,requires_signed_term),
         updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, name, description || null, icon || null, tracksExpiry, requiresSignedTerm]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.delete('/categories/:id', requireRole('admin','manager'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM erp_categories WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

// ============ ITENS ============
router.get('/items', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT i.id, i.category_id AS "categoryId", c.name AS "categoryName",
             c.icon AS "categoryIcon", c.tracks_expiry AS "tracksExpiry",
             c.requires_signed_term AS "requiresSignedTerm",
             i.name, i.sku, i.unit,
             i.current_qty AS "currentQty", i.min_qty AS "minQty",
             i.expiry_date AS "expiryDate",
             i.expiry_alert_days AS "expiryAlertDays",
             i.notes, i.active,
             i.created_at AS "createdAt", i.updated_at AS "updatedAt"
      FROM erp_items i
      JOIN erp_categories c ON c.id = i.category_id
      ORDER BY c.name, i.name
    `);
    res.json(r.rows);
  } catch (e: any) {
    console.error('[ERP items GET]', e);
    sendError(res, e);
  }
});

router.post('/items', WRITE, async (req: Request, res: Response) => {
  try {
    const { categoryId, name, sku, unit, currentQty, minQty, expiryDate, expiryAlertDays, notes } = req.body;
    if (!categoryId || !name) return res.status(400).json({ error: 'Categoria e nome obrigatórios' });
    const r = await pool.query(
      `INSERT INTO erp_items (category_id,name,sku,unit,current_qty,min_qty,expiry_date,expiry_alert_days,notes)
       VALUES ($1,$2,$3,COALESCE($4,'un'),COALESCE($5,0),COALESCE($6,0),$7,COALESCE($8,30),$9)
       RETURNING *`,
      [categoryId, name, sku || null, unit, currentQty, minQty, expiryDate || null, expiryAlertDays, notes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { console.error('[ERP items POST]', e); sendError(res, e); }
});

router.put('/items/:id', WRITE, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, sku, unit, minQty, expiryDate, expiryAlertDays, notes, active, categoryId } = req.body;
    const r = await pool.query(
      `UPDATE erp_items SET
         category_id=COALESCE($2,category_id),
         name=COALESCE($3,name), sku=$4, unit=COALESCE($5,unit),
         min_qty=COALESCE($6,min_qty), expiry_date=$7,
         expiry_alert_days=COALESCE($8,expiry_alert_days),
         notes=$9, active=COALESCE($10,active),
         updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [id, categoryId, name, sku || null, unit, minQty, expiryDate || null, expiryAlertDays, notes || null, active]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.delete('/items/:id', requireRole('admin','manager'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM erp_items WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

// ============ FUNCIONÁRIOS ============
router.get('/employees', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`SELECT id,name,role,cpf,phone,active,created_at AS "createdAt"
      FROM erp_employees ORDER BY name`);
    res.json(r.rows);
  } catch (e: any) { sendError(res, e); }
});

router.post('/employees', WRITE, async (req: Request, res: Response) => {
  try {
    const { name, role, cpf, phone } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await pool.query(
      `INSERT INTO erp_employees (name,role,cpf,phone) VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, role || null, cpf || null, phone || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.put('/employees/:id', WRITE, async (req: Request, res: Response) => {
  try {
    const { name, role, cpf, phone, active } = req.body;
    const r = await pool.query(
      `UPDATE erp_employees SET name=COALESCE($2,name), role=$3, cpf=$4, phone=$5,
         active=COALESCE($6,active) WHERE id=$1 RETURNING *`,
      [req.params.id, name, role || null, cpf || null, phone || null, active]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.delete('/employees/:id', requireRole('admin','manager'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM erp_employees WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

// ============ MOVIMENTAÇÕES ============
router.get('/movements', async (req: Request, res: Response) => {
  try {
    const { itemId, limit } = req.query as any;
    const params: any[] = [];
    let where = '';
    if (itemId) { params.push(itemId); where = `WHERE m.item_id = $${params.length}`; }
    params.push(parseInt(limit) || 200);
    const r = await pool.query(`
      SELECT m.id, m.item_id AS "itemId", i.name AS "itemName", i.unit,
             m.type, m.qty, m.employee_id AS "employeeId",
             e.name AS "employeeName", m.performed_by AS "performedBy",
             m.notes, m.signed_pdf_url AS "signedPdfUrl",
             m.created_at AS "createdAt"
      FROM erp_movements m
      JOIN erp_items i ON i.id = m.item_id
      LEFT JOIN erp_employees e ON e.id = m.employee_id
      ${where}
      ORDER BY m.created_at DESC
      LIMIT $${params.length}
    `, params);
    res.json(r.rows);
  } catch (e: any) { console.error('[ERP movs GET]', e); sendError(res, e); }
});

router.post('/movements', WRITE, async (req: AuthedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { itemId, type, qty, employeeId, notes, signedPdfUrl } = req.body;
    if (!itemId || !type || !qty) return res.status(400).json({ error: 'itemId, type e qty obrigatórios' });
    const q = parseFloat(qty);
    if (!q || q <= 0) return res.status(400).json({ error: 'Quantidade inválida' });
    if (!['in','out','adjust','discard'].includes(type))
      return res.status(400).json({ error: 'Tipo inválido' });

    await client.query('BEGIN');
    const item = await client.query('SELECT current_qty FROM erp_items WHERE id=$1 FOR UPDATE', [itemId]);
    if (!item.rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item não encontrado' }); }
    const cur = parseFloat(item.rows[0].current_qty);
    let next = cur;
    if (type === 'in') next = cur + q;
    else if (type === 'out' || type === 'discard') next = cur - q;
    else if (type === 'adjust') next = q;
    if (next < 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Estoque insuficiente' }); }

    await client.query('UPDATE erp_items SET current_qty=$2, updated_at=NOW() WHERE id=$1', [itemId, next]);
    const m = await client.query(
      `INSERT INTO erp_movements (item_id,type,qty,employee_id,performed_by,notes,signed_pdf_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [itemId, type, q, employeeId || null, req.user?.username || null, notes || null, signedPdfUrl || null]
    );
    await client.query('COMMIT');
    res.json(m.rows[0]);
  } catch (e: any) {
    // [#29 baixo] loga falhas no ROLLBACK em vez de silenciá-las.
    try { await client.query('ROLLBACK'); }
    catch (rbErr) { console.error('[ERP movs POST] rollback failed', rbErr); }
    console.error('[ERP movs POST]', e);
    sendError(res, e);
  } finally { client.release(); }
});


// ============ DASHBOARD / ALERTAS ============
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const lowStock = await pool.query(`
      SELECT i.id, i.name, i.unit, i.current_qty AS "currentQty", i.min_qty AS "minQty",
             c.name AS "categoryName"
      FROM erp_items i JOIN erp_categories c ON c.id=i.category_id
      WHERE i.active=TRUE AND i.min_qty > 0 AND i.current_qty <= i.min_qty
      ORDER BY (i.current_qty - i.min_qty) ASC LIMIT 50`);

    const expiring = await pool.query(`
      SELECT i.id, i.name, i.expiry_date AS "expiryDate",
             i.expiry_alert_days AS "expiryAlertDays",
             c.name AS "categoryName",
             (i.expiry_date - CURRENT_DATE) AS "daysLeft"
      FROM erp_items i JOIN erp_categories c ON c.id=i.category_id
      WHERE i.active=TRUE AND i.expiry_date IS NOT NULL
        AND (i.expiry_date - CURRENT_DATE) <= i.expiry_alert_days
      ORDER BY i.expiry_date ASC LIMIT 50`);

    const totals = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM erp_items WHERE active=TRUE) AS "totalItems",
        (SELECT COUNT(*) FROM erp_categories) AS "totalCategories",
        (SELECT COUNT(*) FROM erp_employees WHERE active=TRUE) AS "totalEmployees"`);

    res.json({
      lowStock: lowStock.rows,
      expiring: expiring.rows,
      totals: totals.rows[0],
      alertCount: lowStock.rows.length + expiring.rows.length,
    });
  } catch (e: any) { console.error('[ERP dashboard]', e); sendError(res, e); }
});

// ============ FROTA (veículos) ============
router.get('/vehicles', async (_req: Request, res: Response) => {
  try {
    const r = await pool.query(`
      SELECT v.id, v.name, v.vehicle_type AS "vehicleType", v.brand, v.model, v.year,
             v.plate, v.renavam, v.chassis, v.color, v.fuel,
             v.acquisition_date AS "acquisitionDate", v.notes, v.active,
             v.created_at AS "createdAt", v.updated_at AS "updatedAt",
             (SELECT COUNT(*) FROM erp_vehicle_comments c WHERE c.vehicle_id = v.id)::int AS "commentsCount",
             (SELECT COUNT(*) FROM erp_vehicle_comments c WHERE c.vehicle_id = v.id AND c.status='open')::int AS "openCount"
      FROM erp_vehicles v
      ORDER BY v.name`);
    res.json(r.rows);
  } catch (e: any) { console.error('[ERP vehicles GET]', e); sendError(res, e); }
});

router.post('/vehicles', WRITE, async (req: Request, res: Response) => {
  try {
    const { name, vehicleType, brand, model, year, plate, renavam, chassis, color, fuel, acquisitionDate, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    const r = await pool.query(
      `INSERT INTO erp_vehicles (name,vehicle_type,brand,model,year,plate,renavam,chassis,color,fuel,acquisition_date,notes)
       VALUES ($1,COALESCE($2,'caminhao'),$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name, vehicleType, brand || null, model || null, year || null,
       plate || null, renavam || null, chassis || null, color || null, fuel || null,
       acquisitionDate || null, notes || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { console.error('[ERP vehicles POST]', e); sendError(res, e); }
});

router.put('/vehicles/:id', WRITE, async (req: Request, res: Response) => {
  try {
    const { name, vehicleType, brand, model, year, plate, renavam, chassis, color, fuel, acquisitionDate, notes, active } = req.body;
    const r = await pool.query(
      `UPDATE erp_vehicles SET
         name=COALESCE($2,name), vehicle_type=COALESCE($3,vehicle_type),
         brand=$4, model=$5, year=$6, plate=$7, renavam=$8, chassis=$9,
         color=$10, fuel=$11, acquisition_date=$12, notes=$13,
         active=COALESCE($14,active), updated_at=NOW()
       WHERE id=$1 RETURNING *`,
      [req.params.id, name, vehicleType, brand || null, model || null, year || null,
       plate || null, renavam || null, chassis || null, color || null, fuel || null,
       acquisitionDate || null, notes || null, active]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.delete('/vehicles/:id', requireRole('admin','manager'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM erp_vehicles WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

// Comentários do veículo (timeline: multas, manutenções, observações)
router.get('/vehicles/:id/comments', async (req: Request, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, vehicle_id AS "vehicleId", comment, category,
              reference_date AS "referenceDate", amount, status,
              attachment_url AS "attachmentUrl", author,
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM erp_vehicle_comments WHERE vehicle_id=$1
       ORDER BY COALESCE(reference_date, created_at::date) DESC, created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (e: any) { sendError(res, e); }
});

router.post('/vehicles/:id/comments', WRITE, async (req: AuthedRequest, res: Response) => {
  try {
    const { comment, category, referenceDate, amount, status, attachmentUrl } = req.body;
    if (!comment || !comment.trim()) return res.status(400).json({ error: 'Comentário obrigatório' });
    const r = await pool.query(
      `INSERT INTO erp_vehicle_comments (vehicle_id,comment,category,reference_date,amount,status,attachment_url,author)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,'open'),$7,$8) RETURNING *`,
      [req.params.id, comment, category || null, referenceDate || null,
       amount != null ? parseFloat(amount) : null, status, attachmentUrl || null,
       req.user?.username || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { console.error('[ERP veh comments POST]', e); sendError(res, e); }
});

router.put('/vehicles/:vid/comments/:cid', WRITE, async (req: Request, res: Response) => {
  try {
    const { comment, category, referenceDate, amount, status, attachmentUrl } = req.body;
    const r = await pool.query(
      `UPDATE erp_vehicle_comments SET
         comment=COALESCE($3,comment), category=$4, reference_date=$5,
         amount=$6, status=COALESCE($7,status), attachment_url=$8,
         updated_at=NOW()
       WHERE id=$2 AND vehicle_id=$1 RETURNING *`,
      [req.params.vid, req.params.cid, comment, category || null,
       referenceDate || null, amount != null ? parseFloat(amount) : null,
       status, attachmentUrl || null]
    );
    res.json(r.rows[0]);
  } catch (e: any) { sendError(res, e); }
});

router.delete('/vehicles/:vid/comments/:cid', requireRole('admin','manager'), async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM erp_vehicle_comments WHERE id=$2 AND vehicle_id=$1',
      [req.params.vid, req.params.cid]);
    res.json({ ok: true });
  } catch (e: any) { sendError(res, e); }
});

export default router;
