/**
 * External Dictionary API Integration
 * Fetches word definitions from external sources and adds Hindi translations
 */

import { NextRequest, NextResponse } from 'next/server'
import { microsoftTranslator } from '@/lib/services/microsoft-translator'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Search query is required',
        words: []
      })
    }

    console.log('🌐 External dictionary search for:', query)

    // Fetch from DictionaryAPI.dev (free and reliable)
    const wordData = await fetchFromDictionaryAPI(query)

    if (!wordData) {
      return NextResponse.json({
        success: false,
        error: 'Word not found in dictionary',
        words: [],
        suggestions: [
          `Try "${query.toLowerCase()}"`,
          `Try "${query}s" (plural)`,
          `Try "${query}ing" (verb form)`,
          `Try "${query}ed" (past tense)`
        ]
      })
    }

    // Add Hindi translation using Microsoft Translator
    const hindiTranslation = await getHindiTranslationWithAzure(query.toLowerCase())

    // Create cultural context based on word type
    let culturalContext = `This word is commonly used in English and can be learned for vocabulary building.`
    if (hindiTranslation && !hindiTranslation.includes('अनुवाद उपलब्ध नहीं')) {
      culturalContext = `In Hindi, this word is expressed as "${hindiTranslation}". Understanding both English and Hindi meanings helps in bilingual communication.`
    }

    const formattedWord = {
      id: Date.now(),
      word: wordData.word,
      pronunciation: wordData.pronunciation,
      partOfSpeech: wordData.partOfSpeech,
      englishDefinition: wordData.definition,
      englishSynonyms: wordData.synonyms || [],
      englishAntonyms: wordData.antonyms || [],
      hindiTranslation: hindiTranslation,
      devanagariScript: transliterateToDevanagari(query),
      amarkoshaCategory: 'External Dictionary',
      semanticCluster: wordData.partOfSpeech,
      examples: wordData.examples || [],
      culturalContext: culturalContext,
      difficultyLevel: determineDifficulty(query),
      frequencyRank: 9999,
      audioUrl: wordData.audioUrl,
      source: 'external_api',
      isActive: true,
      createdAt: new Date().toISOString()
    }

    return NextResponse.json({
      success: true,
      words: [formattedWord],
      total: 1,
      query: query.trim(),
      searchType: 'external',
      source: 'Free Dictionary APIs'
    })

  } catch (error) {
    console.error('❌ External dictionary search failed:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'External search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        words: []
      },
      { status: 500 }
    )
  }
}

// Enhanced Free Dictionary API (dictionaryapi.dev)
async function fetchFromDictionaryAPI(word: string) {
  try {
    console.log(`🌐 Fetching from DictionaryAPI.dev: ${word}`)
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, {
      headers: {
        'User-Agent': 'VG-Kosh-Dictionary/1.0'
      }
    })

    if (!response.ok) {
      console.log(`❌ DictionaryAPI.dev response not ok: ${response.status}`)
      return null
    }

    const data = await response.json()
    console.log(`✅ DictionaryAPI.dev response:`, JSON.stringify(data, null, 2))

    if (!data || data.length === 0) {
      console.log('❌ No data returned from DictionaryAPI.dev')
      return null
    }

    const entry = data[0]

    // Get the best pronunciation
    let pronunciation = entry.phonetic
    if (!pronunciation && entry.phonetics && entry.phonetics.length > 0) {
      pronunciation = entry.phonetics.find((p: any) => p.text)?.text || entry.phonetics[0]?.text
    }

    // Get the first meaning with a definition
    let bestMeaning = null
    let bestDefinition = null

    if (entry.meanings && entry.meanings.length > 0) {
      for (const meaning of entry.meanings) {
        if (meaning.definitions && meaning.definitions.length > 0) {
          bestMeaning = meaning
          bestDefinition = meaning.definitions[0]
          break
        }
      }
    }

    if (!bestMeaning || !bestDefinition) {
      console.log('❌ No valid meaning/definition found')
      return null
    }

    // Get audio URL
    let audioUrl = null
    if (entry.phonetics && entry.phonetics.length > 0) {
      const audioPhonetic = entry.phonetics.find((p: any) => p.audio && p.audio.length > 0)
      if (audioPhonetic) {
        audioUrl = audioPhonetic.audio
      }
    }

    // Prepare examples
    const examples = []
    if (bestDefinition.example) {
      examples.push({
        english: bestDefinition.example,
        hindi: '' // Will be filled by translation function
      })
    }

    // Get synonyms if available
    const synonyms = bestMeaning.synonyms || []
    const antonyms = bestMeaning.antonyms || []

    const result = {
      word: entry.word || word,
      pronunciation: pronunciation || '',
      partOfSpeech: bestMeaning.partOfSpeech || 'unknown',
      definition: bestDefinition.definition || '',
      examples: examples,
      synonyms: synonyms.slice(0, 5), // Limit to 5 synonyms
      antonyms: antonyms.slice(0, 5), // Limit to 5 antonyms
      audioUrl: audioUrl
    }

    console.log(`✅ Processed word data:`, result)
    return result

  } catch (error) {
    console.error('❌ Dictionary API error:', error)
    return null
  }
}

// Wordnik API (requires API key - using mock for now)
async function fetchFromWordnikAPI(word: string) {
  try {
    // Mock implementation - you can add real Wordnik API key
    return null
  } catch (error) {
    return null
  }
}

// Merriam-Webster API (requires API key - using mock for now)
async function fetchFromMerriamWebsterAPI(word: string) {
  try {
    // Mock implementation - you can add real Merriam-Webster API key
    return null
  } catch (error) {
    return null
  }
}

// Enhanced Hindi translation using Microsoft Translator with fallback
async function getHindiTranslationWithAzure(word: string): Promise<string> {
  try {
    // First try Microsoft Translator for high-quality translation
    if (microsoftTranslator.isConfigured()) {
      console.log(`🌐 Using Microsoft Translator for: ${word}`)
      const result = await microsoftTranslator.translateToHindi(word)

      if (result.success) {
        console.log(`✅ Microsoft Translator result: ${word} → ${result.translatedText}`)
        return result.translatedText
      } else {
        console.warn(`⚠️ Microsoft Translator failed: ${result.error}`)
      }
    } else {
      console.log(`⚠️ Microsoft Translator not configured, using local mapping`)
    }

    // Fallback to local mapping
    return await getHindiTranslation(word)

  } catch (error) {
    console.error('❌ Translation error:', error)
    // Fallback to local mapping
    return await getHindiTranslation(word)
  }
}

// Comprehensive Hindi translation mapping for common words (fallback)
async function getHindiTranslation(word: string): Promise<string> {
  const commonTranslations: { [key: string]: string } = {
    // Basic words
    'the': 'वह',
    'be': 'होना',
    'to': 'को',
    'of': 'का',
    'and': 'और',
    'a': 'एक',
    'in': 'में',
    'that': 'वह',
    'have': 'होना',
    'i': 'मैं',
    'it': 'यह',
    'for': 'के लिए',
    'not': 'नहीं',
    'on': 'पर',
    'with': 'के साथ',
    'he': 'वह',
    'as': 'जैसा',
    'you': 'तुम',
    'do': 'करना',
    'at': 'पर',

    // Common nouns
    // Greetings and basic expressions
    'hello': 'नमस्ते',
    'goodbye': 'अलविदा',
    'thank': 'धन्यवाद',
    'thanks': 'धन्यवाद',
    'please': 'कृपया',
    'sorry': 'माफ करना',
    'excuse': 'माफ करना',
    'yes': 'हाँ',
    'no': 'नहीं',
    'okay': 'ठीक है',
    'welcome': 'स्वागत',

    // Basic adjectives
    'good': 'अच्छा',
    'bad': 'बुरा',
    'big': 'बड़ा',
    'small': 'छोटा',
    'large': 'बड़ा',
    'little': 'छोटा',
    'hot': 'गर्म',
    'cold': 'ठंडा',
    'warm': 'गर्म',
    'cool': 'ठंडा',
    'new': 'नया',
    'old': 'पुराना',
    'young': 'जवान',
    'fast': 'तेज़',
    'slow': 'धीमा',
    'high': 'ऊंचा',
    'low': 'नीचा',
    'long': 'लंबा',
    'short': 'छोटा',
    'wide': 'चौड़ा',
    'narrow': 'संकरा',
    'thick': 'मोटा',
    'thin': 'पतला',
    'heavy': 'भारी',
    'light': 'हल्का',
    'strong': 'मजबूत',
    'weak': 'कमजोर',
    'clean': 'साफ',
    'dirty': 'गंदा',
    'beautiful': 'सुंदर',
    'ugly': 'बदसूरत',
    'nice': 'अच्छा',
    'pretty': 'सुंदर',
    'handsome': 'सुंदर',
    'smart': 'चतुर',
    'stupid': 'मूर्ख',
    'clever': 'चतुर',
    'wise': 'बुद्धिमान',
    'foolish': 'मूर्ख',
    'rich': 'अमीर',
    'poor': 'गरीब',
    'expensive': 'महंगा',
    'cheap': 'सस्ता',
    'free': 'मुफ्त',
    'busy': 'व्यस्त',
    'lazy': 'आलसी',
    'tired': 'थका हुआ',
    'hungry': 'भूखा',
    'thirsty': 'प्यासा',
    'full': 'भरा हुआ',
    'empty': 'खाली',
    'open': 'खुला',
    'closed': 'बंद',
    'right': 'सही',
    'wrong': 'गलत',
    'true': 'सच',
    'false': 'झूठ',
    'real': 'असली',
    'fake': 'नकली',
    'easy': 'आसान',
    'difficult': 'कठिन',
    'hard': 'कठिन',
    'soft': 'नरम',
    'smooth': 'चिकना',
    'rough': 'खुरदरा',
    'sharp': 'तेज़',
    'dull': 'कुंद',
    'bright': 'चमकीला',
    'dark': 'अंधेरा',
    'loud': 'तेज़',
    'quiet': 'शांत',
    'silent': 'मौन',
    'noisy': 'शोर',
    'calm': 'शांत',
    'angry': 'गुस्सा',
    'happy': 'खुश',
    'sad': 'उदास',
    'excited': 'उत्साहित',
    'bored': 'ऊब',
    'worried': 'चिंतित',
    'scared': 'डरा हुआ',
    'brave': 'बहादुर',
    'afraid': 'डरा हुआ',
    'surprised': 'हैरान',
    'confused': 'भ्रमित',
    'sure': 'निश्चित',
    'certain': 'निश्चित',
    'possible': 'संभव',
    'impossible': 'असंभव',
    'necessary': 'आवश्यक',
    'important': 'महत्वपूर्ण',
    'special': 'विशेष',
    'normal': 'सामान्य',
    'strange': 'अजीब',
    'funny': 'मजेदार',
    'serious': 'गंभीर',
    'dangerous': 'खतरनाक',
    'safe': 'सुरक्षित',
    'healthy': 'स्वस्थ',
    'sick': 'बीमार',
    'dead': 'मृत',
    'alive': 'जीवित',
    'awake': 'जागा हुआ',
    'asleep': 'सोया हुआ',
    'water': 'पानी',
    'food': 'खाना',
    'house': 'घर',
    'school': 'स्कूल',
    'book': 'किताब',
    'pen': 'कलम',
    'paper': 'कागज',
    'computer': 'कंप्यूटर',
    'phone': 'फोन',
    'car': 'कार',
    'tree': 'पेड़',
    'flower': 'फूल',
    'sun': 'सूरज',
    'moon': 'चाँद',
    'star': 'तारा',
    'sky': 'आकाश',
    'earth': 'पृथ्वी',
    'fire': 'आग',
    'air': 'हवा',
    'time': 'समय',
    'day': 'दिन',
    'night': 'रात',
    'morning': 'सुबह',
    'evening': 'शाम',
    'work': 'काम',
    'play': 'खेल',
    'study': 'पढ़ाई',
    'read': 'पढ़ना',
    'write': 'लिखना',
    'speak': 'बोलना',
    'listen': 'सुनना',
    'see': 'देखना',
    'think': 'सोचना',
    'know': 'जानना',
    'understand': 'समझना',
    'learn': 'सीखना',
    'teach': 'सिखाना',
    'help': 'मदद',
    'give': 'देना',
    'take': 'लेना',
    'come': 'आना',
    'go': 'जाना',
    'run': 'दौड़ना',
    'walk': 'चलना',
    'sit': 'बैठना',
    'stand': 'खड़ा होना',
    'sleep': 'सोना',
    'eat': 'खाना',
    'drink': 'पीना',
    'happy': 'खुश',
    'sad': 'उदास',
    'angry': 'गुस्सा',
    'love': 'प्यार',
    'like': 'पसंद',
    'hate': 'नफरत',
    'family': 'परिवार',
    'mother': 'माँ',
    'father': 'पिता',
    'brother': 'भाई',
    'sister': 'बहन',
    'child': 'बच्चा',
    'man': 'आदमी',
    'woman': 'औरत',
    'boy': 'लड़का',
    'girl': 'लड़की',
    'friend': 'दोस्त',
    'teacher': 'शिक्षक',
    'student': 'छात्र',
    'doctor': 'डॉक्टर',
    'money': 'पैसा',
    'price': 'कीमत',
    'buy': 'खरीदना',
    'sell': 'बेचना',
    'market': 'बाजार',
    'shop': 'दुकान',
    'city': 'शहर',
    'village': 'गाँव',
    'country': 'देश',
    'world': 'दुनिया',
    'language': 'भाषा',
    'english': 'अंग्रेजी',
    'hindi': 'हिंदी',
    'india': 'भारत',
    'culture': 'संस्कृति',
    'tradition': 'परंपरा',
    'festival': 'त्योहार',
    'religion': 'धर्म',
    'god': 'भगवान',
    'temple': 'मंदिर',
    'prayer': 'प्रार्थना',
    'music': 'संगीत',
    'dance': 'नृत्य',
    'art': 'कला',
    'color': 'रंग',
    'red': 'लाल',
    'blue': 'नीला',
    'green': 'हरा',
    'yellow': 'पीला',
    'white': 'सफेद',
    'black': 'काला'
  }

  const lowerWord = word.toLowerCase()
  return commonTranslations[lowerWord] || `${word} (अनुवाद उपलब्ध नहीं)`
}

// Simple transliteration to Devanagari (basic implementation)
function transliterateToDevanagari(word: string): string {
  // This is a very basic implementation
  // For production, use a proper transliteration library
  const transliterationMap: { [key: string]: string } = {
    'a': 'अ', 'b': 'ब', 'c': 'क', 'd': 'द', 'e': 'ए',
    'f': 'फ', 'g': 'ग', 'h': 'ह', 'i': 'इ', 'j': 'ज',
    'k': 'क', 'l': 'ल', 'm': 'म', 'n': 'न', 'o': 'ओ',
    'p': 'प', 'q': 'क', 'r': 'र', 's': 'स', 't': 'त',
    'u': 'उ', 'v': 'व', 'w': 'व', 'x': 'क्स', 'y': 'य', 'z': 'ज'
  }
  
  return word.toLowerCase().split('').map(char => transliterationMap[char] || char).join('')
}

// Determine difficulty based on word length and complexity
function determineDifficulty(word: string): 'beginner' | 'intermediate' | 'advanced' {
  if (word.length <= 4)
  return 'beginner'
  if (word.length <= 8)
  return 'intermediate'
  return 'advanced'
}
