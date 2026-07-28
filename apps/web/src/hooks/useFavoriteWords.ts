/**
 * useFavoriteWords Hook
 * Phase 2 Feature 2: User personalization features (favorites, learning progress)
 */

import { useState, useEffect, useCallback } from 'react'
import { useBetterAuthUser } from '@/hooks/useBetterAuthUser'
export interface FavoriteWord {
  id: string
  word: string
  pronunciation?: string
  partOfSpeech?: string
  englishDefinition: string
  hindiTranslation?: string
  devanagariScript?: string
  difficultyLevel?: string
  audioUrl?: string
  addedAt: number
  lastReviewed?: number
  reviewCount: number
  masteryLevel: 'learning' | 'familiar' | 'mastered'
  tags: string[]
  personalNotes?: string
  source: string
}

export interface LearningProgress {
  totalWords: number
  masteredWords: number
  familiarWords: number
  learningWords: number
  streakDays: number
  lastStudyDate?: number
  weeklyGoal: number
  weeklyProgress: number
  totalReviews: number
  averageAccuracy: number
}

export interface UseFavoriteWordsReturn {
  // Favorites management
  favoriteWords: FavoriteWord[]
  addToFavorites: (word: any) => void
  removeFromFavorites: (wordId: string) => void
  isFavorite: (word: string) => boolean
  updateWordProgress: (wordId: string, masteryLevel: FavoriteWord['masteryLevel']) => void
  addPersonalNote: (wordId: string, note: string) => void
  addWordTag: (wordId: string, tag: string) => void
  removeWordTag: (wordId: string, tag: string) => void
  
  // Learning progress
  learningProgress: LearningProgress
  recordWordReview: (wordId: string, correct: boolean) => void
  updateWeeklyGoal: (goal: number) => void
  getWordsByMastery: (level: FavoriteWord['masteryLevel']) => FavoriteWord[]
  getWordsByTag: (tag: string) => FavoriteWord[]
  
  // Statistics
  getFavoriteStats: () => {
    totalFavorites: number
    recentlyAdded: FavoriteWord[]
    mostReviewed: FavoriteWord[]
    needsReview: FavoriteWord[]
  }
  
  // Data management
  exportFavorites: () => any
  importFavorites: (data: any) => void
  clearAllFavorites: () => void
  
  // State
  isLoading: boolean
  error: string | null
}

export const useFavoriteWords = (): UseFavoriteWordsReturn => {
  const { user } = useBetterAuthUser()
  const [favoriteWords, setFavoriteWords] = useState<FavoriteWord[]>([])
  const [learningProgress, setLearningProgress] = useState<LearningProgress>({
    totalWords: 0,
    masteredWords: 0,
    familiarWords: 0,
    learningWords: 0,
    streakDays: 0,
    weeklyGoal: 10,
    weeklyProgress: 0,
    totalReviews: 0,
    averageAccuracy: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const FAVORITES_KEY = `vg_kosh_favorites_${user?.id || 'anonymous'}`
  const PROGRESS_KEY = `vg_kosh_progress_${user?.id || 'anonymous'}`

  /**
   * Load favorites and progress from localStorage
   */
  useEffect(() => {
    const loadData = () => {
      try {
        setIsLoading(true)
        
        // Load favorites
        const storedFavorites = localStorage.getItem(FAVORITES_KEY)
        if (storedFavorites) {
          const favorites = JSON.parse(storedFavorites)
          setFavoriteWords(favorites)
        }
        
        // Load progress
        const storedProgress = localStorage.getItem(PROGRESS_KEY)
        if (storedProgress) {
          const progress = JSON.parse(storedProgress)
          setLearningProgress(prev => ({ ...prev, ...progress }))
        }
        
        setError(null)
      } catch (err) {
        console.error('❌ Failed to load favorites data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    if (typeof window !== 'undefined') {
      loadData()
    }
  }, [user?.id, FAVORITES_KEY, PROGRESS_KEY])

  /**
   * Save favorites to localStorage
   */
  const saveFavorites = useCallback((favorites: FavoriteWord[]) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
      updateLearningProgress(favorites)
    } catch (err) {
      console.error('❌ Failed to save favorites:', err)
      setError(err instanceof Error ? err.message : 'Failed to save favorites')
    }
  }, [FAVORITES_KEY])

  /**
   * Update learning progress based on favorites
   */
  const updateLearningProgress = useCallback((favorites: FavoriteWord[]) => {
    const totalWords = favorites.length
    const masteredWords = favorites.filter(w => w.masteryLevel === 'mastered').length
    const familiarWords = favorites.filter(w => w.masteryLevel === 'familiar').length
    const learningWords = favorites.filter(w => w.masteryLevel === 'learning').length
    const totalReviews = favorites.reduce((sum, w) => sum + w.reviewCount, 0)

    // Calculate streak
    const today = new Date().toDateString()
    const lastStudyDate = learningProgress.lastStudyDate ? new Date(learningProgress.lastStudyDate).toDateString() : null
    const streakDays = lastStudyDate === today ? learningProgress.streakDays : 0

    // Calculate weekly progress
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    weekStart.setHours(0, 0, 0, 0)
    
    const weeklyProgress = favorites.filter(w => 
      w.lastReviewed && w.lastReviewed >= weekStart.getTime()
    ).length

    const newProgress: LearningProgress = {
      totalWords,
      masteredWords,
      familiarWords,
      learningWords,
      streakDays,
      lastStudyDate: learningProgress.lastStudyDate,
      weeklyGoal: learningProgress.weeklyGoal,
      weeklyProgress,
      totalReviews,
      averageAccuracy: learningProgress.averageAccuracy
    }

    setLearningProgress(newProgress)
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress))
  }, [learningProgress.streakDays, learningProgress.lastStudyDate, learningProgress.weeklyGoal, learningProgress.averageAccuracy, PROGRESS_KEY])

  /**
   * Add word to favorites
   */
  const addToFavorites = useCallback((word: any) => {
    try {
      const favoriteWord: FavoriteWord = {
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        word: word.word,
        pronunciation: word.pronunciation,
        partOfSpeech: word.partOfSpeech,
        englishDefinition: word.englishDefinition,
        hindiTranslation: word.hindiTranslation,
        devanagariScript: word.devanagariScript,
        difficultyLevel: word.difficultyLevel,
        audioUrl: word.audioUrl,
        addedAt: Date.now(),
        reviewCount: 0,
        masteryLevel: 'learning',
        tags: [],
        source: word.source || 'unknown'
      }

      const newFavorites = [...favoriteWords, favoriteWord]
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
      
      console.log(`⭐ Added "${word.word}" to favorites`)
    } catch (err) {
      console.error('❌ Failed to add to favorites:', err)
      setError(err instanceof Error ? err.message : 'Failed to add to favorites')
    }
  }, [favoriteWords, saveFavorites])

  /**
   * Remove word from favorites
   */
  const removeFromFavorites = useCallback((wordId: string) => {
    try {
      const newFavorites = favoriteWords.filter(w => w.id !== wordId)
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
      
      console.log(`🗑️ Removed word from favorites`)
    } catch (err) {
      console.error('❌ Failed to remove from favorites:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove from favorites')
    }
  }, [favoriteWords, saveFavorites])

  /**
   * Check if word is favorite
   */
  const isFavorite = useCallback((word: string) => {
    return favoriteWords.some(fav => fav.word.toLowerCase() === word.toLowerCase())
  }, [favoriteWords])

  /**
   * Update word mastery level
   */
  const updateWordProgress = useCallback((wordId: string, masteryLevel: FavoriteWord['masteryLevel']) => {
    try {
      const newFavorites = favoriteWords.map(word => 
        word.id === wordId 
          ? { ...word, masteryLevel, lastReviewed: Date.now() }
          : word
      )
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
      
      console.log(`📈 Updated word progress to ${masteryLevel}`)
    } catch (err) {
      console.error('❌ Failed to update word progress:', err)
      setError(err instanceof Error ? err.message : 'Failed to update progress')
    }
  }, [favoriteWords, saveFavorites])

  /**
   * Add personal note to word
   */
  const addPersonalNote = useCallback((wordId: string, note: string) => {
    try {
      const newFavorites = favoriteWords.map(word => 
        word.id === wordId ? { ...word, personalNotes: note } : word
      )
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
    } catch (err) {
      console.error('❌ Failed to add personal note:', err)
      setError(err instanceof Error ? err.message : 'Failed to add note')
    }
  }, [favoriteWords, saveFavorites])

  /**
   * Add tag to word
   */
  const addWordTag = useCallback((wordId: string, tag: string) => {
    try {
      const newFavorites = favoriteWords.map(word => 
        word.id === wordId 
          ? { ...word, tags: [...new Set([...word.tags, tag])] }
          : word
      )
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
    } catch (err) {
      console.error('❌ Failed to add tag:', err)
      setError(err instanceof Error ? err.message : 'Failed to add tag')
    }
  }, [favoriteWords, saveFavorites])

  /**
   * Remove tag from word
   */
  const removeWordTag = useCallback((wordId: string, tag: string) => {
    try {
      const newFavorites = favoriteWords.map(word => 
        word.id === wordId 
          ? { ...word, tags: word.tags.filter(t => t !== tag) }
          : word
      )
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
    } catch (err) {
      console.error('❌ Failed to remove tag:', err)
      setError(err instanceof Error ? err.message : 'Failed to remove tag')
    }
  }, [favoriteWords, saveFavorites])

  /**
   * Record word review
   */
  const recordWordReview = useCallback((wordId: string, correct: boolean) => {
    try {
      const newFavorites = favoriteWords.map(word => {
        if (word.id === wordId) {
          const newReviewCount = word.reviewCount + 1
          return {
            ...word,
            reviewCount: newReviewCount,
            lastReviewed: Date.now()
          }
        }
        return word
      })
      
      setFavoriteWords(newFavorites)
      saveFavorites(newFavorites)
      
      // Update streak
      const today = Date.now()
      const newProgress = {
        ...learningProgress,
        lastStudyDate: today,
        streakDays: learningProgress.streakDays + 1,
        totalReviews: learningProgress.totalReviews + 1
      }
      setLearningProgress(newProgress)
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress))
      
    } catch (err) {
      console.error('❌ Failed to record review:', err)
      setError(err instanceof Error ? err.message : 'Failed to record review')
    }
  }, [favoriteWords, saveFavorites, learningProgress, PROGRESS_KEY])

  /**
   * Update weekly goal
   */
  const updateWeeklyGoal = useCallback((goal: number) => {
    const newProgress = { ...learningProgress, weeklyGoal: goal }
    setLearningProgress(newProgress)
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress))
  }, [learningProgress, PROGRESS_KEY])

  /**
   * Get words by mastery level
   */
  const getWordsByMastery = useCallback((level: FavoriteWord['masteryLevel']) => {
    return favoriteWords.filter(word => word.masteryLevel === level)
  }, [favoriteWords])

  /**
   * Get words by tag
   */
  const getWordsByTag = useCallback((tag: string) => {
    return favoriteWords.filter(word => word.tags.includes(tag))
  }, [favoriteWords])

  /**
   * Get favorite statistics
   */
  const getFavoriteStats = useCallback(() => {
    const now = Date.now()
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)

    return {
      totalFavorites: favoriteWords.length,
      recentlyAdded: favoriteWords
        .filter(w => w.addedAt > oneWeekAgo)
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, 5),
      mostReviewed: favoriteWords
        .sort((a, b) => b.reviewCount - a.reviewCount)
        .slice(0, 5),
      needsReview: favoriteWords
        .filter(w => !w.lastReviewed || w.lastReviewed < oneDayAgo)
        .sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0))
        .slice(0, 10)
    }
  }, [favoriteWords])

  /**
   * Export favorites data
   */
  const exportFavorites = useCallback(() => {
    return {
      favorites: favoriteWords,
      progress: learningProgress,
      exportDate: new Date().toISOString(),
      version: '1.0'
    }
  }, [favoriteWords, learningProgress])

  /**
   * Import favorites data
   */
  const importFavorites = useCallback((data: any) => {
    try {
      if (data.favorites && Array.isArray(data.favorites)) {
        setFavoriteWords(data.favorites)
        saveFavorites(data.favorites)
      }
      if (data.progress) {
        setLearningProgress(data.progress)
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(data.progress))
      }
      console.log('✅ Favorites imported successfully')
    } catch (err) {
      console.error('❌ Failed to import favorites:', err)
      setError(err instanceof Error ? err.message : 'Failed to import favorites')
    }
  }, [saveFavorites, PROGRESS_KEY])

  /**
   * Clear all favorites
   */
  const clearAllFavorites = useCallback(() => {
    try {
      setFavoriteWords([])
      localStorage.removeItem(FAVORITES_KEY)
      localStorage.removeItem(PROGRESS_KEY)
      setLearningProgress({
        totalWords: 0,
        masteredWords: 0,
        familiarWords: 0,
        learningWords: 0,
        streakDays: 0,
        weeklyGoal: 10,
        weeklyProgress: 0,
        totalReviews: 0,
        averageAccuracy: 0
      })
      console.log('🧹 All favorites cleared')
    } catch (err) {
      console.error('❌ Failed to clear favorites:', err)
      setError(err instanceof Error ? err.message : 'Failed to clear favorites')
    }
  }, [FAVORITES_KEY, PROGRESS_KEY])

  return {
    // Favorites management
    favoriteWords,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    updateWordProgress,
    addPersonalNote,
    addWordTag,
    removeWordTag,
    
    // Learning progress
    learningProgress,
    recordWordReview,
    updateWeeklyGoal,
    getWordsByMastery,
    getWordsByTag,
    
    // Statistics
    getFavoriteStats,
    
    // Data management
    exportFavorites,
    importFavorites,
    clearAllFavorites,
    
    // State
    isLoading,
    error
  }
}
