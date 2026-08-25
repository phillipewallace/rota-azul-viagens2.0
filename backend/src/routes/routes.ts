import { Router } from 'express';
import { pool } from '../config/database';
import { googleMapsOptimizer } from '../services/googleMapsOptimizer';
import { optimizeLargeRoute } from '../services/hybridOptimizer';

const router = Router();

const toIntOrNull = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
};

// Get all routes - ✅ BUSCA PONTOS DA TABELA route_points COM TODOS OS CAMPOS OPERACIONAIS
router.get('/', async (req, res) => {
  try {
    // Buscar rotas
    const routesQuery = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.total_distance,
        r.estimated_time,
        r.estimated_duration,
        r.optimized_order,
        r.polyline,
        r.status,
        r.optimization_mode,
        r.created_at
      FROM routes r
      ORDER BY r.created_at DESC
    `;
    
    const routesResult = await pool.query(routesQuery);
    
    // Para cada rota, buscar os pontos da tabela route_points com todos os campos
    const routes = await Promise.all(routesResult.rows.map(async (route) => {
      const pointsQuery = `
        SELECT 
          id, address, lat, lng, point_order, type, completed, completed_at,
          customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, 
          notes, cep, stop_type,
          COALESCE(point_category, 'obra') AS point_category,
          COALESCE(operation_type, 'entrega') AS operation_type,
          recolhido_qty,
          COALESCE(auto_removed, false) AS auto_removed,
          COALESCE(sanitario_numbers, ARRAY[]::TEXT[]) AS sanitario_numbers,
          COALESCE(sanitario_recolhidos, ARRAY[]::TEXT[]) AS sanitario_recolhidos
        FROM route_points 
        WHERE route_id = $1 
        ORDER BY point_order
      `;
      
      const pointsResult = await pool.query(pointsQuery, [route.id]);
      
      const points = pointsResult.rows.map(p => ({
        id: p.id,
        address: p.address,
        lat: parseFloat(p.lat),
        lng: parseFloat(p.lng),
        order: p.point_order,
        type: p.type,
        completed: p.completed,
        completedAt: p.completed_at,
        customerName: p.customer_name,
        restroomsQty: p.restrooms_qty,
        cleaningsQty: p.cleanings_qty,
        contactName: p.contact_name,
        contactPhone: p.contact_phone,
        notes: p.notes,
        observation: p.notes,
        cep: p.cep,
        stopType: p.stop_type,
        pointCategory: p.point_category || 'obra',
        operationType: p.operation_type || 'entrega',
        recolhidoQty: p.recolhido_qty,
        autoRemoved: p.auto_removed || false,
        sanitarioNumbers: p.sanitario_numbers || [],
        sanitarioRecolhidos: p.sanitario_recolhidos || [],
      }));
      
      return {
        id: route.id,
        name: route.name,
        description: route.description,
        points: points,
        totalDistance: parseFloat(route.total_distance) || 0,
        estimatedTime: route.estimated_time,
        estimatedDuration: parseInt(route.estimated_duration) || 0,
        optimizedOrder: route.optimized_order || [],
        polyline: route.polyline,
        status: route.status,
        optimizationMode: route.optimization_mode || 'optimized',
        createdAt: route.created_at,
        pointCount: points.length
      };
    }));

    res.json(routes);
  } catch (error) {
    console.error('❌ [ROUTES] Error fetching routes:', error);
    console.error('🔍 [ROUTES] Mensagem PG:', (error as any)?.message);
    res.status(500).json({ error: 'Erro ao buscar rotas', detail: (error as any)?.message });
  }
});

// Get single route by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const routeQuery = `SELECT * FROM routes WHERE id = $1`;
    const pointsQuery = `
      SELECT 
        id, route_id, address, lat, lng, point_order, type, completed, completed_at,
        customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, 
        notes, cep, stop_type, created_at
      FROM route_points 
      WHERE route_id = $1 
      ORDER BY point_order
    `;
    
    const [routeResult, pointsResult] = await Promise.all([
      pool.query(routeQuery, [id]),
      pool.query(pointsQuery, [id])
    ]);
    
    if (routeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // Mapear pontos com todos os campos
    const routePoints = pointsResult.rows.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.type,
      completed: p.completed,
      completedAt: p.completed_at,
      customerName: p.customer_name,
      restroomsQty: p.restrooms_qty,
      cleaningsQty: p.cleanings_qty,
      contactName: p.contact_name,
      contactPhone: p.contact_phone,
      notes: p.notes,
      observation: p.notes, // Compatibilidade
      cep: p.cep,
      stopType: p.stop_type
    }));
    
    const route = {
      ...routeResult.rows[0],
      totalDistance: parseFloat(routeResult.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(routeResult.rows[0].estimated_duration) || 0,
      routePoints
    };
    
    res.json(route);
  } catch (error) {
    console.error('❌ [ROUTES] Error fetching route:', error);
    res.status(500).json({ error: 'Erro ao buscar rota' });
  }
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, optimizationMode } = req.body;
    
    console.log(`📝 [ROUTES CREATE] Criando rota "${name}" com ${points?.length || 0} pontos`);
    
    // Validar dados mínimos
    if (!name || !name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nome da rota é obrigatório' });
    }
    
    if (!points || points.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }
    
    const query = `
      INSERT INTO routes (name, description, total_distance, estimated_duration, optimized_order, polyline, optimization_mode)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await client.query(query, [
      name.trim(),
      description || '',
      parseFloat(totalDistance) || 0,
      parseInt(estimatedDuration) || 0,
      JSON.stringify(optimizedOrder || []),
      polyline || null,
      optimizationMode || 'optimized'
    ]);
    
    const routeId = result.rows[0].id;
    
    // ✅ INSERIR PONTOS COM TODOS OS CAMPOS
    for (const [index, point] of points.entries()) {
      await client.query(
        `INSERT INTO route_points (
          route_id, address, lat, lng, point_order, type, completed,
          customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, cep, stop_type,
          point_category, operation_type, sanitario_numbers
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          routeId,
          point.address || '',
          parseFloat(point.lat) || 0,
          parseFloat(point.lng) || 0,
          Number.isFinite(Number(point.order)) ? Number(point.order) : index,
          point.type || 'waypoint',
          false,
          point.customerName || point.name || null,
          toIntOrNull(point.restroomsQty),
          toIntOrNull(point.cleaningsQty),
          point.contactName || null,
          point.contactPhone || null,
          point.notes || point.observation || null,
          point.cep || null,
          point.stopType || null,
          point.pointCategory || 'obra',
          point.operationType || 'entrega',
          Array.isArray(point.sanitarioNumbers) ? point.sanitarioNumbers : null,
        ]
      );
    }
    
    await client.query('COMMIT');
    
    const responseRoute = {
      ...result.rows[0],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(result.rows[0].estimated_duration) || 0,
      optimizationMode: result.rows[0].optimization_mode || 'optimized'
    };
    
    console.log(`✅ [ROUTES CREATE] Rota "${name}" criada com sucesso (ID: ${routeId})`);
    res.status(201).json(responseRoute);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES CREATE] Error creating route:', error);
    res.status(500).json({ error: 'Erro ao criar rota' });
  } finally {
    client.release();
  }
});

// ✅ NOVO ENDPOINT - VERIFICAR SE ROTA ESTÁ EM USO
router.get('/:id/check-usage', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 [ROUTE USAGE] Verificando uso da rota ${id}`);
    
    const trucksUsingRoute = await pool.query(
      'SELECT id, name, plate FROM trucks WHERE current_route_id = $1',
      [id]
    );
    
    const inUse = trucksUsingRoute.rows.length > 0;
    
    console.log(`${inUse ? '🚛' : '🆓'} [ROUTE USAGE] Rota ${id} ${inUse ? 'EM USO' : 'LIVRE'} por ${trucksUsingRoute.rows.length} caminhão(ões)`);
    
    res.json({
      inUse: inUse,
      trucksCount: trucksUsingRoute.rows.length,
      trucks: trucksUsingRoute.rows
    });
    
  } catch (error) {
    console.error('❌ [ROUTE USAGE] Erro ao verificar uso da rota:', error);
    res.status(500).json({ error: 'Erro ao verificar uso da rota' });
  }
});

// ✅ CORRIGIDO - OTIMIZAÇÃO INTELIGENTE PRIORITÁRIA
router.post('/:id/optimize-intelligent', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { points } = req.body;
    
    console.log(`🧠 [INTELLIGENT OPTIMIZE] ========================================`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] Iniciando otimização inteligente para rota ${id}`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] Pontos recebidos: ${points?.length || 0}`);
    
    if (!points || points.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }

    // ✅ VERIFICAR SE ROTA EXISTE
    const routeCheck = await client.query('SELECT id, name FROM routes WHERE id = $1', [id]);
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }

    // ✅ BUSCAR PONTOS CONCLUÍDOS REAIS DO BANCO
    const completedPointsQuery = `
      SELECT rp.*, 
             CASE 
               WHEN rp.completed = true OR rp.completed = 't' OR rp.completed = 'true' THEN true
               ELSE false
             END as is_truly_completed
      FROM route_points rp 
      WHERE rp.route_id = $1 
      AND (rp.completed = true OR rp.completed = 't' OR rp.completed = 'true')
      ORDER BY rp.point_order ASC
    `;
    
    const completedResult = await client.query(completedPointsQuery, [id]);
    const trulyCompletedPoints = completedResult.rows;
    
    console.log(`🔒 [INTELLIGENT OPTIMIZE] ${trulyCompletedPoints.length} pontos REALMENTE concluídos no banco`);

    // ✅ SE NÃO HÁ PONTOS CONCLUÍDOS, RETORNAR ERRO PARA USAR FALLBACK
    if (trulyCompletedPoints.length === 0) {
      await client.query('ROLLBACK');
      console.log(`🆓 [INTELLIGENT OPTIMIZE] Nenhum ponto concluído - usar otimização tradicional`);
      return res.status(400).json({ 
        error: 'Nenhum ponto concluído encontrado - usar otimização tradicional',
        useTraditional: true 
      });
    }

    // ✅ APLICAR PRESERVAÇÃO INTELIGENTE
    const finalPoints = await preserveCompletedPointsIntelligently(client, id, points);

    // ✅ CALCULAR MÉTRICAS CORRIGIDAS
    const totalDistance = calculateTotalDistanceFromPoints(finalPoints);
    const estimatedDuration = totalDistance > 0 ? totalDistance * 60 : 0;
    const hours = Math.floor(estimatedDuration / 3600);
    const minutes = Math.floor((estimatedDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    // ✅ SANITIZAR PONTOS ANTES DO JSON.stringify
    const sanitizedPoints = sanitizePointsForJSON(finalPoints);

    // ✅ ATUALIZAR ROTA COM DADOS PRESERVADOS
    await client.query(
      `UPDATE routes SET 
       total_distance = $1, 
       estimated_duration = $2,
       updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [
        totalDistance,
        Math.round(estimatedDuration),
        id
      ]
    );

    await client.query('COMMIT');

    console.log(`✅ [INTELLIGENT OPTIMIZE] Otimização inteligente concluída com preservação`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${finalPoints.filter(p => p.completed).length} pontos preservados`);
    console.log(`📊 [INTELLIGENT OPTIMIZE] ${finalPoints.filter(p => !p.completed).length} pontos otimizados`);
    console.log(`🧠 [INTELLIGENT OPTIMIZE] ========================================`);

    res.json({
      message: 'Otimização inteligente concluída',
      points: sanitizedPoints,
      optimizedOrder: sanitizedPoints.map(p => p.id),
      totalDistance: totalDistance,
      estimatedTime: estimatedTime,
      preservedPoints: finalPoints.filter(p => p.completed).length,
      optimizedPoints: finalPoints.filter(p => !p.completed).length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [INTELLIGENT OPTIMIZE] Erro na otimização inteligente:', error);
    res.status(500).json({ error: 'Erro na otimização inteligente' });
  } finally {
    client.release();
  }
});

// ✅ FUNÇÃO AUXILIAR CORRIGIDA - CALCULAR DISTÂNCIA TOTAL
function calculateTotalDistanceFromPoints(points: any[]): number {
  if (!points || points.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const point1 = points[i];
    const point2 = points[i + 1];
    
    // ✅ VERIFICAR SE AS COORDENADAS SÃO VÁLIDAS
    if (isValidCoordinate(point1.lat) && isValidCoordinate(point1.lng) && 
        isValidCoordinate(point2.lat) && isValidCoordinate(point2.lng)) {
      total += calculateDistance(point1, point2);
    }
  }
  return total;
}

// ✅ NOVA FUNÇÃO - VALIDAR COORDENADAS
function isValidCoordinate(coord: any): boolean {
  return typeof coord === 'number' && !isNaN(coord) && isFinite(coord);
}

function calculateDistance(point1: any, point2: any): number {
  const R = 6371;
  const dLat = toRadians(point2.lat - point1.lat);
  const dLng = toRadians(point2.lng - point1.lng);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
           Math.cos(toRadians(point1.lat)) * Math.cos(toRadians(point2.lat)) *
           Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ✅ NOVA FUNÇÃO - SANITIZAR PONTOS PARA JSON
function sanitizePointsForJSON(points: any[]): any[] {
  return points.map(point => ({
    id: point.id || `point-${Date.now()}-${Math.random()}`,
    address: point.address || '',
    cep: point.cep || '',
    lat: isValidCoordinate(point.lat) ? point.lat : 0,
    lng: isValidCoordinate(point.lng) ? point.lng : 0,
    order: typeof point.order === 'number' ? point.order : 0,
    type: point.type || 'waypoint',
    completed: Boolean(point.completed),
    completedAt: point.completedAt || null
  }));
}

async function preserveCompletedPointsIntelligently(client: any, routeId: string, newPoints: any[]) {
  try {
    console.log(`🛡️ [INTELLIGENT PRESERVATION] Iniciando preservação ROBUSTA para rota ${routeId}`);
    
    // 1️⃣ BUSCAR PONTOS REALMENTE CONCLUÍDOS DO BANCO
    const completedPointsQuery = `
      SELECT rp.*, 
             CASE 
               WHEN rp.completed = true OR rp.completed = 't' OR rp.completed = 'true' THEN true
               ELSE false
             END as is_truly_completed
      FROM route_points rp 
      WHERE rp.route_id = $1 
      AND (rp.completed = true OR rp.completed = 't' OR rp.completed = 'true')
      ORDER BY rp.point_order ASC
    `;
    
    const completedResult = await client.query(completedPointsQuery, [routeId]);
    const trulyCompletedPoints = completedResult.rows;
    
    console.log(`🔒 [INTELLIGENT PRESERVATION] ${trulyCompletedPoints.length} pontos REALMENTE concluídos no banco`);
    
    // Log detalhado dos pontos concluídos
    trulyCompletedPoints.forEach((point, index) => {
      console.log(`🔒 [PRESERVATION] Ponto concluído ${index + 1}: {
  id: '${point.id}',
  order: ${point.point_order},
  address: '${point.address.substring(0, 40)}...',
  completed: ${point.completed},
  completed_at: ${point.completed_at}
}`);
    });

    // 2️⃣ SE NÃO HÁ PONTOS CONCLUÍDOS, FAZER ATUALIZAÇÃO NORMAL COM TODOS OS CAMPOS
    if (trulyCompletedPoints.length === 0) {
      console.log(`🆕 [INTELLIGENT PRESERVATION] Nenhum ponto concluído - atualização normal com campos operacionais`);
      
      await client.query('DELETE FROM route_points WHERE route_id = $1', [routeId]);
      
      for (const [index, point] of newPoints.entries()) {
        await client.query(
          `INSERT INTO route_points (
            route_id, address, lat, lng, point_order, type, completed,
            customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, cep, stop_type
          ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            routeId,
            point.address || '',
            parseFloat(point.lat) || 0,
            parseFloat(point.lng) || 0,
            Number.isFinite(Number(point.order)) ? Number(point.order) : index,
            point.type || 'waypoint',
            point.customerName || point.name || null,
            toIntOrNull(point.restroomsQty),
            toIntOrNull(point.cleaningsQty),
            point.contactName || null,
            point.contactPhone || null,
            point.notes || point.observation || null,
            point.cep || null,
            point.stopType || null,
          ]
        );
      }
      
      return newPoints;
    }

    // 3️⃣ ENCONTRAR O ÚLTIMO PONTO CONCLUÍDO
    const lastCompletedPoint = trulyCompletedPoints[trulyCompletedPoints.length - 1];
    const lastCompletedOrder = lastCompletedPoint.point_order;
    
    console.log(`📍 [INTELLIGENT PRESERVATION] Último ponto concluído na ordem: ${lastCompletedOrder}`);

    // 4️⃣ CRIAR LISTA DE PONTOS PRESERVADOS (CONCLUÍDOS) COM TODOS OS CAMPOS OPERACIONAIS
    const preservedPoints = trulyCompletedPoints.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.type,
      completed: true,
      completedAt: p.completed_at,
      customerName: p.customer_name,
      restroomsQty: p.restrooms_qty,
      cleaningsQty: p.cleanings_qty,
      contactName: p.contact_name,
      contactPhone: p.contact_phone,
      notes: p.notes,
      cep: p.cep,
      stopType: p.stop_type
    }));

    // 5️⃣ IDENTIFICAR NOVOS PONTOS QUE VÊM APÓS OS CONCLUÍDOS
    const pendingNewPoints = newPoints
      .filter(p => p.order > lastCompletedOrder)
      .map((p, index) => ({
        ...p,
        order: lastCompletedOrder + index + 1,
        completed: false,
        completedAt: null
      }));
    
    console.log(`🎯 [INTELLIGENT PRESERVATION] ${pendingNewPoints.length} novos pontos para inserir após concluídos`);

    // 6️⃣ OTIMIZAR APENAS OS PONTOS PENDENTES SE NECESSÁRIO
    let optimizedPendingPoints = pendingNewPoints;
    
    if (pendingNewPoints.length > 1) {
      try {
        console.log(`🚀 [INTELLIGENT PRESERVATION] Otimizando ${pendingNewPoints.length} pontos pendentes`);
        
        const optimizationResult = await googleMapsOptimizer.optimizePartialRoute(
          [preservedPoints[preservedPoints.length - 1]], // Último concluído como origem
          pendingNewPoints
        );
        
        optimizedPendingPoints = optimizationResult.optimizedPoints
          .filter(p => !p.completed)
          .map((p, index) => ({
            ...p,
            order: lastCompletedOrder + index + 1,
            completed: false,
            completedAt: null
          }));
        
        console.log(`✅ [INTELLIGENT PRESERVATION] ${optimizedPendingPoints.length} pontos otimizados`);
        
      } catch (optimizationError) {
        console.error(`⚠️ [INTELLIGENT PRESERVATION] Erro na otimização:`, optimizationError);
        // Manter ordem original em caso de erro
      }
    }

    // 7️⃣ APLICAR MUDANÇAS NO BANCO - PRESERVANDO PONTOS CONCLUÍDOS
    console.log(`💾 [INTELLIGENT PRESERVATION] Aplicando mudanças no banco`);
    
    // ✅ REMOVER APENAS PONTOS NÃO CONCLUÍDOS
    await client.query(
      `DELETE FROM route_points 
       WHERE route_id = $1 
       AND (completed = false OR completed IS NULL OR completed = 'f')`,
      [routeId]
    );
    
    console.log(`🗑️ [INTELLIGENT PRESERVATION] Pontos não concluídos removidos`);
    
    // ✅ INSERIR NOVOS PONTOS COM TODOS OS CAMPOS OPERACIONAIS
    for (const [index, point] of optimizedPendingPoints.entries()) {
      await client.query(
        `INSERT INTO route_points (
          route_id, address, lat, lng, point_order, type, completed, completed_at,
          customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, cep, stop_type
        ) VALUES ($1, $2, $3, $4, $5, $6, false, NULL, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          routeId,
          point.address || '',
          parseFloat(point.lat) || 0,
          parseFloat(point.lng) || 0,
          Number.isFinite(Number(point.order)) ? Number(point.order) : index,
          point.type || 'waypoint',
          point.customerName || point.name || null,
          toIntOrNull(point.restroomsQty),
          toIntOrNull(point.cleaningsQty),
          point.contactName || null,
          point.contactPhone || null,
          point.notes || point.observation || null,
          point.cep || null,
          point.stopType || null,
        ]
      );
    }
    
    console.log(`✅ [INTELLIGENT PRESERVATION] ${optimizedPendingPoints.length} novos pontos inseridos`);

    // 8️⃣ RESULTADO FINAL - PONTOS PRESERVADOS + NOVOS OTIMIZADOS
    const finalPoints = [...preservedPoints, ...optimizedPendingPoints];
    
    console.log(`🎯 [INTELLIGENT PRESERVATION] Resultado final: ${preservedPoints.length} preservados + ${optimizedPendingPoints.length} novos = ${finalPoints.length} total`);
    
    return finalPoints;
    
  } catch (error) {
    console.error('❌ [INTELLIGENT PRESERVATION] Erro crítico:', error);
    throw error;
  }
}

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, description, points, totalDistance, estimatedTime, estimatedDuration, optimizedOrder, polyline, status } = req.body;
    
    console.log(`🔄 [ROUTE UPDATE] ========================================`);
    console.log(`🔄 [ROUTE UPDATE] Atualizando rota ${id} com ${points?.length || 0} pontos`);
    
    // ✅ VALIDAÇÃO RIGOROSA DOS DADOS RECEBIDOS
    if (!name || !name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nome da rota é obrigatório' });
    }
    
    if (!points || !Array.isArray(points) || points.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'É necessário pelo menos 2 pontos' });
    }
    
    // Validar cada ponto
    const invalidPoints: string[] = [];
    points.forEach((p: any, i: number) => {
      const lat = parseFloat(p.lat);
      const lng = parseFloat(p.lng);
      if (!lat || !lng || lat === 0 || lng === 0 || !p.address) {
        const label = i === 0 ? 'Origem' : (i === points.length - 1 ? 'Destino' : `Parada ${i}`);
        invalidPoints.push(label);
      }
    });
    
    if (invalidPoints.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: `Pontos inválidos: ${invalidPoints.join(', ')}. Busque o endereço para obter coordenadas.` 
      });
    }
    
    // Log dos pontos recebidos para debug
    console.log(`📋 [ROUTE UPDATE] Validação OK - Pontos recebidos:`);
    points.forEach((p: any, i: number) => {
      console.log(`   ${i}: ${p.address?.substring(0, 30)}... | lat:${p.lat} lng:${p.lng} | customer: ${p.customerName || 'N/A'}`);
    });
    
    // Verificar se a rota existe
    const routeExists = await client.query('SELECT id, name FROM routes WHERE id = $1', [id]);
    if (routeExists.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // ✅ BUSCAR PONTOS EXISTENTES COM ESTADO DE CONCLUSÃO
    const existingPointsResult = await client.query(
      `SELECT id, address, completed, completed_at FROM route_points WHERE route_id = $1`,
      [id]
    );
    
    // Criar mapa de pontos concluídos por endereço (para preservar estado)
    const completedByAddress: Map<string, { completed: boolean, completedAt: any }> = new Map();
    existingPointsResult.rows.forEach((p: any) => {
      if (p.completed === true || p.completed === 't' || p.completed === 'true') {
        completedByAddress.set(p.address, { 
          completed: true, 
          completedAt: p.completed_at 
        });
      }
    });
    
    console.log(`🔒 [ROUTE UPDATE] ${completedByAddress.size} pontos com estado 'concluído' a preservar`);
    
    // ✅ DELETAR TODOS OS PONTOS EXISTENTES
    await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    console.log(`🗑️ [ROUTE UPDATE] Pontos antigos removidos`);
    
    // ✅ INSERIR TODOS OS PONTOS NOVOS COM TODOS OS CAMPOS OPERACIONAIS
    let insertedCount = 0;
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      
      // Verificar se este endereço estava concluído antes
      const previousState = completedByAddress.get(point.address);
      const isCompleted = previousState?.completed || point.completed || false;
      const completedAt = previousState?.completedAt || point.completedAt || null;
      
      // ✅ GARANTIR TODOS OS CAMPOS COM VALORES SEGUROS
      const customerName = point.customerName || point.name || null;
      const restroomsQty = (point.restroomsQty !== undefined && point.restroomsQty !== null && point.restroomsQty !== '') 
        ? parseInt(String(point.restroomsQty)) : null;
      const cleaningsQty = (point.cleaningsQty !== undefined && point.cleaningsQty !== null && point.cleaningsQty !== '') 
        ? parseInt(String(point.cleaningsQty)) : null;
      const contactName = point.contactName || null;
      const contactPhone = point.contactPhone || null;
      const notes = point.notes || point.observation || null;
      const cep = point.cep || null;
      const stopType = point.stopType || null;
      
      await client.query(
        `INSERT INTO route_points (
          route_id, address, lat, lng, point_order, type, completed, completed_at,
          customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, cep, stop_type,
          point_category, operation_type, recolhido_qty, auto_removed,
          sanitario_numbers, sanitario_recolhidos
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          id,
          point.address || '',
          parseFloat(point.lat) || 0,
          parseFloat(point.lng) || 0,
          i,
          point.type || 'waypoint',
          isCompleted,
          completedAt,
          customerName,
          restroomsQty,
          cleaningsQty,
          contactName,
          contactPhone,
          notes,
          cep,
          stopType,
          point.pointCategory || 'obra',
          point.operationType || 'entrega',
          point.recolhidoQty ?? null,
          point.autoRemoved || false,
          Array.isArray(point.sanitarioNumbers) ? point.sanitarioNumbers : null,
          Array.isArray(point.sanitarioRecolhidos) ? point.sanitarioRecolhidos : null,
        ]
      );
      insertedCount++;
    }
    
    console.log(`✅ [ROUTE UPDATE] ${insertedCount}/${points.length} pontos inseridos com todos os campos operacionais`);
    
    // ✅ BUSCAR PONTOS FINAIS DO BANCO
    const finalPointsFromDB = await client.query(
      `SELECT id, address, lat, lng, point_order, type, completed, completed_at,
              customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, cep, stop_type
       FROM route_points 
       WHERE route_id = $1 
       ORDER BY point_order ASC`,
      [id]
    );

    const updatedPoints = finalPointsFromDB.rows.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: p.type,
      completed: p.completed,
      completedAt: p.completed_at,
      customerName: p.customer_name,
      restroomsQty: p.restrooms_qty,
      cleaningsQty: p.cleanings_qty,
      contactName: p.contact_name,
      contactPhone: p.contact_phone,
      notes: p.notes,
      cep: p.cep,
      stopType: p.stop_type
    }));

    console.log(`📊 [ROUTE UPDATE] Pontos finais no banco: ${updatedPoints.length} total`);
    console.log(`📊 [ROUTE UPDATE] Pontos concluídos: ${updatedPoints.filter(p => p.completed).length}`);

    // Atualizar dados da rota principal
    const updateQuery = `
      UPDATE routes 
      SET name = $1, description = $2, total_distance = $3, 
          estimated_duration = $4, optimized_order = $5, 
          polyline = $6, status = $7, optimization_mode = COALESCE($8, optimization_mode), updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [
      name,
      description,
      parseFloat(totalDistance) || 0,
      parseInt(estimatedDuration) || 0,
      JSON.stringify(optimizedOrder || []),
      polyline,
      status || 'active',
      req.body.optimizationMode || null,
      id
    ]);
    
    await client.query('COMMIT');
    
    const responseRoute = {
      ...result.rows[0],
      totalDistance: parseFloat(result.rows[0].total_distance) || 0,
      estimatedDuration: parseInt(result.rows[0].estimated_duration) || 0
    };
    
    console.log(`✅ [ROUTE UPDATE] Rota "${responseRoute.name}" atualizada com sucesso`);
    console.log(`✅ [ROUTE UPDATE] ========================================`);
    
    res.json(responseRoute);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTE UPDATE] Erro ao atualizar rota:', error);
    res.status(500).json({ error: 'Erro ao atualizar rota' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const scheduleCheck = await pool.query(
      'SELECT COUNT(*) as count FROM schedules WHERE route_id = $1', 
      [id]
    );
    
    if (parseInt(scheduleCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir esta rota pois ela possui agendamentos vinculados. Remova os agendamentos primeiro.' 
      });
    }
    
    await pool.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    console.log('✅ [ROUTES] Route deleted:', result.rows[0].name);
    res.json({ message: 'Rota excluída com sucesso' });
  } catch (error) {
    console.error('❌ [ROUTES] Error deleting route:', error);
    res.status(500).json({ error: 'Erro ao excluir rota' });
  }
});

// ✅ ENDPOINT DE RESET - ÚNICO LOCAL AUTORIZADO A RESETAR PONTOS
router.post('/:id/reset', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🔄 [ROUTES RESET] Resetando rota ${id}`);
    
    // Verificar se a rota existe
    const routeCheck = await client.query('SELECT id, name FROM routes WHERE id = $1', [id]);
    
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // ✅ RESET COMPLETO - Resetar TODOS os pontos da rota (completed = false)
    const resetResult = await client.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING id',
      [id]
    );
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [ROUTES RESET] Rota "${routeCheck.rows[0].name}" resetada - ${resetResult.rows.length} pontos`);
    
    res.json({ 
      message: 'Rota resetada com sucesso',
      routeName: routeCheck.rows[0].name,
      pointsReset: resetResult.rows.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [ROUTES RESET] Erro ao resetar rota:', error);
    res.status(500).json({ error: 'Erro ao resetar rota' });
  } finally {
    client.release();
  }
});

// ✅ NOVO ENDPOINT - OTIMIZAR ROTA MANUALMENTE (TRANSFORMA ROTA FIXA EM OTIMIZADA)
router.post('/:id/optimize-manual', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    console.log(`🔄 [MANUAL OPTIMIZE] ========================================`);
    console.log(`🔄 [MANUAL OPTIMIZE] Iniciando otimização manual da rota ${id}`);
    
    // Buscar rota atual
    const routeQuery = 'SELECT * FROM routes WHERE id = $1';
    const routeResult = await client.query(routeQuery, [id]);
    
    if (routeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    const route = routeResult.rows[0];
    const currentPoints = route.points || [];
    
    if (currentPoints.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Rota deve ter pelo menos 2 pontos' });
    }
    
    console.log(`📍 [MANUAL OPTIMIZE] Pontos atuais: ${currentPoints.length}`);
    console.log(`🔍 [MANUAL OPTIMIZE] Modo atual: ${route.optimization_mode}`);
    
    // ✅ USAR SERVIÇO DE OTIMIZAÇÃO DO GOOGLE MAPS
    const optimizedResult = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(currentPoints);
    
    console.log(`✅ [MANUAL OPTIMIZE] Otimização concluída`);
    console.log(`📊 [MANUAL OPTIMIZE] Distância: ${optimizedResult.totalDistance} km`);
    console.log(`⏱️ [MANUAL OPTIMIZE] Tempo: ${optimizedResult.totalDuration} segundos`);
    
    // Calcular tempo formatado
    const hours = Math.floor(optimizedResult.totalDuration / 3600);
    const minutes = Math.floor((optimizedResult.totalDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
    
    // ✅ ATUALIZAR ROTA NO BANCO COM MODO 'optimized'
    await client.query(
      `UPDATE routes SET 
       total_distance = $1,
       estimated_duration = $2,
       optimized_order = $3,
       polyline = $4,
       optimization_mode = 'optimized',
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [
        optimizedResult.totalDistance,
        Math.round(optimizedResult.totalDuration),
        JSON.stringify(optimizedResult.optimizedOrder || []),
        optimizedResult.polyline || null,
        id
      ]
    );
    
    // ✅ ATUALIZAR PONTOS NA TABELA route_points
    await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
    
    for (const point of optimizedResult.optimizedPoints) {
      await client.query(
        `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
         VALUES ($1, $2, $3, $4, $5, $6, false)`,
        [id, point.address, point.lat, point.lng, point.order, point.type || 'waypoint']
      );
    }
    
    await client.query('COMMIT');
    
    console.log(`✅ [MANUAL OPTIMIZE] Rota otimizada e atualizada no banco`);
    console.log(`🔄 [MANUAL OPTIMIZE] ========================================`);
    
    res.json({
      message: 'Rota otimizada com sucesso',
      points: optimizedResult.optimizedPoints,
      totalDistance: optimizedResult.totalDistance,
      estimatedTime: estimatedTime,
      optimizationMode: 'optimized'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MANUAL OPTIMIZE] Erro na otimização manual:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota manualmente' });
  } finally {
    client.release();
  }
});

// Endpoint de otimização 
router.post('/:id/optimize', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🚀 [ROUTES OPTIMIZE] Iniciando otimização da rota ${id}`);
    
    // Get route points
    const pointsResult = await pool.query(
      'SELECT * FROM route_points WHERE route_id = $1 ORDER BY point_order',
      [id]
    );
    
    const points = pointsResult.rows.map(p => ({
      id: p.id,
      address: p.address,
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      order: p.point_order,
      type: (p.point_order === 0 ? 'origin' : 
            p.point_order === pointsResult.rows.length - 1 ? 'destination' : 'waypoint') as 'origin' | 'destination' | 'waypoint',
      completed: p.completed
    }));

    if (points.length < 2) {
      return res.json({ message: 'Rota precisa de pelo menos 2 pontos para otimizar' });
    }

    // Usar Routes API v2 com limite de waypoints
    const optimized = await googleMapsOptimizer.optimizeRouteWithGoogleAPIs(points);
    
    // Update route points with optimized order
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete existing points
      await client.query('DELETE FROM route_points WHERE route_id = $1', [id]);
      
      // Insert optimized points
      for (const point of optimized.optimizedPoints) {
        await client.query(
          `INSERT INTO route_points (route_id, address, lat, lng, point_order, type, completed)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, point.address, point.lat, point.lng, point.order, point.type, point.completed || false]
        );
      }
      
      // Update route metadata
      await client.query(
        `UPDATE routes SET 
         total_distance = $1, 
         estimated_duration = $2, 
         polyline = $3,
         optimized_order = $4,
         updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5`,
        [
          optimized.totalDistance,
          optimized.totalDuration,
          optimized.polyline,
          JSON.stringify(optimized.optimizedOrder),
          id
        ]
      );
      
      await client.query('COMMIT');
      
      console.log(`✅ [ROUTES OPTIMIZE] Rota ${id} otimizada com sucesso`);
      res.json({ 
        message: 'Rota otimizada com sucesso',
        optimizedPoints: optimized.optimizedPoints.length,
        totalDistance: optimized.totalDistance,
        totalDuration: Math.round(optimized.totalDuration / 60) + ' min',
        newOrder: optimized.optimizedOrder
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ [ROUTES OPTIMIZE] Erro na otimização:', error);
    res.status(500).json({ error: 'Erro ao otimizar rota' });
  }
});

// ✅ NOVO: Otimizador híbrido para rotas grandes (50+ pontos)
router.post('/:id/optimize-hybrid', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const ptsRes = await client.query(
      `SELECT id, address, lat, lng, point_order, type, operation_type
       FROM route_points WHERE route_id = $1 ORDER BY point_order`,
      [id]
    );
    const points = ptsRes.rows.map((p, i) => ({
      id: p.id, address: p.address, lat: parseFloat(p.lat), lng: parseFloat(p.lng),
      type: i === 0 ? 'origin' : (i === ptsRes.rows.length - 1 ? 'destination' : (p.type || 'waypoint')),
      operationType: p.operation_type,
    }));
    if (points.length < 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Use otimização normal para menos de 3 pontos' });
    }
    const result = await optimizeLargeRoute(points as any);
    const hours = Math.floor(result.totalDuration / 3600);
    const minutes = Math.floor((result.totalDuration % 3600) / 60);
    const estimatedTime = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;

    // Atualizar ordem dos pontos no banco
    for (let i = 0; i < result.optimizedPoints.length; i++) {
      await client.query(
        `UPDATE route_points SET point_order = $1, type = $2 WHERE id = $3::uuid`,
        [i, i === 0 ? 'origin' : (i === result.optimizedPoints.length - 1 ? 'destination' : 'waypoint'), result.optimizedPoints[i].id]
      );
    }
    await client.query(
      `UPDATE routes SET total_distance=$1, estimated_duration=$2,
       optimized_order=$3, polyline=$4, optimization_mode='optimized', updated_at=NOW()
       WHERE id=$5`,
      [result.totalDistance, result.totalDuration,
       JSON.stringify(result.optimizedOrder), result.polyline, id]
    );
    await client.query('COMMIT');
    res.json({
      message: 'Otimizado com algoritmo híbrido',
      totalPoints: result.optimizedPoints.length,
      totalDistance: result.totalDistance,
      estimatedTime,
      polyline: result.polyline,
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.error('❌ [HYBRID]', e);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

export default router;

