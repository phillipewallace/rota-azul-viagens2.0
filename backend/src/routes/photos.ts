import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { requireAuth, softAuth } from '../middleware/requireAuth';

const router = Router();

const PHOTOS_BASE = path.join(__dirname, '../../uploads/photos');
if (!fs.existsSync(PHOTOS_BASE)) fs.mkdirSync(PHOTOS_BASE, { recursive: true });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const storage = multer.diskStorage({
  destination: (req: any, _file: any, cb: any) => {
    const { routeId, pointId } = req.params;
    if (!UUID_RE.test(routeId) || !UUID_RE.test(pointId)) {
      return cb(new Error('routeId/pointId inválidos'), '');
    }
    const dir = path.join(PHOTOS_BASE, routeId, pointId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${uuidv4()}-${Date.now()}${ext.length > 5 ? '.jpg' : ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (_req: any, file: any, cb: any) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error('Formato não permitido'));
  },
});

// Upload N fotos para um ponto
router.post('/route/:routeId/point/:pointId/photos', softAuth, (req: any, res: any) => {
  upload.array('photos', 50)(req, res, async (err: any) => {
    if (err) {
      console.error('❌ [PHOTOS] erro multer:', err);
      return res.status(400).json({ error: err.message || 'Erro no upload' });
    }
    try {
      const { routeId, pointId } = req.params;
      if (!UUID_RE.test(routeId) || !UUID_RE.test(pointId)) {
        return res.status(400).json({ error: 'routeId/pointId inválidos' });
      }
      const { operationType } = req.body;
      const files = (req.files as any[]) || [];
      if (!files.length) return res.status(400).json({ error: 'Nenhuma foto enviada' });

      const inserted: any[] = [];
      for (const file of files) {
        const relPath = `photos/${routeId}/${pointId}/${file.filename}`;
        const fileUrl = `/uploads/${relPath}`;
        const result = await pool.query(
          `INSERT INTO point_photos (route_id, point_id, file_path, file_url, operation_type, uploaded_by)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6) RETURNING *`,
          [routeId, pointId, relPath, fileUrl, operationType || null, req.user?.username || null]
        );
        inserted.push(result.rows[0]);
      }

      // Sync no completed_routes (count total)
      await pool.query(
        `UPDATE completed_routes
            SET photos_count = (SELECT COUNT(*) FROM point_photos WHERE route_id = $1::uuid),
                updated_at = NOW()
          WHERE route_id = $1::uuid`,
        [routeId]
      );

      res.json({ success: true, photos: inserted });
    } catch (e: any) {
      console.error('❌ [PHOTOS] erro:', e);
      res.status(500).json({ error: e.message });
    }
  });
});

// Listar fotos de um ponto
router.get('/route/:routeId/point/:pointId/photos', requireAuth, async (req, res) => {
  try {
    const { routeId, pointId } = req.params;
    const result = await pool.query(
      `SELECT * FROM point_photos WHERE route_id = $1::uuid AND point_id = $2::uuid ORDER BY uploaded_at`,
      [routeId, pointId]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Listar fotos de uma rota
router.get('/route/:routeId/photos', requireAuth, async (req, res) => {
  try {
    const { routeId } = req.params;
    const result = await pool.query(
      `SELECT * FROM point_photos WHERE route_id = $1::uuid ORDER BY uploaded_at`,
      [routeId]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
