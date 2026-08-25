
import { Router } from 'express';
import { pool } from '../config/database';

const router = Router();

// Dashboard - Estatísticas gerais
router.get('/dashboard', async (req, res) => {
  try {
    const { period = '30' } = req.query; // dias
    const days = parseInt(period as string);

    console.log(`📊 [ANALYTICS] Buscando dashboard (últimos ${days} dias)`);

    // KPIs principais
    const kpisQuery = `
      SELECT 
        COUNT(*) as total_routes,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_routes,
        COUNT(*) FILTER (WHERE status = 'in_progress') as active_routes,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_routes,
        COALESCE(SUM(total_points), 0) as total_points_planned,
        COALESCE(SUM(points_completed), 0) as total_points_completed,
        COALESCE(SUM(total_distance), 0) as total_distance,
        COALESCE(AVG(completion_percentage), 0) as avg_completion,
        COUNT(DISTINCT truck_id) as trucks_used,
        COUNT(DISTINCT driver_id) FILTER (WHERE driver_id IS NOT NULL) as drivers_active
      FROM route_executions
      WHERE started_at >= NOW() - INTERVAL '${days} days'
    `;

    const kpisResult = await pool.query(kpisQuery);
    const kpis = kpisResult.rows[0];

    // Top motoristas por conclusão
    const topDriversQuery = `
      SELECT 
        d.name as driver_name,
        COUNT(*) as routes_executed,
        COUNT(*) FILTER (WHERE re.status = 'completed') as routes_completed,
        COALESCE(AVG(re.completion_percentage), 0) as avg_completion
      FROM route_executions re
      LEFT JOIN drivers d ON re.driver_id = d.id
      WHERE re.started_at >= NOW() - INTERVAL '${days} days'
        AND d.name IS NOT NULL
      GROUP BY d.id, d.name
      ORDER BY routes_completed DESC, avg_completion DESC
      LIMIT 5
    `;

    const topDriversResult = await pool.query(topDriversQuery);

    // Top caminhões por uso
    const topTrucksQuery = `
      SELECT 
        t.name as truck_name,
        t.plate,
        COUNT(*) as routes_executed,
        COALESCE(SUM(re.total_distance), 0) as total_distance
      FROM route_executions re
      JOIN trucks t ON re.truck_id = t.id
      WHERE re.started_at >= NOW() - INTERVAL '${days} days'
      GROUP BY t.id, t.name, t.plate
      ORDER BY routes_executed DESC
      LIMIT 5
    `;

    const topTrucksResult = await pool.query(topTrucksQuery);

    res.json({
      kpis: {
        totalRoutes: parseInt(kpis.total_routes) || 0,
        completedRoutes: parseInt(kpis.completed_routes) || 0,
        activeRoutes: parseInt(kpis.active_routes) || 0,
        cancelledRoutes: parseInt(kpis.cancelled_routes) || 0,
        totalPointsPlanned: parseInt(kpis.total_points_planned) || 0,
        totalPointsCompleted: parseInt(kpis.total_points_completed) || 0,
        totalDistance: parseFloat(kpis.total_distance) || 0,
        avgCompletion: parseFloat(kpis.avg_completion) || 0,
        trucksUsed: parseInt(kpis.trucks_used) || 0,
        driversActive: parseInt(kpis.drivers_active) || 0
      },
      topDrivers: topDriversResult.rows.map(row => ({
        driverName: row.driver_name,
        routesExecuted: parseInt(row.routes_executed),
        routesCompleted: parseInt(row.routes_completed),
        avgCompletion: parseFloat(row.avg_completion)
      })),
      topTrucks: topTrucksResult.rows.map(row => ({
        truckName: row.truck_name,
        plate: row.plate,
        routesExecuted: parseInt(row.routes_executed),
        totalDistance: parseFloat(row.total_distance)
      }))
    });

  } catch (error) {
    console.error('❌ [ANALYTICS] Erro ao buscar dashboard:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas do dashboard' });
  }
});

// Trends - Gráficos temporais
router.get('/trends', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);

    console.log(`📈 [ANALYTICS] Buscando tendências (últimos ${days} dias)`);

    const trendsQuery = `
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as routes_count,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
        COALESCE(SUM(total_distance), 0) as total_distance,
        COALESCE(AVG(completion_percentage), 0) as avg_completion
      FROM route_executions
      WHERE started_at >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(started_at)
      ORDER BY DATE(started_at) ASC
    `;

    const result = await pool.query(trendsQuery);

    res.json(
      result.rows.map(row => ({
        date: row.date,
        routesCount: parseInt(row.routes_count),
        completedCount: parseInt(row.completed_count),
        totalDistance: parseFloat(row.total_distance),
        avgCompletion: parseFloat(row.avg_completion)
      }))
    );

  } catch (error) {
    console.error('❌ [ANALYTICS] Erro ao buscar tendências:', error);
    res.status(500).json({ error: 'Erro ao buscar tendências' });
  }
});

// Performance - Rankings e comparações
router.get('/performance', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);

    console.log(`🏆 [ANALYTICS] Buscando performance (últimos ${days} dias)`);

    // Ranking de motoristas
    const driversQuery = `
      SELECT 
        d.id,
        d.name,
        COUNT(*) as total_routes,
        COUNT(*) FILTER (WHERE re.status = 'completed') as completed_routes,
        COALESCE(AVG(re.completion_percentage), 0) as avg_completion,
        COALESCE(SUM(re.total_distance), 0) as total_distance,
        COALESCE(SUM(re.points_completed), 0) as total_points_completed
      FROM route_executions re
      LEFT JOIN drivers d ON re.driver_id = d.id
      WHERE re.started_at >= NOW() - INTERVAL '${days} days'
        AND d.name IS NOT NULL
      GROUP BY d.id, d.name
      ORDER BY completed_routes DESC, avg_completion DESC
    `;

    const driversResult = await pool.query(driversQuery);

    // Ranking de caminhões
    const trucksQuery = `
      SELECT 
        t.id,
        t.name,
        t.plate,
        COUNT(*) as total_routes,
        COALESCE(SUM(re.total_distance), 0) as total_distance,
        COALESCE(AVG(re.completion_percentage), 0) as avg_completion
      FROM route_executions re
      JOIN trucks t ON re.truck_id = t.id
      WHERE re.started_at >= NOW() - INTERVAL '${days} days'
      GROUP BY t.id, t.name, t.plate
      ORDER BY total_routes DESC, total_distance DESC
    `;

    const trucksResult = await pool.query(trucksQuery);

    res.json({
      drivers: driversResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        totalRoutes: parseInt(row.total_routes),
        completedRoutes: parseInt(row.completed_routes),
        avgCompletion: parseFloat(row.avg_completion),
        totalDistance: parseFloat(row.total_distance),
        totalPointsCompleted: parseInt(row.total_points_completed)
      })),
      trucks: trucksResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        plate: row.plate,
        totalRoutes: parseInt(row.total_routes),
        totalDistance: parseFloat(row.total_distance),
        avgCompletion: parseFloat(row.avg_completion)
      }))
    });

  } catch (error) {
    console.error('❌ [ANALYTICS] Erro ao buscar performance:', error);
    res.status(500).json({ error: 'Erro ao buscar dados de performance' });
  }
});

// History - Listagem de execuções com filtros
router.get('/history', async (req, res) => {
  try {
    const { 
      status, 
      driverId, 
      truckId, 
      startDate, 
      endDate,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    console.log(`📜 [ANALYTICS] Buscando histórico (página ${pageNum})`);

    let whereConditions: string[] = [];
    let params: any[] = [];
    let paramCount = 1;

    if (status) {
      whereConditions.push(`re.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    if (driverId) {
      whereConditions.push(`re.driver_id = $${paramCount}`);
      params.push(driverId);
      paramCount++;
    }

    if (truckId) {
      whereConditions.push(`re.truck_id = $${paramCount}`);
      params.push(truckId);
      paramCount++;
    }

    if (startDate) {
      whereConditions.push(`re.started_at >= $${paramCount}`);
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      whereConditions.push(`re.started_at <= $${paramCount}`);
      params.push(endDate);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    // Query de contagem
    const countQuery = `
      SELECT COUNT(*) as total
      FROM route_executions re
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Query de dados
    const dataQuery = `
      SELECT 
        re.id,
        re.route_id,
        re.route_name,
        re.route_description,
        re.truck_id,
        re.driver_id,
        re.total_points,
        re.total_distance,
        re.estimated_duration,
        re.started_at,
        re.completed_at,
        re.status,
        re.points_completed,
        re.actual_duration,
        re.completion_percentage,
        t.name as truck_name,
        t.plate as truck_plate,
        d.name as driver_name
      FROM route_executions re
      JOIN trucks t ON re.truck_id = t.id
      LEFT JOIN drivers d ON re.driver_id = d.id
      ${whereClause}
      ORDER BY re.started_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const dataResult = await pool.query(dataQuery, [...params, limitNum, offset]);

    res.json({
      data: dataResult.rows.map(row => ({
        id: row.id,
        routeId: row.route_id,
        routeName: row.route_name,
        routeDescription: row.route_description,
        truckId: row.truck_id,
        truckName: row.truck_name,
        truckPlate: row.truck_plate,
        driverId: row.driver_id,
        driverName: row.driver_name,
        totalPoints: parseInt(row.total_points),
        totalDistance: parseFloat(row.total_distance),
        estimatedDuration: parseInt(row.estimated_duration),
        startedAt: row.started_at,
        completedAt: row.completed_at,
        status: row.status,
        pointsCompleted: parseInt(row.points_completed),
        actualDuration: row.actual_duration ? parseInt(row.actual_duration) : null,
        completionPercentage: parseFloat(row.completion_percentage)
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('❌ [ANALYTICS] Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico de execuções' });
  }
});

// History Detail - Detalhes de uma execução específica
router.get('/history/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 [ANALYTICS] Buscando detalhes da execução: ${id}`);

    const query = `
      SELECT 
        re.*,
        t.name as truck_name,
        t.plate as truck_plate,
        t.model as truck_model,
        d.name as driver_name,
        d.phone as driver_phone
      FROM route_executions re
      JOIN trucks t ON re.truck_id = t.id
      LEFT JOIN drivers d ON re.driver_id = d.id
      WHERE re.id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Execução não encontrada' });
    }

    const execution = result.rows[0];

    res.json({
      id: execution.id,
      routeId: execution.route_id,
      routeName: execution.route_name,
      routeDescription: execution.route_description,
      truck: {
        id: execution.truck_id,
        name: execution.truck_name,
        plate: execution.truck_plate,
        model: execution.truck_model
      },
      driver: execution.driver_id ? {
        id: execution.driver_id,
        name: execution.driver_name,
        phone: execution.driver_phone
      } : null,
      totalPoints: parseInt(execution.total_points),
      totalDistance: parseFloat(execution.total_distance),
      estimatedDuration: parseInt(execution.estimated_duration),
      startedAt: execution.started_at,
      completedAt: execution.completed_at,
      status: execution.status,
      pointsCompleted: parseInt(execution.points_completed),
      actualDuration: execution.actual_duration ? parseInt(execution.actual_duration) : null,
      completionPercentage: parseFloat(execution.completion_percentage),
      pointsSnapshot: execution.points_snapshot,
      createdAt: execution.created_at,
      updatedAt: execution.updated_at
    });

  } catch (error) {
    console.error('❌ [ANALYTICS] Erro ao buscar detalhes da execução:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes da execução' });
  }
});

// Get route usage statistics
router.get('/route-usage', async (req, res) => {
  try {
    const { period = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        r.name as route_name,
        COUNT(re.id) as execution_count,
        COALESCE(SUM(re.total_distance), 0) as total_distance
      FROM routes r
      LEFT JOIN route_executions re ON r.id = re.route_id
        AND re.started_at >= NOW() - INTERVAL '${period} days'
      GROUP BY r.id, r.name
      HAVING COUNT(re.id) > 0
      ORDER BY execution_count DESC
      LIMIT 10
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching route usage:', error);
    res.status(500).json({ error: 'Erro ao buscar uso de rotas' });
  }
});

// Get maintenance summary statistics
router.get('/maintenance-summary', async (req, res) => {
  try {
    const { period = 30 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count,
        COALESCE(SUM(cost), 0) as total_cost
      FROM maintenance_records
      WHERE maintenance_date >= NOW() - INTERVAL '${period} days'
      GROUP BY type
      ORDER BY count DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching maintenance summary:', error);
    res.status(500).json({ error: 'Erro ao buscar resumo de manutenção' });
  }
});

// Get monthly performance statistics
router.get('/monthly-performance', async (req, res) => {
  try {
    const { period = 180 } = req.query; // Default to 6 months
    
    const result = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', started_at), 'YYYY-MM') as month,
        COUNT(*) as total_executions,
        COALESCE(SUM(total_distance), 0) as total_distance
      FROM route_executions
      WHERE started_at >= NOW() - INTERVAL '${period} days'
      GROUP BY DATE_TRUNC('month', started_at)
      ORDER BY month ASC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching monthly performance:', error);
    res.status(500).json({ error: 'Erro ao buscar performance mensal' });
  }
});

export default router;
