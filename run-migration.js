const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3310,
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh'
  });
  
  const sql = fs.readFileSync('src/lib/db/migrations/009_phase4_rbac_restructure.sql', 'utf8');
  
  // The execute() method requires a single statement or multipleStatements enabled. 
  // We'll just execute the ALTER TABLE directly
  const query = `
    ALTER TABLE tenant_features
      ADD COLUMN teacher_can_upload_videos BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN teacher_can_schedule_live BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN admin_can_manage_zoom BOOLEAN NOT NULL DEFAULT TRUE;
  `;
  
  try {
    const [result] = await connection.query(query);
    console.log('Migration successful:', result);
    
    const [desc] = await connection.query('DESCRIBE tenant_features');
    console.log('Columns:');
    desc.forEach(c => console.log(c.Field, c.Type));
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('Columns already exist. Proceeding.');
    } else {
      console.error('Migration failed:', err);
    }
  }

  await connection.end();
}
run();
