/**
 * Test External Dictionary API Connection
 * Tests the connection to dictionaryapi.dev
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing external dictionary API connection...')

    // Test with a simple word
    const testWord = 'hello'
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${testWord}`, {
      headers: {
        'User-Agent': 'VG-Kosh-Dictionary/1.0'
      }
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API returned status ${response.status}`,
        details: await response.text()
      })
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      message: 'External dictionary API is working!',
      testWord: testWord,
      apiResponse: data,
      wordFound: data && data.length > 0,
      wordData: data[0] || null
    })

  } catch (error) {
    console.error('❌ External API test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to connect to external dictionary API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
