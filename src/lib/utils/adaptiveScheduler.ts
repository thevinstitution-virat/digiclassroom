/**
 * Adaptive Scheduler Utility
 * Adjusts session duration based on engagement and performance
 */

export interface SessionAdjustment {
  newDuration: number
  reason: string
  confidence: number
}

export interface UserPerformanceData {
  averageEngagement: number
  completionRate: number
  preferredDuration: number
  recentSessions: number
  grade: number
}

export class AdaptiveScheduler {
  /**
   * Adjust session duration based on engagement score and grade
   */
  static adjustSessionDuration(
    currentDuration: number, 
    engagementScore: number, 
    grade: number,
    performanceData?: UserPerformanceData
  ): SessionAdjustment {
    const baseAdjustment = this.getBaseAdjustment(engagementScore)
    const gradeModifier = this.getGradeModifier(grade)
    const performanceModifier = performanceData ? this.getPerformanceModifier(performanceData) : 1
    
    let adjustment = baseAdjustment * gradeModifier * performanceModifier
    let newDuration = currentDuration + adjustment
    
    // Ensure within acceptable bounds
    const bounds = this.getGradeBounds(grade)
    newDuration = Math.max(bounds.min, Math.min(bounds.max, newDuration))
    
    // Round to nearest 5 minutes
    newDuration = Math.round(newDuration / 5) * 5
    
    const reason = this.getAdjustmentReason(engagementScore, adjustment, performanceData)
    const confidence = this.calculateConfidence(engagementScore, performanceData)
    
    return {
      newDuration,
      reason,
      confidence
    }
  }

  /**
   * Get base adjustment based on engagement score
   */
  private static getBaseAdjustment(engagementScore: number): number {
    if (engagementScore >= 90) return 3 // Excellent engagement - increase duration
    if (engagementScore >= 80) return 2 // Good engagement - slight increase
    if (engagementScore >= 70) return 1 // Fair engagement - minimal increase
    if (engagementScore >= 60) return 0 // Average engagement - no change
    if (engagementScore >= 50) return -1 // Below average - slight decrease
    if (engagementScore >= 40) return -2 // Poor engagement - decrease
    return -3 // Very poor engagement - significant decrease
  }

  /**
   * Get grade-based modifier
   */
  private static getGradeModifier(grade: number): number {
    const modifiers = {
      9: 0.8,  // Younger students - smaller adjustments
      10: 0.9,
      11: 1.0, // Standard adjustments
      12: 1.1  // Senior students - larger adjustments
    }
    return modifiers[grade as keyof typeof modifiers] || 1.0
  }

  /**
   * Get performance-based modifier
   */
  private static getPerformanceModifier(performanceData: UserPerformanceData): number {
    const { averageEngagement, completionRate, recentSessions } = performanceData
    
    // Base modifier on historical performance
    let modifier = 1.0
    
    // Adjust based on average engagement
    if (averageEngagement >= 80) modifier += 0.1
    else if (averageEngagement <= 50) modifier -= 0.1
    
    // Adjust based on completion rate
    if (completionRate >= 0.9) modifier += 0.1
    else if (completionRate <= 0.6) modifier -= 0.1
    
    // Adjust based on recent activity (more sessions = more confidence)
    if (recentSessions >= 10) modifier += 0.05
    else if (recentSessions <= 3) modifier -= 0.05
    
    return Math.max(0.5, Math.min(1.5, modifier))
  }

  /**
   * Get grade-specific duration bounds
   */
  private static getGradeBounds(grade: number): { min: number; max: number } {
    const bounds = {
      9: { min: 15, max: 25 },
      10: { min: 15, max: 30 },
      11: { min: 20, max: 35 },
      12: { min: 25, max: 45 }
    }
    return bounds[grade as keyof typeof bounds] || { min: 20, max: 30 }
  }

  /**
   * Get human-readable reason for adjustment
   */
  private static getAdjustmentReason(
    engagementScore: number, 
    adjustment: number,
    performanceData?: UserPerformanceData
  ): string {
    if (adjustment > 2) {
      return "Excellent focus! Increasing session duration to challenge you more."
    } else if (adjustment > 0) {
      return "Good engagement. Slightly increasing session length."
    } else if (adjustment === 0) {
      return "Maintaining current duration based on your performance."
    } else if (adjustment > -2) {
      return "Reducing session time to help maintain focus."
    } else {
      return "Significantly reducing duration to improve concentration."
    }
  }

  /**
   * Calculate confidence in the adjustment
   */
  private static calculateConfidence(
    engagementScore: number,
    performanceData?: UserPerformanceData
  ): number {
    let confidence = 0.5 // Base confidence
    
    // Higher confidence for extreme scores
    if (engagementScore >= 80 || engagementScore <= 40) {
      confidence += 0.3
    }
    
    // Higher confidence with more historical data
    if (performanceData && performanceData.recentSessions >= 5) {
      confidence += 0.2
    }
    
    return Math.min(1.0, confidence)
  }

  /**
   * Get optimal session duration for a new user
   */
  static getOptimalStartingDuration(grade: number, subject: string): number {
    const baseDurations = {
      9: 20,
      10: 20,
      11: 25,
      12: 30
    }
    
    let duration = baseDurations[grade as keyof typeof baseDurations] || 25
    
    // Adjust based on subject complexity
    const complexSubjects = ['mathematics', 'physics', 'chemistry']
    const simpleSubjects = ['english', 'hindi', 'social_science']
    
    if (complexSubjects.includes(subject.toLowerCase())) {
      duration += 5
    } else if (simpleSubjects.includes(subject.toLowerCase())) {
      duration -= 5
    }
    
    return Math.max(15, Math.min(35, duration))
  }

  /**
   * Calculate break duration based on session length
   */
  static calculateBreakDuration(sessionDuration: number, grade: number): number {
    // Base break duration is 20% of session duration
    let breakDuration = Math.round(sessionDuration * 0.2)
    
    // Minimum and maximum break durations by grade
    const breakBounds = {
      9: { min: 3, max: 8 },
      10: { min: 3, max: 10 },
      11: { min: 5, max: 12 },
      12: { min: 5, max: 15 }
    }
    
    const bounds = breakBounds[grade as keyof typeof breakBounds] || { min: 5, max: 10 }
    
    return Math.max(bounds.min, Math.min(bounds.max, breakDuration))
  }

  /**
   * Suggest next session timing based on performance patterns
   */
  static suggestNextSessionTiming(
    performanceData: UserPerformanceData,
    currentTime: Date = new Date()
  ): Date {
    const hour = currentTime.getHours()
    
    // Default to 2 hours later
    let nextSession = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000)
    
    // Adjust based on time of day and grade
    if (performanceData.grade <= 10) {
      // Younger students - prefer earlier sessions
      if (hour >= 18) {
        // If it's evening, suggest tomorrow morning
        nextSession = new Date(currentTime)
        nextSession.setDate(nextSession.getDate() + 1)
        nextSession.setHours(7, 0, 0, 0)
      }
    } else {
      // Senior students - more flexible timing
      if (hour >= 22) {
        // If it's very late, suggest tomorrow
        nextSession = new Date(currentTime)
        nextSession.setDate(nextSession.getDate() + 1)
        nextSession.setHours(8, 0, 0, 0)
      }
    }
    
    return nextSession
  }

  /**
   * Get session difficulty recommendation
   */
  static getSessionDifficulty(
    engagementScore: number,
    completionRate: number,
    grade: number
  ): 'easy' | 'medium' | 'hard' {
    // High engagement and completion - can handle harder content
    if (engagementScore >= 80 && completionRate >= 0.8) {
      return 'hard'
    }
    
    // Low engagement or completion - need easier content
    if (engagementScore <= 50 || completionRate <= 0.5) {
      return 'easy'
    }
    
    return 'medium'
  }

  /**
   * Generate session recommendations
   */
  static generateSessionRecommendations(
    currentDuration: number,
    engagementScore: number,
    grade: number,
    subject: string,
    performanceData?: UserPerformanceData
  ) {
    const adjustment = this.adjustSessionDuration(currentDuration, engagementScore, grade, performanceData)
    const breakDuration = this.calculateBreakDuration(adjustment.newDuration, grade)
    const difficulty = performanceData 
      ? this.getSessionDifficulty(engagementScore, performanceData.completionRate, grade)
      : 'medium'
    const nextTiming = performanceData 
      ? this.suggestNextSessionTiming(performanceData)
      : new Date(Date.now() + 2 * 60 * 60 * 1000)

    return {
      sessionDuration: adjustment.newDuration,
      breakDuration,
      difficulty,
      nextSessionTime: nextTiming,
      adjustmentReason: adjustment.reason,
      confidence: adjustment.confidence,
      recommendations: [
        `Study for ${adjustment.newDuration} minutes`,
        `Take a ${breakDuration}-minute break`,
        `Focus on ${difficulty} difficulty topics`,
        `Next session suggested at ${nextTiming.toLocaleTimeString()}`
      ]
    }
  }
}
