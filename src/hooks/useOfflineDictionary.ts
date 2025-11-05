/**
 * useOfflineDictionary Hook
 * Manages offline dictionary functionality and state
 */

import { useState, useEffect, useCallback } from 'react'
import OfflineDictionaryService from '@/lib/services/offline-dictionary'

interface OfflineState {
  isOnline: boolean
  isOfflineReady: boolean
  cachedWordsCount: number
  isInitializing: boolean
  error: string | null
}

interface OfflineSearchResult {
  success: boolean
  words: any[]
  total: number
  query: string
  source: string
  offline: boolean
  error?: string
}

export const useOfflineDictionary = () => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: true, // Always start as true to avoid hydration mismatch
    isOfflineReady: false,
    cachedWordsCount: 0,
    isInitializing: false,
    error: null
  })

  const offlineService = OfflineDictionaryService.getInstance()

  /**
   * Initialize offline functionality
   */
  const initializeOffline = useCallback(async () => {
    setOfflineState(prev => ({ ...prev, isInitializing: true, error: null }))

    try {
      // Initialize offline cache
      await offlineService.initializeOfflineCache()

      // Get current stats
      const stats = await offlineService.getDictionaryStats()

      setOfflineState(prev => ({
        ...prev,
        isOfflineReady: offlineService.isOfflineAvailable(),
        cachedWordsCount: stats.cachedWords,
        isInitializing: false,
        error: stats.error || null
      }))

      console.log('✅ Offline dictionary initialized:', stats)
    } catch (error) {
      console.error('❌ Failed to initialize offline dictionary:', error)
      setOfflineState(prev => ({
        ...prev,
        isInitializing: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      }))
    }
  }, [offlineService])

  /**
   * Search words offline
   */
  const searchOffline = useCallback(async (query: string): Promise<OfflineSearchResult> => {
    try {
      const result = await offlineService.searchOffline(query)
      console.log('🔍 Offline search result:', result)
      return result
    } catch (error) {
      console.error('❌ Offline search failed:', error)
      return {
        success: false,
        words: [],
        total: 0,
        query,
        source: 'offline_error',
        offline: true,
        error: error instanceof Error ? error.message : 'Search failed'
      }
    }
  }, [offlineService])

  /**
   * Get offline dictionary statistics
   */
  const getOfflineStats = useCallback(async () => {
    try {
      const stats = await offlineService.getDictionaryStats()
      setOfflineState(prev => ({
        ...prev,
        cachedWordsCount: stats.cachedWords,
        error: stats.error || null
      }))
      return stats
    } catch (error) {
      console.error('❌ Failed to get offline stats:', error)
      return {
        cachedWords: 0,
        searchHistory: 0,
        favorites: 0,
        lastUpdated: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Failed to get stats'
      }
    }
  }, [offlineService])

  /**
   * Cache additional words
   */
  const cacheWords = useCallback(async (words: any[]) => {
    try {
      await offlineService.cacheCommonWords()
      await getOfflineStats() // Refresh stats
      console.log(`✅ Cached ${words.length} additional words`)
    } catch (error) {
      console.error('❌ Failed to cache words:', error)
      setOfflineState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to cache words'
      }))
    }
  }, [offlineService, getOfflineStats])

  /**
   * Handle online/offline status changes
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Connection restored')
      setOfflineState(prev => ({ ...prev, isOnline: true }))
    }

    const handleOffline = () => {
      console.log('📱 Connection lost - switching to offline mode')
      setOfflineState(prev => ({ ...prev, isOnline: false }))
    }

    if (typeof window !== 'undefined') {
      // Set initial online status on client mount to avoid hydration mismatch
      setOfflineState(prev => ({ ...prev, isOnline: navigator.onLine }))

      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initializeOffline()
  }, [initializeOffline])

  /**
   * Determine if we should use offline search
   */
  const shouldUseOffline = useCallback((forceOffline: boolean = false) => {
    return forceOffline || (!offlineState.isOnline && offlineState.isOfflineReady)
  }, [offlineState.isOnline, offlineState.isOfflineReady])

  /**
   * Get offline status message
   */
  const getOfflineStatusMessage = useCallback(() => {
    if (offlineState.isInitializing) {
      return 'Initializing offline dictionary...'
    }
    
    if (!offlineState.isOnline && offlineState.isOfflineReady) {
      return `Offline mode active - ${offlineState.cachedWordsCount} words available`
    }
    
    if (!offlineState.isOnline && !offlineState.isOfflineReady) {
      return 'Offline - limited functionality available'
    }
    
    if (offlineState.isOnline && offlineState.isOfflineReady) {
      return `Online - ${offlineState.cachedWordsCount} words cached for offline use`
    }
    
    return 'Online'
  }, [offlineState])

  /**
   * Check if a specific feature is available offline
   */
  const isFeatureAvailableOffline = useCallback((feature: 'search' | 'favorites' | 'history') => {
    if (!offlineState.isOfflineReady) return false
    
    switch (feature) {
      case 'search':
        return offlineState.cachedWordsCount > 0
      case 'favorites':
      case 'history':
        return true // These use localStorage
      default:
        return false
    }
  }, [offlineState.isOfflineReady, offlineState.cachedWordsCount])

  return {
    // State
    isOnline: offlineState.isOnline,
    isOfflineReady: offlineState.isOfflineReady,
    cachedWordsCount: offlineState.cachedWordsCount,
    isInitializing: offlineState.isInitializing,
    error: offlineState.error,
    
    // Actions
    initializeOffline,
    searchOffline,
    getOfflineStats,
    cacheWords,
    
    // Utilities
    shouldUseOffline,
    getOfflineStatusMessage,
    isFeatureAvailableOffline
  }
}
