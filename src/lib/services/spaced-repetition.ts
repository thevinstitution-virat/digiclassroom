/**
 * VG Kosh Spaced Repetition Algorithm
 * Implementation of SM-2 algorithm with Indian educational adaptations
 */

import { SpacedRepetitionCard, SpacedRepetitionPerformance } from '@/lib/types/quiz'

export class SpacedRepetitionService {
  
  /**
   * Calculate next review date using SM-2 algorithm
   * Adapted for Indian educational patterns and cultural context
   */
  calculateNextReview(
    card: SpacedRepetitionCard, 
    performance: SpacedRepetitionPerformance
  ): Partial<SpacedRepetitionCard> {
    const { quality, responseTime, hintUsed, confidenceLevel } = performance
    
    // Adjust quality based on response time and hints
    let adjustedQuality = quality
    
    // Penalty for using hints
    if (hintUsed) {
      adjustedQuality = Math.max(0, adjustedQuality - 1)
    }
    
    // Penalty for slow response (cultural adaptation for Indian students)
    const expectedResponseTime = this.getExpectedResponseTime(card.difficultyLevel)
    if (responseTime > expectedResponseTime * 2) {
      adjustedQuality = Math.max(0, adjustedQuality - 1)
    }
    
    // Bonus for high confidence
    if (confidenceLevel >= 4 && adjustedQuality >= 4) {
      adjustedQuality = Math.min(5, adjustedQuality + 1)
    }
    
    let newEaseFactor = card.easeFactor
    let newInterval = card.intervalDays
    let newRepetitions = card.repetitions
    let newMasteryLevel = card.masteryLevel
    let newLearningStage = card.learningStage
    
    // Update repetitions and reviews
    newRepetitions += 1
    const totalReviews = card.totalReviews + 1
    const correctReviews = card.correctReviews + (adjustedQuality >= 3 ? 1 : 0)
    
    // Calculate mastery level (0-100%)
    const successRate = correctReviews / totalReviews
    newMasteryLevel = Math.round(successRate * 100)
    
    // Update learning stage based on mastery and repetitions
    newLearningStage = this.updateLearningStage(
      card.learningStage, 
      newMasteryLevel, 
      newRepetitions,
      adjustedQuality
    )
    
    // SM-2 Algorithm implementation
    if (adjustedQuality >= 3) {
      // Correct answer
      if (newRepetitions === 1) {
        newInterval = 1
      } else if (newRepetitions === 2) {
        newInterval = 6
      } else {
        newInterval = Math.round(card.intervalDays * newEaseFactor)
      }
      
      // Update ease factor
      newEaseFactor = newEaseFactor + (0.1 - (5 - adjustedQuality) * (0.08 + (5 - adjustedQuality) * 0.02))
      newEaseFactor = Math.max(1.3, newEaseFactor)
      
    } else {
      // Incorrect answer - reset to beginning
      newRepetitions = 0
      newInterval = 1
      newEaseFactor = Math.max(1.3, newEaseFactor - 0.2)
    }
    
    // Cultural context adaptation for Indian students
    newInterval = this.adaptIntervalForIndianContext(
      newInterval, 
      card.culturalContextMastery,
      card.difficultyLevel
    )
    
    // Calculate next review date
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + newInterval)
    
    return {
      intervalDays: newInterval,
      repetitions: newRepetitions,
      easeFactor: newEaseFactor,
      lastReviewed: new Date(),
      nextReview,
      masteryLevel: newMasteryLevel,
      totalReviews,
      correctReviews,
      incorrectReviews: totalReviews - correctReviews,
      learningStage: newLearningStage,
      updatedAt: new Date()
    }
  }
  
  /**
   * Update learning stage based on performance
   */
  private updateLearningStage(
    currentStage: SpacedRepetitionCard['learningStage'],
    masteryLevel: number,
    repetitions: number,
    quality: number
  ): SpacedRepetitionCard['learningStage'] {
    
    // Stage progression based on mastery and repetitions
    if (masteryLevel >= 90 && repetitions >= 5) {
      return 'mastered'
    } else if (masteryLevel >= 75 && repetitions >= 3) {
      return 'mastering'
    } else if (masteryLevel >= 60 && repetitions >= 2) {
      return 'practicing'
    } else if (repetitions >= 1) {
      return 'learning'
    } else {
      return 'new'
    }
  }
  
  /**
   * Adapt interval for Indian educational context
   */
  private adaptIntervalForIndianContext(
    interval: number,
    culturalContextMastery: number,
    difficultyLevel: string
  ): number {
    let adaptedInterval = interval
    
    // Shorter intervals for cultural context words (Indian students need more practice)
    if (culturalContextMastery < 70) {
      adaptedInterval = Math.max(1, Math.round(interval * 0.7))
    }
    
    // Adjust for difficulty level
    switch (difficultyLevel) {
      case 'hard':
        adaptedInterval = Math.max(1, Math.round(interval * 0.8))
        break
      case 'easy':
        adaptedInterval = Math.round(interval * 1.2)
        break
      default:
        // medium - no change
        break
    }
    
    // Ensure minimum and maximum intervals
    adaptedInterval = Math.max(1, Math.min(365, adaptedInterval))
    
    return adaptedInterval
  }
  
  /**
   * Get expected response time based on difficulty
   */
  private getExpectedResponseTime(difficultyLevel: string): number {
    switch (difficultyLevel) {
      case 'easy': return 10 // 10 seconds
      case 'medium': return 20 // 20 seconds
      case 'hard': return 30 // 30 seconds
      default: return 20
    }
  }
  
  /**
   * Get due words for review
   */
  getDueWords(cards: SpacedRepetitionCard[]): SpacedRepetitionCard[] {
    const now = new Date()
    return cards.filter(card => 
      card.isActive && 
      card.nextReview <= now
    ).sort((a, b) => a.nextReview.getTime() - b.nextReview.getTime())
  }
  
  /**
   * Create new spaced repetition card
   */
  createNewCard(userId: string, wordId: string): Partial<SpacedRepetitionCard> {
    const now = new Date()
    const nextReview = new Date()
    nextReview.setDate(nextReview.getDate() + 1) // Review tomorrow
    
    return {
      userId,
      wordId,
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReview,
      masteryLevel: 0,
      difficultyLevel: 'medium',
      totalReviews: 0,
      correctReviews: 0,
      incorrectReviews: 0,
      learningStage: 'new',
      culturalContextMastery: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    }
  }
  
  /**
   * Calculate optimal study session size
   */
  calculateOptimalSessionSize(
    totalDueWords: number,
    userLevel: number,
    availableTime: number
  ): number {
    // Base session size
    let sessionSize = Math.min(20, totalDueWords)
    
    // Adjust for user level (beginners get smaller sessions)
    if (userLevel < 3) {
      sessionSize = Math.min(10, sessionSize)
    } else if (userLevel > 7) {
      sessionSize = Math.min(30, sessionSize)
    }
    
    // Adjust for available time (assuming 1 minute per question)
    if (availableTime > 0) {
      sessionSize = Math.min(sessionSize, Math.floor(availableTime / 60))
    }
    
    return Math.max(1, sessionSize)
  }
  
  /**
   * Get learning statistics
   */
  getLearningStats(cards: SpacedRepetitionCard[]) {
    const total = cards.length
    const byStage = cards.reduce((acc, card) => {
      acc[card.learningStage] = (acc[card.learningStage] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const averageMastery = cards.reduce((sum, card) => sum + card.masteryLevel, 0) / total
    const dueToday = this.getDueWords(cards).length
    
    const nextWeekDue = cards.filter(card => {
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      return card.nextReview <= weekFromNow && card.nextReview > new Date()
    }).length
    
    return {
      total,
      byStage,
      averageMastery: Math.round(averageMastery),
      dueToday,
      nextWeekDue,
      masteredWords: byStage.mastered || 0,
      learningWords: (byStage.new || 0) + (byStage.learning || 0),
      practicingWords: (byStage.practicing || 0) + (byStage.mastering || 0)
    }
  }
  
  /**
   * Predict next review dates for planning
   */
  predictNextReviews(cards: SpacedRepetitionCard[], days: number = 7): Date[] {
    const predictions: Date[] = []
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + days)
    
    for (const card of cards) {
      let currentDate = new Date(card.nextReview)
      while (currentDate <= endDate) {
        predictions.push(new Date(currentDate))
        // Estimate next interval (simplified)
        const estimatedInterval = Math.round(card.intervalDays * card.easeFactor)
        currentDate.setDate(currentDate.getDate() + estimatedInterval)
      }
    }
    
    return predictions.sort((a, b) => a.getTime() - b.getTime())
  }
}
