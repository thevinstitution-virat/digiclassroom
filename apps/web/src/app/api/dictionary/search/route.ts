/**
 * Dictionary Search API Route
 * Simple REST endpoint for word search
 */

import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required',
        words: []
      })
    }

    console.log('🔍 Dictionary search request:', { query, limit })

    // Simple fuzzy search query
    const searchSQL = `
      SELECT 
        id, word, pronunciation, part_of_speech as partOfSpeech,
        english_definition as englishDefinition, hindi_translation as hindiTranslation,
        devanagari_script as devanagariScript, amarkosha_category as amarkoshaCategory,
        semantic_cluster as semanticCluster, difficulty_level as difficultyLevel,
        frequency_rank as frequencyRank, audio_url as audioUrl,
        audio_accent as audioAccent, created_at as createdAt
      FROM dictionary_words
      WHERE (
          word LIKE ? OR 
          hindi_translation LIKE ? OR 
          english_definition LIKE ?
        )
      ORDER BY 
        CASE 
          WHEN word = ? THEN 1
          WHEN word LIKE ? THEN 2
          WHEN hindi_translation LIKE ? THEN 3
          ELSE 4
        END,
        frequency_rank ASC,
        word ASC
      LIMIT ?
    `

    const searchTerm = query.trim()
    const params = [
      `%${searchTerm}%`, // word LIKE
      `%${searchTerm}%`, // hindi_translation LIKE
      `%${searchTerm}%`, // english_definition LIKE
      searchTerm,        // exact word match
      `${searchTerm}%`,  // word starts with
      `${searchTerm}%`,  // hindi starts with
      limit
    ]

    console.log('🔍 Search SQL:', searchSQL)
    console.log('🔍 Search params:', params)

    const words = await executeQuery(searchSQL, params)
    console.log('🔍 Search results:', words.length, 'words found')

    // Parse JSON fields if they exist
    const processedWords = words.map((word: any) => {
      try {
        if (word.examples && typeof word.examples === 'string') {
          word.examples = JSON.parse(word.examples)
        }
        if (word.regionalUsage && typeof word.regionalUsage === 'string') {
          word.regionalUsage = JSON.parse(word.regionalUsage)
        }
        if (word.englishSynonyms && typeof word.englishSynonyms === 'string') {
          word.englishSynonyms = JSON.parse(word.englishSynonyms)
        }
        if (word.hindiSynonyms && typeof word.hindiSynonyms === 'string') {
          word.hindiSynonyms = JSON.parse(word.hindiSynonyms)
        }
      } catch (e) {
        console.warn('Error parsing JSON fields for word:', word.word, e)
      }
      return word
    })

    return NextResponse.json({
      success: true,
      words: processedWords,
      total: processedWords.length,
      query: searchTerm,
      searchType: 'fuzzy'
    })

  } catch (error) {
    console.error('❌ Dictionary search failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        words: []
      },
      { status: 500 }
    )
  }
}
