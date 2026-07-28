/**
 * useDictionaryCache Hook
 * React hook for managing dictionary search cache and history
 * Phase 1 Feature 4: Basic Caching System
 */

import { useState, useEffect, useCallback } from 'react'
import { DictionaryCacheService, CachedSearchResult, SearchHistoryEntry, CacheStats } from '@/lib/services/dictionary-cache'

export interface UseDictionaryCacheReturn {
  // Cache operations
  cacheSearchResult: (query: string, results: any[]) => void
  searchCache: (query: string) => CachedSearchResult[]
  getCachedResult: (word: string) => CachedSearchResult | null
  
  // History operations
  getSearchHistory: (limit?: number) => SearchHistoryEntry[]
  getSessionSearches: () => SearchHistoryEntry[]
  getRecentSearches: (limit?: number) => string[]
  getMostSearchedWords: (limit?: number) => Array<{word: string, count: number}>
  
  // Statistics
  cacheStats: CacheStats
  refreshStats: () => void
  
  // Utilities
  clearCache: () => void
  exportCacheData: () => any
  
  // State
  isLoading: boolean
  error: string | null
}

export const useDictionaryCache = (): UseDictionaryCacheReturn => {
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalCachedResults: 0,
    totalSearchHistory: 0,
    cacheHitRate: 0,
    mostSearchedWords: [],
    recentSearches: [],
    cacheSize: 0,
    lastCleanup: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load initial cache statistics
   */
  useEffect(() => {
    const loadStats = () => {
      try {
        setIsLoading(true)
        const stats = DictionaryCacheService.getCacheStats()
        setCacheStats(stats)
        setError(null)
        console.log('📊 Cache stats loaded:', stats)
      } catch (err) {
        console.error('❌ Failed to load cache stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to load cache stats')
      } finally {
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  /**
   * Cache search results
   */
  const cacheSearchResult = useCallback((query: string, results: any[]) => {
    try {
      DictionaryCacheService.cacheSearchResult(query, results)
      
      // Refresh stats after caching
      const newStats = DictionaryCacheService.getCacheStats()
      setCacheStats(newStats)
      
      console.log(`💾 Cached ${results.length} results for "${query}"`)
    } catch (err) {
      console.error('❌ Failed to cache search result:', err)
      setError(err instanceof Error ? err.message : 'Failed to cache results')
    }
  }, [])

  /**
   * Search in cache
   */
  const searchCache = useCallback((query: string): CachedSearchResult[] => {
    try {
      const results = DictionaryCacheService.searchCache(query)
      
      // Refresh stats if we had cache hits
      if (results.length > 0) {
        const newStats = DictionaryCacheService.getCacheStats()
        setCacheStats(newStats)
      }
      
      return results
    } catch (err) {
      console.error('❌ Failed to search cache:', err)
      setError(err instanceof Error ? err.message : 'Failed to search cache')
      return []
    }
  }, [])

  /**
   * Get specific cached result
   */
  const getCachedResult = useCallback((word: string): CachedSearchResult | null => {
    try {
      const cached = DictionaryCacheService.getCachedResults()
      const result = cached[word.toLowerCase()]
      
      if (result) {
        // Update access time
        result.lastAccessed = Date.now()
        result.hitCount++
        
        // Save updated cache
        const allCached = DictionaryCacheService.getCachedResults()
        allCached[word.toLowerCase()] = result
        localStorage.setItem('vg_kosh_search_cache', JSON.stringify(allCached))
      }
      
      return result || null
    } catch (err) {
      console.error('❌ Failed to get cached result:', err)
      return null
    }
  }, [])

  /**
   * Get search history
   */
  const getSearchHistory = useCallback((limit: number = 100): SearchHistoryEntry[] => {
    try {
      return DictionaryCacheService.getSearchHistory(limit)
    } catch (err) {
      console.error('❌ Failed to get search history:', err)
      return []
    }
  }, [])

  /**
   * Get current session searches
   */
  const getSessionSearches = useCallback((): SearchHistoryEntry[] => {
    try {
      return DictionaryCacheService.getSessionSearches()
    } catch (err) {
      console.error('❌ Failed to get session searches:', err)
      return []
    }
  }, [])

  /**
   * Get recent unique searches
   */
  const getRecentSearches = useCallback((limit: number = 10): string[] => {
    try {
      return DictionaryCacheService.getRecentSearches(limit)
    } catch (err) {
      console.error('❌ Failed to get recent searches:', err)
      return []
    }
  }, [])

  /**
   * Get most searched words
   */
  const getMostSearchedWords = useCallback((limit: number = 10): Array<{word: string, count: number}> => {
    try {
      return DictionaryCacheService.getMostSearchedWords(limit)
    } catch (err) {
      console.error('❌ Failed to get most searched words:', err)
      return []
    }
  }, [])

  /**
   * Refresh cache statistics
   */
  const refreshStats = useCallback(() => {
    try {
      const stats = DictionaryCacheService.getCacheStats()
      setCacheStats(stats)
      setError(null)
      console.log('🔄 Cache stats refreshed:', stats)
    } catch (err) {
      console.error('❌ Failed to refresh cache stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to refresh stats')
    }
  }, [])

  /**
   * Clear all cache data
   */
  const clearCache = useCallback(() => {
    try {
      DictionaryCacheService.clearCache()
      
      // Reset stats
      setCacheStats({
        totalCachedResults: 0,
        totalSearchHistory: 0,
        cacheHitRate: 0,
        mostSearchedWords: [],
        recentSearches: [],
        cacheSize: 0,
        lastCleanup: Date.now()
      })
      
      setError(null)
      console.log('🧹 Cache cleared successfully')
    } catch (err) {
      console.error('❌ Failed to clear cache:', err)
      setError(err instanceof Error ? err.message : 'Failed to clear cache')
    }
  }, [])

  /**
   * Export cache data
   */
  const exportCacheData = useCallback(() => {
    try {
      return DictionaryCacheService.exportCacheData()
    } catch (err) {
      console.error('❌ Failed to export cache data:', err)
      setError(err instanceof Error ? err.message : 'Failed to export cache data')
      return null
    }
  }, [])

  return {
    // Cache operations
    cacheSearchResult,
    searchCache,
    getCachedResult,
    
    // History operations
    getSearchHistory,
    getSessionSearches,
    getRecentSearches,
    getMostSearchedWords,
    
    // Statistics
    cacheStats,
    refreshStats,
    
    // Utilities
    clearCache,
    exportCacheData,
    
    // State
    isLoading,
    error
  }
}
