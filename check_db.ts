import { pool } from './backend/src/config/database';
try {
  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'erp_service_orders'
  `);
  console.log('Columns in erp_service_orders:');
  res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
