import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { requireAuth, AuthedRequest, softAuth } from '../middleware/requireAuth';

const router = Router();

// ============ POST público (mobile motorista) ============
router.post('/', softAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      truckPlate,
      truckId,
      truckName,
      truckModel,
      vehicleKind,    // 'truck' | 'carretinha'
      vehicleType,    // 'carroceria' | 'tanque' | 'carretinha'
      carretinhaId,
      signerName,
      signerDocument,
      signatureDataUrl,
      odometerKm,
      fuelLevel,
      generalNotes,
      items,
      signatureMode,  // 'none' | 'cliente' | 'conferente'
    } = req.body;

    if (!truckPlate || !signerName || !signerDocument || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const mode = ['none', 'cliente', 'conferente'].includes(signatureMode) ? signatureMode : 'none';

    const kind = vehicleKind || (vehicleType === 'carretinha' ? 'carretinha' : 'truck');

    let resolvedTruckId = kind === 'truck' ? (truckId || null) : null;
    let resolvedCarretinhaId = kind === 'carretinha' ? (carretinhaId || null) : null;
    let resolvedName = truckName || null;
    let resolvedModel = truckModel || null;

    if (kind === 'truck' && !resolvedTruckId) {
      const t = await client.query(
        `SELECT id, name, model FROM trucks
         WHERE UPPER(REPLACE(plate, '-', '')) = UPPER(REPLACE($1, '-', '')) LIMIT 1`,
        [truckPlate]
      );
      if (t.rows[0]) {
        resolvedTruckId = t.rows[0].id;
        resolvedName = resolvedName || t.rows[0].name;
        resolvedModel = resolvedModel || t.rows[0].model;
      }
    }
    if (kind === 'carretinha' && !resolvedCarretinhaId) {
      const t = await client.query(
        `SELECT id, name, model FROM carretinhas
         WHERE UPPER(REPLACE(plate, '-', '')) = UPPER(REPLACE($1, '-', '')) LIMIT 1`,
        [truckPlate]
      );
      if (t.rows[0]) {
        resolvedCarretinhaId = t.rows[0].id;
        resolvedName = resolvedName || t.rows[0].name;
        resolvedModel = resolvedModel || t.rows[0].model;
      }
    }

    const critical = items.filter((i: any) => i.status === 'critical').length;
    const attention = items.filter((i: any) => i.status === 'attention').length;
    const summary = critical > 0 ? 'critical' : attention > 0 ? 'attention' : 'ok';

    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO truck_checklists
       (truck_id, truck_plate, truck_name, truck_model, signer_name, signer_document,
        signature_data_url, odometer_km, fuel_level, general_notes, summary_status,
        critical_count, attention_count, vehicle_kind, vehicle_type, carretinha_id,
        signature_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id, created_at`,
      [
        resolvedTruckId,
        String(truckPlate).toUpperCase(),
        resolvedName,
        resolvedModel,
        String(signerName).trim(),
        String(signerDocument).trim(),
        signatureDataUrl || null,
        odometerKm != null && odometerKm !== '' ? Number(odometerKm) : null,
        fuelLevel || null,
        generalNotes || null,
        summary,
        critical,
        attention,
        kind,
        vehicleType || null,
        resolvedCarretinhaId,
        mode,
      ]
    );
    const checklistId = ins.rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO truck_checklist_items
         (checklist_id, category, item_key, item_label, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          checklistId,
          item.category || 'Geral',
          item.itemKey || item.key || 'item',
          item.itemLabel || item.label || '',
          item.status || 'na',
          item.notes || null,
        ]
      );
    }
    await client.query('COMMIT');

    res.json({ id: checklistId, createdAt: ins.rows[0].created_at, summaryStatus: summary });
  } catch (e: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[checklists POST]', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ============ GET lista (autenticado) ============
router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { plate, signer, from, to, status } = req.query as Record<string, string>;
    const where: string[] = [];
    const params: any[] = [];
    if (plate) {
      params.push(`%${plate.toUpperCase()}%`);
      where.push(`UPPER(truck_plate) LIKE $${params.length}`);
    }
    if (signer) {
      params.push(`%${signer.toLowerCase()}%`);
      where.push(`LOWER(signer_name) LIKE $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      where.push(`created_at <= ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (status) {
      params.push(status);
      where.push(`summary_status = $${params.length}`);
    }
    const sql = `
      SELECT id, truck_id AS "truckId", truck_plate AS "truckPlate",
        truck_name AS "truckName", truck_model AS "truckModel",
        signer_name AS "signerName", signer_document AS "signerDocument",
        odometer_km AS "odometerKm", fuel_level AS "fuelLevel",
        summary_status AS "summaryStatus",
        critical_count AS "criticalCount", attention_count AS "attentionCount",
        vehicle_kind AS "vehicleKind", vehicle_type AS "vehicleType",
        carretinha_id AS "carretinhaId",
        signature_mode AS "signatureMode",
        second_signer_name AS "secondSignerName",
        second_signer_document AS "secondSignerDocument",
        second_signed_at AS "secondSignedAt",
        created_at AS "createdAt"
      FROM truck_checklists
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY created_at DESC
      LIMIT 500`;
    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e: any) {
    console.error('[checklists GET]', e);
    res.status(500).json({ error: e.message });
  }
});

// ============ GET detalhe ============
router.get('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const head = await pool.query(
      `SELECT id, truck_id AS "truckId", truck_plate AS "truckPlate",
        truck_name AS "truckName", truck_model AS "truckModel",
        signer_name AS "signerName", signer_document AS "signerDocument",
        signature_data_url AS "signatureDataUrl",
        odometer_km AS "odometerKm", fuel_level AS "fuelLevel",
        general_notes AS "generalNotes",
        summary_status AS "summaryStatus",
        critical_count AS "criticalCount", attention_count AS "attentionCount",
        vehicle_kind AS "vehicleKind", vehicle_type AS "vehicleType",
        carretinha_id AS "carretinhaId",
        signature_mode AS "signatureMode",
        second_signature_data_url AS "secondSignatureDataUrl",
        second_signer_name AS "secondSignerName",
        second_signer_document AS "secondSignerDocument",
        second_signed_at AS "secondSignedAt",
        created_at AS "createdAt"
       FROM truck_checklists WHERE id=$1`,
      [id]
    );
    if (!head.rows[0]) return res.status(404).json({ error: 'Checklist não encontrado' });
    const items = await pool.query(
      `SELECT category, item_key AS "itemKey", item_label AS "itemLabel",
              status, notes
         FROM truck_checklist_items WHERE checklist_id=$1
         ORDER BY category, item_label`,
      [id]
    );
    res.json({ ...head.rows[0], items: items.rows });
  } catch (e: any) {
    console.error('[checklists GET id]', e);
    res.status(500).json({ error: e.message });
  }
});

// ============ DELETE (admin) ============
router.delete('/:id', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Apenas admin' });
    await pool.query('DELETE FROM truck_checklists WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint público para buscar veículo (caminhão OU carretinha) pela placa, sem auth
router.get('/lookup/truck/:plate', async (req: Request, res: Response) => {
  try {
    const { plate } = req.params;
    const t = await pool.query(
      `SELECT id, name, plate, model, year, 'truck' AS kind
         FROM trucks
        WHERE UPPER(REPLACE(plate, '-', '')) = UPPER(REPLACE($1, '-', '')) LIMIT 1`,
      [plate]
    );
    if (t.rows[0]) return res.json(t.rows[0]);
    const c = await pool.query(
      `SELECT id, name, plate, model, year, 'carretinha' AS kind
         FROM carretinhas
        WHERE UPPER(REPLACE(plate, '-', '')) = UPPER(REPLACE($1, '-', '')) LIMIT 1`,
      [plate]
    );
    if (c.rows[0]) return res.json(c.rows[0]);
    return res.status(404).json({ error: 'Veículo não encontrado' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Pendentes de 2ª assinatura por placa (público) ============
router.get('/lookup/pending/:plate', async (req: Request, res: Response) => {
  try {
    const { plate } = req.params;
    const r = await pool.query(
      `SELECT id, truck_plate AS "truckPlate", truck_name AS "truckName",
              truck_model AS "truckModel", vehicle_kind AS "vehicleKind",
              signer_name AS "signerName", signature_mode AS "signatureMode",
              created_at AS "createdAt"
         FROM truck_checklists
        WHERE UPPER(REPLACE(truck_plate, '-', '')) = UPPER(REPLACE($1, '-', ''))
          AND signature_mode IN ('cliente','conferente')
          AND second_signature_data_url IS NULL
        ORDER BY created_at DESC
        LIMIT 50`,
      [plate]
    );
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============ Salvar 2ª assinatura (público) ============
router.post('/:id/second-signature', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { signerName, signerDocument, signatureDataUrl } = req.body || {};
    if (!signerName || !signerDocument || !signatureDataUrl) {
      return res.status(400).json({ error: 'Nome, documento e assinatura são obrigatórios' });
    }
    const cur = await pool.query(
      `SELECT signature_mode, second_signature_data_url FROM truck_checklists WHERE id=$1`,
      [id]
    );
    if (!cur.rows[0]) return res.status(404).json({ error: 'Checklist não encontrada' });
    if (cur.rows[0].signature_mode === 'none') {
      return res.status(400).json({ error: 'Esta checklist não requer 2ª assinatura' });
    }
    if (cur.rows[0].second_signature_data_url) {
      return res.status(409).json({ error: 'Esta checklist já foi assinada' });
    }
    await pool.query(
      `UPDATE truck_checklists
          SET second_signer_name=$1, second_signer_document=$2,
              second_signature_data_url=$3, second_signed_at=NOW()
        WHERE id=$4`,
      [String(signerName).trim(), String(signerDocument).trim(), signatureDataUrl, id]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

