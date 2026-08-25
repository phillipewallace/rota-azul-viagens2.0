
import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();
router.use(requireAuth);

// Get all maintenance records
router.get('/', async (req, res) => {
  try {
    console.log('🔧 Fetching all maintenance records...');
    
    const query = `
      SELECT 
        m.id,
        m.truck_id,
        m.type,
        m.maintenance_type,
        m.description,
        m.cost,
        m.maintenance_date,
        m.scheduled_date,
        m.completed_date,
        m.next_maintenance_date,
        m.performed_by,
        m.status,
        m.created_at,
        t.name as truck_name,
        t.plate as truck_plate
      FROM maintenance_records m
      LEFT JOIN trucks t ON m.truck_id = t.id
      ORDER BY m.maintenance_date DESC, m.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    const maintenanceRecords = result.rows.map(record => ({
      id: record.id,
      truckId: record.truck_id,
      truck: record.truck_name || `Placa ${record.truck_plate}`,
      truckName: record.truck_name,
      type: record.type || record.maintenance_type,
      maintenanceType: record.maintenance_type || record.type,
      description: record.description,
      cost: parseFloat(record.cost) || 0,
      maintenanceDate: record.maintenance_date,
      scheduledDate: record.scheduled_date,
      completedDate: record.completed_date,
      nextMaintenanceDate: record.next_maintenance_date,
      performedBy: record.performed_by,
      status: record.status,
      createdAt: record.created_at
    }));

    console.log(`✅ Found ${maintenanceRecords.length} maintenance records`);
    res.json(maintenanceRecords);
  } catch (error) {
    console.error('❌ Error fetching maintenance records:', error);
    res.status(500).json({ error: 'Erro ao buscar registros de manutenção' });
  }
});

// Get single maintenance record by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        m.*,
        t.name as truck_name,
        t.plate as truck_plate
      FROM maintenance_records m
      LEFT JOIN trucks t ON m.truck_id = t.id
      WHERE m.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error fetching maintenance record:', error);
    res.status(500).json({ error: 'Erro ao buscar registro de manutenção' });
  }
});

// Create new maintenance record
router.post('/', async (req, res) => {
  try {
    const { 
      truck_id, 
      type, 
      maintenance_type, 
      description, 
      cost, 
      maintenance_date, 
      scheduled_date,
      next_maintenance_date,
      performed_by,
      status 
    } = req.body;
    
    const query = `
      INSERT INTO maintenance_records (
        truck_id, type, maintenance_type, description, cost, 
        maintenance_date, scheduled_date, next_maintenance_date, 
        performed_by, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      truck_id,
      type || maintenance_type,
      maintenance_type || type,
      description,
      cost || 0,
      maintenance_date || new Date().toISOString().split('T')[0],
      scheduled_date,
      next_maintenance_date,
      performed_by,
      status || 'scheduled'
    ]);
    
    // Update truck's last maintenance date if maintenance is completed
    if (status === 'completed' || !status) {
      await pool.query(
        'UPDATE trucks SET last_maintenance = $1, next_maintenance = $2 WHERE id = $3',
        [maintenance_date || new Date().toISOString().split('T')[0], next_maintenance_date, truck_id]
      );
    }
    
    console.log('✅ Maintenance record created for truck:', truck_id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating maintenance record:', error);
    res.status(500).json({ error: 'Erro ao criar registro de manutenção' });
  }
});

// Update maintenance record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      type, 
      maintenance_type, 
      description, 
      cost, 
      maintenance_date,
      completed_date,
      next_maintenance_date,
      performed_by,
      status 
    } = req.body;
    
    const query = `
      UPDATE maintenance_records 
      SET type = $1, maintenance_type = $2, description = $3, cost = $4, 
          maintenance_date = $5, completed_date = $6, next_maintenance_date = $7,
          performed_by = $8, status = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      type || maintenance_type, 
      maintenance_type || type, 
      description, 
      cost, 
      maintenance_date,
      completed_date,
      next_maintenance_date,
      performed_by, 
      status, 
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    console.log('✅ Maintenance record updated:', id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating maintenance record:', error);
    res.status(500).json({ error: 'Erro ao atualizar registro de manutenção' });
  }
});

// Delete maintenance record
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM maintenance_records WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro de manutenção não encontrado' });
    }
    
    console.log('✅ Maintenance record deleted:', id);
    res.json({ message: 'Registro de manutenção excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting maintenance record:', error);
    res.status(500).json({ error: 'Erro ao excluir registro de manutenção' });
  }
});

export default router;
