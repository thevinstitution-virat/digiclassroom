/**
 * Enhanced Database Migration Utility for Menu-Based Chatbot
 * Extends existing migration system with menu-specific functionality
 */

import { executeQuery, executeQuerySingle, withTransaction } from './connection'
import fs from 'fs'
import path from 'path'

interface MenuMigration {
  id: string
  filename: string
  description: string
  executed_at?: Date
}

/**
 * Enhanced migration manager for menu-based chatbot features
 */
export class MenuMigrationManager {
  
  /**
   * Create menu-specific migrations table
   */
  static async createMenuMigrationsTable(): Promise<void> {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS menu_migrations (
        id VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rollback_sql TEXT,
        INDEX idx_executed_at (executed_at),
        INDEX idx_filename (filename)
      )
    `)
  }

  /**
   * Execute menu-specific migration
   */
  static async executeMenuMigration(migrationId: string): Promise<void> {
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations', `${migrationId}.sql`)
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationId}.sql`)
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    await withTransaction(async (connection) => {
      // Execute migration SQL
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      for (const statement of statements) {
        if (statement.trim()) {
          await executeQuery(statement)
        }
      }

      // Record migration
      await executeQuery(
        'INSERT INTO menu_migrations (id, filename, description) VALUES (?, ?, ?)',
        [migrationId, `${migrationId}.sql`, `Menu chatbot migration: ${migrationId}`]
      )
    })

    console.log(`✅ Menu migration completed: ${migrationId}`)
  }

  /**
   * Check if migration has been executed
   */
  static async isMigrationExecuted(migrationId: string): Promise<boolean> {
    const result = await executeQuerySingle(
      'SELECT id FROM menu_migrations WHERE id = ?',
      [migrationId]
    )
    return !!result
  }

  /**
   * Run all pending menu migrations
   */
  static async runMenuMigrations(): Promise<void> {
    await this.createMenuMigrationsTable()

    const migrations = [
      '001_menu_chatbot_tables'
    ]

    for (const migrationId of migrations) {
      const isExecuted = await this.isMigrationExecuted(migrationId)
      
      if (!isExecuted) {
        console.log(`🔄 Running menu migration: ${migrationId}`)
        await this.executeMenuMigration(migrationId)
      } else {
        console.log(`⏭️ Skipping already executed migration: ${migrationId}`)
      }
    }

    console.log('✅ All menu migrations completed')
  }

  /**
   * Seed initial menu data
   */
  static async seedMenuData(): Promise<void> {
    console.log('🌱 Seeding initial menu data...')

    // Insert default user preferences for existing users.
    // Phase 4.1: legacy `users` table dropped; Better Auth `user` is the source.
    await executeQuery(`
      INSERT IGNORE INTO user_preferences (user_id, clerk_user_id, preferred_language, learning_style, difficulty_preference)
      SELECT
        CONCAT('user_', id) as user_id,
        id as clerk_user_id,
        'en' as preferred_language,
        'adaptive' as learning_style,
        'adaptive' as difficulty_preference
      FROM \`user\`
    `)

    // Insert sample analytics events for testing
    await executeQuery(`
      INSERT IGNORE INTO analytics_events (user_id, event_type, event_category, event_action, event_label, session_id)
      VALUES 
      ('demo_user_1', 'menu_interaction', 'student', 'menu_selection', 'homework_help', 'session_001'),
      ('demo_user_2', 'menu_interaction', 'teacher', 'menu_selection', 'create_quiz', 'session_002'),
      ('demo_user_3', 'menu_interaction', 'parent', 'menu_selection', 'check_progress', 'session_003')
    `)

    console.log('✅ Menu data seeding completed')
  }

  /**
   * Create database indexes for performance
   */
  static async createPerformanceIndexes(): Promise<void> {
    console.log('🔧 Creating performance indexes...')

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_conversations_user_role ON conversations(user_id, role)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_intent_topic ON conversations(intent, topic)',
      'CREATE INDEX IF NOT EXISTS idx_menu_selections_user_timestamp ON menu_selections(user_id, timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_progress_logs_user_subject ON progress_logs(user_id, subject, date)',
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_type ON chat_messages(conversation_id, message_type)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_events_user_type ON analytics_events(user_id, event_type, timestamp)'
    ]

    for (const indexSQL of indexes) {
      try {
        await executeQuery(indexSQL)
      } catch (error) {
        console.warn(`⚠️ Index creation warning: ${error}`)
      }
    }

    console.log('✅ Performance indexes created')
  }

  /**
   * Validate menu database schema
   */
  static async validateMenuSchema(): Promise<boolean> {
    console.log('🔍 Validating menu database schema...')

    const requiredTables = [
      'conversations',
      'menu_selections', 
      'progress_logs',
      'chat_messages',
      'user_preferences',
      'analytics_events',
      'performance_metrics'
    ]

    try {
      for (const table of requiredTables) {
        const result = await executeQuerySingle(
          'SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
          [table]
        )
        
        if (!result || result.count === 0) {
          console.error(`❌ Required table missing: ${table}`)
          return false
        }
      }

      console.log('✅ Menu database schema validation passed')
      return true
    } catch (error) {
      console.error('❌ Schema validation failed:', error)
      return false
    }
  }

  /**
   * Get menu system statistics
   */
  static async getMenuSystemStats(): Promise<{
    totalConversations: number
    totalMenuSelections: number
    totalUsers: number
    avgConversationsPerUser: number
  }> {
    const stats = await executeQuerySingle(`
      SELECT 
        (SELECT COUNT(*) FROM conversations) as totalConversations,
        (SELECT COUNT(*) FROM menu_selections) as totalMenuSelections,
        (SELECT COUNT(DISTINCT user_id) FROM conversations) as totalUsers,
        (SELECT COUNT(*) FROM conversations) / NULLIF((SELECT COUNT(DISTINCT user_id) FROM conversations), 0) as avgConversationsPerUser
    `)

    return {
      totalConversations: stats?.totalConversations || 0,
      totalMenuSelections: stats?.totalMenuSelections || 0,
      totalUsers: stats?.totalUsers || 0,
      avgConversationsPerUser: stats?.avgConversationsPerUser || 0
    }
  }

  /**
   * Clean up old data (for maintenance)
   */
  static async cleanupOldData(daysToKeep: number = 90): Promise<void> {
    console.log(`🧹 Cleaning up data older than ${daysToKeep} days...`)

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    // Clean up old conversations and related data
    await withTransaction(async () => {
      await executeQuery(
        'DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE created_at < ?)',
        [cutoffDate]
      )
      
      await executeQuery(
        'DELETE FROM menu_selections WHERE timestamp < ?',
        [cutoffDate]
      )
      
      await executeQuery(
        'DELETE FROM conversations WHERE created_at < ? AND status != "active"',
        [cutoffDate]
      )
      
      await executeQuery(
        'DELETE FROM analytics_events WHERE timestamp < ?',
        [cutoffDate]
      )
    })

    console.log('✅ Data cleanup completed')
  }
}

// Utility functions for easy access
export async function initializeMenuSystem(): Promise<void> {
  console.log('🚀 Initializing menu-based chatbot system...')
  
  await MenuMigrationManager.runMenuMigrations()
  await MenuMigrationManager.createPerformanceIndexes()
  await MenuMigrationManager.seedMenuData()
  
  const isValid = await MenuMigrationManager.validateMenuSchema()
  if (!isValid) {
    throw new Error('Menu system initialization failed - schema validation error')
  }
  
  const stats = await MenuMigrationManager.getMenuSystemStats()
  console.log('📊 Menu system statistics:', stats)
  
  console.log('✅ Menu-based chatbot system initialized successfully')
}

export async function getMenuSystemHealth(): Promise<{
  schemaValid: boolean
  stats: any
  lastMigration: string | null
}> {
  const schemaValid = await MenuMigrationManager.validateMenuSchema()
  const stats = await MenuMigrationManager.getMenuSystemStats()
  
  const lastMigration = await executeQuerySingle(
    'SELECT id FROM menu_migrations ORDER BY executed_at DESC LIMIT 1'
  )
  
  return {
    schemaValid,
    stats,
    lastMigration: lastMigration?.id || null
  }
}
