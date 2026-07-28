/**
 * Offline Dictionary Service
 * Manages offline functionality for dictionary features
 */

interface OfflineDictionaryWord {
  word: string
  pronunciation?: string
  partOfSpeech?: string
  englishDefinition: string
  hindiTranslation?: string
  devanagariScript?: string
  difficultyLevel?: string
  frequencyRank?: number
  audioUrl?: string
  cached: boolean
  timestamp: number
}

interface OfflineSearchResult {
  success: boolean
  words: OfflineDictionaryWord[]
  total: number
  query: string
  source: string
  offline: boolean
  error?: string
}

interface DictionaryStats {
  cachedWords: number
  searchHistory: number
  favorites: number
  lastUpdated: string
  error?: string
}

class OfflineDictionaryService {
  private static instance: OfflineDictionaryService
  private serviceWorkerReady: boolean = false

  private constructor() {
    this.initializeServiceWorker()
  }

  static getInstance(): OfflineDictionaryService {
    if (!OfflineDictionaryService.instance) {
      OfflineDictionaryService.instance = new OfflineDictionaryService()
    }
    return OfflineDictionaryService.instance
  }

  /**
   * Initialize service worker for offline functionality
   */
  private async initializeServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('✅ Service Worker registered:', registration.scope)
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready
        this.serviceWorkerReady = true
        
        // Listen for service worker updates
        registration.addEventListener('updatefound', () => {
          console.log('🔄 Service Worker update found')
        })
        
        console.log('✅ Offline Dictionary Service initialized')
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error)
      }
    } else {
      console.warn('⚠️ Service Worker not supported')
    }
  }

  /**
   * Cache common English words for offline access
   */
  async cacheCommonWords(): Promise<void> {
    if (!this.serviceWorkerReady) {
      console.warn('⚠️ Service Worker not ready')
      return
    }

    try {
      // Common English words dataset (top 10,000 words)
      const commonWords = await this.getCommonWordsDataset()
      
      if (commonWords.length > 0) {
        await this.sendMessageToServiceWorker('CACHE_DICTIONARY_WORDS', { words: commonWords })
        console.log(`✅ Cached ${commonWords.length} common words for offline access`)
      }
    } catch (error) {
      console.error('❌ Failed to cache common words:', error)
    }
  }

  /**
   * Get common words dataset
   */
  private async getCommonWordsDataset(): Promise<OfflineDictionaryWord[]> {
    // This would typically fetch from a curated dataset
    // For now, return a sample of essential words
    const essentialWords: OfflineDictionaryWord[] = [
      {
        word: 'hello',
        pronunciation: '/həˈloʊ/',
        partOfSpeech: 'interjection',
        englishDefinition: 'Used as a greeting or to begin a phone conversation',
        hindiTranslation: 'नमस्ते',
        devanagariScript: 'नमस्ते',
        difficultyLevel: 'easy',
        frequencyRank: 1,
        cached: true,
        timestamp: Date.now()
      },
      {
        word: 'education',
        pronunciation: '/ˌɛdʒʊˈkeɪʃən/',
        partOfSpeech: 'noun',
        englishDefinition: 'The process of receiving or giving systematic instruction',
        hindiTranslation: 'शिक्षा',
        devanagariScript: 'शिक्षा',
        difficultyLevel: 'medium',
        frequencyRank: 2,
        cached: true,
        timestamp: Date.now()
      },
      {
        word: 'knowledge',
        pronunciation: '/ˈnɑlɪdʒ/',
        partOfSpeech: 'noun',
        englishDefinition: 'Facts, information, and skills acquired through experience or education',
        hindiTranslation: 'ज्ञान',
        devanagariScript: 'ज्ञान',
        difficultyLevel: 'medium',
        frequencyRank: 3,
        cached: true,
        timestamp: Date.now()
      },
      {
        word: 'student',
        pronunciation: '/ˈstudənt/',
        partOfSpeech: 'noun',
        englishDefinition: 'A person who is studying at a school or college',
        hindiTranslation: 'छात्र',
        devanagariScript: 'छात्र',
        difficultyLevel: 'easy',
        frequencyRank: 4,
        cached: true,
        timestamp: Date.now()
      },
      {
        word: 'teacher',
        pronunciation: '/ˈtitʃər/',
        partOfSpeech: 'noun',
        englishDefinition: 'A person who teaches, especially in a school',
        hindiTranslation: 'शिक्षक',
        devanagariScript: 'शिक्षक',
        difficultyLevel: 'easy',
        frequencyRank: 5,
        cached: true,
        timestamp: Date.now()
      }
    ]

    // In a real implementation, this would fetch from a comprehensive dataset
    // For now, we'll expand this with more common words
    const expandedWords = [...essentialWords]
    
    // Add more common words programmatically
    const additionalWords = [
      'book', 'read', 'write', 'learn', 'study', 'school', 'class', 'lesson',
      'homework', 'exam', 'test', 'grade', 'subject', 'mathematics', 'science',
      'history', 'english', 'language', 'dictionary', 'vocabulary', 'grammar',
      'pronunciation', 'meaning', 'definition', 'translation', 'word', 'sentence'
    ]

    additionalWords.forEach((word, index) => {
      expandedWords.push({
        word: word,
        partOfSpeech: 'noun',
        englishDefinition: `Definition for ${word}`,
        hindiTranslation: `${word} का हिंदी अनुवाद`,
        difficultyLevel: 'medium',
        frequencyRank: index + 6,
        cached: true,
        timestamp: Date.now()
      })
    })

    return expandedWords
  }

  /**
   * Search for words offline
   */
  async searchOffline(query: string): Promise<OfflineSearchResult> {
    if (!this.serviceWorkerReady) {
      return {
        success: false,
        words: [],
        total: 0,
        query,
        source: 'offline_unavailable',
        offline: true,
        error: 'Service Worker not ready'
      }
    }

    try {
      const result = await this.sendMessageToServiceWorker('SEARCH_OFFLINE_WORDS', { query })
      return result.results || {
        success: false,
        words: [],
        total: 0,
        query,
        source: 'offline_error',
        offline: true,
        error: 'Search failed'
      }
    } catch (error) {
      console.error('❌ Offline search failed:', error)
      return {
        success: false,
        words: [],
        total: 0,
        query,
        source: 'offline_error',
        offline: true,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get dictionary statistics
   */
  async getDictionaryStats(): Promise<DictionaryStats> {
    if (!this.serviceWorkerReady) {
      return {
        cachedWords: 0,
        searchHistory: 0,
        favorites: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Service Worker not ready'
      }
    }

    try {
      const result = await this.sendMessageToServiceWorker('GET_DICTIONARY_STATS')
      return result.stats || {
        cachedWords: 0,
        searchHistory: 0,
        favorites: 0,
        lastUpdated: new Date().toISOString(),
        error: 'Failed to get stats'
      }
    } catch (error) {
      console.error('❌ Failed to get dictionary stats:', error)
      return {
        cachedWords: 0,
        searchHistory: 0,
        favorites: 0,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Check if offline functionality is available
   */
  isOfflineAvailable(): boolean {
    return this.serviceWorkerReady && 'serviceWorker' in navigator
  }

  /**
   * Send message to service worker
   */
  private async sendMessageToServiceWorker(type: string, data?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No service worker controller'))
        return
      }

      const messageChannel = new MessageChannel()
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data)
      }

        // @ts-ignore
      messageChannel.port1.onerror = (error) => {
        reject(error)
      }

      navigator.serviceWorker.controller.postMessage(
        { type, data },
        [messageChannel.port2]
      )
    })
  }

  /**
   * Initialize offline caching on first visit
   */
  async initializeOfflineCache(): Promise<void> {
    try {
      const stats = await this.getDictionaryStats()
      
      if (stats.cachedWords === 0) {
        console.log('🔄 Initializing offline dictionary cache...')
        await this.cacheCommonWords()
        console.log('✅ Offline dictionary cache initialized')
      } else {
        console.log(`✅ Offline cache ready: ${stats.cachedWords} words available`)
      }
    } catch (error) {
      console.error('❌ Failed to initialize offline cache:', error)
    }
  }
}

export default OfflineDictionaryService
