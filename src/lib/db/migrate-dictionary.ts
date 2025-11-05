/**
 * Dictionary Database Migration Script
 * Creates the missing dictionary_words table and populates it with essential vocabulary
 */

import { getConnection } from './connection'
import fs from 'fs'
import path from 'path'

interface MigrationResult {
  success: boolean
  message: string
  wordsCreated?: number
  error?: string
}

export async function migrateDictionaryTable(): Promise<MigrationResult> {
  let connection
  
  try {
    console.log('🔄 Starting dictionary table migration...')
    
    // Get database connection
    connection = await getConnection()
    
    // Read the SQL migration file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/create-dictionary-table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split SQL statements (handle multiple statements)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))
    
    console.log(`📝 Executing ${statements.length} SQL statements...`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      if (statement.toLowerCase().includes('create table')) {
        console.log('🏗️ Creating dictionary_words table...')
      } else if (statement.toLowerCase().includes('insert into')) {
        console.log('📚 Inserting vocabulary words...')
      } else if (statement.toLowerCase().includes('create index')) {
        console.log('🔍 Creating search indexes...')
      }
      
      try {
        await connection.execute(statement)
      } catch (error: any) {
        // Ignore "table already exists" errors
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('ℹ️ Table already exists, skipping creation...')
          continue
        }
        
        // Ignore "duplicate entry" errors for inserts
        if (error.code === 'ER_DUP_ENTRY') {
          console.log('ℹ️ Some words already exist, skipping duplicates...')
          continue
        }
        
        throw error
      }
    }
    
    // Verify the table was created and populated (removed is_active filter)
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as count FROM dictionary_words'
    ) as any[]
    
    const wordCount = rows[0]?.count || 0
    
    console.log('✅ Dictionary table migration completed successfully')
    console.log(`📊 Total active words in database: ${wordCount}`)
    
    return {
      success: true,
      message: `Dictionary table migration completed successfully. ${wordCount} words available.`,
      wordsCreated: wordCount
    }
    
  } catch (error: any) {
    console.error('❌ Dictionary migration failed:', error)
    
    return {
      success: false,
      message: 'Dictionary table migration failed',
      error: error.message
    }
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

/**
 * Check if dictionary table exists and has data
 */
export async function checkDictionaryTableStatus(): Promise<{
  tableExists: boolean
  wordCount: number
  isReady: boolean
}> {
  let connection
  
  try {
    connection = await getConnection()
    
    // Check if table exists
    const [tables] = await connection.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'dictionary_words'
    `) as any[]
    
    const tableExists = tables[0]?.count > 0
    
    if (!tableExists) {
      return {
        tableExists: false,
        wordCount: 0,
        isReady: false
      }
    }
    
    // Check word count (removed is_active filter since column doesn't exist in user's table)
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as count FROM dictionary_words'
    ) as any[]
    
    const wordCount = rows[0]?.count || 0
    
    return {
      tableExists: true,
      wordCount,
      isReady: wordCount > 0
    }
    
  } catch (error) {
    console.error('❌ Failed to check dictionary table status:', error)
    return {
      tableExists: false,
      wordCount: 0,
      isReady: false
    }
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

/**
 * Add more vocabulary words to the dictionary
 */
export async function addVocabularyWords(words: Array<{
  word: string
  pronunciation?: string
  partOfSpeech: string
  englishDefinition: string
  hindiTranslation?: string
  devanagariScript?: string
  difficultyLevel?: 'easy' | 'medium' | 'hard'
  frequencyRank?: number
  audioUrl?: string
}>): Promise<MigrationResult> {
  let connection
  
  try {
    connection = await getConnection()
    
    console.log(`📚 Adding ${words.length} new vocabulary words...`)
    
    const insertSQL = `
      INSERT IGNORE INTO dictionary_words (
        word, pronunciation, part_of_speech, english_definition, 
        hindi_translation, devanagari_script, difficulty_level, 
        frequency_rank, audio_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    let addedCount = 0
    
    for (const word of words) {
      try {
        const [result] = await connection.execute(insertSQL, [
          word.word.toLowerCase(),
          word.pronunciation || null,
          word.partOfSpeech,
          word.englishDefinition,
          word.hindiTranslation || null,
          word.devanagariScript || null,
          word.difficultyLevel || 'medium',
          word.frequencyRank || 1000,
          word.audioUrl || null
        ]) as any[]
        
        if (result.affectedRows > 0) {
          addedCount++
        }
      } catch (error: any) {
        if (error.code !== 'ER_DUP_ENTRY') {
          console.error(`❌ Failed to add word "${word.word}":`, error.message)
        }
      }
    }
    
    console.log(`✅ Added ${addedCount} new words to dictionary`)
    
    return {
      success: true,
      message: `Successfully added ${addedCount} new words to dictionary`,
      wordsCreated: addedCount
    }
    
  } catch (error: any) {
    console.error('❌ Failed to add vocabulary words:', error)
    
    return {
      success: false,
      message: 'Failed to add vocabulary words',
      error: error.message
    }
  } finally {
    if (connection) {
      connection.release()
    }
  }
}

/**
 * Initialize dictionary with common English words
 */
export async function initializeDictionaryWithCommonWords(): Promise<MigrationResult> {
  const commonWords = [
    // Basic verbs
    { word: 'write', partOfSpeech: 'verb', englishDefinition: 'Mark letters, words, or other symbols on a surface', hindiTranslation: 'लिखना', difficultyLevel: 'easy' as const, frequencyRank: 41 },
    { word: 'speak', partOfSpeech: 'verb', englishDefinition: 'Say something in order to convey information or express a feeling', hindiTranslation: 'बोलना', difficultyLevel: 'easy' as const, frequencyRank: 42 },
    { word: 'listen', partOfSpeech: 'verb', englishDefinition: 'Give attention with the ear; attend closely for the purpose of hearing', hindiTranslation: 'सुनना', difficultyLevel: 'easy' as const, frequencyRank: 43 },
    { word: 'understand', partOfSpeech: 'verb', englishDefinition: 'Perceive the intended meaning of words, a language, or speaker', hindiTranslation: 'समझना', difficultyLevel: 'medium' as const, frequencyRank: 44 },
    { word: 'explain', partOfSpeech: 'verb', englishDefinition: 'Make clear to someone by describing it in more detail or revealing relevant facts', hindiTranslation: 'समझाना', difficultyLevel: 'medium' as const, frequencyRank: 45 },
    
    // Academic subjects
    { word: 'physics', partOfSpeech: 'noun', englishDefinition: 'The branch of science concerned with the nature and properties of matter and energy', hindiTranslation: 'भौतिकी', difficultyLevel: 'medium' as const, frequencyRank: 46 },
    { word: 'chemistry', partOfSpeech: 'noun', englishDefinition: 'The branch of science that deals with the identification of substances', hindiTranslation: 'रसायन विज्ञान', difficultyLevel: 'medium' as const, frequencyRank: 47 },
    { word: 'biology', partOfSpeech: 'noun', englishDefinition: 'The study of living organisms', hindiTranslation: 'जीव विज्ञान', difficultyLevel: 'medium' as const, frequencyRank: 48 },
    { word: 'geography', partOfSpeech: 'noun', englishDefinition: 'The study of the physical features of the earth and its atmosphere', hindiTranslation: 'भूगोल', difficultyLevel: 'medium' as const, frequencyRank: 49 },
    { word: 'literature', partOfSpeech: 'noun', englishDefinition: 'Written works, especially those considered of superior or lasting artistic merit', hindiTranslation: 'साहित्य', difficultyLevel: 'medium' as const, frequencyRank: 50 },
    
    // Technology and modern terms
    { word: 'computer', partOfSpeech: 'noun', englishDefinition: 'An electronic device for storing and processing data', hindiTranslation: 'कंप्यूटर', difficultyLevel: 'easy' as const, frequencyRank: 51 },
    { word: 'internet', partOfSpeech: 'noun', englishDefinition: 'A global computer network providing a variety of information and communication facilities', hindiTranslation: 'इंटरनेट', difficultyLevel: 'easy' as const, frequencyRank: 52 },
    { word: 'technology', partOfSpeech: 'noun', englishDefinition: 'The application of scientific knowledge for practical purposes', hindiTranslation: 'प्रौद्योगिकी', difficultyLevel: 'medium' as const, frequencyRank: 53 },
    { word: 'digital', partOfSpeech: 'adjective', englishDefinition: 'Relating to or using signals or information represented by discrete values', hindiTranslation: 'डिजिटल', difficultyLevel: 'medium' as const, frequencyRank: 54 },
    { word: 'online', partOfSpeech: 'adjective', englishDefinition: 'Connected to the internet or available through a computer network', hindiTranslation: 'ऑनलाइन', difficultyLevel: 'easy' as const, frequencyRank: 55 }
  ]
  
  return await addVocabularyWords(commonWords)
}
