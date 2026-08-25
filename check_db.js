const { pool } = require('./backend/src/config/database');
async function run() {
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
}
run();
