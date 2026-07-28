// Step 8: Verify all Phase 5 tables after migration
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3310,
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh',
  });

  for (const table of ['batches', 'enrollments', 'video_assets', 'student_video_progress']) {
    console.log(`\n=== ${table.toUpperCase()} ===`);
    const [cols] = await conn.query(`DESCRIBE ${table}`);
    console.table(cols);

    const [indexes] = await conn.query(`SHOW INDEX FROM ${table}`);
    const indexNames = [...new Set(/** @type {any[]} */ (indexes).map(i => `${i.Key_name} (${i.Column_name})${i.Non_unique === 0 ? ' [UNIQUE]' : ''}`))];
    console.log('Indexes:', indexNames.join(', '));
  }

  await conn.end();
}

main().catch(console.error);
