import mysql from 'mysql2/promise';

async function check() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh',
    port: 3310
  });

  const [rows] = await connection.execute('SELECT COUNT(*) as count FROM users');
  console.log('Users count:', rows);
  
  process.exit(0);
}

check();
