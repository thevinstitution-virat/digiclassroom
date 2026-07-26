/**
 * VG Kosh Achievement System
 * Gamification and progress tracking with Indian cultural context
 */

import { Achievement, UserAchievement, QuizSession, QuizAnalytics } from '@/lib/types/quiz'

export class AchievementSystem {
  
  // Define all available achievements
  private achievements: Achievement[] = [
    // Learning Milestones
    {
      code: 'first_steps',
      name: 'पहला कदम (First Steps)',
      description: 'Complete your first quiz session',
      icon: '👶',
      color: 'green',
      points: 10,
      culturalContext: true,
      requirements: { type: 'sessions_completed', value: 1 }
    },
    {
      code: 'vocabulary_builder',
      name: 'शब्द निर्माता (Vocabulary Builder)',
      description: 'Learn 50 new words',
      icon: '📚',
      color: 'blue',
      points: 50,
      culturalContext: true,
      requirements: { type: 'words_learned', value: 50 }
    },
    {
      code: 'word_scholar',
      name: 'शब्द विद्वान (Word Scholar)',
      description: 'Learn 100 new words',
      icon: '🎓',
      color: 'purple',
      points: 100,
      culturalContext: true,
      requirements: { type: 'words_learned', value: 100 }
    },
    {
      code: 'lexicon_master',
      name: 'शब्दकोश गुरु (Lexicon Master)',
      description: 'Learn 500 new words',
      icon: '🧠',
      color: 'gold',
      points: 500,
      culturalContext: true,
      requirements: { type: 'words_learned', value: 500 }
    },
    {
      code: 'dictionary_sage',
      name: 'शब्दकोश ऋषि (Dictionary Sage)',
      description: 'Learn 1000 new words',
      icon: '🏛️',
      color: 'platinum',
      points: 1000,
      culturalContext: true,
      requirements: { type: 'words_learned', value: 1000 }
    },
    
    // Performance Badges
    {
      code: 'sharpshooter',
      name: 'निशानेबाज़ (Sharpshooter)',
      description: 'Achieve 90% accuracy in a quiz session',
      icon: '🎯',
      color: 'red',
      points: 25,
      culturalContext: true,
      requirements: { type: 'session_accuracy', value: 90 }
    },
    {
      code: 'perfectionist',
      name: 'पूर्णतावादी (Perfectionist)',
      description: 'Score 100% in a quiz session',
      icon: '💯',
      color: 'gold',
      points: 50,
      culturalContext: true,
      requirements: { type: 'session_accuracy', value: 100 }
    },
    {
      code: 'speed_demon',
      name: 'तेज़ी का राजा (Speed Demon)',
      description: 'Complete a quiz in under 5 minutes',
      icon: '⚡',
      color: 'yellow',
      points: 30,
      culturalContext: true,
      requirements: { type: 'session_duration', value: 300 } // 5 minutes in seconds
    },
    
    // Streak Achievements
    {
      code: 'consistent_learner',
      name: 'नियमित छात्र (Consistent Learner)',
      description: 'Practice for 3 consecutive days',
      icon: '🔥',
      color: 'orange',
      points: 30,
      culturalContext: true,
      requirements: { type: 'streak_days', value: 3 }
    },
    {
      code: 'streak_warrior',
      name: 'निरंतरता योद्धा (Streak Warrior)',
      description: 'Practice for 7 consecutive days',
      icon: '🏆',
      color: 'gold',
      points: 70,
      culturalContext: true,
      requirements: { type: 'streak_days', value: 7 }
    },
    {
      code: 'dedication_master',
      name: 'समर्पण गुरु (Dedication Master)',
      description: 'Practice for 30 consecutive days',
      icon: '👑',
      color: 'royal',
      points: 300,
      culturalContext: true,
      requirements: { type: 'streak_days', value: 30 }
    },
    
    // Cultural Context Achievements
    {
      code: 'cultural_explorer',
      name: 'सांस्कृतिक खोजकर्ता (Cultural Explorer)',
      description: 'Master 25 words with Indian cultural context',
      icon: '🇮🇳',
      color: 'saffron',
      points: 75,
      culturalContext: true,
      requirements: { type: 'cultural_words_mastered', value: 25 }
    },
    {
      code: 'desi_expert',
      name: 'देसी विशेषज्ञ (Desi Expert)',
      description: 'Excel in Indian English vocabulary',
      icon: '🎭',
      color: 'green',
      points: 100,
      culturalContext: true,
      requirements: { type: 'cultural_accuracy', value: 85 }
    },
    {
      code: 'festival_champion',
      name: 'त्योहार चैंपियन (Festival Champion)',
      description: 'Complete festival-themed quiz during Diwali/Holi',
      icon: '🎊',
      color: 'rainbow',
      points: 50,
      culturalContext: true,
      requirements: { type: 'festival_quiz_completed', value: 1 }
    },
    
    // Subject Mastery
    {
      code: 'science_scholar',
      name: 'विज्ञान विद्वान (Science Scholar)',
      description: 'Master 50 scientific terms',
      icon: '🔬',
      color: 'blue',
      points: 100,
      culturalContext: false,
      requirements: { type: 'subject_mastery', value: 50, timeframe: 'science' }
    },
    {
      code: 'literature_lover',
      name: 'साहित्य प्रेमी (Literature Lover)',
      description: 'Master 50 literary terms',
      icon: '📖',
      color: 'purple',
      points: 100,
      culturalContext: true,
      requirements: { type: 'subject_mastery', value: 50, timeframe: 'literature' }
    },
    
    // Social Achievements
    {
      code: 'class_champion',
      name: 'कक्षा चैंपियन (Class Champion)',
      description: 'Rank #1 in your class leaderboard',
      icon: '🥇',
      color: 'gold',
      points: 200,
      culturalContext: true,
      requirements: { type: 'class_rank', value: 1 }
    },
    {
      code: 'helpful_peer',
      name: 'सहायक मित्र (Helpful Peer)',
      description: 'Help 10 classmates with doubt resolution',
      icon: '🤝',
      color: 'blue',
      points: 150,
      culturalContext: true,
      requirements: { type: 'doubts_helped', value: 10 }
    }
  ]
  
  /**
   * Check and award achievements based on user activity
   */
  async checkAchievements(
    userId: string,
    session: QuizSession,
    analytics: QuizAnalytics,
    existingAchievements: UserAchievement[]
  ): Promise<UserAchievement[]> {
    
    const newAchievements: UserAchievement[] = []
    const earnedCodes = new Set(existingAchievements.map(a => a.achievementCode))
    
    for (const achievement of this.achievements) {
      // Skip if already earned
      if (earnedCodes.has(achievement.code)) {
        continue
      }
      
      // Check if requirements are met
      if (await this.checkRequirement(achievement, userId, session, analytics)) {
        const userAchievement = this.createUserAchievement(userId, achievement)
        newAchievements.push(userAchievement)
      }
    }
    
    return newAchievements
  }
  
  /**
   * Check if a specific achievement requirement is met
   */
  private async checkRequirement(
    achievement: Achievement,
    userId: string,
    session: QuizSession,
    analytics: QuizAnalytics
  ): Promise<boolean> {
    
    const { type, value, timeframe } = achievement.requirements
    
    switch (type) {
      case 'sessions_completed':
        return analytics.questionsAttempted > 0
        
      case 'words_learned':
        return analytics.newWordsLearned >= value
        
      case 'session_accuracy':
        return session.accuracyRate >= value
        
      case 'session_duration':
        return session.durationSeconds <= value
        
      case 'streak_days':
        return analytics.streakDays >= value
        
      case 'cultural_words_mastered':
        return analytics.culturalQuestionsCorrect >= value
        
      case 'cultural_accuracy':
        const culturalAccuracy = analytics.culturalQuestionsCorrect / Math.max(1, analytics.questionsAttempted) * 100
        return culturalAccuracy >= value
        
      case 'festival_quiz_completed':
        return this.isFestivalSeason() && session.sessionType === 'challenge'
        
      case 'subject_mastery':
        // This would require additional data about subject-specific performance
        return analytics.wordsMastered >= value
        
      case 'class_rank':
        // This would require leaderboard data
        return false // Placeholder
        
      case 'doubts_helped':
        // This would require social interaction data
        return false // Placeholder
        
      default:
        return false
    }
  }
  
  /**
   * Create user achievement record
   */
  private createUserAchievement(userId: string, achievement: Achievement): UserAchievement {
    return {
      id: this.generateId(),
      userId,
      achievementType: this.getAchievementType(achievement.code),
      achievementCode: achievement.code,
      achievementName: achievement.name,
      achievementDescription: achievement.description,
      badgeIcon: achievement.icon,
      badgeColor: achievement.color,
      pointsAwarded: achievement.points,
      culturalContext: achievement.culturalContext,
      earnedAt: new Date(),
      isVisible: true
    }
  }
  
  /**
   * Get achievement type based on code
   */
  private getAchievementType(code: string): UserAchievement['achievementType'] {
    if (code.includes('streak') || code.includes('consistent'))
  return 'streak'
    if (code.includes('cultural') || code.includes('desi') || code.includes('festival'))
  return 'cultural'
    if (code.includes('class') || code.includes('helpful'))
  return 'social'
    if (code.includes('accuracy') || code.includes('speed') || code.includes('perfect'))
  return 'performance'
    return 'milestone'
  }
  
  /**
   * Check if it's currently a festival season
   */
  private isFestivalSeason(): boolean {
    const now = new Date()
    const month = now.getMonth() + 1 // 1-12
    const day = now.getDate()
    
    // Diwali season (October-November)
    if ((month === 10 && day >= 15) || (month === 11 && day <= 15)) {
      return true
    }
    
    // Holi season (March)
    if (month === 3 && day >= 1 && day <= 15) {
      return true
    }
    
    // Add more festivals as needed
    return false
  }
  
  /**
   * Get achievement progress for a user
   */
  getAchievementProgress(
    achievement: Achievement,
    analytics: QuizAnalytics,
    session?: QuizSession
  ): { current: number; target: number; percentage: number } {
    
    const { type, value } = achievement.requirements
    let current = 0
    
    switch (type) {
      case 'words_learned':
        current = analytics.newWordsLearned
        break
      case 'streak_days':
        current = analytics.streakDays
        break
      case 'cultural_words_mastered':
        current = analytics.culturalQuestionsCorrect
        break
      case 'session_accuracy':
        current = session?.accuracyRate || 0
        break
      default:
        current = 0
    }
    
    const percentage = Math.min(100, (current / value) * 100)
    
    return {
      current,
      target: value,
      percentage: Math.round(percentage)
    }
  }
  
  /**
   * Get achievements by category
   */
  getAchievementsByCategory(): Record<string, Achievement[]> {
    return {
      milestone: this.achievements.filter(a => a.code.includes('steps') || a.code.includes('builder') || a.code.includes('scholar') || a.code.includes('master') || a.code.includes('sage')),
      performance: this.achievements.filter(a => a.code.includes('sharp') || a.code.includes('perfect') || a.code.includes('speed')),
      streak: this.achievements.filter(a => a.code.includes('streak') || a.code.includes('consistent') || a.code.includes('dedication')),
      cultural: this.achievements.filter(a => a.code.includes('cultural') || a.code.includes('desi') || a.code.includes('festival')),
      subject: this.achievements.filter(a => a.code.includes('science') || a.code.includes('literature')),
      social: this.achievements.filter(a => a.code.includes('class') || a.code.includes('helpful'))
    }
  }
  
  /**
   * Calculate total achievement points for a user
   */
  calculateTotalPoints(userAchievements: UserAchievement[]): number {
    return userAchievements.reduce((total, achievement) => total + achievement.pointsAwarded, 0)
  }
  
  /**
   * Get next achievements to work towards
   */
  getNextAchievements(
    userAchievements: UserAchievement[],
    analytics: QuizAnalytics
  ): Achievement[] {
    const earnedCodes = new Set(userAchievements.map(a => a.achievementCode))
    
    return this.achievements
      .filter(a => !earnedCodes.has(a.code))
      .map(a => ({
        ...a,
        progress: this.getAchievementProgress(a, analytics)
      }))
      .sort((a, b) => b.progress.percentage - a.progress.percentage)
      .slice(0, 5) // Top 5 closest achievements
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
}

// Export singleton instance
export const achievementSystem = new AchievementSystem()
