/**
 * Dictionary Cache Service
 * Manages intelligent caching for search results and user search history
 * Phase 1 Feature 4: Basic Caching System
 */

export interface CachedSearchResult {
  word: string
  pronunciation?: string
  partOfSpeech?: string
  englishDefinition: string
  hindiTranslation?: string
  devanagariScript?: string
  difficultyLevel?: string
  frequencyRank?: number
  audioUrl?: string
  source: 'local' | 'external_api' | 'offline_cache' | 'translator'
  timestamp: number
  hitCount: number
  lastAccessed: number
}

export interface SearchHistoryEntry {
  id: string
  query: string
  timestamp: number
  resultsFound: number
  source: string
  userId?: string
  sessionId: string
}

export interface CacheStats {
  totalCachedResults: number
  totalSearchHistory: number
  cacheHitRate: number
  mostSearchedWords: string[]
  recentSearches: string[]
  cacheSize: number
  lastCleanup: number
}

export class DictionaryCacheService {
  private static readonly SEARCH_RESULTS_KEY = 'vg_kosh_search_cache'
  private static readonly SEARCH_HISTORY_KEY = 'vg_kosh_search_history'
  private static readonly CACHE_STATS_KEY = 'vg_kosh_cache_stats'
  private static readonly SESSION_SEARCHES_KEY = 'vg_kosh_session_searches'
  
  // Cache configuration
  private static readonly MAX_CACHE_SIZE = 500 // Maximum cached search results
  private static readonly MAX_HISTORY_SIZE = 1000 // Maximum search history entries
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
  
  private static sessionId: string = this.generateSessionId()

  /**
   * Generate unique session ID
   */
  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Cache search result in localStorage
   */
  static cacheSearchResult(query: string, results: any[]): void {
    if (typeof window === 'undefined') return

    try {
      const cached = this.getCachedResults()
      const timestamp = Date.now()

      // Process each result
      results.forEach(result => {
        const cacheKey = result.word.toLowerCase()
        const cachedResult: CachedSearchResult = {
          word: result.word,
          pronunciation: result.pronunciation,
          partOfSpeech: result.partOfSpeech,
          englishDefinition: result.englishDefinition,
          hindiTranslation: result.hindiTranslation,
          devanagariScript: result.devanagariScript,
          difficultyLevel: result.difficultyLevel,
          frequencyRank: result.frequencyRank,
          audioUrl: result.audioUrl,
          source: result.source || 'unknown',
          timestamp,
          hitCount: cached[cacheKey]?.hitCount || 0,
          lastAccessed: timestamp
        }

        cached[cacheKey] = cachedResult
      })

      // Cleanup old entries if cache is too large
      this.cleanupCache(cached)

      // Save to localStorage
      localStorage.setItem(this.SEARCH_RESULTS_KEY, JSON.stringify(cached))

      // Record search in history
      this.recordSearchHistory(query, results.length, results[0]?.source || 'unknown')

      console.log(`💾 Cached ${results.length} search results for "${query}"`)
    } catch (error) {
      console.error('❌ Failed to cache search results:', error)
    }
  }

  /**
   * Get cached search results
   */
  static getCachedResults(): Record<string, CachedSearchResult> {
    if (typeof window === 'undefined') return {}

    try {
      const stored = localStorage.getItem(this.SEARCH_RESULTS_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('❌ Failed to load cached results:', error)
      return {}
    }
  }

  /**
   * Search in cache
   */
  static searchCache(query: string): CachedSearchResult[] {
    if (typeof window === 'undefined') return []

    try {
      const cached = this.getCachedResults()
      const searchTerm = query.toLowerCase().trim()
      const results: CachedSearchResult[] = []

      // Exact match first
      if (cached[searchTerm]) {
        const result = cached[searchTerm]
        result.hitCount++
        result.lastAccessed = Date.now()
        results.push(result)
      }

      // Partial matches
      Object.values(cached).forEach(result => {
        if (result.word.toLowerCase() !== searchTerm && 
            (result.word.toLowerCase().includes(searchTerm) ||
             result.hindiTranslation?.toLowerCase().includes(searchTerm) ||
             result.englishDefinition.toLowerCase().includes(searchTerm))) {
          result.hitCount++
          result.lastAccessed = Date.now()
          results.push(result)
        }
      })

      // Update cache with new hit counts
      if (results.length > 0) {
        localStorage.setItem(this.SEARCH_RESULTS_KEY, JSON.stringify(cached))
        console.log(`🎯 Cache hit: Found ${results.length} results for "${query}"`)
      }

      return results.slice(0, 10) // Limit to top 10 results
    } catch (error) {
      console.error('❌ Failed to search cache:', error)
      return []
    }
  }

  /**
   * Record search in history (sessionStorage)
   */
  static recordSearchHistory(query: string, resultsFound: number, source: string): void {
    if (typeof window === 'undefined') return

    try {
      // Add to persistent history (localStorage)
      const history = this.getSearchHistory()
      const entry: SearchHistoryEntry = {
        id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: query.trim(),
        timestamp: Date.now(),
        resultsFound,
        source,
        sessionId: this.sessionId
      }

      history.unshift(entry)

      // Keep only recent entries
      if (history.length > this.MAX_HISTORY_SIZE) {
        history.splice(this.MAX_HISTORY_SIZE)
      }

      localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(history))

      // Add to session history (sessionStorage)
      this.recordSessionSearch(entry)

      console.log(`📝 Recorded search: "${query}" (${resultsFound} results from ${source})`)
    } catch (error) {
      console.error('❌ Failed to record search history:', error)
    }
  }

  /**
   * Record search in current session (sessionStorage)
   */
  private static recordSessionSearch(entry: SearchHistoryEntry): void {
    try {
      const sessionSearches = this.getSessionSearches()
      sessionSearches.unshift(entry)

      // Keep only last 50 searches in session
      if (sessionSearches.length > 50) {
        sessionSearches.splice(50)
      }

      sessionStorage.setItem(this.SESSION_SEARCHES_KEY, JSON.stringify(sessionSearches))
    } catch (error) {
      console.error('❌ Failed to record session search:', error)
    }
  }

  /**
   * Get search history
   */
  static getSearchHistory(limit: number = 100): SearchHistoryEntry[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(this.SEARCH_HISTORY_KEY)
      const history = stored ? JSON.parse(stored) : []
      return history.slice(0, limit)
    } catch (error) {
      console.error('❌ Failed to load search history:', error)
      return []
    }
  }

  /**
   * Get current session searches
   */
  static getSessionSearches(): SearchHistoryEntry[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = sessionStorage.getItem(this.SESSION_SEARCHES_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('❌ Failed to load session searches:', error)
      return []
    }
  }

  /**
   * Get recent unique searches
   */
  static getRecentSearches(limit: number = 10): string[] {
    const history = this.getSearchHistory(50)
    const uniqueQueries = new Set<string>()
    const recent: string[] = []

    for (const entry of history) {
      if (!uniqueQueries.has(entry.query.toLowerCase()) && recent.length < limit) {
        uniqueQueries.add(entry.query.toLowerCase())
        recent.push(entry.query)
      }
    }

    return recent
  }

  /**
   * Get most searched words
   */
  static getMostSearchedWords(limit: number = 10): Array<{word: string, count: number}> {
    const history = this.getSearchHistory(500)
    const wordCounts = new Map<string, number>()

    history.forEach(entry => {
      const word = entry.query.toLowerCase()
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
    })

    return Array.from(wordCounts.entries())
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): CacheStats {
    const cached = this.getCachedResults()
    const history = this.getSearchHistory()
    const sessionSearches = this.getSessionSearches()

    // Calculate cache hit rate
    const totalSearches = sessionSearches.length
    const cacheHits = sessionSearches.filter(s => s.source === 'cache').length
    const hitRate = totalSearches > 0 ? (cacheHits / totalSearches) * 100 : 0

    return {
      totalCachedResults: Object.keys(cached).length,
      totalSearchHistory: history.length,
      cacheHitRate: Math.round(hitRate * 100) / 100,
      mostSearchedWords: this.getMostSearchedWords(5).map(w => w.word),
      recentSearches: this.getRecentSearches(5),
      cacheSize: this.calculateCacheSize(),
      lastCleanup: this.getLastCleanupTime()
    }
  }

  /**
   * Calculate cache size in bytes (approximate)
   */
  private static calculateCacheSize(): number {
    try {
      const cached = localStorage.getItem(this.SEARCH_RESULTS_KEY) || ''
      const history = localStorage.getItem(this.SEARCH_HISTORY_KEY) || ''
      return (cached.length + history.length) * 2 // Approximate bytes (UTF-16)
    } catch {
      return 0
    }
  }

  /**
   * Cleanup old cache entries
   */
  private static cleanupCache(cached: Record<string, CachedSearchResult>): void {
    const now = Date.now()
    const entries = Object.entries(cached)

    // Remove expired entries
    const validEntries = entries.filter(([_, result]) => 
      now - result.timestamp < this.CACHE_DURATION
    )

    // If still too many, remove least recently used
    if (validEntries.length > this.MAX_CACHE_SIZE) {
      validEntries.sort((a, b) => b[1].lastAccessed - a[1].lastAccessed)
      validEntries.splice(this.MAX_CACHE_SIZE)
    }

    // Rebuild cache object
    const cleanedCache: Record<string, CachedSearchResult> = {}
    validEntries.forEach(([key, result]) => {
      cleanedCache[key] = result
    })

    // Replace original cache
    Object.keys(cached).forEach(key => delete cached[key])
    Object.assign(cached, cleanedCache)

    // Record cleanup time
    localStorage.setItem(this.CACHE_STATS_KEY, JSON.stringify({ lastCleanup: now }))
  }

  /**
   * Get last cleanup time
   */
  private static getLastCleanupTime(): number {
    try {
      const stats = localStorage.getItem(this.CACHE_STATS_KEY)
      return stats ? JSON.parse(stats).lastCleanup || 0 : 0
    } catch {
      return 0
    }
  }

  /**
   * Clear all cache data
   */
  static clearCache(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.SEARCH_RESULTS_KEY)
      localStorage.removeItem(this.SEARCH_HISTORY_KEY)
      localStorage.removeItem(this.CACHE_STATS_KEY)
      sessionStorage.removeItem(this.SESSION_SEARCHES_KEY)
      
      console.log('🧹 Dictionary cache cleared')
    } catch (error) {
      console.error('❌ Failed to clear cache:', error)
    }
  }

  /**
   * Export cache data for backup
   */
  static exportCacheData(): any {
    return {
      searchResults: this.getCachedResults(),
      searchHistory: this.getSearchHistory(),
      stats: this.getCacheStats(),
      sessionId: this.sessionId,
      exportTime: Date.now()
    }
  }
}
