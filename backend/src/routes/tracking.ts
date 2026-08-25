import { Router } from 'express';
import { pool } from '../config/database';
import { softAuth, requireAuth } from '../middleware/requireAuth';

const router = Router();

// Rate-limit em memória: 1 ping por truck por segundo
const lastPing = new Map<string, number>();
const RATE_MS = 1000;

/**
 * POST /api/tracking/location
 * Recebe ping de localização do app mobile (rastreamento em background)
 * Body: { routeId, truckId?, driverId?, lat, lng, speed?, timestamp? }
 */
router.post('/location', softAuth, async (req: any, res: any) => {
  try {
    const { routeId, truckId, driverId, lat, lng, speed, timestamp } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat/lng obrigatórios (number)' });
    }
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ error: 'lat/lng fora de range' });
    }

    // Rate-limit por truck (ou IP fallback)
    const key = truckId || req.ip || 'anon';
    const now = Date.now();
    const last = lastPing.get(key) || 0;
    if (now - last < RATE_MS) {
      return res.status(202).json({ ok: true, rateLimited: true });
    }
    lastPing.set(key, now);

    const recordedAt = timestamp ? new Date(timestamp) : new Date();
    await pool.query(
      `INSERT INTO tracking_locations (route_id, truck_id, driver_id, lat, lng, speed, recorded_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)`,
      [routeId || null, truckId || null, driverId || null, lat, lng, speed ?? null, recordedAt]
    );
    // Atualiza posição atual do caminhão para refletir no mapa web
    if (truckId) {
      pool.query(
        `UPDATE trucks SET location_lat = $1, location_lng = $2, updated_at = NOW() WHERE id = $3::uuid`,
        [lat, lng, truckId]
      ).catch((e) => console.warn('[TRACKING] update truck loc:', e?.message));
    }
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[TRACKING] erro:', e);
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

router.get('/route/:routeId', requireAuth, async (req: any, res: any) => {
  try {
    const { routeId } = req.params;
    const r = await pool.query(
      `SELECT lat, lng, speed, recorded_at
         FROM tracking_locations
        WHERE route_id = $1::uuid
        ORDER BY recorded_at ASC`,
      [routeId]
    );
    res.json({ points: r.rows });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

router.get('/truck/:truckId/latest', requireAuth, async (req: any, res: any) => {
  try {
    const { truckId } = req.params;
    const r = await pool.query(
      `SELECT lat, lng, speed, recorded_at, route_id
         FROM tracking_locations
        WHERE truck_id = $1::uuid
        ORDER BY recorded_at DESC
        LIMIT 1`,
      [truckId]
    );
    res.json(r.rows[0] || null);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

/**
 * POST /api/tracking/purge — apaga pings antigos (>30 dias).
 * Pode ser chamado por cron externo.
 */
router.post('/purge', requireAuth, async (_req: any, res: any) => {
  try {
    const r = await pool.query(`DELETE FROM tracking_locations WHERE recorded_at < NOW() - INTERVAL '30 days'`);
    res.json({ ok: true, deleted: r.rowCount });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'erro' });
  }
});

export default router;
