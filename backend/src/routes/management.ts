
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Get management statistics
router.get('/stats', async (req, res) => {
  try {
    console.log('📊 Fetching management stats...');
    
    // Get trucks stats
    const trucksQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'in_route' THEN 1 END) as in_route,
        COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as in_maintenance
      FROM trucks
    `;
    
    // Get maintenance stats
    const maintenanceQuery = `
      SELECT 
        COUNT(*) as total_maintenances,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress
      FROM maintenance_records
    `;
    
    // Get upcoming maintenance
    const upcomingQuery = `
      SELECT COUNT(*) as upcoming_count
      FROM maintenance_records 
      WHERE scheduled_date >= CURRENT_DATE 
      AND scheduled_date <= CURRENT_DATE + INTERVAL '30 days'
      AND status != 'completed'
    `;
    
    // Get costs
    const costsQuery = `
      SELECT 
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(cost), 0) as avg_cost
      FROM maintenance_records 
      WHERE maintenance_date >= CURRENT_DATE - INTERVAL '30 days'
    `;

    const [trucksResult, maintenanceResult, upcomingResult, costsResult] = await Promise.all([
      pool.query(trucksQuery),
      pool.query(maintenanceQuery),
      pool.query(upcomingQuery),
      pool.query(costsQuery)
    ]);

    const stats = {
      trucks: {
        total: parseInt(trucksResult.rows[0]?.total) || 0,
        available: parseInt(trucksResult.rows[0]?.available) || 0,
        in_route: parseInt(trucksResult.rows[0]?.in_route) || 0,
        in_maintenance: parseInt(trucksResult.rows[0]?.in_maintenance) || 0
      },
      maintenance: {
        total_maintenances: parseInt(maintenanceResult.rows[0]?.total_maintenances) || 0,
        completed: parseInt(maintenanceResult.rows[0]?.completed) || 0,
        pending: parseInt(maintenanceResult.rows[0]?.scheduled) || 0,
        in_progress: parseInt(maintenanceResult.rows[0]?.in_progress) || 0
      },
      upcoming: {
        upcoming_count: parseInt(upcomingResult.rows[0]?.upcoming_count) || 0
      },
      costs: {
        total_cost: parseFloat(costsResult.rows[0]?.total_cost) || 0,
        avg_cost: parseFloat(costsResult.rows[0]?.avg_cost) || 0
      }
    };

    console.log('✅ Management stats loaded successfully');
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching management stats:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas de gestão' });
  }
});

// Get maintenance records
router.get('/maintenance', async (req, res) => {
  try {
    console.log('🔧 Fetching maintenance records...');
    
    const { startDate, endDate, truckId, status, type } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.truck_id,
        m.type as maintenance_type,
        m.description,
        TO_CHAR(m.scheduled_date, 'YYYY-MM-DD') as scheduled_date,
        TO_CHAR(m.maintenance_date, 'YYYY-MM-DD') as maintenance_date,
        m.cost,
        m.mileage,
        m.next_maintenance_km,
        m.supplier,
        m.invoice_number,
        m.items,
        m.status,
        m.files,
        m.created_at,
        m.updated_at,
        t.name as truck_name,
        t.plate as truck_plate
      FROM maintenance_records m
      LEFT JOIN trucks t ON m.truck_id = t.id
      WHERE 1=1
    `;


    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (startDate && typeof startDate === 'string') {
      query += ` AND m.scheduled_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate && typeof endDate === 'string') {
      query += ` AND m.scheduled_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    if (truckId && typeof truckId === 'string') {
      query += ` AND m.truck_id = $${paramIndex}`;
      params.push(truckId);
      paramIndex++;
    }
    
    if (status && typeof status === 'string') {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (type && typeof type === 'string') {
      query += ` AND m.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ' ORDER BY m.scheduled_date DESC, m.created_at DESC';
    
    const result = await pool.query(query, params);
    
    const parseJson = (v: any) => { try { if (v == null) return null; if (typeof v !== 'string') return v; return JSON.parse(v); } catch { return null; } };
    const maintenanceRecords = result.rows.map(record => ({
      id: record.id,
      truck_id: record.truck_id,
      truck_name: record.truck_name,
      truck_plate: record.truck_plate,
      maintenance_type: record.maintenance_type,
      description: record.description,
      scheduled_date: record.scheduled_date,
      maintenance_date: record.maintenance_date,
      cost: parseFloat(record.cost) || 0,
      mileage: record.mileage != null ? parseInt(record.mileage) : null,
      next_maintenance_km: record.next_maintenance_km != null ? parseInt(record.next_maintenance_km) : null,
      supplier: record.supplier || null,
      invoice_number: record.invoice_number || null,
      items: parseJson(record.items) || [],
      status: record.status,
      files: parseJson(record.files) || [],
      created_at: record.created_at,
      updated_at: record.updated_at
    }));



    console.log(`✅ Found ${maintenanceRecords.length} maintenance records`);
    res.json(maintenanceRecords);
  } catch (error) {
    console.error('❌ Error fetching maintenance records:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de manutenção' });
  }
});

// Create maintenance record
router.post('/maintenance', async (req, res) => {
  try {
    console.log('🔧 Creating maintenance record...', req.body);
    
    const { 
      truck_id, 
      maintenance_type, 
      description, 
      scheduled_date, 
      cost, 
      mileage,
      next_maintenance_km,
      supplier,
      invoice_number,
      items,
      status,
      files 
    } = req.body;
    
    // Validate required fields
    if (!truck_id || !maintenance_type || !description || !scheduled_date) {
      console.log('❌ Missing required fields:', { truck_id, maintenance_type, description, scheduled_date });
      return res.status(400).json({ 
        error: 'Campos obrigatórios: truck_id, maintenance_type, description, scheduled_date' 
      });
    }
    
    // Check if truck exists
    const truckCheck = await pool.query('SELECT id FROM trucks WHERE id = $1', [truck_id]);
    if (truckCheck.rows.length === 0) {
      console.log('❌ Truck not found:', truck_id);
      return res.status(400).json({ error: 'Caminhão não encontrado' });
    }
    
    // Map frontend status to database status
    const validStatus = status === 'pending' ? 'scheduled' : status || 'scheduled';
    
    // Ensure extra columns exist (idempotent)
    await pool.query(`
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS mileage INTEGER;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS next_maintenance_km INTEGER;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS supplier TEXT;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS items JSONB;
    `).catch(() => {});

    // Insert maintenance record
    const query = `
      INSERT INTO maintenance_records (
        truck_id, type, description, scheduled_date, maintenance_date,
        cost, mileage, next_maintenance_km, supplier, invoice_number,
        items, status, files
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const parsedMileage = mileage === '' || mileage == null || isNaN(parseInt(mileage)) ? null : parseInt(mileage);
    const parsedNextKm = next_maintenance_km === '' || next_maintenance_km == null || isNaN(parseInt(next_maintenance_km)) ? null : parseInt(next_maintenance_km);

    const result = await pool.query(query, [
      truck_id,
      maintenance_type,
      description,
      scheduled_date,
      scheduled_date,
      parseFloat(cost) || 0,
      parsedMileage,
      parsedNextKm,
      supplier || null,
      invoice_number || null,
      items ? JSON.stringify(items) : null,
      validStatus,
      files ? JSON.stringify(files) : null
    ]);


    
    console.log('✅ Maintenance record created:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating maintenance record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Error details:', errorMessage);
    res.status(500).json({ error: 'Erro ao criar registro de manutenção: ' + errorMessage });
  }
});

// Update maintenance record
router.put('/maintenance/:id', async (req, res) => {
  try {
    console.log('🔧 Updating maintenance record:', req.params.id);
    
    const { id } = req.params;
    const { 
      maintenance_type, 
      description, 
      scheduled_date, 
      maintenance_date,
      cost, 
      mileage,
      next_maintenance_km,
      supplier,
      invoice_number,
      items,
      status,
      files 
    } = req.body;
    
    // Map frontend status to database status
    const validStatus = status === 'pending' ? 'scheduled' : status || 'scheduled';
    
    // Ensure extra columns exist (idempotent)
    await pool.query(`
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS mileage INTEGER;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS next_maintenance_km INTEGER;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS supplier TEXT;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS invoice_number TEXT;
      ALTER TABLE maintenance_records ADD COLUMN IF NOT EXISTS items JSONB;
    `).catch(() => {});

    const query = `
      UPDATE maintenance_records 
      SET type = $1, description = $2, scheduled_date = $3, maintenance_date = $4,
          cost = $5, mileage = $6, next_maintenance_km = $7, supplier = $8,
          invoice_number = $9, items = $10, status = $11, files = $12,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $13
      RETURNING *
    `;
    
    const parsedMileage = mileage === '' || mileage == null || isNaN(parseInt(mileage)) ? null : parseInt(mileage);
    const parsedNextKm = next_maintenance_km === '' || next_maintenance_km == null || isNaN(parseInt(next_maintenance_km)) ? null : parseInt(next_maintenance_km);

    const result = await pool.query(query, [
      maintenance_type,
      description,
      scheduled_date,
      maintenance_date || scheduled_date,
      parseFloat(cost) || 0,
      parsedMileage,
      parsedNextKm,
      supplier || null,
      invoice_number || null,
      items ? JSON.stringify(items) : null,
      validStatus,
      files ? JSON.stringify(files) : null,
      id
    ]);


    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    console.log('✅ Maintenance record updated:', id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating maintenance record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ error: 'Erro ao atualizar registro de manutenção: ' + errorMessage });
  }
});

// Delete maintenance record
router.delete('/maintenance/:id', async (req, res) => {
  try {
    console.log('🔧 Deleting maintenance record:', req.params.id);
    
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM maintenance_records WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    console.log('✅ Maintenance record deleted:', id);
    res.json({ message: 'Registro de manutenção excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting maintenance record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    res.status(500).json({ error: 'Erro ao excluir registro de manutenção: ' + errorMessage });
  }
});

// Get costs summary
router.get('/costs-summary', async (req, res) => {
  try {
    console.log('💰 Fetching costs summary...');
    
    const { startDate, endDate } = req.query;
    
    let query = `
      SELECT 
        type as maintenance_type,
        COUNT(*) as count,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(AVG(cost), 0) as avg_cost
      FROM maintenance_records
      WHERE cost IS NOT NULL
    `;
    
    const params: any[] = [];
    let paramIndex = 1;
    
    if (startDate && typeof startDate === 'string') {
      query += ` AND maintenance_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    
    if (endDate && typeof endDate === 'string') {
      query += ` AND maintenance_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    query += ' GROUP BY type ORDER BY total_cost DESC';
    
    const result = await pool.query(query, params);
    
    const summary = result.rows.map(row => ({
      maintenance_type: row.maintenance_type,
      count: parseInt(row.count),
      total_cost: parseFloat(row.total_cost),
      avg_cost: parseFloat(row.avg_cost)
    }));

    console.log(`✅ Found ${summary.length} cost summary items`);
    res.json(summary);
  } catch (error) {
    console.error('❌ Error fetching costs summary:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo de custos' });
  }
});

export default router;
