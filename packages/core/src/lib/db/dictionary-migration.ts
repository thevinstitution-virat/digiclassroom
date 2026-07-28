/**
 * VG Kosh Dictionary Database Migration Manager
 * Handles dictionary feature database setup and sample data
 */

import { executeQuery, executeQuerySingle } from './connection.js'
import fs from 'fs'
import path from 'path'

export class DictionaryMigrationManager {
  /**
   * Run dictionary database migrations
   */
  static async runDictionaryMigrations(): Promise<void> {
    console.log('🚀 Running dictionary database migrations...')
    
    try {
      // Read and execute the migration SQL
      const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/002_dictionary_tables.sql')
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
      
      // Split by semicolon and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
      
      for (const statement of statements) {
        try {
          await executeQuery(statement)
        } catch (error: any) {
          // Ignore "table already exists" errors
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️ Migration warning: ${error.message}`)
          }
        }
      }
      
      console.log('✅ Dictionary database migrations completed')
    } catch (error) {
      console.error('❌ Dictionary migration failed:', error)
      throw error
    }
  }

  /**
   * Seed dictionary with sample data
   */
  static async seedDictionaryData(): Promise<void> {
    console.log('🌱 Seeding dictionary with sample data...')
    
    try {
      // Check if data already exists
      const existingWords = await executeQuerySingle<{ count: number }>(
        'SELECT COUNT(*) as count FROM dictionary_words'
      )
      
      if (existingWords && existingWords.count > 0) {
        console.log('📚 Dictionary already contains data, skipping seed')
        return
      }
      
      // Sample words for initial testing
      const sampleWords = [
        {
          word: 'Serendipity',
          pronunciation: '/ˌserənˈdipədē/',
          partOfSpeech: 'noun',
          englishDefinition: 'The occurrence and development of events by chance in a happy or beneficial way.',
          hindiTranslation: 'संयोग से मिली खुशी',
          devanagariScript: 'सेरेंडिपिटी',
          amarkoshaCategory: 'Mental States',
          semanticCluster: 'Emotions',
          examples: JSON.stringify([
            {
              english: 'A fortunate stroke of serendipity brought the old friends together.',
              hindi: 'एक भाग्यशाली संयोग ने पुराने दोस्तों को फिर से मिला दिया।'
            }
          ]),
          culturalContext: 'The concept of serendipity resonates with the Indian belief in "kismat" (fate) and unexpected blessings.',
          difficultyLevel: 'advanced',
          frequencyRank: 5000
        },
        {
          word: 'Resilience',
          pronunciation: '/rɪˈzɪljəns/',
          partOfSpeech: 'noun',
          englishDefinition: 'The ability to recover quickly from difficulties; toughness.',
          hindiTranslation: 'लचीलापन, दृढ़ता',
          devanagariScript: 'रेज़िलिएंस',
          amarkoshaCategory: 'Mental Qualities',
          semanticCluster: 'Strength',
          examples: JSON.stringify([
            {
              english: 'Her resilience helped her overcome the challenges.',
              hindi: 'उसकी दृढ़ता ने उसे चुनौतियों से पार पाने में मदद की।'
            }
          ]),
          culturalContext: 'In Indian philosophy, resilience is often associated with "धैर्य" (patience) and inner strength.',
          difficultyLevel: 'intermediate',
          frequencyRank: 3000
        },
        {
          word: 'Ephemeral',
          pronunciation: '/ɪˈfem(ə)rəl/',
          partOfSpeech: 'adjective',
          englishDefinition: 'Lasting for a very short time.',
          hindiTranslation: 'क्षणिक, अस्थायी',
          devanagariScript: 'इफेमेरल',
          amarkoshaCategory: 'Time Concepts',
          semanticCluster: 'Duration',
          examples: JSON.stringify([
            {
              english: 'The beauty of cherry blossoms is ephemeral.',
              hindi: 'चेरी के फूलों की सुंदरता क्षणिक होती है।'
            }
          ]),
          culturalContext: 'The concept of impermanence is central to Indian philosophy, reflected in terms like "अनित्य" (anitya).',
          difficultyLevel: 'advanced',
          frequencyRank: 8000
        },
        {
          word: 'Ubiquitous',
          pronunciation: '/juːˈbɪkwɪtəs/',
          partOfSpeech: 'adjective',
          englishDefinition: 'Present, appearing, or found everywhere.',
          hindiTranslation: 'सर्वव्यापी, हर जगह मौजूद',
          devanagariScript: 'यूबिक्विटस',
          amarkoshaCategory: 'Spatial Concepts',
          semanticCluster: 'Presence',
          examples: JSON.stringify([
            {
              english: 'Mobile phones have become ubiquitous in modern society.',
              hindi: 'आधुनिक समाज में मोबाइल फोन सर्वव्यापी हो गए हैं।'
            }
          ]),
          culturalContext: 'Similar to the Sanskrit concept of "व्यापक" (vyapak), meaning all-pervading.',
          difficultyLevel: 'advanced',
          frequencyRank: 6000
        },
        {
          word: 'Harmony',
          pronunciation: '/ˈhɑːməni/',
          partOfSpeech: 'noun',
          englishDefinition: 'The combination of simultaneously sounded musical notes to produce chords and chord progressions.',
          hindiTranslation: 'सामंजस्य, मेल',
          devanagariScript: 'हार्मनी',
          amarkoshaCategory: 'Musical Terms',
          semanticCluster: 'Unity',
          examples: JSON.stringify([
            {
              english: 'The choir sang in perfect harmony.',
              hindi: 'गायक मंडली ने पूर्ण सामंजस्य के साथ गाया।'
            }
          ]),
          culturalContext: 'Harmony in Indian music is expressed through "राग" (raga) and "ताल" (taal) systems.',
          difficultyLevel: 'intermediate',
          frequencyRank: 2000
        }
      ]
      
      // Insert sample words
      for (const word of sampleWords) {
        await executeQuery(
          `INSERT INTO dictionary_words 
           (word, pronunciation, part_of_speech, english_definition, hindi_translation, 
            devanagari_script, amarkosha_category, semantic_cluster, examples, 
            cultural_context, difficulty_level, frequency_rank, source) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            word.word, word.pronunciation, word.partOfSpeech, word.englishDefinition,
            word.hindiTranslation, word.devanagariScript, word.amarkoshaCategory,
            word.semanticCluster, word.examples, word.culturalContext,
            word.difficultyLevel, word.frequencyRank, 'system'
          ]
        )
      }
      
      console.log(`✅ Seeded ${sampleWords.length} sample words`)
    } catch (error) {
      console.error('❌ Dictionary seeding failed:', error)
      throw error
    }
  }

  /**
   * Create performance indexes for dictionary
   */
  static async createDictionaryIndexes(): Promise<void> {
    console.log('🔍 Creating dictionary performance indexes...')
    
    const indexes = [
      // Search optimization indexes
      'CREATE INDEX IF NOT EXISTS idx_dict_word_search ON dictionary_words(word, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_dict_hindi_search ON dictionary_words(hindi_translation, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_dict_difficulty ON dictionary_words(difficulty_level, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_dict_category ON dictionary_words(amarkosha_category, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_dict_frequency ON dictionary_words(frequency_rank, is_active)',
      
      // User progress indexes
      'CREATE INDEX IF NOT EXISTS idx_progress_user_word ON user_vocab_progress(user_id, word_id)',
      'CREATE INDEX IF NOT EXISTS idx_progress_due_date ON user_vocab_progress(next_due_date, status)',
      'CREATE INDEX IF NOT EXISTS idx_progress_status ON user_vocab_progress(status, user_id)',
      
      // Community phrases indexes
      'CREATE INDEX IF NOT EXISTS idx_phrases_word_approved ON community_phrases(word_id, is_approved)',
      'CREATE INDEX IF NOT EXISTS idx_phrases_user ON community_phrases(user_id, is_approved)',
      'CREATE INDEX IF NOT EXISTS idx_phrases_region ON community_phrases(region, is_approved)',
      
      // Analytics indexes
      'CREATE INDEX IF NOT EXISTS idx_search_history_user ON dictionary_search_history(user_id, created_at)',
      'CREATE INDEX IF NOT EXISTS idx_search_history_query ON dictionary_search_history(search_query, created_at)',
      
      // Stats indexes
      'CREATE INDEX IF NOT EXISTS idx_stats_points ON dictionary_user_stats(total_points DESC)',
      'CREATE INDEX IF NOT EXISTS idx_stats_streak ON dictionary_user_stats(current_streak_days DESC)',
      'CREATE INDEX IF NOT EXISTS idx_stats_activity ON dictionary_user_stats(last_activity_date DESC)'
    ]

    for (const indexSQL of indexes) {
      try {
        await executeQuery(indexSQL)
      } catch (error: any) {
        console.warn(`⚠️ Index creation warning: ${error.message}`)
      }
    }

    console.log('✅ Dictionary performance indexes created')
  }

  /**
   * Validate dictionary database schema
   */
  static async validateDictionarySchema(): Promise<boolean> {
    console.log('🔍 Validating dictionary database schema...')

    const requiredTables = [
      'dictionary_words',
      'user_vocab_progress', 
      'community_phrases',
      'dictionary_user_stats',
      'dictionary_search_history',
      'dictionary_offline_sync'
    ]

    try {
      for (const table of requiredTables) {
        const result = await executeQuerySingle<{ count: number }>(
          `SELECT COUNT(*) as count FROM information_schema.tables 
           WHERE table_schema = DATABASE() AND table_name = ?`,
          [table]
        )
        
        if (!result || result.count === 0) {
          console.error(`❌ Required table missing: ${table}`)
          return false
        }
      }
      
      console.log('✅ Dictionary schema validation passed')
      return true
    } catch (error) {
      console.error('❌ Dictionary schema validation failed:', error)
      return false
    }
  }

  /**
   * Get dictionary system statistics
   */
  static async getDictionarySystemStats(): Promise<any> {
    try {
      const stats = await executeQuery(`
        SELECT
          (SELECT COUNT(*) FROM dictionary_words) as total_words,
          (SELECT COUNT(*) FROM user_vocab_progress) as total_progress_entries,
          (SELECT COUNT(*) FROM community_phrases WHERE is_approved = TRUE) as approved_phrases,
          (SELECT COUNT(*) FROM dictionary_user_stats) as total_users,
          (SELECT COUNT(*) FROM dictionary_search_history WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as searches_24h
      `)
      
      return stats[0]
    } catch (error) {
      console.error('Error getting dictionary system stats:', error)
      return null
    }
  }
}

// Utility functions for easy access
export async function initializeDictionarySystem(): Promise<void> {
  console.log('🚀 Initializing VG Kosh Dictionary system...')
  
  await DictionaryMigrationManager.runDictionaryMigrations()
  await DictionaryMigrationManager.createDictionaryIndexes()
  await DictionaryMigrationManager.seedDictionaryData()
  
  const isValid = await DictionaryMigrationManager.validateDictionarySchema()
  if (!isValid) {
    throw new Error('Dictionary system initialization failed - schema validation error')
  }
  
  const stats = await DictionaryMigrationManager.getDictionarySystemStats()
  console.log('📊 Dictionary system statistics:', stats)
  
  console.log('✅ VG Kosh Dictionary system initialized successfully')
}

export async function isDictionaryInitialized(): Promise<boolean> {
  try {
    return await DictionaryMigrationManager.validateDictionarySchema()
  } catch (error) {
    console.error('Error checking dictionary initialization:', error)
    return false
  }
}
