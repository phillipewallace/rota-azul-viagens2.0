
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get truck data by plate for mobile app
router.get('/truck/:plate', async (req, res) => {
  try {
    const { plate } = req.params;
    
    console.log(`🔍 [MOBILE API] Buscando caminhão com placa: ${plate}`);
    
    // Query para buscar dados do caminhão
    const truckQuery = `
      SELECT 
        t.id,
        t.name,
        t.plate,
        t.model,
        t.year,
        COALESCE(t.status, 'available') as status,
        t.current_route_id,
        d.name as driver_name,
        t.updated_at as truck_updated_at
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      WHERE UPPER(REPLACE(t.plate, '-', '')) = UPPER(REPLACE($1, '-', ''))
    `;
    
    const truckResult = await pool.query(truckQuery, [plate]);

    if (truckResult.rows.length === 0) {
      console.log(`❌ [MOBILE API] Caminhão não encontrado: ${plate}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    const truck = truckResult.rows[0];
    console.log(`✅ [MOBILE API] Caminhão encontrado: ${truck.name} (${truck.plate})`);
    
    // Buscar dados da rota se existir
    let currentRoute: any = null;
    
    if (truck.current_route_id) {
      console.log(`📋 [MOBILE API] Buscando rota: ${truck.current_route_id}`);
      
      const routeQuery = `
        SELECT 
          r.id,
          r.name,
          r.description,
          r.updated_at as route_updated_at
        FROM routes r
        WHERE r.id = $1
      `;
      
      const routeResult = await pool.query(routeQuery, [truck.current_route_id]);
      
      if (routeResult.rows.length > 0) {
        const route = routeResult.rows[0];
        
        // ✅ CRÍTICO: Buscar pontos COM TODOS OS CAMPOS OPERACIONAIS
        const pointsQuery = `
          SELECT 
            rp.id,
            rp.address,
            COALESCE(rp.lat, 0) as lat,
            COALESCE(rp.lng, 0) as lng,
            COALESCE(rp.point_order, 0) as point_order,
            COALESCE(rp.type, 'waypoint') as type,
            CASE 
              WHEN rp.completed = true OR rp.completed = 't' OR rp.completed = 'true' THEN true
              ELSE false
            END as completed,
            rp.completed_at,
            rp.customer_name,
            rp.restrooms_qty,
            rp.cleanings_qty,
            rp.contact_name,
            rp.contact_phone,
            rp.notes,
            rp.cep,
            rp.stop_type,
            COALESCE(rp.point_category, 'obra') AS point_category,
            COALESCE(rp.operation_type, 'entrega') AS operation_type,
            rp.recolhido_qty,
            COALESCE(rp.auto_removed, false) AS auto_removed,
            rp.sanitario_numbers,
            rp.sanitario_recolhidos
          FROM route_points rp
          WHERE rp.route_id = $1
          ORDER BY rp.point_order ASC
        `;
        
        const pointsResult = await pool.query(pointsQuery, [truck.current_route_id]);
        console.log(`📍 [MOBILE API] Pontos da rota encontrados: ${pointsResult.rows.length}`);
        
        let points: any[] = [];
        let completedCount = 0;
        
        if (pointsResult.rows.length > 0) {
          points = pointsResult.rows.map((point) => {
            const isCompleted = point.completed === true;
            
            if (isCompleted) {
              completedCount++;
            }
            
            console.log(`📍 [MOBILE API] Ponto: {
  id: '${point.id}',
  order: ${point.point_order},
  address: '${point.address.substring(0, 50)}...',
  completed: ${isCompleted},
  type: '${point.type}',
  customerName: '${point.customer_name || 'N/A'}'
}`);
            
            return {
              id: point.id,
              address: point.address,
              lat: Number(point.lat),
              lng: Number(point.lng),
              order: Number(point.point_order),
              type: point.type,
              completed: isCompleted,
              completedAt: point.completed_at,
              // ✅ CAMPOS OPERACIONAIS
              name: point.customer_name,
              customerName: point.customer_name,
              restroomsQty: point.restrooms_qty,
              cleaningsQty: point.cleanings_qty,
              contactName: point.contact_name,
              contactPhone: point.contact_phone,
              notes: point.notes,
              observation: point.notes,
              cep: point.cep,
              stopType: point.stop_type,
              pointCategory: point.point_category || 'obra',
              operationType: point.operation_type || 'entrega',
              recolhidoQty: point.recolhido_qty,
              autoRemoved: point.auto_removed || false,
              sanitarioNumbers: point.sanitario_numbers || [],
              sanitarioRecolhidos: point.sanitario_recolhidos || []
            };
          });
        }
        
        console.log(`📊 [MOBILE API] Status final: ${completedCount}/${points.length} pontos concluídos`);
        
        currentRoute = {
          id: route.id,
          name: route.name,
          description: route.description || null,
          points: points,
          pointsCount: points.length,
          completedPoints: completedCount,
          lastUpdated: route.route_updated_at
        };
      }
    }

    const response = {
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      driver: truck.driver_name || null,
      currentRoute,
      lastUpdated: truck.truck_updated_at
    };

    console.log(`📱 [MOBILE API] Enviando resposta: {
  id: '${response.id}',
  name: '${response.name}',
  plate: '${response.plate}',
  model: '${response.model}',
  year: ${response.year},
  status: '${response.status}',
  driver: ${response.driver},
  currentRoute: ${response.currentRoute ? `{
    id: '${response.currentRoute.id}',
    name: '${response.currentRoute.name}',
    pointsCount: ${response.currentRoute.pointsCount},
    completedPoints: ${response.currentRoute.completedPoints},
    lastUpdated: ${response.currentRoute.lastUpdated}
  }` : 'null'},
  lastUpdated: ${response.lastUpdated}
}`);

    res.json(response);
    
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao buscar caminhão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Update truck location
router.put('/truck/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    console.log(`📍 [MOBILE API] Atualizando localização do caminhão ${id}: { lat: ${lat}, lng: ${lng} }`);

    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [lat, lng, id]
    );

    console.log(`✅ [MOBILE API] Localização atualizada para caminhão ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [MOBILE API] Erro ao atualizar localização:', error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// ✅ IMPLEMENTAÇÃO BRUTA E ASSERTIVA - VALIDAÇÃO COMPLETA DE PONTOS
async function validatePointCompletionInDatabase(client: any, pointId: string, expectedCompleted: boolean, truckId: string) {
  const timestamp = new Date().toISOString();
  
  console.log(`🔍 [DB VALIDATION] ========================================`);
  console.log(`🔍 [DB VALIDATION] Iniciando validação COMPLETA do ponto ${pointId}`);
  console.log(`🔍 [DB VALIDATION] Esperado completed: ${expectedCompleted}`);
  console.log(`🔍 [DB VALIDATION] Caminhão: ${truckId}`);
  console.log(`🔍 [DB VALIDATION] Timestamp: ${timestamp}`);
  
  try {
    // 1️⃣ VERIFICAR SE O PONTO EXISTE
    const pointExistsQuery = `
      SELECT 
        rp.id,
        rp.route_id,
        rp.address,
        rp.point_order,
        rp.type,
        rp.completed,
        rp.completed_at,
        rp.created_at,
        r.name as route_name,
        t.name as truck_name,
        t.plate as truck_plate
      FROM route_points rp
      LEFT JOIN routes r ON rp.route_id = r.id
      LEFT JOIN trucks t ON r.id = t.current_route_id
      WHERE rp.id = $1
    `;
    
    const pointExistsResult = await client.query(pointExistsQuery, [pointId]);
    
    if (pointExistsResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: Ponto ${pointId} não existe no banco!`);
      throw new Error(`Ponto ${pointId} não encontrado no banco de dados`);
    }
    
    const currentPointData = pointExistsResult.rows[0];
    console.log(`✅ [DB VALIDATION] Ponto encontrado:`);
    console.log(`   - ID: ${currentPointData.id}`);
    console.log(`   - Endereço: ${currentPointData.address}`);
    console.log(`   - Ordem: ${currentPointData.point_order}`);
    console.log(`   - Tipo: ${currentPointData.type}`);
    console.log(`   - Completed ATUAL: ${currentPointData.completed}`);
    console.log(`   - Completed_at ATUAL: ${currentPointData.completed_at}`);
    console.log(`   - Rota: ${currentPointData.route_name} (${currentPointData.route_id})`);
    console.log(`   - Caminhão: ${currentPointData.truck_name} (${currentPointData.truck_plate})`);
    
    // 2️⃣ VERIFICAR SE O CAMINHÃO ESTÁ REALMENTE VINCULADO À ROTA
    const truckRouteValidation = `
      SELECT 
        t.id as truck_id,
        t.current_route_id,
        r.id as route_id,
        r.name as route_name
      FROM trucks t
      LEFT JOIN routes r ON t.current_route_id = r.id
      WHERE t.id = $1 AND r.id = $2
    `;
    
    const truckRouteResult = await client.query(truckRouteValidation, [truckId, currentPointData.route_id]);
    
    if (truckRouteResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: Caminhão ${truckId} não está vinculado à rota ${currentPointData.route_id}!`);
      throw new Error(`Caminhão não vinculado à rota do ponto`);
    }
    
    console.log(`✅ [DB VALIDATION] Vinculação caminhão-rota confirmada`);
    
    // 3️⃣ ATUALIZAR O PONTO COM VALIDAÇÃO TRIPLA
    const updateTimestamp = expectedCompleted ? new Date() : null;
    
    console.log(`🔄 [DB VALIDATION] Executando UPDATE com:`);
    console.log(`   - completed: ${expectedCompleted}`);
    console.log(`   - completed_at: ${updateTimestamp}`);
    
    const updateResult = await client.query(
      'UPDATE route_points SET completed = $1, completed_at = $2 WHERE id = $3 RETURNING *',
      [expectedCompleted, updateTimestamp, pointId]
    );
    
    if (updateResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: UPDATE falhou para ponto ${pointId}!`);
      throw new Error(`Falha ao atualizar ponto no banco`);
    }
    
    const updatedPoint = updateResult.rows[0];
    console.log(`✅ [DB VALIDATION] UPDATE executado com sucesso`);
    
    // 4️⃣ VERIFICAÇÃO PÓS-UPDATE - LEITURA IMEDIATA DO BANCO
    const verificationQuery = `
      SELECT 
        id,
        completed,
        completed_at,
        CASE 
          WHEN completed = true OR completed = 't' OR completed = 'true' THEN true
          ELSE false
        END as completed_normalized
      FROM route_points 
      WHERE id = $1
    `;
    
    const verificationResult = await client.query(verificationQuery, [pointId]);
    
    if (verificationResult.rows.length === 0) {
      console.error(`❌ [DB VALIDATION] ERRO CRÍTICO: Ponto desapareceu após UPDATE!`);
      throw new Error(`Ponto não encontrado após UPDATE`);
    }
    
    const verifiedPoint = verificationResult.rows[0];
    const actualCompleted = verifiedPoint.completed_normalized;
    
    console.log(`🔍 [DB VALIDATION] Verificação pós-UPDATE:`);
    console.log(`   - completed (bruto): ${verifiedPoint.completed}`);
    console.log(`   - completed (normalizado): ${actualCompleted}`);
    console.log(`   - completed_at: ${verifiedPoint.completed_at}`);
    console.log(`   - Esperado: ${expectedCompleted}`);
    
    // 5️⃣ VALIDAÇÃO FINAL - COMPARAÇÃO ASSERTIVA
    if (actualCompleted !== expectedCompleted) {
      console.error(`❌ [DB VALIDATION] DISCREPÂNCIA CRÍTICA DETECTADA!`);
      console.error(`   - Esperado: ${expectedCompleted}`);
      console.error(`   - Atual no banco: ${actualCompleted}`);
      console.error(`   - Valor bruto no banco: ${verifiedPoint.completed}`);
      
      // Log detalhado da discrepância
      console.error(`🚨 [DB VALIDATION] DADOS PARA DEBUG:`);
      console.error(`   - Point ID: ${pointId}`);
      console.error(`   - Truck ID: ${truckId}`);
      console.error(`   - Route ID: ${currentPointData.route_id}`);
      console.error(`   - Update Timestamp: ${updateTimestamp}`);
      console.error(`   - Verification Result: ${JSON.stringify(verifiedPoint)}`);
      
      throw new Error(`Discrepância crítica: esperado ${expectedCompleted}, encontrado ${actualCompleted}`);
    }
    
    // 6️⃣ ATUALIZAR TIMESTAMP DA ROTA
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [currentPointData.route_id]
    );
    
    console.log(`✅ [DB VALIDATION] Timestamp da rota atualizado`);
    
    // 7️⃣ LOG DE SUCESSO COMPLETO
    console.log(`🎯 [DB VALIDATION] VALIDAÇÃO COMPLETA REALIZADA COM SUCESSO!`);
    console.log(`   - Ponto ${pointId} atualizado para completed: ${actualCompleted}`);
    console.log(`   - Completed_at: ${verifiedPoint.completed_at}`);
    console.log(`   - Rota ${currentPointData.route_id} timestamp atualizado`);
    console.log(`   - Caminhão ${truckId} mantém vinculação correta`);
    console.log(`🔍 [DB VALIDATION] ========================================`);
    
    return {
      success: true,
      pointId: pointId,
      actualCompleted: actualCompleted,
      completedAt: verifiedPoint.completed_at,
      routeId: currentPointData.route_id,
      truckId: truckId
    };
    
  } catch (error) {
    console.error(`❌ [DB VALIDATION] ERRO NA VALIDAÇÃO:`, error);
    console.error(`🔍 [DB VALIDATION] ========================================`);
    throw error;
  }
}

// Update route point — agora aceita campos operacionais V2
router.put('/truck/:truckId/route/point/:pointId', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { truckId, pointId } = req.params;
    const {
      completed,
      recolhidoQty,
      autoRemoved,
      operationType,
      observation,
      sanitarioNumbers,
      sanitarioRecolhidos,
    } = req.body || {};

    const completedValue = completed === undefined ? null : Boolean(completed);

    // valida vínculo caminhão-rota-ponto
    const ck = await client.query(
      `SELECT rp.route_id FROM route_points rp
        JOIN trucks t ON t.current_route_id = rp.route_id
        WHERE rp.id = $1::uuid AND t.id = $2::uuid`,
      [pointId, truckId]
    );
    if (!ck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ponto/caminhão não vinculados' });
    }
    const routeId = ck.rows[0].route_id;

    const update = await client.query(
      `UPDATE route_points SET
         completed       = COALESCE($1::boolean, completed),
         completed_at    = CASE WHEN $1::boolean = true THEN NOW()
                                WHEN $1::boolean = false THEN NULL
                                ELSE completed_at END,
         recolhido_qty   = COALESCE($2::int, recolhido_qty),
         auto_removed    = COALESCE($3::boolean, auto_removed),
         operation_type  = COALESCE($4, operation_type),
         notes           = COALESCE($5, notes),
         sanitario_numbers    = COALESCE($6::text[], sanitario_numbers),
         sanitario_recolhidos = COALESCE($7::text[], sanitario_recolhidos)
       WHERE id = $8::uuid
       RETURNING *`,
      [
        completedValue,
        recolhidoQty === undefined || recolhidoQty === null ? null : parseInt(String(recolhidoQty)),
        autoRemoved === undefined ? null : Boolean(autoRemoved),
        operationType || null,
        observation ?? null,
        Array.isArray(sanitarioNumbers) ? sanitarioNumbers : null,
        Array.isArray(sanitarioRecolhidos) ? sanitarioRecolhidos : null,
        pointId,
      ]
    );

    if (!update.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ponto não encontrado' });
    }

    // Regras automáticas ao CONCLUIR pelo motorista (app mobile):
    //  - entrega     → operation_type vira 'manutencao' (próxima visita = manutenção do banheiro instalado)
    //  - recolhimento → auto_removed = true (sai da rota ativa) + status do sanitário tratado pelo endpoint /sanitarios/movimentar
    //  - manutencao   → no-op (continua manutenção)
    // OBS: o painel admin sempre vence — quando o admin salva uma rota, o
    // UPDATE do painel sobrescreve operation_type/auto_removed com a preferência dele.
    if (completedValue === true) {
      const row = update.rows[0];
      const opType = (row.operation_type || row.stop_type || '').toString().toLowerCase();
      if (opType === 'recolhimento') {
        await client.query(
          `UPDATE route_points SET auto_removed = true WHERE id = $1::uuid`,
          [pointId]
        );
      } else if (opType === 'entrega') {
        await client.query(
          `UPDATE route_points
              SET operation_type = 'manutencao',
                  stop_type = 'manutencao'
            WHERE id = $1::uuid`,
          [pointId]
        );
      }
    }

    await client.query('UPDATE routes SET updated_at = NOW() WHERE id = $1', [routeId]);
    await client.query('COMMIT');

    // Garante registro em completed_routes (auto-cria com driver/plate se não existir)
    pool.query(
      `INSERT INTO completed_routes (route_id, route_name, truck_id, truck_plate, driver_id, driver_name, started_at, status)
         SELECT r.id, r.name, t.id, t.plate, t.current_driver_id, d.name, NOW(), 'in_progress'
           FROM routes r
           LEFT JOIN trucks t ON t.current_route_id = r.id
           LEFT JOIN drivers d ON d.id = t.current_driver_id
          WHERE r.id = $1::uuid
            AND NOT EXISTS (
              SELECT 1 FROM completed_routes cr
               WHERE cr.route_id = r.id AND cr.status = 'in_progress'
            )`,
      [routeId]
    ).catch((e) => console.warn('[MOBILE] ensure completed_routes:', e?.message));

    pool.query(
      `UPDATE completed_routes
          SET points_snapshot = (
            SELECT COALESCE(jsonb_agg(rp ORDER BY rp.point_order), '[]'::jsonb)
              FROM route_points rp WHERE rp.route_id = $1::uuid
          ),
          photos_count = (SELECT COUNT(*)::int FROM point_photos WHERE route_id = $1::uuid),
          updated_at = NOW()
        WHERE route_id = $1::uuid AND status = 'in_progress'`,
      [routeId]
    ).catch((e) => console.warn('[MOBILE] sync completed_routes:', e?.message));

    res.json({ success: true, point: update.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [MOBILE] update ponto:', error);
    res.status(500).json({ error: error?.message || 'Erro ao atualizar ponto' });
  } finally {
    client.release();
  }
});

// Finish route
router.post('/truck/:truckId/finish-route', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { truckId } = req.params;
    const { totalDistance, totalDuration } = req.body || {};
    
    console.log(`🏁 [MOBILE API] Finalizando rota do caminhão ${truckId}`);
    
    // Buscar a rota atual + driver + plate
    const truckResult = await client.query(
      `SELECT t.current_route_id, t.plate, t.current_driver_id,
              d.name AS driver_name,
              r.name AS route_name,
              r.total_distance AS route_distance,
              r.estimated_duration AS route_duration
         FROM trucks t
         LEFT JOIN drivers d ON d.id = t.current_driver_id
         LEFT JOIN routes  r ON r.id = t.current_route_id
        WHERE t.id = $1`,
      [truckId]
    );
    
    if (truckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    const tr = truckResult.rows[0];
    const currentRouteId = tr.current_route_id;
    
    if (!currentRouteId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Caminhão não possui rota ativa' });
    }
    
    const finalDistance = totalDistance ?? tr.route_distance ?? null;
    const finalDuration = totalDuration ?? tr.route_duration ?? null;
    
    // Snapshot final no completed_routes (idempotente, auto-cria se necessário)
    try {
      const ptsAgg = await client.query(
        `SELECT COALESCE(jsonb_agg(rp ORDER BY rp.point_order), '[]'::jsonb) AS pts,
                (SELECT COUNT(*)::int FROM point_photos WHERE route_id = $1::uuid) AS photos
           FROM route_points rp WHERE rp.route_id = $1::uuid`,
        [currentRouteId]
      );
      const ptsJson = JSON.stringify(ptsAgg.rows[0].pts ?? []);
      const photosCount = ptsAgg.rows[0].photos ?? 0;

      const upd = await client.query(
        `UPDATE completed_routes SET status = 'finished', finished_at = NOW(),
                total_distance = $1, total_duration = $2,
                truck_id = COALESCE(truck_id, $6::uuid),
                truck_plate = COALESCE(truck_plate, $7),
                driver_id = COALESCE(driver_id, $8::uuid),
                driver_name = COALESCE(driver_name, $9),
                route_name = COALESCE(route_name, $10),
                points_snapshot = $3::jsonb, photos_count = $4, updated_at = NOW()
          WHERE route_id = $5::uuid AND status = 'in_progress'
          RETURNING id`,
        [finalDistance, finalDuration, ptsJson, photosCount, currentRouteId,
         truckId, tr.plate, tr.current_driver_id, tr.driver_name, tr.route_name]
      );

      if (!upd.rows.length) {
        await client.query(
          `INSERT INTO completed_routes
             (route_id, route_name, truck_id, truck_plate, driver_id, driver_name,
              started_at, finished_at, status, total_distance, total_duration,
              points_snapshot, photos_count)
           VALUES ($1::uuid, $2, $3::uuid, $4, $5::uuid, $6,
                   NOW(), NOW(), 'finished', $7, $8, $9::jsonb, $10)`,
          [currentRouteId, tr.route_name, truckId, tr.plate,
           tr.current_driver_id, tr.driver_name,
           finalDistance, finalDuration, ptsJson, photosCount]
        );
      }
    } catch (e: any) {
      console.warn('[MOBILE] snapshot finish-route:', e?.message);
    }

    // Resetar pontos da rota (mantém o snapshot já salvo)
    const resetPointsResult = await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING id',
      [currentRouteId]
    );

    await client.query(
      'UPDATE trucks SET current_route_id = NULL, status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['available', truckId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Rota finalizada e pontos resetados com sucesso',
      pointsReset: resetPointsResult.rows.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao finalizar rota:', error);
    res.status(500).json({ error: 'Erro ao finalizar rota' });
  } finally {
    client.release();
  }
});

// ✅ ENDPOINT DE EXTRA-STOP FOI MOVIDO PARA mobile-extra.ts PARA EVITAR DUPLICAÇÃO

export default router;
