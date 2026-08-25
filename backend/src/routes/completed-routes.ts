import { Router } from 'express';
import { pool } from '../config/database';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

const POINT_COLS = `id, address, lat, lng, point_order, type, completed, completed_at,
  customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone,
  notes, cep, point_category, operation_type, recolhido_qty, auto_removed,
  sanitario_numbers, sanitario_recolhidos`;

async function snapshotPoints(routeId: string) {
  const pts = await pool.query(
    `SELECT ${POINT_COLS} FROM route_points WHERE route_id = $1::uuid ORDER BY point_order`,
    [routeId]
  );
  // photos por ponto + total
  const photoAgg = await pool.query(
    `SELECT point_id, COUNT(*)::int AS c FROM point_photos WHERE route_id = $1::uuid GROUP BY point_id`,
    [routeId]
  );
  const photoMap = new Map<string, number>();
  photoAgg.rows.forEach((r) => photoMap.set(r.point_id, r.c));
  const enriched = pts.rows.map((p) => ({ ...p, photos_count: photoMap.get(p.id) || 0 }));
  const total = Array.from(photoMap.values()).reduce((s, n) => s + n, 0);
  return { points: enriched, photosCount: total };
}

// Listar
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status, from, to, driverId } = req.query as any;
    const conds: string[] = [];
    const args: any[] = [];
    if (status) { args.push(status); conds.push(`status = $${args.length}`); }
    if (from) { args.push(from); conds.push(`finished_at >= $${args.length}`); }
    if (to) { args.push(to); conds.push(`finished_at <= $${args.length}`); }
    if (driverId) { args.push(driverId); conds.push(`driver_id = $${args.length}::uuid`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM completed_routes ${where} ORDER BY COALESCE(finished_at, started_at, created_at) DESC LIMIT 500`,
      args
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Detalhes
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const cr = await pool.query(`SELECT * FROM completed_routes WHERE id = $1::uuid`, [id]);
    if (!cr.rows.length) return res.status(404).json({ error: 'Não encontrada' });
    const photos = await pool.query(
      `SELECT * FROM point_photos WHERE route_id = $1::uuid ORDER BY uploaded_at`,
      [cr.rows[0].route_id]
    );
    res.json({ ...cr.rows[0], photos: photos.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Iniciar
router.post('/start', requireAuth, async (req, res) => {
  try {
    const { routeId, truckId, truckPlate, driverId, driverName, routeName } = req.body;
    if (!routeId) return res.status(400).json({ error: 'routeId obrigatório' });
    const exists = await pool.query(
      `SELECT id FROM completed_routes WHERE route_id = $1::uuid AND status = 'in_progress' LIMIT 1`,
      [routeId]
    );
    if (exists.rows.length) return res.json({ id: exists.rows[0].id, existed: true });
    const result = await pool.query(
      `INSERT INTO completed_routes (route_id, route_name, truck_id, truck_plate, driver_id, driver_name, started_at, status)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, NOW(), 'in_progress') RETURNING *`,
      [routeId, routeName || null, truckId || null, truckPlate || null, driverId || null, driverName || null]
    );
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sync (chamado a cada conclusão)
router.put('/:routeId/sync', requireAuth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { points, photosCount } = await snapshotPoints(routeId);
    const result = await pool.query(
      `UPDATE completed_routes SET points_snapshot = $1, photos_count = $2, updated_at = NOW()
       WHERE route_id = $3::uuid AND status = 'in_progress' RETURNING *`,
      [JSON.stringify(points), photosCount, routeId]
    );
    res.json(result.rows[0] || null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Finalizar (idempotente)
router.post('/:routeId/finish', requireAuth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const { totalDistance, totalDuration } = req.body;
    const { points, photosCount } = await snapshotPoints(routeId);
    const result = await pool.query(
      `UPDATE completed_routes SET status='finished', finished_at=NOW(),
        total_distance=$1, total_duration=$2, points_snapshot=$3, photos_count=$4, updated_at=NOW()
       WHERE route_id=$5::uuid AND status='in_progress' RETURNING *`,
      [totalDistance ?? null, totalDuration ?? null, JSON.stringify(points), photosCount, routeId]
    );
    res.json(result.rows[0] || null);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ZIP de fotos (auth via query token para ser baixado por <a href>)
router.get('/:id/photos.zip', async (req, res) => {
  try {
    // aceitar token como query param para download direto via <a>
    const tokenQ = (req.query.token as string) || '';
    const tokenH = (req.headers.authorization || '').replace('Bearer ', '');
    const token = tokenH || tokenQ;
    if (!token) return res.status(401).end();
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    } catch { return res.status(401).end(); }

    const { id } = req.params;
    const cr = await pool.query(`SELECT route_id, route_name FROM completed_routes WHERE id = $1::uuid`, [id]);
    if (!cr.rows.length) return res.status(404).end();
    const routeId = cr.rows[0].route_id;
    const photos = await pool.query(
      `SELECT pp.file_path, pp.point_id, rp.address FROM point_photos pp
       LEFT JOIN route_points rp ON rp.id = pp.point_id
       WHERE pp.route_id = $1::uuid`,
      [routeId]
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="fotos-${cr.rows[0].route_name || id}.zip"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);
    const base = path.join(__dirname, '../../uploads');
    for (const p of photos.rows) {
      const full = path.join(base, p.file_path);
      if (fs.existsSync(full)) {
        const safe = (p.address || p.point_id).toString().replace(/[^a-z0-9]+/gi, '_').slice(0, 60);
        archive.file(full, { name: `${safe}/${path.basename(full)}` });
      }
    }
    await archive.finalize();
  } catch (e: any) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

export default router;
