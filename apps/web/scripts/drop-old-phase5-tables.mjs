// Step 6: Drop old video_assets table + verify Phase 5 table state
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3310,
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh',
  });

  console.log('Connected to MySQL.');

  // Check what Phase 5 tables exist
  const [tables] = await conn.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'virat_gyankosh' AND TABLE_NAME IN ('video_assets', 'batches', 'enrollments', 'student_video_progress')"
  );
  console.log('Existing Phase 5 tables:', tables);

  // Drop the old video_assets table (Phase 4 raw SQL version)
  console.log('\nDropping old video_assets table...');
  await conn.query('DROP TABLE IF EXISTS student_video_progress'); // has FK to video_assets
  await conn.query('DROP TABLE IF EXISTS video_assets');
  console.log('Dropped video_assets (and student_video_progress FK dependent).');

  // Also drop batches/enrollments if they exist with old schema
  await conn.query('DROP TABLE IF EXISTS enrollments');  // has FK to batches
  await conn.query('DROP TABLE IF EXISTS batches');
  console.log('Dropped enrollments and batches (clean slate for Drizzle migration).');

  // Verify
  const [remaining] = await conn.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'virat_gyankosh' AND TABLE_NAME IN ('video_assets', 'batches', 'enrollments', 'student_video_progress')"
  );
  console.log('\nRemaining Phase 5 tables (should be empty):', remaining);

  await conn.end();
  console.log('\nDone. Ready for drizzle-kit generate + migrate.');
}

main().catch(console.error);
