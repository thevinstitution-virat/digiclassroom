/**
 * Subscription Schema Migration Script
 * Applies the subscription and monetization schema to the database
 * 
 * Usage:
 *   npx tsx src/lib/db/subscription-migrate.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

interface MigrationResult {
  success: boolean
  message: string
  error?: string
}

async function runMigration(): Promise<MigrationResult> {
  let connection: mysql.Connection | null = null

  try {
    console.log('🚀 Starting Subscription Schema Migration...\n')

    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
      multipleStatements: true
    })

    console.log('✅ Database connection established')

    // Read the schema file
    const schemaPath = join(__dirname, 'subscription-schema.sql')
    const schema = readFileSync(schemaPath, 'utf-8')

    console.log('📄 Schema file loaded')
    console.log('📊 Executing SQL statements...\n')

    // Execute the schema
    await connection.query(schema)

    console.log('✅ Schema executed successfully')

    // Verify tables were created
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'subscription_plans'
      UNION ALL
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (
        'user_subscriptions',
        'ai_tutor_usage',
        'free_trials',
        'subscription_history',
        'quota_alerts'
      )
    `, [process.env.MYSQL_DATABASE || 'virat_gyankosh'])

    const tableList = tables as any[]
    console.log(`\n📋 Tables created/verified: ${tableList.length}`)
    tableList.forEach((table: any) => {
      const tableName = Object.values(table)[0]
      console.log(`   ✓ ${tableName}`)
    })

    // Verify seed data
    const [plans] = await connection.query('SELECT plan_code, display_name, monthly_price FROM subscription_plans ORDER BY display_order')
    const planList = plans as any[]
    
    console.log(`\n💰 Subscription Plans seeded: ${planList.length}`)
    planList.forEach((plan: any) => {
      console.log(`   ✓ ${plan.plan_code}: ${plan.display_name} - ₹${plan.monthly_price}/month`)
    })

    console.log('\n🎉 Migration completed successfully!')

    return {
      success: true,
      message: 'Subscription schema migration completed successfully'
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    
    return {
      success: false,
      message: 'Migration failed',
      error: error.message
    }

  } finally {
    if (connection) {
      await connection.end()
      console.log('\n🔌 Database connection closed')
    }
  }
}

// Run migration if executed directly
if (require.main === module) {
  runMigration()
    .then((result) => {
      if (result.success) {
        console.log('\n✅ All done!')
        process.exit(0)
      } else {
        console.error('\n❌ Migration failed:', result.error)
        process.exit(1)
      }
    })
    .catch((error) => {
      console.error('\n❌ Unexpected error:', error)
      process.exit(1)
    })
}

export { runMigration }

