#!/usr/bin/env node

/**
 * VG Kosh Dictionary Setup Script
 * Initializes the dictionary database and sample data
 */

const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'password',
  database: process.env.MYSQL_DATABASE || 'virat_gyankosh',
  multipleStatements: true
}

async function setupDictionary() {
  console.log('🚀 Setting up VG Kosh Dictionary system...')

  let connection
  try {
    // Create database connection
    connection = await mysql.createConnection(dbConfig)
    console.log('✅ Connected to database')

    // Read and execute migration SQL
    const migrationPath = path.join(__dirname, '../src/lib/db/migrations/002_dictionary_tables.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

    console.log('📝 Running dictionary migrations...')
    await connection.execute(migrationSQL)
    console.log('✅ Dictionary tables created')

    // Check if sample data already exists
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM dictionary_words')
    if (rows[0].count > 0) {
      console.log('📚 Dictionary already contains data, skipping seed')
    } else {
      console.log('🌱 Seeding dictionary with sample data...')
      await seedSampleData(connection)
      console.log('✅ Sample data seeded')
    }

    console.log('✅ Dictionary system setup completed successfully!')
    console.log('')
    console.log('📚 You can now:')
    console.log('  1. Visit http://localhost:3000/dashboard/user/dictionary')
    console.log('  2. Search for words like "serendipity", "resilience", "ephemeral"')
    console.log('  3. Explore the Word of the Day feature')
    console.log('  4. Track your learning progress')
    console.log('')

  } catch (error) {
    console.error('❌ Dictionary setup failed:', error)
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
    }
  }
}

async function seedSampleData(connection) {
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

  for (const word of sampleWords) {
    await connection.execute(
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
}

// Run the setup
setupDictionary()
