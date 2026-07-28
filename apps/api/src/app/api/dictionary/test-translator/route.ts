/**
 * Microsoft Translator Test API
 * Tests the Azure Cognitive Services translation functionality
 */

import { NextRequest, NextResponse } from 'next/server'
import { microsoftTranslator } from '@/lib/services/microsoft-translator'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing Microsoft Translator service...')

    // Check configuration
    const configStatus = microsoftTranslator.getConfigStatus()
    console.log('⚙️ Configuration status:', configStatus)

    if (!configStatus.configured) {
      return NextResponse.json({
        success: false,
        error: 'Microsoft Translator not configured',
        configStatus: configStatus,
        instructions: [
          '1. Get your Azure Translator API key from Azure Portal',
          '2. Add AZURE_TRANSLATOR_KEY to your .env.local file',
          '3. Restart the development server',
          '4. Test again'
        ]
      })
    }

    // Test connection
    const connectionTest = await microsoftTranslator.testConnection()
    console.log('🔗 Connection test result:', connectionTest)

    if (!connectionTest.success) {
      return NextResponse.json({
        success: false,
        error: 'Translation service connection failed',
        details: connectionTest.message,
        configStatus: configStatus
      })
    }

    // Test multiple translations
    const testWords = ['hello', 'computer', 'beautiful', 'knowledge', 'friendship']
    console.log(`🌐 Testing translations for: ${testWords.join(', ')}`)
    
    const translationResults = await microsoftTranslator.translateMultiple(testWords)
    
    const translations = testWords.map((word, index) => ({
      english: word,
      hindi: translationResults[index].translatedText,
      success: translationResults[index].success,
      error: translationResults[index].error
    }))

    console.log('✅ Translation test completed')

    return NextResponse.json({
      success: true,
      message: 'Microsoft Translator is working correctly!',
      configStatus: configStatus,
      connectionTest: connectionTest,
      sampleTranslations: translations,
      testResults: {
        totalWords: testWords.length,
        successfulTranslations: translations.filter(t => t.success).length,
        failedTranslations: translations.filter(t => !t.success).length
      }
    })

  } catch (error) {
    console.error('❌ Microsoft Translator test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Translation service test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        configStatus: microsoftTranslator.getConfigStatus()
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Text parameter is required'
      }, { status: 400 })
    }

    console.log(`🌐 Translating custom text: "${text}"`)
    
    const result = await microsoftTranslator.translateToHindi(text)
    
    return NextResponse.json({
      success: result.success,
      originalText: result.originalText,
      translatedText: result.translatedText,
      error: result.error,
      configStatus: microsoftTranslator.getConfigStatus()
    })

  } catch (error) {
    console.error('❌ Custom translation failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Translation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
