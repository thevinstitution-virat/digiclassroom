/**
 * Dictionary Database Test API Route
 * Tests database connection and returns sample data
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing dictionary database connection...')

    // Test basic connection
    const testResult = await executeQuerySingle<{ test: number }>('SELECT 1 as test')
    console.log('✅ Database connection test passed:', testResult)

    // Test dictionary_words table
    const wordsCount = await executeQuerySingle<{ count: number }>(
      'SELECT COUNT(*) as count FROM dictionary_words'
    )
    console.log('📚 Words in database:', wordsCount?.count)

    // Get sample words
    const sampleWords = await executeQuery(
      'SELECT word, hindi_translation, difficulty_level FROM dictionary_words LIMIT 5'
    )
    console.log('📖 Sample words:', sampleWords)

    // Test search functionality
    const searchTest = await executeQuery(
      `SELECT word, hindi_translation FROM dictionary_words
       WHERE word LIKE '%serendipity%' OR hindi_translation LIKE '%serendipity%'`
    )
    console.log('🔍 Search test for "serendipity":', searchTest)

    // Test user stats table
    const statsCount = await executeQuerySingle<{ count: number }>(
      'SELECT COUNT(*) as count FROM dictionary_user_stats'
    )
    console.log('👥 User stats records:', statsCount?.count)

    return NextResponse.json({
      success: true,
      message: 'Dictionary database is working perfectly!',
      data: {
        connectionTest: testResult,
        wordsCount: wordsCount?.count || 0,
        sampleWords: sampleWords,
        searchTest: searchTest,
        userStatsCount: statsCount?.count || 0
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Dictionary database test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
