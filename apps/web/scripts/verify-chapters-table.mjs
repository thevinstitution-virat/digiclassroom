import mysql from 'mysql2/promise';
async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3310, user: 'root',
    password: 'rootpassword123', database: 'virat_gyankosh',
  });
  const [cols] = await conn.query('DESCRIBE video_chapters');
  console.table(cols);
  const [indexes] = await conn.query('SHOW INDEX FROM video_chapters');
  const names = [...new Set(/** @type {any[]} */ (indexes).map(i => `${i.Key_name} (${i.Column_name})${i.Non_unique === 0 ? ' [UNIQUE]' : ''}`))];
  console.log('Indexes:', names.join(', '));
  await conn.end();
}
main().catch(console.error);
