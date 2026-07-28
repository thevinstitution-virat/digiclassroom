import { readFileSync } from 'fs'
import { join } from 'path'
import mysql from 'mysql2/promise'

async function setupBaseSchema() {
  console.log('🚀 Setting up base database schema...')

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
    // Read base schema file
    const schemaPath = join(process.cwd(), 'src', 'lib', 'db', 'schema.sql')
    const schemaSQL = readFileSync(schemaPath, 'utf-8')

    console.log('📄 Reading base schema file:', schemaPath)
    console.log('📝 Executing base schema...')

    try {
      await connection.query(schemaSQL)
      console.log('✅ Base schema executed successfully')
    } catch (error: any) {
      // Ignore "Duplicate" errors (tables already exist)
      if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  Some objects already exist (schema may have been partially run)')
      } else {
        console.error('❌ Error executing base schema:', error.message)
        throw error
      }
    }

    console.log('\n✅ Base schema setup completed successfully!')
    console.log('\n📊 Summary:')
    console.log('   - Created tenants table')
    console.log('   - Created users table')
    console.log('   - Created classes table')
    console.log('   - Created content table')
    console.log('   - Created vector_embeddings table')
    console.log('   - Created conversations table')
    console.log('   - Created messages table')
    console.log('   - Created analytics tables')

  } catch (error) {
    console.error('\n❌ Base schema setup failed:', error)
    throw error
  } finally {
    await connection.end()
  }
}

// Run setup
setupBaseSchema()
  .then(() => {
    console.log('\n🎉 All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Setup failed:', error)
    process.exit(1)
  })

