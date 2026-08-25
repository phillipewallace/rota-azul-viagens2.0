import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Reordenar paradas da rota
router.put('/route/:routeId/reorder', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { routeId } = req.params;
    const { points } = req.body;
    
    console.log(`🔄 [MOBILE API] Reordenando paradas da rota ${routeId}`);
    console.log(`📋 [MOBILE API] Novos pontos:`, points);
    
    if (!Array.isArray(points) || points.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lista de pontos inválida' });
    }
    
    // Verificar se a rota existe
    const routeCheck = await client.query(
      'SELECT id FROM routes WHERE id = $1',
      [routeId]
    );
    
    if (routeCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rota não encontrada' });
    }
    
    // Atualizar ordem de cada ponto
    for (const point of points) {
      const updateResult = await client.query(
        'UPDATE route_points SET point_order = $1 WHERE id = $2 AND route_id = $3',
        [point.order, point.pointId, routeId]
      );
      console.log(`📍 [MOBILE API] Ponto ${point.pointId} atualizado para ordem ${point.order}, rows affected: ${updateResult.rowCount}`);
    }
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [routeId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [MOBILE API] Reordenação concluída para rota ${routeId}`);
    
    res.json({ 
      success: true,
      message: 'Ordem das paradas atualizada com sucesso',
      routeId,
      pointsUpdated: points.length
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao reordenar paradas:', error);
    res.status(500).json({ error: 'Erro ao reordenar paradas' });
  } finally {
    client.release();
  }
});

/**
 * Adicionar parada extra à rota
 * Aceita coordenadas lat/lng diretamente do frontend ou extrai de links
 * 
 * ✅ ENDPOINT UNIFICADO - Funciona tanto para rotas criadas no web quanto no mobile
 */
router.post('/route/:routeId/extra-stop', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { routeId } = req.params;
    const { 
      name, stopType, location, 
      lat: providedLat, lng: providedLng, 
      insertBeforeId, truckId, source,
      // Novos campos operacionais
      restroomsQty, cleaningsQty, contactName, contactPhone, notes
    } = req.body;
    
    console.log(`➕ [MOBILE EXTRA-STOP] ========================================`);
    console.log(`➕ [MOBILE EXTRA-STOP] Requisição recebida`);
    console.log(`➕ [MOBILE EXTRA-STOP] Route ID recebido: "${routeId}"`);
    console.log(`➕ [MOBILE EXTRA-STOP] Tipo do routeId: ${typeof routeId}`);
    console.log(`➕ [MOBILE EXTRA-STOP] Tamanho do routeId: ${routeId?.length || 0}`);
    console.log(`📋 [MOBILE EXTRA-STOP] Dados completos:`, JSON.stringify({ 
      name, stopType, location, 
      providedLat, providedLng, 
      insertBeforeId, truckId, source,
      restroomsQty, cleaningsQty, contactName, contactPhone, notes
    }, null, 2));
    
    // ✅ VALIDAÇÃO DO ROUTE ID
    if (!routeId || routeId.trim() === '' || routeId === 'undefined' || routeId === 'null') {
      await client.query('ROLLBACK');
      console.error(`❌ [MOBILE EXTRA-STOP] Route ID inválido: "${routeId}"`);
      return res.status(400).json({ error: 'ID da rota é obrigatório e deve ser válido' });
    }
    
    // ✅ VALIDAÇÃO DO FORMATO UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(routeId.trim())) {
      await client.query('ROLLBACK');
      console.error(`❌ [MOBILE EXTRA-STOP] Route ID não é um UUID válido: "${routeId}"`);
      return res.status(400).json({ error: `ID da rota inválido: ${routeId}` });
    }
    
    // Validar campos obrigatórios
    if (!name || !name.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Nome do cliente/ponto é obrigatório' });
    }
    
    if (!location || !location.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Endereço ou localização é obrigatório' });
    }
    
    // ✅ VERIFICAR SE ROTA EXISTE - Com logging detalhado
    const cleanRouteId = routeId.trim();
    console.log(`🔍 [MOBILE EXTRA-STOP] Buscando rota com ID limpo: "${cleanRouteId}"`);
    
    const routeCheck = await client.query(
      'SELECT id, name, status FROM routes WHERE id = $1::uuid',
      [cleanRouteId]
    );
    
    console.log(`🔍 [MOBILE EXTRA-STOP] Resultado da busca: ${routeCheck.rows.length} linhas`);
    
    if (routeCheck.rows.length === 0) {
      // ✅ DEBUG: Listar todas as rotas para comparação
      const allRoutes = await client.query('SELECT id, name FROM routes LIMIT 10');
      console.error(`❌ [MOBILE EXTRA-STOP] Rota ${cleanRouteId} NÃO encontrada`);
      console.error(`📋 [MOBILE EXTRA-STOP] Rotas disponíveis (primeiras 10):`);
      allRoutes.rows.forEach(r => {
        console.error(`   - ID: "${r.id}" | Nome: "${r.name}"`);
      });
      
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        error: 'Rota não encontrada',
        routeIdReceived: cleanRouteId,
        hint: 'Verifique se o ID da rota está correto e se a rota existe no sistema'
      });
    }
    
    console.log(`✅ [MOBILE EXTRA-STOP] Rota encontrada: ${routeCheck.rows[0].name} (ID: ${routeCheck.rows[0].id})`)
    
    // Se truckId foi fornecido, verificar vínculo (mas não obrigatório para flexibilidade)
    if (truckId) {
      const truckCheck = await client.query(
        'SELECT id, name FROM trucks WHERE id = $1',
        [truckId]
      );
      
      if (truckCheck.rows.length === 0) {
        console.warn(`⚠️ [MOBILE API] Caminhão ${truckId} não encontrado`);
      }
    }
    
    // Usar coordenadas fornecidas diretamente pelo frontend, se disponíveis
    let lat = providedLat ? parseFloat(providedLat) : 0;
    let lng = providedLng ? parseFloat(providedLng) : 0;
    let address = location.trim();
    
    // Se não foram fornecidas coordenadas, tentar extrair do texto/link
    if ((!lat || lat === 0) && (!lng || lng === 0)) {
      console.log(`📍 [MOBILE API] Tentando extrair coordenadas do texto...`);
      
      // Padrões de URL do Google Maps, Plus Codes e geo: URIs
      const patterns = [
        /maps\?q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,                    // ?q=lat,lng
        /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,                            // @lat,lng
        /maps\/place\/[^\/]+\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,       // place/@lat,lng
        /q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,                           // q=lat,lng (simples)
        /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,                      // lat, lng (formato decimal longo)
        /geo:(-?\d+\.?\d*),(-?\d+\.?\d*)/,                         // geo:lat,lng (URI)
        /place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,                      // place/lat,lng
      ];
      
      for (const pattern of patterns) {
        const match = location.match(pattern);
        if (match) {
          lat = parseFloat(match[1]);
          lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            console.log(`📍 [MOBILE API] Coordenadas extraídas do link: ${lat}, ${lng}`);
            break;
          }
        }
      }
    } else {
      console.log(`📍 [MOBILE API] Usando coordenadas fornecidas: ${lat}, ${lng}`);
    }
    
    // Log final das coordenadas
    if (lat === 0 && lng === 0) {
      console.log(`📍 [MOBILE API] Sem coordenadas, usando apenas endereço texto: "${address}"`);
    }
    
    // Determinar ordem de inserção
    let insertOrder = 0;
    
    if (insertBeforeId && insertBeforeId !== 'end') {
      // Inserir antes de um ponto específico
      const beforePointResult = await client.query(
        'SELECT point_order FROM route_points WHERE id = $1 AND route_id = $2::uuid',
        [insertBeforeId, cleanRouteId]
      );
      
      if (beforePointResult.rows.length > 0) {
        insertOrder = beforePointResult.rows[0].point_order;
        
        // Incrementar ordem dos pontos posteriores
        await client.query(
          'UPDATE route_points SET point_order = point_order + 1 WHERE route_id = $1::uuid AND point_order >= $2',
          [cleanRouteId, insertOrder]
        );
        
        console.log(`📍 [MOBILE EXTRA-STOP] Inserindo antes do ponto ${insertBeforeId} na ordem ${insertOrder}`);
      } else {
        // Se ponto de referência não existe, adicionar no final
        const maxOrderResult = await client.query(
          'SELECT COALESCE(MAX(point_order), -1) + 1 as next_order FROM route_points WHERE route_id = $1::uuid',
          [cleanRouteId]
        );
        insertOrder = maxOrderResult.rows[0].next_order;
      }
    } else {
      // Adicionar no final
      const maxOrderResult = await client.query(
        'SELECT COALESCE(MAX(point_order), -1) + 1 as next_order FROM route_points WHERE route_id = $1::uuid',
        [cleanRouteId]
      );
      insertOrder = maxOrderResult.rows[0].next_order;
      
      console.log(`📍 [MOBILE EXTRA-STOP] Adicionando no final na ordem ${insertOrder}`);
    }
    
    // Inserir novo ponto com todos os campos operacionais
    console.log(`💾 [MOBILE EXTRA-STOP] Inserindo ponto com route_id: ${cleanRouteId}`);
    
    // Parsear campos numéricos de forma segura
    const parsedRestroomsQty = restroomsQty ? parseInt(restroomsQty, 10) : null;
    const parsedCleaningsQty = cleaningsQty ? parseInt(cleaningsQty, 10) : null;
    
    const insertResult = await client.query(
      `INSERT INTO route_points (
        route_id, address, lat, lng, point_order, type, completed, completed_at,
        customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, stop_type
      )
       VALUES ($1::uuid, $2, $3, $4, $5, $6, false, NULL, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, address, lat, lng, point_order, type, completed, customer_name, restrooms_qty, cleanings_qty, contact_name, contact_phone, notes, stop_type`,
      [
        cleanRouteId, address, lat, lng, insertOrder, 'waypoint',
        name.trim() || null,
        parsedRestroomsQty,
        parsedCleaningsQty,
        contactName?.trim() || null,
        contactPhone?.trim() || null,
        notes?.trim() || null,
        stopType || 'Entrega'
      ]
    );
    
    const newPoint = insertResult.rows[0];
    
    // Atualizar timestamp da rota
    await client.query(
      'UPDATE routes SET updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid',
      [cleanRouteId]
    );
    
    await client.query('COMMIT');
    
    console.log(`✅ [MOBILE API] Parada extra adicionada com sucesso: ${newPoint.id}`);
    
    // Retornar ponto criado no formato esperado pelo frontend
    res.json({
      id: newPoint.id,
      address: newPoint.address,
      lat: Number(newPoint.lat) || 0,
      lng: Number(newPoint.lng) || 0,
      order: Number(newPoint.point_order),
      type: newPoint.type,
      completed: newPoint.completed || false,
      name: newPoint.customer_name || name.trim(),
      customerName: newPoint.customer_name,
      restroomsQty: newPoint.restrooms_qty,
      cleaningsQty: newPoint.cleanings_qty,
      contactName: newPoint.contact_name,
      contactPhone: newPoint.contact_phone,
      notes: newPoint.notes,
      stopType: newPoint.stop_type || 'Entrega'
    });
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [MOBILE API] Erro ao adicionar parada extra:', error);
    res.status(500).json({ 
      error: 'Erro ao adicionar parada extra',
      details: error.message || 'Erro interno do servidor'
    });
  } finally {
    client.release();
  }
});

export default router;
