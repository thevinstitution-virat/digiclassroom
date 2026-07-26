/**
 * TEA-Ch² Assessment Scoring Engine
 * Comprehensive scoring and grade norm calculations
 */

export interface AttentionAssessment {
  id: string
  userId: string
  testDate: Date
  selectiveScore?: number
  sustainedScore?: number
  switchingScore?: number
  selectivePercentile?: number
  sustainedPercentile?: number
  switchingPercentile?: number
  everydayIndex?: number
  belowThreshold?: boolean
  user: {
    name: string
    grade: number
    age: number
  }
}

export interface PomodoroConfig {
  sessionDuration: number // in seconds
  breakDuration: number
  longBreakAfter: number
  longBreakDuration: number
  rationale: string
}

export interface ParentReport {
  studentName: string
  testDate: Date
  overallScore: number
  strengths: string[]
  concerns: string[]
  recommendations: string[]
  nextSteps: string[]
}

export class AttentionScoringEngine {
  // Grade-based attention span expectations (in seconds)
  private readonly ATTENTION_SPAN_NORMS = {
    5: { min: 300, avg: 540, max: 900 },    // 5-9 minutes for 5-year-olds
    6: { min: 360, avg: 600, max: 1080 },   // 6-10 minutes for 6-year-olds  
    7: { min: 420, avg: 720, max: 1200 },   // 7-12 minutes for 7-year-olds
    8: { min: 480, avg: 900, max: 1440 },   // 8-15 minutes for 8-year-olds
    9: { min: 600, avg: 1200, max: 1800 },  // 10-20 minutes for 9-year-olds
    10: { min: 720, avg: 1500, max: 2100 }, // 12-25 minutes for 10-year-olds
    11: { min: 900, avg: 1800, max: 2400 }, // 15-30 minutes for 11-year-olds
    12: { min: 1080, avg: 2100, max: 2700 }, // 18-35 minutes for 12-year-olds
    13: { min: 1200, avg: 2400, max: 3000 }, // 20-40 minutes for 13-year-olds
    14: { min: 1320, avg: 2700, max: 3300 }, // 22-45 minutes for 14-year-olds
    15: { min: 1440, avg: 3000, max: 3600 }  // 24-50+ minutes for 15-year-olds
  } as const

  private readonly PERCENTILE_THRESHOLDS = {
    selective: {
      p10: 0.3,   // 30% accuracy = 10th percentile (concern)
      p25: 0.5,   // 50% accuracy = 25th percentile  
      p50: 0.7,   // 70% accuracy = median
      p75: 0.85,  // 85% accuracy = 75th percentile
      p90: 0.95   // 95% accuracy = 90th percentile
    },
    sustained: {
      p10: 0.4,   // Based on sustained attention research
      p25: 0.6,
      p50: 0.75,
      p75: 0.87,
      p90: 0.95
    },
    switching: {
      p10: 0.25,  // Switching is harder - lower thresholds
      p25: 0.45,
      p50: 0.65,
      p75: 0.8,
      p90: 0.92
    }
  } as const

  /**
   * Calculate percentile rank based on test type and age
   */
  calculatePercentileRank(score: number, testType: 'selective' | 'sustained' | 'switching', age: number): number {
    const thresholds = this.PERCENTILE_THRESHOLDS[testType]
    
    if (score >= thresholds.p90)
  return 90
    if (score >= thresholds.p75)
  return 75
    if (score >= thresholds.p50)
  return 50
    if (score >= thresholds.p25)
  return 25
    if (score >= thresholds.p10)
  return 10
    return 5 // Below 10th percentile
  }

  /**
   * Adapt Pomodoro session length based on attention assessment
   */
  adaptPomodoroSession(attentionScores: AttentionAssessment, currentGrade: number): PomodoroConfig {
    const sustainedPercentile = attentionScores.sustainedPercentile || 50
    const selectivePercentile = attentionScores.selectivePercentile || 50
    
    // Base session length by grade
    let baseSessionMinutes: number
    if (currentGrade <= 4) {
      baseSessionMinutes = 15 // Grades K-4: 15-20 minutes
    } else if (currentGrade <= 6) {
      baseSessionMinutes = 20 // Grades 5-6: 20-25 minutes  
    } else if (currentGrade <= 8) {
      baseSessionMinutes = 25 // Grades 7-8: 25-30 minutes
    } else {
      baseSessionMinutes = 30 // Grades 9-12: 30-35 minutes
    }
    
    // Adjust based on attention scores
    let adjustmentFactor = 1.0
    
    if (sustainedPercentile < 25) {
      adjustmentFactor = 0.7 // Reduce by 30% for low sustained attention
    } else if (sustainedPercentile < 50) {
      adjustmentFactor = 0.85 // Reduce by 15%
    } else if (sustainedPercentile > 75) {
      adjustmentFactor = 1.2 // Increase by 20% for high sustained attention
    }
    
    const adjustedSessionMinutes = Math.round(baseSessionMinutes * adjustmentFactor)
    
    // Break duration (typically 20-25% of session length)
    const breakMinutes = Math.max(3, Math.round(adjustedSessionMinutes * 0.2))
    
    return {
      sessionDuration: adjustedSessionMinutes * 60, // Convert to seconds
      breakDuration: breakMinutes * 60,
      longBreakAfter: 4, // Standard Pomodoro cycle
      longBreakDuration: Math.max(15, adjustedSessionMinutes / 2) * 60,
      rationale: this.generateRationale(sustainedPercentile, selectivePercentile, adjustedSessionMinutes)
    }
  }

  /**
   * Check if parent alert should be triggered
   */
  shouldTriggerParentAlert(assessment: AttentionAssessment): boolean {
    // Alert if any core attention domain is below 10th percentile
    return (
      (assessment.selectivePercentile && assessment.selectivePercentile <= 10) ||
      (assessment.sustainedPercentile && assessment.sustainedPercentile <= 10) ||
      (assessment.switchingPercentile && assessment.switchingPercentile <= 10) ||
      (assessment.everydayIndex && assessment.everydayIndex <= 75) // Overall composite score concern threshold
    )
  }

  /**
   * Generate comprehensive parent report
   */
  generateParentReport(assessment: AttentionAssessment): ParentReport {
    const concerns: string[] = []
    const strengths: string[] = []
    
    // Analyze results
    if (assessment.selectivePercentile && assessment.selectivePercentile <= 10) {
      concerns.push("संकेन्द्रण में कमी (Difficulty focusing with distractions present)")
    } else if (assessment.selectivePercentile && assessment.selectivePercentile >= 75) {
      strengths.push("अच्छा चुनिंदा ध्यान (Good selective attention skills)")
    }
    
    if (assessment.sustainedPercentile && assessment.sustainedPercentile <= 10) {
      concerns.push("लंबे समय तक ध्यान बनाए रखने में कमी (Difficulty maintaining attention for extended periods)")
    } else if (assessment.sustainedPercentile && assessment.sustainedPercentile >= 75) {
      strengths.push("अच्छा निरंतर ध्यान (Strong sustained attention abilities)")
    }
    
    if (assessment.switchingPercentile && assessment.switchingPercentile <= 10) {
      concerns.push("कार्य बदलने में कठिनाई (Difficulty switching between tasks)")
    } else if (assessment.switchingPercentile && assessment.switchingPercentile >= 75) {
      strengths.push("अच्छा कार्य स्विचिंग (Good task switching abilities)")
    }
    
    return {
      studentName: assessment.user.name,
      testDate: assessment.testDate,
      overallScore: assessment.everydayIndex || 0,
      strengths,
      concerns,
      recommendations: this.generateRecommendations(assessment),
      nextSteps: concerns.length > 0 ? [
        "शिक्षक से बात करें (Discuss with teacher)",
        "घर पर ध्यान बढ़ाने की गतिविधियां करें (Practice attention-building activities at home)",
        "यदि चिंता जारी रहे तो विशेषज्ञ से सलाह लें (Consider specialist consultation if concerns persist)"
      ] : [
        "वर्तमान दिनचर्या जारी रखें (Continue current routine)",
        "नियमित अभ्यास के लिए प्रोत्साहित करें (Encourage regular practice)"
      ]
    }
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(assessment: AttentionAssessment): string[] {
    const recommendations: string[] = []
    const pomodoroConfig = this.adaptPomodoroSession(assessment, assessment.user.grade)
    
    recommendations.push(`अनुशंसित अध्ययन सत्र: ${pomodoroConfig.sessionDuration / 60} मिनट (Recommended study sessions: ${pomodoroConfig.sessionDuration / 60} minutes)`)
    
    if (assessment.sustainedPercentile && assessment.sustainedPercentile < 25) {
      recommendations.push("छोटे कार्यों से शुरुआत करें और धीरे-धीरे समय बढ़ाएं (Start with shorter tasks and gradually increase duration)")
    }
    
    if (assessment.selectivePercentile && assessment.selectivePercentile < 25) {
      recommendations.push("शांत वातावरण में अध्ययन करें (Study in a quiet environment with minimal distractions)")
    }
    
    if (assessment.switchingPercentile && assessment.switchingPercentile < 25) {
      recommendations.push("एक समय में एक कार्य पर ध्यान दें (Focus on one task at a time)")
    }
    
    return recommendations
  }

  /**
   * Generate rationale for Pomodoro recommendations
   */
  private generateRationale(sustainedPercentile: number, selectivePercentile: number, sessionMinutes: number): string {
    if (sustainedPercentile < 25) {
      return `Based on your attention assessment, shorter ${sessionMinutes}-minute sessions will help you maintain focus better. आपके ध्यान मूल्यांकन के आधार पर, ${sessionMinutes} मिनट के छोटे सत्र आपको बेहतर फोकस बनाए रखने में मदद करेंगे।`
    } else if (sustainedPercentile > 75) {
      return `Your strong sustained attention allows for longer ${sessionMinutes}-minute study sessions. आपका मजबूत निरंतर ध्यान ${sessionMinutes} मिनट के लंबे अध्ययन सत्रों की अनुमति देता है।`
    } else {
      return `Your attention profile suggests ${sessionMinutes}-minute sessions are optimal for your learning. आपकी ध्यान प्रोफ़ाइल सुझाती है कि ${sessionMinutes} मिनट के सत्र आपके सीखने के लिए इष्टतम हैं।`
    }
  }

  /**
   * Calculate overall everyday attention index
   */
  calculateEverydayIndex(selectiveScore: number, sustainedScore: number, switchingScore?: number): number {
    if (switchingScore !== undefined) {
      // For older children with switching component
      return Math.round((selectiveScore * 0.4 + sustainedScore * 0.4 + switchingScore * 0.2))
    } else {
      // For younger children without switching
      return Math.round((selectiveScore * 0.5 + sustainedScore * 0.5))
    }
  }
}
