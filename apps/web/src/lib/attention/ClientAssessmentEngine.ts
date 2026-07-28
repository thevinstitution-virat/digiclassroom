/**
 * Client-Side TEA-Ch² Assessment Engine
 * Simplified version for client-side use without database dependencies
 */

export interface AttentionResponse {
  stimulusId: string
  stimulusType: 'target' | 'distractor' | 'neutral'
  responseTime: number // milliseconds
  correct: boolean
  timestamp: number
  screenPosition: { x: number; y: number }
  trialNumber: number
  sessionTime: number
}

export interface BehaviorMetrics {
  totalTime: number
  idleTime: number
  distractionEvents: number
  clickAccuracy: number
  responseVariability: number
  engagementScore: number
}

export interface GameConfig {
  targetCount?: number
  distractorRatio?: number
  colors?: string[]
  animationSpeed?: number
  targetSize?: 'small' | 'medium' | 'large'
  gridSize?: string
  targetSymbol?: string
  distractorSymbols?: string[]
  targetDensity?: number
  soundSets?: string[]
  countingRange?: number[]
  intervalVariability?: number
  backgroundNoise?: boolean
  beepFrequency?: string
  countingTrials?: number
  maxBeepsPerTrial?: number
  distractorSounds?: boolean
  items?: string[]
  switchTrials?: number
  itemsPerTrial?: number
  switchCue?: string
  duration?: number
}

export interface AttentionSubtest {
  id: string
  name: string
  type: 'selective' | 'sustained' | 'switching' | 'reaction'
  duration: number // seconds
  instructions: {
    english: string
    hindi: string
    demo?: boolean
  }
  gameConfig: GameConfig
  scoringRubric: ScoringRubric
}

export interface ScoringRubric {
  maxScore: number
  timeBonus: boolean
  accuracyWeight: number
  speedWeight: number
  consistencyWeight: number
}

export interface SubtestResult {
  subtestId: string
  rawScore: number
  scaledScore: number
  percentile: number
  accuracy: number
  averageReactionTime: number
  engagementScore: number
  completionTime: number
  flagged: boolean
}

export class ClientAssessmentEngine {
  private readonly AGE_GROUPS = {
    JUNIOR: '5-7',
    ADOLESCENT: '8-15'
  } as const

  /**
   * Generate age-appropriate game configuration
   */
  generateGameConfig(testType: string, grade: number, age: number): GameConfig {
    switch (testType) {
      case 'BALLOON_HUNT':
        return {
          targetCount: Math.min(12 + grade * 2, 25),
          distractorRatio: Math.min(0.2 + grade * 0.05, 0.4),
          colors: ['red', 'blue', 'yellow', 'green', 'purple'],
          animationSpeed: age >= 7 ? 1.2 : 1.0,
          targetSize: age <= 6 ? 'large' : 'medium',
          duration: 120 // 2 minutes
        }
        
      case 'HECTOR_CANCELLATION':
        return {
          gridSize: grade <= 6 ? '8x8' : '10x10',
          targetSymbol: '◆',
          distractorSymbols: ['◇', '○', '□', '△', '☆'],
          targetDensity: Math.min(0.12 + grade * 0.01, 0.18),
          duration: 180 // 3 minutes
        }
        
      case 'BARKING':
        return {
          soundSets: ['dogs', 'cats', 'birds'],
          countingRange: [2, Math.min(6 + Math.floor(grade/2), 10)],
          intervalVariability: 0.7,
          backgroundNoise: grade >= 4,
          duration: 120 // 2 minutes
        }
        
      case 'VIGIL': 
        return {
          beepFrequency: 'irregular',
          countingTrials: Math.min(6 + grade, 10),
          maxBeepsPerTrial: Math.min(4 + Math.floor(grade/2), 8),
          distractorSounds: grade >= 6,
          duration: 150 // 2.5 minutes
        }
        
      case 'REDS_BLUES':
        return {
          items: ['red_circle', 'blue_circle', 'red_square', 'blue_square'],
          switchTrials: Math.min(3 + Math.floor(grade/3), 6),
          itemsPerTrial: Math.min(8 + grade, 15),
          switchCue: 'visual_text',
          duration: 180 // 3 minutes
        }

      case 'REACTION_TIME':
        return {
          targetCount: 20,
          colors: ['green'],
          targetSize: 'large',
          duration: 60 // 1 minute
        }
        
      default:
        return {
          duration: 120 // Default 2 minutes
        }
    }
  }

  /**
   * Calculate basic performance metrics
   */
  calculateBasicMetrics(responses: AttentionResponse[], behaviorMetrics: BehaviorMetrics) {
    const correctResponses = responses.filter(r => r.correct)
    const accuracy = responses.length > 0 ? correctResponses.length / responses.length : 0
    const averageReactionTime = correctResponses.length > 0 
      ? correctResponses.reduce((sum, r) => sum + r.responseTime, 0) / correctResponses.length 
      : 0

    // Calculate response variability
    const reactionTimes = correctResponses.map(r => r.responseTime)
    const rtMean = averageReactionTime
    const rtVariance = reactionTimes.length > 1
      ? reactionTimes.reduce((sum, rt) => sum + Math.pow(rt - rtMean, 2), 0) / reactionTimes.length
      : 0
    const responseVariability = rtMean > 0 ? Math.sqrt(rtVariance) / rtMean : 0

    return {
      accuracy: accuracy * 100,
      averageReactionTime,
      responseVariability,
      correctCount: correctResponses.length,
      totalCount: responses.length,
      engagementScore: behaviorMetrics.engagementScore
    }
  }

  /**
   * Calculate raw score based on test type
   */
  calculateRawScore(responses: AttentionResponse[], testType: string, behaviorMetrics: BehaviorMetrics): number {
    const metrics = this.calculateBasicMetrics(responses, behaviorMetrics)
    let score = metrics.accuracy // Start with accuracy percentage

    // Adjust based on test type
    if (testType.includes('selective') || testType.includes('BALLOON_HUNT')) {
      // Selective attention: accuracy is key, speed bonus
      const speedBonus = Math.max(0, (1000 - metrics.averageReactionTime) / 1000 * 10)
      score = Math.min(100, score + speedBonus)
    } else if (testType.includes('sustained')) {
      // Sustained attention: consistency is key
      const consistencyPenalty = metrics.responseVariability * 10
      score = Math.max(0, score - consistencyPenalty)
    } else if (testType.includes('switching')) {
      // Switching attention: flexibility, penalize slow responses more
      const rtPenalty = Math.min(metrics.averageReactionTime / 100, 15)
      score = Math.max(0, score - rtPenalty)
    }

    // Apply engagement bonus/penalty
    const engagementAdjustment = (behaviorMetrics.engagementScore - 50) / 50 * 5
    score = Math.max(0, Math.min(100, score + engagementAdjustment))

    return Math.round(score)
  }

  /**
   * Simple percentile calculation without database
   */
  calculatePercentile(score: number, testType: string, age: number): number {
    const thresholds = {
      selective: { p90: 95, p75: 85, p50: 70, p25: 50, p10: 30 },
      sustained: { p90: 95, p75: 87, p50: 75, p25: 60, p10: 40 },
      switching: { p90: 92, p75: 80, p50: 65, p25: 45, p10: 25 }
    }

    const typeKey = testType.includes('selective') ? 'selective' :
                   testType.includes('sustained') ? 'sustained' :
                   testType.includes('switching') ? 'switching' : 'selective'
    
    const typeThresholds = thresholds[typeKey]
    
    // Age adjustment (older children have slightly higher expectations)
    const ageAdjustment = Math.max(0, (age - 8) * 1.5)
    const adjustedScore = score + ageAdjustment

    if (adjustedScore >= typeThresholds.p90)
  return 95
    if (adjustedScore >= typeThresholds.p75)
  return 85
    if (adjustedScore >= typeThresholds.p50)
  return 50
    if (adjustedScore >= typeThresholds.p25)
  return 25
    if (adjustedScore >= typeThresholds.p10)
  return 15
    return 5
  }

  /**
   * Generate assessment summary for API submission
   */
  generateAssessmentSummary(
    responses: AttentionResponse[], 
    behaviorMetrics: BehaviorMetrics, 
    testType: string, 
    age: number, 
    grade: number
  ) {
    const rawScore = this.calculateRawScore(responses, testType, behaviorMetrics)
    const percentile = this.calculatePercentile(rawScore, testType, age)
    const metrics = this.calculateBasicMetrics(responses, behaviorMetrics)

    return {
      rawScore,
      percentile,
      accuracy: metrics.accuracy,
      averageReactionTime: metrics.averageReactionTime,
      responseVariability: metrics.responseVariability,
      engagementScore: metrics.engagementScore,
      totalResponses: responses.length,
      correctResponses: metrics.correctCount,
      testType,
      age,
      grade,
      flagged: percentile < 10 // Flag if below 10th percentile
    }
  }
}
