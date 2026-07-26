const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3310,
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh'
  });
  
  const [rows] = await connection.execute("SHOW TABLES LIKE '%class%'");
  console.log('Tables containing class:', rows.map(r => Object.values(r)[0]));

  const [rows2] = await connection.execute("SHOW TABLES LIKE '%teacher%'");
  console.log('Tables containing teacher:', rows2.map(r => Object.values(r)[0]));

  const [rows3] = await connection.execute("SHOW COLUMNS FROM classes");
  console.log('Columns in classes:', rows3.map(r => r.Field));

  await connection.end();
}
run();
