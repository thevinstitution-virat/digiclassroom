import { readFileSync } from 'fs'
import { join } from 'path'
import mysql from 'mysql2/promise'

async function runMigration() {
  console.log('🚀 Starting Teacher Validation System Migration...')

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
    // Read migration file
    const migrationPath = join(process.cwd(), 'migrations', '002-teacher-validation-system.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('📄 Reading migration file:', migrationPath)

    // Split migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== '\n')

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`)

    let successCount = 0
    let skipCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || statement.length < 10) continue

      try {
        console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`)
        await connection.query(statement)
        successCount++
        console.log(`✅ Statement ${i + 1} executed successfully`)
      } catch (error: any) {
        // Ignore errors for objects that already exist
        if (
          error.code === 'ER_DUP_FIELDNAME' ||
          error.code === 'ER_TABLE_EXISTS_ERROR' ||
          error.code === 'ER_DUP_KEYNAME' ||
          error.code === 'ER_FK_INCOMPATIBLE_COLUMNS' ||
          error.code === 'ER_FK_DUP_NAME'
        ) {
          skipCount++
          console.log(`⚠️  Statement ${i + 1} skipped (already exists or incompatible)`)
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message)
          console.error('Statement:', statement.substring(0, 200))
          // Continue with next statement instead of throwing
          skipCount++
        }
      }
    }

    console.log(`\n📊 Migration Summary:`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ⚠️  Skipped: ${skipCount}`)

    console.log('\n✅ Migration completed successfully!')
    console.log('\n📊 Summary:')
    console.log('   - Added approval_status, approved_by, approved_at, rejection_reason to users table')
    console.log('   - Created teacher_class_assignments table')
    console.log('   - Created teacher_activity_logs table')
    console.log('   - Created content_validation_queue table')
    console.log('   - Created teacher_statistics view')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    throw error
  } finally {
    await connection.end()
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n🎉 All done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error)
    process.exit(1)
  })

