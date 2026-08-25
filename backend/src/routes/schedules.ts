
import express from 'express';
import { pool } from '../config/database';

const router = express.Router();

// Get all schedules
router.get('/', async (req, res) => {
  try {
    console.log('📅 [SCHEDULES GET] Iniciando busca por cronogramas...')
    
    const query = `
      SELECT 
        s.id,
        s.driver_id,
        s.truck_id,
        s.route_id,
        s.departure_time,
        s.arrival_time,
        s.scheduled_date,
        s.status,
        s.created_at,
        d.name as driver_name,
        d.license_number as driver_license,
        t.name as truck_name, 
        t.plate as truck_plate,
        r.name as route_name,
        r.origin,
        r.destination
      FROM schedules s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN trucks t ON s.truck_id = t.id  
      LEFT JOIN routes r ON s.route_id = r.id
      ORDER BY s.scheduled_date DESC, s.departure_time ASC
    `;
    
    const result = await pool.query(query);
    
    const schedules = result.rows.map(schedule => ({
      id: schedule.id,
      driverId: schedule.driver_id,
      truckId: schedule.truck_id,
      routeId: schedule.route_id,
      departureTime: schedule.departure_time,
      arrivalTime: schedule.arrival_time,
      scheduledDate: schedule.scheduled_date,
      status: schedule.status,
      createdAt: schedule.created_at,
      driver: {
        name: schedule.driver_name,
        license: schedule.driver_license
      },
      truck: {
        name: schedule.truck_name,
        plate: schedule.truck_plate
      },
      route: {
        name: schedule.route_name,
        origin: schedule.origin,
        destination: schedule.destination
      }
    }))
    
    console.log(`✅ [SCHEDULES GET] ${schedules.length} cronogramas encontrados`)
    res.json(schedules)
  } catch (error) {
    console.error('❌ [SCHEDULES GET] Erro ao buscar cronogramas:', error)
    res.status(500).json({ error: 'Erro ao buscar cronogramas' })
  }
});

// Get single schedule by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        s.*,
        t.name as truck_name,
        t.plate as truck_plate,
        r.name as route_full_name,
        d.name as driver_name
      FROM schedules s
      LEFT JOIN trucks t ON s.truck_id = t.id
      LEFT JOIN routes r ON s.route_id = r.id
      LEFT JOIN drivers d ON s.driver_id = d.id
      WHERE s.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error fetching schedule:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamento' });
  }
});

// Create new schedule
router.post('/', async (req, res) => {
  try {
    const { 
      name, 
      truck_id, 
      route_id, 
      route_name, 
      driver_id, 
      scheduled_date, 
      scheduled_time,
      start_date,
      end_date,
      days_of_week,
      start_time,
      notes 
    } = req.body;
    
    const query = `
      INSERT INTO schedules (
        name, truck_id, route_id, route_name, driver_id, 
        scheduled_date, scheduled_time, start_date, end_date, 
        days_of_week, start_time, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name,
      truck_id,
      route_id,
      route_name,
      driver_id,
      scheduled_date,
      scheduled_time,
      start_date,
      end_date,
      days_of_week || '1,2,3,4,5',
      start_time || scheduled_time,
      notes
    ]);
    
    console.log('✅ Schedule created:', result.rows[0].name || 'Novo agendamento');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating schedule:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

// Update schedule
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      truck_id, 
      route_id, 
      route_name, 
      driver_id, 
      scheduled_date, 
      scheduled_time,
      status,
      notes 
    } = req.body;
    
    const query = `
      UPDATE schedules 
      SET name = $1, truck_id = $2, route_id = $3, route_name = $4, 
          driver_id = $5, scheduled_date = $6, scheduled_time = $7, 
          status = $8, notes = $9, updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      name, truck_id, route_id, route_name, driver_id, 
      scheduled_date, scheduled_time, status, notes, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    console.log('✅ Schedule updated:', result.rows[0].name || result.rows[0].id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating schedule:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento' });
  }
});

// Delete schedule
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM schedules WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    console.log('✅ Schedule deleted:', result.rows[0].name || result.rows[0].id);
    res.json({ message: 'Agendamento excluído com sucesso' });
  } catch (error) {
    console.error('❌ Error deleting schedule:', error);
    res.status(500).json({ error: 'Erro ao excluir agendamento' });
  }
});

export default router;
