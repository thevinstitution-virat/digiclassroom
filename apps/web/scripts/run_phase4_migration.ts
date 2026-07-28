import { readFileSync } from 'fs'
import { join } from 'path'
import mysql from 'mysql2/promise'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

async function setupPhase4Schema() {
  console.log('🚀 Setting up Phase 4 Schema (Video Assets & Live Classes)...')

  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3307'),
    user: process.env.MYSQL_USER || 'digiclassroom_user',
    password: process.env.MYSQL_PASSWORD || 'digiclassroom123',
    database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
    multipleStatements: true,
  })

  try {
    const schemaPath = join(process.cwd(), 'src', 'lib', 'db', 'migrations', '008_phase4_video_live_classes.sql')
    console.log(`📖 Reading schema file from: ${schemaPath}`)
    const schemaSql = readFileSync(schemaPath, 'utf8')

    console.log('⚡ Executing schema...')
    await connection.query(schemaSql)
    
    console.log('✅ Phase 4 schema successfully created!')
    
    // Verify constraints
    const [tables] = await connection.query(`SHOW TABLES LIKE '%video_assets%'`)
    console.log('\n🔍 Verifying Tables:', tables)
    
  } catch (error) {
    console.error('❌ Error setting up schema:', error)
  } finally {
    await connection.end()
  }
}

setupPhase4Schema().catch(console.error)
