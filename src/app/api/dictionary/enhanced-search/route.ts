/**
 * Enhanced Dictionary Search API
 * Provides comprehensive word information with Indian context
 */

import { NextRequest, NextResponse } from 'next/server'
import { enhancedDictionary } from '@/lib/services/enhanced-dictionary'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Query parameter "q" is required'
      }, { status: 400 })
    }

    const word = query.trim().toLowerCase()
    console.log(`🔍 Enhanced search for: "${word}"`)

    // Get enhanced word data
    const enhancedData = await enhancedDictionary.getEnhancedWordData(word)

    if (!enhancedData) {
      console.log(`❌ No enhanced data found for: "${word}"`)
      return NextResponse.json({
        success: false,
        error: 'Word not found',
        query: word
      }, { status: 404 })
    }

    console.log(`✅ Enhanced data retrieved for: "${word}"`)

    return NextResponse.json({
      success: true,
      query: word,
      data: enhancedData,
      timestamp: new Date().toISOString(),
      source: 'enhanced_dictionary'
    })

  } catch (error) {
    console.error('❌ Enhanced search error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Enhanced search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { word } = await request.json()

    if (!word || typeof word !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Word parameter is required'
      }, { status: 400 })
    }

    console.log(`🔍 Enhanced POST search for: "${word}"`)

    const enhancedData = await enhancedDictionary.getEnhancedWordData(word.trim().toLowerCase())

    if (!enhancedData) {
      return NextResponse.json({
        success: false,
        error: 'Word not found',
        word: word
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      word: word,
      data: enhancedData,
      timestamp: new Date().toISOString(),
      source: 'enhanced_dictionary'
    })

  } catch (error) {
    console.error('❌ Enhanced POST search error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Enhanced search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
