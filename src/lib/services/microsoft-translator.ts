/**
 * Microsoft Translator Service (Azure Cognitive Services)
 * Provides high-quality English to Hindi translations
 */

interface TranslationResponse {
  translations: Array<{
    text: string
    to: string
  }>
}

interface TranslationResult {
  success: boolean
  translatedText: string
  originalText: string
  error?: string
}

export class MicrosoftTranslatorService {
  private apiKey: string
  private endpoint: string
  private region: string

  constructor() {
    this.apiKey = process.env.AZURE_TRANSLATOR_KEY || ''
    this.endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://vg-kosh.cognitiveservices.azure.com'
    this.region = process.env.AZURE_TRANSLATOR_REGION || 'global'
  }

  /**
   * Translate text from English to Hindi
   */
  async translateToHindi(text: string): Promise<TranslationResult> {
    try {
      if (!this.apiKey) {
        console.warn('⚠️ Microsoft Translator API key not configured')
        return {
          success: false,
          translatedText: `${text} (अनुवाद सेवा उपलब्ध नहीं)`,
          originalText: text,
          error: 'API key not configured'
        }
      }

      console.log(`🌐 Translating to Hindi: "${text}"`)

      // Use the correct path for custom Azure endpoints
      const translateUrl = this.endpoint.includes('cognitiveservices.azure.com')
        ? `${this.endpoint}/translator/text/v3.0/translate?api-version=3.0&to=hi`
        : `${this.endpoint}/translate?api-version=3.0&to=hi`

      console.log(`🔗 Using translate URL: ${translateUrl}`)

      const response = await fetch(translateUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Ocp-Apim-Subscription-Region': this.region,
          'Content-Type': 'application/json',
          'User-Agent': 'VG-Kosh-Dictionary/1.0'
        },
        body: JSON.stringify([{
          text: text
        }])
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Microsoft Translator API error: ${response.status} - ${errorText}`)
        
        return {
          success: false,
          translatedText: `${text} (अनुवाद त्रुटि)`,
          originalText: text,
          error: `API error: ${response.status}`
        }
      }

      const data: TranslationResponse[] = await response.json()
      
      if (!data || data.length === 0 || !data[0].translations || data[0].translations.length === 0) {
        console.error('❌ No translation data received')
        return {
          success: false,
          translatedText: `${text} (अनुवाद उपलब्ध नहीं)`,
          originalText: text,
          error: 'No translation data'
        }
      }

      const translatedText = data[0].translations[0].text
      console.log(`✅ Translation successful: "${text}" → "${translatedText}"`)

      return {
        success: true,
        translatedText: translatedText,
        originalText: text
      }

    } catch (error) {
      console.error('❌ Microsoft Translator service error:', error)
      return {
        success: false,
        translatedText: `${text} (अनुवाद त्रुटि)`,
        originalText: text,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Translate multiple words/phrases at once
   */
  async translateMultiple(texts: string[]): Promise<TranslationResult[]> {
    try {
      if (!this.apiKey) {
        return texts.map(text => ({
          success: false,
          translatedText: `${text} (अनुवाद सेवा उपलब्ध नहीं)`,
          originalText: text,
          error: 'API key not configured'
        }))
      }

      console.log(`🌐 Translating ${texts.length} texts to Hindi`)

      // Use the correct path for custom Azure endpoints
      const translateUrl = this.endpoint.includes('cognitiveservices.azure.com')
        ? `${this.endpoint}/translator/text/v3.0/translate?api-version=3.0&to=hi`
        : `${this.endpoint}/translate?api-version=3.0&to=hi`

      console.log(`🔗 Using translate URL: ${translateUrl}`)

      const response = await fetch(translateUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Ocp-Apim-Subscription-Region': this.region,
          'Content-Type': 'application/json',
          'User-Agent': 'VG-Kosh-Dictionary/1.0'
        },
        body: JSON.stringify(texts.map(text => ({ text })))
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ Microsoft Translator API error: ${response.status} - ${errorText}`)
        
        return texts.map(text => ({
          success: false,
          translatedText: `${text} (अनुवाद त्रुटि)`,
          originalText: text,
          error: `API error: ${response.status}`
        }))
      }

      const data: TranslationResponse[] = await response.json()
      
      return texts.map((text, index) => {
        const translationData = data[index]
        if (translationData && translationData.translations && translationData.translations.length > 0) {
          const translatedText = translationData.translations[0].text
          console.log(`✅ Translation ${index + 1}: "${text}" → "${translatedText}"`)
          
          return {
            success: true,
            translatedText: translatedText,
            originalText: text
          }
        } else {
          return {
            success: false,
            translatedText: `${text} (अनुवाद उपलब्ध नहीं)`,
            originalText: text,
            error: 'No translation data'
          }
        }
      })

    } catch (error) {
      console.error('❌ Microsoft Translator service error:', error)
      return texts.map(text => ({
        success: false,
        translatedText: `${text} (अनुवाद त्रुटि)`,
        originalText: text,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }

  /**
   * Test the translation service
   */
  async testConnection(): Promise<{ success: boolean; message: string; sampleTranslation?: string }> {
    try {
      const testResult = await this.translateToHindi('hello')
      
      if (testResult.success) {
        return {
          success: true,
          message: 'Microsoft Translator service is working correctly',
          sampleTranslation: `"hello" → "${testResult.translatedText}"`
        }
      } else {
        return {
          success: false,
          message: `Translation service test failed: ${testResult.error}`
        }
      }
    } catch (error) {
      return {
        success: false,
        message: `Translation service test error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.endpoint)
  }

  /**
   * Get service configuration status
   */
  getConfigStatus(): { configured: boolean; endpoint: string; hasApiKey: boolean; region: string } {
    return {
      configured: this.isConfigured(),
      endpoint: this.endpoint,
      hasApiKey: !!this.apiKey,
      region: this.region
    }
  }
}

// Export singleton instance
export const microsoftTranslator = new MicrosoftTranslatorService()

// Helper function for easy translation
export async function translateToHindi(text: string): Promise<string> {
  const result = await microsoftTranslator.translateToHindi(text)
  return result.translatedText
}

// Helper function for multiple translations
export async function translateMultipleToHindi(texts: string[]): Promise<string[]> {
  const results = await microsoftTranslator.translateMultiple(texts)
  return results.map(result => result.translatedText)
}
