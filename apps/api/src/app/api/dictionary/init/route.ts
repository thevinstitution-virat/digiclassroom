/**
 * Dictionary Initialization API Route
 * Creates dictionary tables and seeds sample data
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Initializing VG Kosh Dictionary system...')

    // Test database connection first
    try {
      await executeQuery('SELECT 1 as test')
      console.log('✅ Database connection successful')
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError)
      return NextResponse.json({
        success: false,
        error: 'Database connection failed. Please ensure MySQL is running and configured correctly.',
        details: 'Check your .env.local file and make sure MySQL service is started.',
        troubleshooting: [
          '1. Start MySQL service on your system',
          '2. Verify database credentials in .env.local',
          '3. Create database "virat_gyankosh" if it doesn\'t exist',
          '4. Check if port 3306 is accessible'
        ]
      }, { status: 503 })
    }

    // These three tables are also declared in the Drizzle schema and created by
    // drizzle/0000_pg_baseline.sql. The statements below are the Postgres port of
    // the original MySQL bootstrap and are kept IF NOT EXISTS so they never fight
    // the migration; the column types mirror the baseline exactly. MySQL enums
    // become plain text (as pg-core does), and indexes are separate statements.

    // Create dictionary_words table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS dictionary_words (
        id SERIAL PRIMARY KEY,
        word VARCHAR(255) NOT NULL UNIQUE,
        pronunciation VARCHAR(255),
        part_of_speech TEXT NOT NULL,

        english_definition TEXT NOT NULL,
        english_synonyms JSON DEFAULT '[]',
        english_antonyms JSON DEFAULT '[]',

        hindi_translation VARCHAR(500) NOT NULL,
        hindi_synonyms JSON DEFAULT '[]',
        devanagari_script VARCHAR(500),

        amarkosha_category VARCHAR(100),
        semantic_cluster VARCHAR(100),
        etymology TEXT,

        examples JSON DEFAULT '[]',
        cultural_context TEXT,
        regional_usage JSON DEFAULT '[]',

        audio_url VARCHAR(500),
        audio_accent TEXT DEFAULT 'indian',

        difficulty_level TEXT DEFAULT 'intermediate',
        frequency_rank INTEGER,

        source VARCHAR(100) DEFAULT 'system',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    // The MySQL original carried a FULLTEXT index over the word/definition
    // columns. Postgres has no direct equivalent; dictionary search uses LIKE
    // matching, so no index is created in its place.
    for (const idx of [
      `CREATE INDEX IF NOT EXISTS idx_word ON dictionary_words (word)`,
      `CREATE INDEX IF NOT EXISTS idx_hindi_translation ON dictionary_words (hindi_translation)`,
      `CREATE INDEX IF NOT EXISTS idx_amarkosha_category ON dictionary_words (amarkosha_category)`,
      `CREATE INDEX IF NOT EXISTS idx_difficulty_level ON dictionary_words (difficulty_level)`,
    ]) {
      await executeQuery(idx)
    }

    // Create user_vocab_progress table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS user_vocab_progress (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        clerk_user_id VARCHAR(255) NOT NULL,
        word_id INTEGER NOT NULL,

        efactor DECIMAL(3,2) DEFAULT 2.50,
        interval_days INTEGER DEFAULT 1,
        repetitions INTEGER DEFAULT 0,
        next_due_date DATE NOT NULL,
        last_reviewed TIMESTAMP NULL,

        correct_attempts INTEGER DEFAULT 0,
        total_attempts INTEGER DEFAULT 0,
        accuracy_percentage DECIMAL(5,2) DEFAULT 0.00,

        status TEXT DEFAULT 'new',
        first_learned_at TIMESTAMP NULL,
        mastered_at TIMESTAMP NULL,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        CONSTRAINT unique_user_word UNIQUE (user_id, word_id)
      )
    `)

    for (const idx of [
      `CREATE INDEX IF NOT EXISTS idx_user_id ON user_vocab_progress (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_word_id ON user_vocab_progress (word_id)`,
      `CREATE INDEX IF NOT EXISTS idx_next_due_date ON user_vocab_progress (next_due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_status ON user_vocab_progress (status)`,
    ]) {
      await executeQuery(idx)
    }

    // Create dictionary_user_stats table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS dictionary_user_stats (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL UNIQUE,
        clerk_user_id VARCHAR(255) NOT NULL UNIQUE,

        total_words_learned INTEGER DEFAULT 0,
        words_mastered INTEGER DEFAULT 0,
        current_streak_days INTEGER DEFAULT 0,
        longest_streak_days INTEGER DEFAULT 0,
        last_activity_date DATE NULL,

        total_quiz_attempts INTEGER DEFAULT 0,
        correct_quiz_answers INTEGER DEFAULT 0,
        average_accuracy DECIMAL(5,2) DEFAULT 0.00,

        total_points INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        badges_earned JSON DEFAULT '[]',
        achievements JSON DEFAULT '[]',

        phrases_contributed INTEGER DEFAULT 0,
        phrases_approved INTEGER DEFAULT 0,
        community_reputation INTEGER DEFAULT 0,

        daily_goal_words INTEGER DEFAULT 5,
        preferred_difficulty TEXT DEFAULT 'mixed',
        notification_preferences JSON DEFAULT '{}',

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    for (const idx of [
      `CREATE INDEX IF NOT EXISTS idx_stats_user_id ON dictionary_user_stats (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_total_points ON dictionary_user_stats (total_points)`,
      `CREATE INDEX IF NOT EXISTS idx_level ON dictionary_user_stats (level)`,
      `CREATE INDEX IF NOT EXISTS idx_current_streak ON dictionary_user_stats (current_streak_days)`,
    ]) {
      await executeQuery(idx)
    }

    console.log('✅ Dictionary tables created')

    // Check if sample data already exists
    const existingWords = await executeQuerySingle<{ count: number }>(
      'SELECT COUNT(*) as count FROM dictionary_words'
    )

    if (!existingWords || existingWords.count === 0) {
      console.log('🌱 Seeding dictionary with sample data...')

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
    } else {
      console.log('📚 Dictionary already contains data, skipping seed')
    }

    return NextResponse.json({
      success: true,
      message: 'Dictionary system initialized successfully',
      wordsCount: existingWords?.count || 5
    })

  } catch (error) {
    console.error('❌ Dictionary initialization failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize dictionary system',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
