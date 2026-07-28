import { readFileSync } from 'fs'
import { join } from 'path'
import mysql from 'mysql2/promise'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

async function setupCoreClassroomSchema() {
  console.log('🚀 Setting up core classroom schema (Features, Notices, Homework, Attendance)...')

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
    // Read schema file
    const schemaPath = join(process.cwd(), 'src', 'lib', 'db', 'core-classroom-schema.sql')
    const schemaSQL = readFileSync(schemaPath, 'utf-8')

    console.log('📄 Reading schema file:', schemaPath)
    console.log('📝 Executing schema migration...')

    try {
      await connection.query(schemaSQL)
      console.log('✅ Core classroom schema executed successfully')
    } catch (error: any) {
      // Ignore "Duplicate" errors (tables already exist)
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Some objects already exist (schema may have been partially run)')
      } else {
        console.error('❌ Error executing schema:', error.message)
        throw error
      }
    }

    console.log('\n✅ Core classroom schema setup completed successfully!')
    console.log('\n📊 Summary:')
    console.log('   - Created tenant_features table')
    console.log('   - Created notices table')
    console.log('   - Created homeworks table')
    console.log('   - Created homework_submissions table')
    console.log('   - Created attendance_records table')

  } catch (error) {
    console.error('\n❌ Setup failed:', error)
    throw error
  } finally {
    await connection.end()
  }
}

// Run setup
setupCoreClassroomSchema()
  .then(() => {
    console.log('\n🎉 All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error)
    process.exit(1)
  })
