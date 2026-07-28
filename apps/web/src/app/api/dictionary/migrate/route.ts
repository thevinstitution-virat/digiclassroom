/**
 * Dictionary Migration API Endpoint
 * Creates the missing dictionary_words table and populates it with essential vocabulary
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  migrateDictionaryTable, 
  checkDictionaryTableStatus, 
  initializeDictionaryWithCommonWords 
} from '@/lib/db/migrate-dictionary'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking dictionary table status...')
    
    // Check current status
    const status = await checkDictionaryTableStatus()
    
    return NextResponse.json({
      success: true,
      status: {
        tableExists: status.tableExists,
        wordCount: status.wordCount,
        isReady: status.isReady,
        message: status.isReady 
          ? `Dictionary table is ready with ${status.wordCount} words`
          : status.tableExists 
            ? 'Dictionary table exists but has no words'
            : 'Dictionary table does not exist'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Failed to check dictionary status:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to check dictionary table status',
      details: error.message
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    console.log(`🔄 Dictionary migration action: ${action}`)
    
    switch (action) {
      case 'migrate':
        // Run full migration (create table + populate with basic words)
        const migrationResult = await migrateDictionaryTable()
        
        if (migrationResult.success) {
          // Add additional common words
          console.log('📚 Adding additional common words...')
          const additionalWordsResult = await initializeDictionaryWithCommonWords()
          
          return NextResponse.json({
            success: true,
            message: 'Dictionary migration completed successfully',
            results: {
              migration: migrationResult,
              additionalWords: additionalWordsResult
            },
            totalWords: (migrationResult.wordsCreated || 0) + (additionalWordsResult.wordsCreated || 0)
          })
        } else {
          return NextResponse.json({
            success: false,
            error: 'Dictionary migration failed',
            details: migrationResult.error
          }, { status: 500 })
        }
        
      case 'add-common-words':
        // Add additional common words only
        const wordsResult = await initializeDictionaryWithCommonWords()
        
        return NextResponse.json({
          success: wordsResult.success,
          message: wordsResult.message,
          wordsAdded: wordsResult.wordsCreated,
          error: wordsResult.error
        })
        
      case 'check-status':
        // Check status only
        const statusResult = await checkDictionaryTableStatus()
        
        return NextResponse.json({
          success: true,
          status: statusResult
        })
        
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action. Use: migrate, add-common-words, or check-status'
        }, { status: 400 })
    }
    
  } catch (error: any) {
    console.error('❌ Dictionary migration API error:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Dictionary migration failed',
      details: error.message
    }, { status: 500 })
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
