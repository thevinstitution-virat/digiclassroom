import { executeQuery, executeQuerySingle, withTransaction } from './connection'
import fs from 'fs'
import path from 'path'

interface Migration {
  id: string
  filename: string
  executed_at?: Date
}

// Create migrations table if it doesn't exist
async function createMigrationsTable(): Promise<void> {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS migrations (
      id VARCHAR(255) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_executed_at (executed_at)
    )
  `)
}

// Get list of executed migrations
async function getExecutedMigrations(): Promise<Migration[]> {
  await createMigrationsTable()
  return await executeQuery<Migration>('SELECT * FROM migrations ORDER BY executed_at')
}

// Get list of migration files
function getMigrationFiles(): string[] {
  const migrationsDir = path.join(process.cwd(), 'src/lib/db/migrations')
  
  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found')
    return []
  }
  
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
}

// Execute a single migration
async function executeMigration(filename: string): Promise<void> {
  const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations', filename)
  const migrationSql = fs.readFileSync(migrationPath, 'utf8')
  
  // Split by semicolon and execute each statement
  const statements = migrationSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
  
  await withTransaction(async (connection) => {
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 100)}...`)
        await connection.execute(statement)
      }
    }
    
    // Record migration as executed
    await connection.execute(
      'INSERT INTO migrations (id, filename) VALUES (?, ?)',
      [filename.replace('.sql', ''), filename]
    )
  })
}

// Run all pending migrations
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Checking for database migrations...')
    
    const executedMigrations = await getExecutedMigrations()
    const executedIds = new Set(executedMigrations.map(m => m.id))
    
    const migrationFiles = getMigrationFiles()
    const pendingMigrations = migrationFiles.filter(file => {
      const id = file.replace('.sql', '')
      return !executedIds.has(id)
    })
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations')
      return
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations:`)
    pendingMigrations.forEach(file => console.log(`  - ${file}`))
    
    for (const migration of pendingMigrations) {
      console.log(`🚀 Executing migration: ${migration}`)
      await executeMigration(migration)
      console.log(`✅ Completed migration: ${migration}`)
    }
    
    console.log('🎉 All migrations completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Rollback last migration (for development)
export async function rollbackLastMigration(): Promise<void> {
  try {
    const lastMigration = await executeQuerySingle<Migration>(
      'SELECT * FROM migrations ORDER BY executed_at DESC LIMIT 1'
    )
    
    if (!lastMigration) {
      console.log('No migrations to rollback')
      return
    }
    
    console.log(`⚠️  Rolling back migration: ${lastMigration.filename}`)
    
    // Remove from migrations table
    await executeQuery('DELETE FROM migrations WHERE id = ?', [lastMigration.id])
    
    console.log('⚠️  Migration rollback completed. Manual schema changes may be required.')
    
  } catch (error) {
    console.error('❌ Rollback failed:', error)
    throw error
  }
}

// Get migration status
export async function getMigrationStatus(): Promise<{
  executed: Migration[]
  pending: string[]
}> {
  const executed = await getExecutedMigrations()
  const allFiles = getMigrationFiles()
  const executedIds = new Set(executed.map(m => m.id))
  const pending = allFiles.filter(file => !executedIds.has(file.replace('.sql', '')))
  
  return { executed, pending }
}
