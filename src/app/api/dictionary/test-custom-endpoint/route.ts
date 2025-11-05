/**
 * Test Custom Azure Endpoint for Microsoft Translator
 * Verifies the VG Kosh specific endpoint is working
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing VG Kosh custom Azure endpoint...')

    const apiKey = process.env.AZURE_TRANSLATOR_KEY
    const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT
    const region = process.env.AZURE_TRANSLATOR_REGION

    console.log('⚙️ Configuration:')
    console.log(`  Endpoint: ${endpoint}`)
    console.log(`  Region: ${region}`)
    console.log(`  API Key: ${apiKey ? 'Configured' : 'Missing'}`)

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured',
        endpoint: endpoint,
        region: region
      })
    }

    // Test translation with custom endpoint
    const testWord = 'beautiful'
    console.log(`🌐 Testing translation of "${testWord}" using custom endpoint`)

    // Use the correct path for custom Azure endpoints
    const translateUrl = endpoint.includes('cognitiveservices.azure.com')
      ? `${endpoint}/translator/text/v3.0/translate?api-version=3.0&to=hi`
      : `${endpoint}/translate?api-version=3.0&to=hi`

    console.log(`🔗 Using translate URL: ${translateUrl}`)

    const response = await fetch(translateUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
        'User-Agent': 'VG-Kosh-Dictionary/1.0'
      },
      body: JSON.stringify([{
        text: testWord
      }])
    })

    console.log(`📡 Response status: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error: ${response.status} - ${errorText}`)
      
      return NextResponse.json({
        success: false,
        error: `API returned status ${response.status}`,
        details: errorText,
        endpoint: endpoint,
        region: region,
        testWord: testWord
      })
    }

    const data = await response.json()
    console.log('📊 Translation response:', data)

    if (!data || data.length === 0 || !data[0].translations || data[0].translations.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No translation data received',
        endpoint: endpoint,
        region: region,
        testWord: testWord,
        rawResponse: data
      })
    }

    const translation = data[0].translations[0].text
    console.log(`✅ Translation successful: "${testWord}" → "${translation}"`)

    // Test multiple words
    const multipleWords = ['computer', 'magnificent', 'algorithm']
    console.log(`🌐 Testing multiple words: ${multipleWords.join(', ')}`)

    // Use the correct path for multiple translations too
    const multiTranslateUrl = endpoint.includes('cognitiveservices.azure.com')
      ? `${endpoint}/translator/text/v3.0/translate?api-version=3.0&to=hi`
      : `${endpoint}/translate?api-version=3.0&to=hi`

    const multiResponse = await fetch(multiTranslateUrl, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
        'User-Agent': 'VG-Kosh-Dictionary/1.0'
      },
      body: JSON.stringify(multipleWords.map(word => ({ text: word })))
    })

    let multipleTranslations = []
    if (multiResponse.ok) {
      const multiData = await multiResponse.json()
      multipleTranslations = multipleWords.map((word, index) => ({
        english: word,
        hindi: multiData[index]?.translations?.[0]?.text || 'Translation failed'
      }))
      console.log('✅ Multiple translations successful:', multipleTranslations)
    }

    return NextResponse.json({
      success: true,
      message: 'VG Kosh custom Azure endpoint is working perfectly!',
      configuration: {
        endpoint: endpoint,
        region: region,
        hasApiKey: !!apiKey
      },
      singleTest: {
        word: testWord,
        translation: translation
      },
      multipleTest: {
        words: multipleTranslations,
        success: multiResponse.ok
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Custom endpoint test failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Custom endpoint test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        endpoint: process.env.AZURE_TRANSLATOR_ENDPOINT,
        region: process.env.AZURE_TRANSLATOR_REGION
      },
      { status: 500 }
    )
  }
}
