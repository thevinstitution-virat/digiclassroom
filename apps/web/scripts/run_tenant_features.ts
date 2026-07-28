import { readFileSync } from 'fs'
import mysql from 'mysql2/promise'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3310'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'rootpassword123',
    database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
    multipleStatements: true,
  })

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tenant_features (
        tenant_id VARCHAR(255) PRIMARY KEY, 
        enable_live_classes BOOLEAN DEFAULT FALSE, 
        enable_video_library BOOLEAN DEFAULT FALSE, 
        enable_homework BOOLEAN DEFAULT FALSE, 
        enable_notices BOOLEAN DEFAULT FALSE, 
        enable_doubts BOOLEAN DEFAULT FALSE, 
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, 
        FOREIGN KEY (tenant_id) REFERENCES organization(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `)
    console.log('✅ Created tenant_features table!')
  } catch (error) {
    console.error('❌ Error setting up schema:', error)
  } finally {
    await connection.end()
  }
}

run()
