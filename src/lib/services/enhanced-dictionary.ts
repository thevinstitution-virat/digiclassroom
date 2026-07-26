/**
 * Enhanced Dictionary Service
 * Provides comprehensive word information using multiple free APIs
 */

import { microsoftTranslator } from './microsoft-translator'

interface EnhancedWordData {
  word: string
  pronunciation: {
    ipa: string
    audio?: string
    syllables: string[]
    syllableCount: number
  }
  meanings: {
    partOfSpeech: string
    definition: string
    example?: string
  }[]
  translations: {
    hindi: string
    romanized: string
    alternates: string[]
  }
  synonyms: {
    english: string[]
    hindi: string[]
  }
  antonyms: {
    english: string[]
    hindi: string[]
  }
  indianContext: {
    explanation: string
    examples: string[]
    culturalNotes: string
  }
  etymology?: {
    origin: string
    rootWord: string
    language: string
    historicalDevelopment: string
    firstKnownUse?: string
    relatedWords?: string[]
  }
  proverbs?: {
    english: {
      proverb: string
      meaning: string
      usage: string
    }[]
    hindi: {
      proverb: string
      meaning: string
      romanized: string
    }[]
    idioms: {
      phrase: string
      meaning: string
      example: string
    }[]
  }
  frequency?: string
  difficulty?: string
}

export class EnhancedDictionaryService {
  
  /**
   * Get comprehensive word information
   */
  async getEnhancedWordData(word: string): Promise<EnhancedWordData | null> {
    try {
      console.log(`🔍 Getting enhanced data for: ${word}`)

      // Fetch from multiple sources in parallel
      const [dictionaryData, wordsApiData, hindiTranslation] = await Promise.allSettled([
        this.fetchFromDictionaryAPI(word),
        this.fetchFromWordsAPI(word),
        microsoftTranslator.translateToHindi(word)
      ])

      // Process dictionary data
      const dictData = dictionaryData.status === 'fulfilled' ? dictionaryData.value : null
      const wordsData = wordsApiData.status === 'fulfilled' ? wordsApiData.value : null
      const translation = hindiTranslation.status === 'fulfilled' ? hindiTranslation.value : null

      if (!dictData) {
        console.log('❌ No dictionary data found')
        return null
      }

      // Build enhanced word data
      const enhancedData: EnhancedWordData = {
        word: dictData.word,
        pronunciation: {
          ipa: dictData.phonetic || '',
          audio: dictData.audioUrl,
          syllables: this.breakIntoSyllables(word),
          syllableCount: this.countSyllables(word)
        },
        meanings: dictData.meanings || [],
        translations: {
          hindi: translation?.translatedText || `${word} (अनुवाद उपलब्ध नहीं)`,
          romanized: this.romanizeHindi(translation?.translatedText || ''),
          alternates: this.getAlternateTranslations(word)
        },
        synonyms: {
          english: dictData.synonyms || [],
          hindi: this.getHindiSynonyms(word)
        },
        antonyms: {
          english: dictData.antonyms || [],
          hindi: this.getHindiAntonyms(word)
        },
        indianContext: {
          explanation: this.generateIndianExplanation(word, dictData.meanings?.[0]?.definition || ''),
          examples: this.generateIndianExamples(word),
          culturalNotes: this.getCulturalNotes(word)
        },
        etymology: this.getDetailedEtymology(word, dictData),
        proverbs: this.getProverbsAndIdioms(word),
        frequency: wordsData?.frequency || 'common',
        difficulty: this.determineDifficulty(word)
      }

      console.log(`✅ Enhanced data generated for: ${word}`)
      return enhancedData

    } catch (error) {
      console.error('❌ Enhanced dictionary error:', error)
      return null
    }
  }

  /**
   * Fetch from DictionaryAPI.dev with enhanced processing
   */
  private async fetchFromDictionaryAPI(word: string) {
    try {
      const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
      if (!response.ok)
  return null

      const data = await response.json()
      if (!data || data.length === 0)
  return null

      const entry = data[0]
      
      // Process all meanings
      const meanings = []
      if (entry.meanings) {
        for (const meaning of entry.meanings) {
          if (meaning.definitions) {
            for (const def of meaning.definitions) {
              meanings.push({
                partOfSpeech: meaning.partOfSpeech,
                definition: def.definition,
                example: def.example
              })
            }
          }
        }
      }

      // Get synonyms and antonyms
      const synonyms = new Set<string>()
      const antonyms = new Set<string>()
      
      entry.meanings?.forEach((meaning: any) => {
        meaning.synonyms?.forEach((syn: string) => synonyms.add(syn))
        meaning.antonyms?.forEach((ant: string) => antonyms.add(ant))
      })

      return {
        word: entry.word,
        phonetic: entry.phonetic || entry.phonetics?.[0]?.text,
        audioUrl: entry.phonetics?.find((p: any) => p.audio)?.audio,
        meanings: meanings,
        synonyms: Array.from(synonyms).slice(0, 8),
        antonyms: Array.from(antonyms).slice(0, 8)
      }

    } catch (error) {
      console.error('Dictionary API error:', error)
      return null
    }
  }

  /**
   * Fetch from Words API (free tier)
   */
  private async fetchFromWordsAPI(word: string) {
    try {
      // Note: This would require API key for full access
      // For now, return mock data based on word characteristics
      return {
        frequency: this.estimateFrequency(word),
        syllables: this.breakIntoSyllables(word)
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Break word into syllables using algorithmic approach
   */
  private breakIntoSyllables(word: string): string[] {
    // Simple syllable breaking algorithm
    const vowels = 'aeiouy'
    const syllables: string[] = []
    let currentSyllable = ''
    
    for (let i = 0; i < word.length; i++) {
      const char = word[i].toLowerCase()
      currentSyllable += word[i]
      
      if (vowels.includes(char)) {
        // Look ahead for consonant clusters
        let nextVowelIndex = -1
        for (let j = i + 1; j < word.length; j++) {
          if (vowels.includes(word[j].toLowerCase())) {
            nextVowelIndex = j
            break
          }
        }
        
        if (nextVowelIndex > i + 1) {
          // Add consonants before next vowel
          const consonantCount = nextVowelIndex - i - 1
          if (consonantCount === 1) {
            syllables.push(currentSyllable)
            currentSyllable = ''
          } else if (consonantCount > 1) {
            currentSyllable += word[i + 1]
            syllables.push(currentSyllable)
            currentSyllable = ''
            i++
          }
        }
      }
    }
    
    if (currentSyllable) {
      syllables.push(currentSyllable)
    }
    
    return syllables.length > 0 ? syllables : [word]
  }

  /**
   * Count syllables in a word
   */
  private countSyllables(word: string): number {
    return this.breakIntoSyllables(word).length
  }

  /**
   * Romanize Hindi text for pronunciation help
   */
  private romanizeHindi(hindi: string): string {
    const romanizationMap: { [key: string]: string } = {
      'जनादेश': 'janadesh',
      'आदेश': 'aadesh',
      'निर्देश': 'nirdesh',
      'हुक्म': 'hukm',
      'निषेध': 'nishedh',
      'मनाही': 'manahi'
    }
    
    return romanizationMap[hindi] || hindi
  }

  /**
   * Get alternate Hindi translations
   */
  private getAlternateTranslations(word: string): string[] {
    const alternates: { [key: string]: string[] } = {
      'mandate': ['आदेश', 'निर्देश', 'हुक्म', 'अधिकार'],
      'beautiful': ['सुंदर', 'खूबसूरत', 'मनोहर', 'रूपवान'],
      'knowledge': ['ज्ञान', 'विद्या', 'बोध', 'जानकारी'],
      'computer': ['कंप्यूटर', 'संगणक', 'गणक यंत्र']
    }
    
    return alternates[word.toLowerCase()] || []
  }

  /**
   * Get Hindi synonyms
   */
  private getHindiSynonyms(word: string): string[] {
    const synonyms: { [key: string]: string[] } = {
      'mandate': ['आदेश', 'निर्देश', 'हुक्म'],
      'beautiful': ['सुंदर', 'खूबसूरत', 'मनोहर'],
      'knowledge': ['ज्ञान', 'विद्या', 'बोध']
    }
    
    return synonyms[word.toLowerCase()] || []
  }

  /**
   * Get Hindi antonyms
   */
  private getHindiAntonyms(word: string): string[] {
    const antonyms: { [key: string]: string[] } = {
      'mandate': ['निषेध', 'मनाही'],
      'beautiful': ['बदसूरत', 'कुरूप'],
      'knowledge': ['अज्ञान', 'अविद्या']
    }
    
    return antonyms[word.toLowerCase()] || []
  }

  /**
   * Generate Indian context explanation
   */
  private generateIndianExplanation(word: string, definition: string): string {
    const contextMap: { [key: string]: string } = {
      'mandate': 'A mandate represents the authority granted to a government or official by the people through elections. In Indian democracy, when a political party wins elections, they receive a "mandate" from the people to govern and implement their policies.',
      'democracy': 'Democracy in India is the world\'s largest democratic system, where people elect their representatives through free and fair elections.',
      'constitution': 'The Indian Constitution is the supreme law of India, drafted by Dr. B.R. Ambedkar and adopted on 26th January 1950.'
    }
    
    return contextMap[word.toLowerCase()] || `This word is commonly used in Indian English and can be understood in the context of ${definition.toLowerCase()}`
  }

  /**
   * Generate Indian context examples
   */
  private generateIndianExamples(word: string): string[] {
    const examples: { [key: string]: string[] } = {
      'mandate': [
        'The BJP received a strong mandate from the Indian voters in the 2019 Lok Sabha elections, allowing them to form the government with a clear majority.',
        'The Supreme Court\'s mandate to implement the Right to Education Act has transformed the educational landscape across rural India.'
      ],
      'democracy': [
        'India\'s democracy has successfully conducted 17 Lok Sabha elections since independence in 1947.',
        'The village panchayat system represents grassroots democracy in rural India.'
      ]
    }
    
    return examples[word.toLowerCase()] || [
      `The word "${word}" is frequently used in Indian academic and professional contexts.`,
      `Understanding "${word}" is important for students preparing for competitive exams in India.`
    ]
  }

  /**
   * Get cultural notes
   */
  private getCulturalNotes(word: string): string {
    const notes: { [key: string]: string } = {
      'mandate': 'In Indian politics, "mandate" (जनादेश) is frequently used during election discussions, representing the people\'s will and democratic choice.',
      'democracy': 'India follows the Westminster model of democracy with adaptations suitable for its diverse population.',
      'constitution': 'The Indian Constitution is one of the longest written constitutions in the world.'
    }
    
    return notes[word.toLowerCase()] || `This word has significance in Indian English usage and academic contexts.`
  }

  /**
   * Estimate word frequency
   */
  private estimateFrequency(word: string): string {
    const commonWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at']
    const uncommonWords = ['serendipity', 'ubiquitous', 'ephemeral', 'mandate', 'vicarious']
    
    if (commonWords.includes(word.toLowerCase()))
  return 'very common'
    if (uncommonWords.includes(word.toLowerCase()))
  return 'uncommon'
    if (word.length > 8)
  return 'rare'
    return 'common'
  }

  /**
   * Determine difficulty level
   */
  private determineDifficulty(word: string): string {
    if (word.length <= 4)
  return 'easy'
    if (word.length <= 7)
  return 'medium'
    return 'hard'
  }

  /**
   * Get detailed etymology information
   */
  private getDetailedEtymology(word: string, dictData: any): {
    origin: string
    rootWord: string
    language: string
    historicalDevelopment: string
    firstKnownUse?: string
    relatedWords?: string[]
  } {
    // Etymology database for common words
    const etymologyData: { [key: string]: any } = {
      'serendipity': {
        origin: 'Coined by Horace Walpole in 1754',
        rootWord: 'Serendip (old name for Sri Lanka)',
        language: 'Persian/Arabic',
        historicalDevelopment: 'From the Persian fairy tale "The Three Princes of Serendip" who made fortunate discoveries by accident. The word evolved from describing accidental discoveries to any pleasant surprise.',
        firstKnownUse: '1754',
        relatedWords: ['serendipitous', 'serendipitously', 'chance', 'fortune']
      },
      'chauvinist': {
        origin: 'Named after Nicolas Chauvin, a French soldier',
        rootWord: 'Chauvin (French surname)',
        language: 'French',
        historicalDevelopment: 'Originally referred to excessive patriotism after Nicolas Chauvin, a soldier devoted to Napoleon. Later expanded to mean excessive devotion to any cause, especially male chauvinism.',
        firstKnownUse: '1870',
        relatedWords: ['chauvinism', 'chauvinistic', 'patriot', 'nationalist']
      },
      'democracy': {
        origin: 'Ancient Greek political concept',
        rootWord: 'demokratia (δημοκρατία)',
        language: 'Greek',
        historicalDevelopment: 'From Greek "demos" (people) + "kratos" (power/rule). First practiced in ancient Athens around 5th century BCE. Modern democratic systems evolved through various historical movements.',
        firstKnownUse: '1570s',
        relatedWords: ['democratic', 'democrat', 'democratize', 'demos']
      },
      'education': {
        origin: 'Latin educational practices',
        rootWord: 'educatus (past participle of educare)',
        language: 'Latin',
        historicalDevelopment: 'From Latin "educare" meaning "to bring up, rear, educate" and "educere" meaning "to lead out". The concept evolved from basic training to comprehensive intellectual development.',
        firstKnownUse: '1530s',
        relatedWords: ['educate', 'educator', 'educational', 'erudite']
      },
      'knowledge': {
        origin: 'Old English philosophical concept',
        rootWord: 'cnawan (to know)',
        language: 'Old English/Germanic',
        historicalDevelopment: 'From Old English "cnawan" (to know) + "-ledge" (action/process). Evolved from simple awareness to complex understanding and wisdom.',
        firstKnownUse: '1300s',
        relatedWords: ['know', 'acknowledge', 'knowledgeable', 'cognition']
      }
    }

    const wordLower = word.toLowerCase()
    if (etymologyData[wordLower]) {
      return etymologyData[wordLower]
    }

    // Generate basic etymology for unknown words
    return {
      origin: `Etymology information for "${word}" is being researched`,
      rootWord: word,
      language: 'Unknown',
      historicalDevelopment: `The word "${word}" has evolved through various linguistic influences over time. Its current meaning and usage reflect modern English development.`,
      firstKnownUse: 'Unknown',
      relatedWords: this.generateRelatedWords(word)
    }
  }

  /**
   * Get proverbs and idioms containing the word
   */
  private getProverbsAndIdioms(word: string): {
    english: { proverb: string; meaning: string; usage: string }[]
    hindi: { proverb: string; meaning: string; romanized: string }[]
    idioms: { phrase: string; meaning: string; example: string }[]
  } {
    const proverbsData: { [key: string]: any } = {
      'knowledge': {
        english: [
          {
            proverb: 'Knowledge is power',
            meaning: 'Having information and understanding gives you strength and advantage',
            usage: 'Used to emphasize the importance of education and learning'
          },
          {
            proverb: 'A little knowledge is a dangerous thing',
            meaning: 'Having incomplete information can lead to poor decisions',
            usage: 'Warning against overconfidence with limited understanding'
          }
        ],
        hindi: [
          {
            proverb: 'ज्ञान ही शक्ति है',
            meaning: 'Knowledge itself is power',
            romanized: 'Gyaan hi shakti hai'
          },
          {
            proverb: 'विद्या धन सबसे बड़ा धन',
            meaning: 'Knowledge is the greatest wealth',
            romanized: 'Vidya dhan sabse bada dhan'
          }
        ],
        idioms: [
          {
            phrase: 'knowledge at your fingertips',
            meaning: 'Information that is easily accessible',
            example: 'With smartphones, we have knowledge at our fingertips'
          }
        ]
      },
      'water': {
        english: [
          {
            proverb: 'Still waters run deep',
            meaning: 'Quiet people often have profound thoughts',
            usage: 'Used to describe someone who appears calm but is very thoughtful'
          },
          {
            proverb: 'You can lead a horse to water, but you cannot make it drink',
            meaning: 'You can provide opportunities but cannot force someone to take advantage',
            usage: 'About providing help that may not be accepted'
          }
        ],
        hindi: [
          {
            proverb: 'बूंद बूंद से सागर भरता है',
            meaning: 'Drop by drop fills the ocean',
            romanized: 'Boond boond se sagar bharta hai'
          }
        ],
        idioms: [
          {
            phrase: 'water under the bridge',
            meaning: 'Something that happened in the past and is no longer important',
            example: 'Our argument is water under the bridge now'
          }
        ]
      },
      'book': {
        english: [
          {
            proverb: 'Don\'t judge a book by its cover',
            meaning: 'Don\'t form opinions based on appearance alone',
            usage: 'Encouraging people to look beyond surface appearances'
          }
        ],
        hindi: [
          {
            proverb: 'किताब सबसे अच्छा दोस्त',
            meaning: 'Books are the best friends',
            romanized: 'Kitaab sabse accha dost'
          }
        ],
        idioms: [
          {
            phrase: 'by the book',
            meaning: 'Following rules exactly',
            example: 'The manager always does everything by the book'
          }
        ]
      }
    }

    const wordLower = word.toLowerCase()
    if (proverbsData[wordLower]) {
      return proverbsData[wordLower]
    }

    // Return empty arrays for words without specific proverbs
    return {
      english: [],
      hindi: [],
      idioms: []
    }
  }

  /**
   * Generate related words for etymology
   */
  private generateRelatedWords(word: string): string[] {
    const relatedWordsMap: { [key: string]: string[] } = {
      'student': ['study', 'studious', 'academic', 'scholar'],
      'teacher': ['teach', 'instruction', 'educator', 'mentor'],
      'school': ['education', 'academic', 'learning', 'institution'],
      'learning': ['learn', 'knowledge', 'education', 'study'],
      'dictionary': ['definition', 'vocabulary', 'lexicon', 'reference']
    }

    return relatedWordsMap[word.toLowerCase()] || []
  }
}

// Export singleton instance
export const enhancedDictionary = new EnhancedDictionaryService()
