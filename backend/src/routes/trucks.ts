
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get all trucks with driver and route information
router.get('/', async (req, res) => {
  try {
    console.log('🚛 [TRUCKS GET] Iniciando busca por todos os caminhões...');
    
    const query = `
      SELECT 
        t.id,
        t.name,
        t.plate,
        t.model,
        t.year,
        t.status,
        t.current_route,
        t.driver,
        t.last_maintenance,
        t.mileage,
        t.location_lat,
        t.location_lng,
        d.name as driver_name,
        r.name as current_route_name
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      LEFT JOIN routes r ON t.current_route_id = r.id
      ORDER BY t.created_at DESC
    `;
    
    console.log('🔍 [TRUCKS GET] Executando query no banco de dados...');
    const result = await pool.query(query);
    console.log(`📊 [TRUCKS GET] Query executada com sucesso, ${result.rows.length} registros encontrados`);
    
    const trucks = result.rows.map(truck => ({
      id: truck.id,
      name: truck.name,
      plate: truck.plate,
      model: truck.model,
      year: truck.year,
      status: truck.status,
      currentRoute: truck.current_route || truck.current_route_name,
      currentRouteName: truck.current_route_name,
      driver: truck.driver || truck.driver_name,
      driverName: truck.driver_name,
      lastMaintenance: truck.last_maintenance,
      mileage: truck.mileage || 0,
      location: truck.location_lat && truck.location_lng ? {
        lat: parseFloat(truck.location_lat),
        lng: parseFloat(truck.location_lng)
      } : null
    }));

    console.log(`✅ [TRUCKS GET] Dados processados e enviados: ${trucks.length} caminhões`);
    trucks.forEach(truck => {
      console.log(`   🚛 Caminhão: ${truck.name} (${truck.plate}) - Status: ${truck.status} - Motorista: ${truck.driver || 'Nenhum'}`);
    });
    
    res.json(trucks);
  } catch (error) {
    console.error('❌ [TRUCKS GET] Erro ao buscar caminhões:', error);
    console.error('🔍 [TRUCKS GET] Mensagem PG:', (error as any)?.message);
    console.error('🔍 [TRUCKS GET] Stack trace:', (error as Error).stack);
    res.status(500).json({ error: 'Erro ao buscar caminhões', detail: (error as any)?.message });
  }
});

// Link route to truck
router.post('/link-route', async (req, res) => {
  try {
    const { truckId, routeId } = req.body;
    
    console.log(`🔗 [TRUCK LINK] Iniciando vinculação de rota ${routeId} ao caminhão ${truckId}`);
    console.log('📝 [TRUCK LINK] Dados recebidos:', req.body);
    
    if (!truckId || !routeId) {
      console.log('❌ [TRUCK LINK] Validação falhou - IDs obrigatórios faltando');
      return res.status(400).json({ error: 'Truck ID and Route ID are required' });
    }
    
    console.log('✅ [TRUCK LINK] Validação dos IDs passou');
    
    // Reset all route points to incomplete when linking route to truck
    console.log('🔄 [TRUCK LINK] Resetando pontos da rota para não concluídos...');
    const resetPointsResult = await pool.query(
      'UPDATE route_points SET completed = false, completed_at = NULL WHERE route_id = $1 RETURNING id',
      [routeId]
    );
    
    console.log(`✅ [TRUCK LINK] ${resetPointsResult.rows.length} pontos da rota resetados para não concluídos`);
    
    // Update truck with route
    console.log('🔍 [TRUCK LINK] Executando UPDATE no banco...');
    const result = await pool.query(
      'UPDATE trucks SET current_route_id = $1, current_route = $2, status = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
      [routeId, routeId, 'in-route', truckId]
    );
    
    if (result.rows.length === 0) {
      console.log(`❌ [TRUCK LINK] Caminhão não encontrado: ${truckId}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log(`✅ [TRUCK LINK] Rota vinculada com sucesso - Caminhão: ${result.rows[0].name}`);
    console.log(`📊 [TRUCK LINK] Pontos resetados: ${resetPointsResult.rows.length} pontos da rota ${routeId} estão prontos para nova execução`);
    
    res.json({ 
      success: true, 
      message: 'Rota vinculada com sucesso',
      resetPoints: resetPointsResult.rows.length
    });
  } catch (error) {
    console.error('❌ [TRUCK LINK] Erro ao vincular rota:', error);
    console.error('🔍 [TRUCK LINK] Stack trace:', (error as Error).stack);
    res.status(500).json({ error: 'Erro ao vincular rota' });
  }
});

// Unlink route from truck
router.post('/unlink-route', async (req, res) => {
  try {
    const { truckId } = req.body;
    console.log(`🔓 [TRUCK UNLINK] Desvinculando rota do caminhão ${truckId}`);

    if (!truckId) {
      return res.status(400).json({ error: 'Truck ID é obrigatório' });
    }

    const result = await pool.query(
      `UPDATE trucks
         SET current_route_id = NULL,
             current_route = NULL,
             status = 'available',
             updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [truckId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }

    console.log(`✅ [TRUCK UNLINK] Rota desvinculada: ${result.rows[0].name}`);
    res.json({ success: true, message: 'Rota desvinculada com sucesso' });
  } catch (error) {
    console.error('❌ [TRUCK UNLINK] Erro ao desvincular rota:', error);
    res.status(500).json({ error: 'Erro ao desvincular rota' });
  }
});

// Get single truck by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🚛 [TRUCK GET] Buscando caminhão por ID: ${id}`);
    
    const query = `
      SELECT 
        t.*,
        d.name as driver_name,
        r.name as route_name
      FROM trucks t
      LEFT JOIN drivers d ON t.current_driver_id = d.id
      LEFT JOIN routes r ON t.current_route_id = r.id
      WHERE t.id = $1
    `;
    
    console.log('🔍 [TRUCK GET] Executando query no banco...');
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ [TRUCK GET] Caminhão não encontrado: ${id}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log(`✅ [TRUCK GET] Caminhão encontrado: ${result.rows[0].name} (${result.rows[0].plate})`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`❌ [TRUCK GET] Erro ao buscar caminhão ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao buscar caminhão' });
  }
});

// Create new truck
router.post('/', async (req, res) => {
  try {
    console.log('🚛 [TRUCK CREATE] Iniciando criação de novo caminhão...');
    console.log('📝 [TRUCK CREATE] Dados recebidos:', req.body);
    
    const { name, plate, model, year, status, driver, currentRoute, mileage, lastMaintenance } = req.body;
    
    // Validate required fields
    if (!name || !plate || !model || !year) {
      console.log('❌ [TRUCK CREATE] Validação falhou - campos obrigatórios faltando');
      return res.status(400).json({ error: 'Campos obrigatórios: nome, placa, modelo e ano' });
    }
    
    console.log('✅ [TRUCK CREATE] Validação dos campos passou');
    
    const query = `
      INSERT INTO trucks (name, plate, model, year, status, driver, current_route, mileage, last_maintenance)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const plateUpper = plate.toUpperCase();
    console.log(`🔍 [TRUCK CREATE] Executando INSERT no banco... Placa: ${plateUpper}`);
    
    const result = await pool.query(query, [
      name,
      plateUpper,
      model,
      year,
      status || 'available',
      driver === 'none' || !driver ? null : driver,
      currentRoute === 'none' || !currentRoute ? null : currentRoute,
      mileage || 0,
      lastMaintenance || null
    ]);
    
    console.log(`✅ [TRUCK CREATE] Caminhão criado com sucesso: ${result.rows[0].name} (ID: ${result.rows[0].id}, Placa: ${result.rows[0].plate})`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ [TRUCK CREATE] Erro ao criar caminhão:', error);
    const dbError = error as any;
    if (dbError?.code === '23505') {
      console.log('🔍 [TRUCK CREATE] Erro de duplicação - Placa já cadastrada');
      return res.status(400).json({ error: 'Placa já cadastrada' });
    }
    res.status(500).json({ error: 'Erro ao criar caminhão' });
  }
});

// Update truck
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🚛 [TRUCK UPDATE] Iniciando atualização do caminhão: ${id}`);
    console.log('📝 [TRUCK UPDATE] Dados recebidos:', req.body);
    
    const { name, plate, model, year, status, driver, currentRoute, mileage, lastMaintenance } = req.body;
    
    // Validate required fields
    if (!name || !plate || !model || !year) {
      console.log('❌ [TRUCK UPDATE] Validação falhou - campos obrigatórios faltando');
      return res.status(400).json({ error: 'Campos obrigatórios: nome, placa, modelo e ano' });
    }
    
    console.log('✅ [TRUCK UPDATE] Validação dos campos passou');
    
    const query = `
      UPDATE trucks 
      SET name = $1, plate = $2, model = $3, year = $4, status = $5, 
          driver = $6, current_route = $7, mileage = $8, last_maintenance = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const plateUpper = plate.toUpperCase();
    console.log(`🔍 [TRUCK UPDATE] Executando UPDATE no banco... Placa: ${plateUpper}`);
    
    const result = await pool.query(query, [
      name,
      plateUpper,
      model,
      year,
      status,
      driver === 'none' || !driver ? null : driver,
      currentRoute === 'none' || !currentRoute ? null : currentRoute,
      mileage || 0,
      lastMaintenance || null,
      id
    ]);
    
    if (result.rows.length === 0) {
      console.log(`❌ [TRUCK UPDATE] Caminhão não encontrado: ${id}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log(`✅ [TRUCK UPDATE] Caminhão atualizado: ${result.rows[0].name} (${result.rows[0].plate})`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`❌ [TRUCK UPDATE] Erro ao atualizar caminhão ${req.params.id}:`, error);
    const dbError = error as any;
    if (dbError?.code === '23505') {
      console.log('🔍 [TRUCK UPDATE] Erro de duplicação - Placa já cadastrada');
      return res.status(400).json({ error: 'Placa já cadastrada' });
    }
    console.error('🔍 [TRUCK UPDATE] Stack trace:', (error as Error).stack);
    res.status(500).json({ error: 'Erro ao atualizar caminhão' });
  }
});

// Update truck location
router.put('/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    
    console.log(`📍 [TRUCK LOCATION] Atualizando localização do caminhão ${id}: ${lat}, ${lng}`);
    
    // Update truck location
    console.log('🔍 [TRUCK LOCATION] Atualizando tabela trucks...');
    await pool.query(
      'UPDATE trucks SET location_lat = $1, location_lng = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [lat, lng, id]
    );
    
    // Insert location history
    console.log('🔍 [TRUCK LOCATION] Inserindo no histórico de localização...');
    await pool.query(
      'INSERT INTO truck_location_history (truck_id, lat, lng) VALUES ($1, $2, $3)',
      [id, lat, lng]
    );
    
    console.log(`✅ [TRUCK LOCATION] Localização atualizada com sucesso para caminhão ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error(`❌ [TRUCK LOCATION] Erro ao atualizar localização do caminhão ${req.params.id}:`, error);
    res.status(500).json({ error: 'Erro ao atualizar localização' });
  }
});

// Delete truck
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ [TRUCK DELETE] Iniciando exclusão do caminhão: ${id}`);
    
    console.log('🔍 [TRUCK DELETE] Executando DELETE no banco...');
    const result = await pool.query('DELETE FROM trucks WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      console.log(`❌ [TRUCK DELETE] Caminhão não encontrado: ${id}`);
      return res.status(404).json({ error: 'Caminhão não encontrado' });
    }
    
    console.log(`✅ [TRUCK DELETE] Caminhão excluído: ${result.rows[0].name} (${result.rows[0].plate})`);
    res.json({ message: 'Caminhão excluído com sucesso' });
  } catch (error) {
    console.error(`❌ [TRUCK DELETE] Erro ao excluir caminhão ${req.params.id}:`, error);
    console.error('🔍 [TRUCK DELETE] Stack trace:', (error as Error).stack);
    res.status(500).json({ error: 'Erro ao excluir caminhão' });
  }
});

export default router;
