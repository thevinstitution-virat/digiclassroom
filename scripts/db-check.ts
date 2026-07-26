import mysql from 'mysql2/promise';

async function main() {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3310,
    user: 'root',
    password: 'rootpassword123',
    database: 'virat_gyankosh'
  });

  try {
    const res = await pool.query(`SELECT id, name FROM organization WHERE id = 'system'`);
    const rows = res[0] as any[];
    console.log("Existing system org:", rows);

    if (rows.length === 0) {
      console.log("System org not found, inserting...");
      await pool.execute(`INSERT INTO organization (id, name, slug, metadata, created_at) VALUES ('system', 'Global Platform', 'global-platform', '{}', NOW())`);
      console.log("System org inserted.");
    } else {
      console.log("System org already exists.");
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
