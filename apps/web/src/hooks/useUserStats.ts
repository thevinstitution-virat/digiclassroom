/**
 * VG Kosh User Statistics Hook
 * React hook for managing user statistics and progress tracking
 */

import { useState, useEffect, useCallback } from 'react'
import { UserStatsService, UserStats, DailyActivity } from '@/lib/services/user-stats'

export interface UseUserStatsReturn {
  stats: UserStats
  isLoading: boolean
  dailyActivity: DailyActivity[]
  recordWordSearch: (word: string) => void
  recordWordLearned: (word: string, isCultural?: boolean) => void
  recordHindiTranslation: () => void
  recordQuizCompleted: (score: number, totalQuestions: number, culturalQuestions?: number) => void
  refreshStats: () => void
  resetStats: () => void
  getTodayProgress: () => {
    percentage: number
    wordsLearned: number
    goal: number
    remaining: number
  }
  getStreakInfo: () => {
    current: number
    longest: number
    isOnTrack: boolean
    daysToGoal: number
  }
  getLevelInfo: () => {
    current: number
    progress: number
    pointsToNext: number
    totalPoints: number
  }
}

export function useUserStats(): UseUserStatsReturn {
  const [stats, setStats] = useState<UserStats>(() => UserStatsService.getUserStats())
  const [isLoading, setIsLoading] = useState(true)
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([])

  // Load initial data
  useEffect(() => {
    const loadStats = () => {
      try {
        const userStats = UserStatsService.getUserStats()
        const activity = UserStatsService.getDailyActivity(7)
        
        setStats(userStats)
        setDailyActivity(activity)
        setIsLoading(false)
      } catch (error) {
        console.error('Error loading user stats:', error)
        setIsLoading(false)
      }
    }

    loadStats()
  }, [])

  // Record word search
  const recordWordSearch = useCallback((word: string) => {
    try {
      const updatedStats = UserStatsService.recordWordSearch(word)
      setStats(updatedStats)
      
      // Update daily activity
      const activity = UserStatsService.getDailyActivity(7)
      setDailyActivity(activity)
      
      console.log('📊 Word search recorded:', word)
    } catch (error) {
      console.error('Error recording word search:', error)
    }
  }, [])

  // Record word learned
  const recordWordLearned = useCallback((word: string, isCultural: boolean = false) => {
    try {
      const updatedStats = UserStatsService.recordWordLearned(word, isCultural)
      setStats(updatedStats)
      
      // Update daily activity
      const activity = UserStatsService.getDailyActivity(7)
      setDailyActivity(activity)
      
      console.log('📚 Word learned recorded:', word, isCultural ? '(Cultural)' : '')
    } catch (error) {
      console.error('Error recording word learned:', error)
    }
  }, [])

  // Record Hindi translation viewed
  const recordHindiTranslation = useCallback(() => {
    try {
      const updatedStats = UserStatsService.recordHindiTranslation()
      setStats(updatedStats)
      
      console.log('🔤 Hindi translation recorded')
    } catch (error) {
      console.error('Error recording Hindi translation:', error)
    }
  }, [])

  // Record quiz completed
  const recordQuizCompleted = useCallback((score: number, totalQuestions: number, culturalQuestions: number = 0) => {
    try {
      const updatedStats = UserStatsService.recordQuizCompleted(score, totalQuestions, culturalQuestions)
      setStats(updatedStats)
      
      // Update daily activity
      const activity = UserStatsService.getDailyActivity(7)
      setDailyActivity(activity)
      
      console.log('🎯 Quiz completed recorded:', { score, totalQuestions, culturalQuestions })
    } catch (error) {
      console.error('Error recording quiz completion:', error)
    }
  }, [])

  // Refresh stats
  const refreshStats = useCallback(() => {
    try {
      const userStats = UserStatsService.getUserStats()
      const activity = UserStatsService.getDailyActivity(7)
      
      setStats(userStats)
      setDailyActivity(activity)
      
      console.log('🔄 Stats refreshed')
    } catch (error) {
      console.error('Error refreshing stats:', error)
    }
  }, [])

  // Reset stats (for testing)
  const resetStats = useCallback(() => {
    try {
      UserStatsService.resetStats()
      const userStats = UserStatsService.getUserStats()
      const activity = UserStatsService.getDailyActivity(7)
      
      setStats(userStats)
      setDailyActivity(activity)
      
      console.log('🔄 Stats reset')
    } catch (error) {
      console.error('Error resetting stats:', error)
    }
  }, [])

  // Get today's progress information
  const getTodayProgress = useCallback(() => {
    const wordsLearned = stats.todayProgress
    const goal = stats.dailyGoalWords
    const percentage = Math.min(100, (wordsLearned / goal) * 100)
    const remaining = Math.max(0, goal - wordsLearned)

    return {
      percentage,
      wordsLearned,
      goal,
      remaining
    }
  }, [stats.todayProgress, stats.dailyGoalWords])

  // Get streak information
  const getStreakInfo = useCallback(() => {
    const current = stats.currentStreakDays
    const longest = stats.longestStreakDays
    const todayProgress = getTodayProgress()
    const isOnTrack = todayProgress.percentage >= 100
    const daysToGoal = isOnTrack ? 0 : 1

    return {
      current,
      longest,
      isOnTrack,
      daysToGoal
    }
  }, [stats.currentStreakDays, stats.longestStreakDays, getTodayProgress])

  // Get level information
  const getLevelInfo = useCallback(() => {
    const current = stats.currentLevel
    const totalPoints = stats.totalPoints
    const pointsForCurrentLevel = (current - 1) * 100
    const pointsForNextLevel = current * 100
    const pointsInCurrentLevel = totalPoints - pointsForCurrentLevel
    const pointsToNext = pointsForNextLevel - totalPoints
    const progress = (pointsInCurrentLevel / 100) * 100

    return {
      current,
      progress: Math.min(100, progress),
      pointsToNext: Math.max(0, pointsToNext),
      totalPoints
    }
  }, [stats.currentLevel, stats.totalPoints])

  return {
    stats,
    isLoading,
    dailyActivity,
    recordWordSearch,
    recordWordLearned,
    recordHindiTranslation,
    recordQuizCompleted,
    refreshStats,
    resetStats,
    getTodayProgress,
    getStreakInfo,
    getLevelInfo
  }
}
