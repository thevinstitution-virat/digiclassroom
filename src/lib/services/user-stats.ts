/**
 * VG Kosh User Statistics Service
 * Tracks user progress, streaks, and learning analytics
 */

export interface UserStats {
  totalWordsLearned: number
  wordsMastered: number
  currentStreakDays: number
  longestStreakDays: number
  totalPoints: number
  currentLevel: number
  dailyGoalWords: number
  todayProgress: number
  todayWordsSearched: number
  todayQuizzesCompleted: number
  weeklyProgress: number[]
  monthlyProgress: number
  lastActiveDate: string
  joinDate: string
  achievements: string[]
  culturalWordsLearned: number
  hindiTranslationsViewed: number
}

export interface DailyActivity {
  date: string
  wordsSearched: number
  wordsLearned: number
  quizzesCompleted: number
  timeSpentMinutes: number
  streakMaintained: boolean
}

export class UserStatsService {
  private static readonly STORAGE_KEY = 'vg_kosh_user_stats'
  private static readonly DAILY_ACTIVITY_KEY = 'vg_kosh_daily_activity'

  /**
   * Get user statistics from localStorage
   */
  static getUserStats(): UserStats {
    if (typeof window === 'undefined') {
      return this.getDefaultStats()
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const stats = JSON.parse(stored)
        // Update today's progress if it's a new day
        return this.updateDailyProgress(stats)
      }
    } catch (error) {
      console.error('Error loading user stats:', error)
    }

    return this.getDefaultStats()
  }

  /**
   * Save user statistics to localStorage
   */
  static saveUserStats(stats: UserStats): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stats))
    } catch (error) {
      console.error('Error saving user stats:', error)
    }
  }

  /**
   * Get default user statistics
   */
  private static getDefaultStats(): UserStats {
    const today = new Date().toISOString().split('T')[0]
    return {
      totalWordsLearned: 0,
      wordsMastered: 0,
      currentStreakDays: 0,
      longestStreakDays: 0,
      totalPoints: 0,
      currentLevel: 1,
      dailyGoalWords: 5,
      todayProgress: 0,
      todayWordsSearched: 0,
      todayQuizzesCompleted: 0,
      weeklyProgress: [0, 0, 0, 0, 0, 0, 0], // Last 7 days
      monthlyProgress: 0,
      lastActiveDate: today,
      joinDate: today,
      achievements: [],
      culturalWordsLearned: 0,
      hindiTranslationsViewed: 0
    }
  }

  /**
   * Update daily progress and check for new day
   */
  private static updateDailyProgress(stats: UserStats): UserStats {
    const today = new Date().toISOString().split('T')[0]
    const lastActive = stats.lastActiveDate

    if (today !== lastActive) {
      // New day - reset daily counters and update streak
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split('T')[0]

      // Check if streak should continue
      if (lastActive === yesterdayStr && stats.todayProgress >= stats.dailyGoalWords) {
        // Streak continues
        stats.currentStreakDays += 1
        stats.longestStreakDays = Math.max(stats.longestStreakDays, stats.currentStreakDays)
      } else if (lastActive !== yesterdayStr) {
        // Streak broken
        stats.currentStreakDays = 0
      }

      // Reset daily counters
      stats.todayProgress = 0
      stats.todayWordsSearched = 0
      stats.todayQuizzesCompleted = 0
      stats.lastActiveDate = today

      // Update weekly progress (shift array and add yesterday's progress)
      stats.weeklyProgress.shift()
      stats.weeklyProgress.push(stats.todayProgress)
    }

    return stats
  }

  /**
   * Record word search activity
   */
  static recordWordSearch(word: string): UserStats {
    const stats = this.getUserStats()
    
    stats.todayWordsSearched += 1
    stats.totalPoints += 1 // 1 point per search
    
    // Update level based on total points
    stats.currentLevel = Math.floor(stats.totalPoints / 100) + 1
    
    this.saveUserStats(stats)
    this.recordDailyActivity('wordSearched')
    
    return stats
  }

  /**
   * Record word learned activity
   */
  static recordWordLearned(word: string, isCultural: boolean = false): UserStats {
    const stats = this.getUserStats()
    
    stats.todayProgress += 1
    stats.totalWordsLearned += 1
    stats.totalPoints += 5 // 5 points per word learned
    
    if (isCultural) {
      stats.culturalWordsLearned += 1
      stats.totalPoints += 2 // Bonus for cultural words
    }
    
    // Update level
    stats.currentLevel = Math.floor(stats.totalPoints / 100) + 1
    
    // Check for achievements
    this.checkAchievements(stats)
    
    this.saveUserStats(stats)
    this.recordDailyActivity('wordLearned')
    
    return stats
  }

  /**
   * Record Hindi translation viewed
   */
  static recordHindiTranslation(): UserStats {
    const stats = this.getUserStats()
    
    stats.hindiTranslationsViewed += 1
    stats.totalPoints += 1 // 1 point per translation
    
    this.saveUserStats(stats)
    
    return stats
  }

  /**
   * Record quiz completion
   */
  static recordQuizCompleted(score: number, totalQuestions: number, culturalQuestions: number = 0): UserStats {
    const stats = this.getUserStats()
    
    stats.todayQuizzesCompleted += 1
    stats.totalPoints += score
    
    // Bonus points for cultural questions
    if (culturalQuestions > 0) {
      stats.totalPoints += culturalQuestions * 2
    }
    
    // Update mastered words based on quiz performance
    const accuracy = score / (totalQuestions * 10) // Assuming 10 points per question
    if (accuracy >= 0.8) {
      stats.wordsMastered += Math.floor(totalQuestions * accuracy)
    }
    
    // Update level
    stats.currentLevel = Math.floor(stats.totalPoints / 100) + 1
    
    this.checkAchievements(stats)
    this.saveUserStats(stats)
    this.recordDailyActivity('quizCompleted')
    
    return stats
  }

  /**
   * Check and award achievements
   */
  private static checkAchievements(stats: UserStats): void {
    const achievements = []

    // Learning milestones
    if (stats.totalWordsLearned >= 10 && !stats.achievements.includes('first_10_words')) {
      achievements.push('first_10_words')
    }
    if (stats.totalWordsLearned >= 50 && !stats.achievements.includes('vocabulary_builder')) {
      achievements.push('vocabulary_builder')
    }
    if (stats.totalWordsLearned >= 100 && !stats.achievements.includes('word_scholar')) {
      achievements.push('word_scholar')
    }

    // Streak achievements
    if (stats.currentStreakDays >= 3 && !stats.achievements.includes('consistent_learner')) {
      achievements.push('consistent_learner')
    }
    if (stats.currentStreakDays >= 7 && !stats.achievements.includes('streak_warrior')) {
      achievements.push('streak_warrior')
    }

    // Cultural achievements
    if (stats.culturalWordsLearned >= 25 && !stats.achievements.includes('cultural_explorer')) {
      achievements.push('cultural_explorer')
    }

    // Add new achievements
    stats.achievements.push(...achievements)
  }

  /**
   * Record daily activity
   */
  private static recordDailyActivity(activityType: string): void {
    if (typeof window === 'undefined') return

    try {
      const today = new Date().toISOString().split('T')[0]
      const stored = localStorage.getItem(this.DAILY_ACTIVITY_KEY)
      let activities: Record<string, DailyActivity> = {}

      if (stored) {
        activities = JSON.parse(stored)
      }

      if (!activities[today]) {
        activities[today] = {
          date: today,
          wordsSearched: 0,
          wordsLearned: 0,
          quizzesCompleted: 0,
          timeSpentMinutes: 0,
          streakMaintained: false
        }
      }

      // Update activity based on type
      switch (activityType) {
        case 'wordSearched':
          activities[today].wordsSearched += 1
          break
        case 'wordLearned':
          activities[today].wordsLearned += 1
          break
        case 'quizCompleted':
          activities[today].quizzesCompleted += 1
          break
      }

      // Keep only last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0]

      Object.keys(activities).forEach(date => {
        if (date < cutoffDate) {
          delete activities[date]
        }
      })

      localStorage.setItem(this.DAILY_ACTIVITY_KEY, JSON.stringify(activities))
    } catch (error) {
      console.error('Error recording daily activity:', error)
    }
  }

  /**
   * Get daily activity data for charts
   */
  static getDailyActivity(days: number = 7): DailyActivity[] {
    if (typeof window === 'undefined')
  return []

    try {
      const stored = localStorage.getItem(this.DAILY_ACTIVITY_KEY)
      if (!stored)
  return []

      const activities: Record<string, DailyActivity> = JSON.parse(stored)
      const result: DailyActivity[] = []

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]

        result.push(activities[dateStr] || {
          date: dateStr,
          wordsSearched: 0,
          wordsLearned: 0,
          quizzesCompleted: 0,
          timeSpentMinutes: 0,
          streakMaintained: false
        })
      }

      return result
    } catch (error) {
      console.error('Error getting daily activity:', error)
      return []
    }
  }

  /**
   * Reset all statistics (for testing)
   */
  static resetStats(): void {
    if (typeof window === 'undefined') return

    localStorage.removeItem(this.STORAGE_KEY)
    localStorage.removeItem(this.DAILY_ACTIVITY_KEY)
  }
}
