/**
 * Mitram Assessments API
 * Handles psychological and aptitude assessment operations
 */

import { NextRequest, NextResponse } from 'next/server'

// Assessment modules configuration
const ASSESSMENT_MODULES = {
  attention: {
    name: 'TEA-Ch² Focus Check',
    description: 'Attention and focus assessment',
    duration: 10,
    ageRange: [5, 15],
    subtests: ['selectivity', 'sustained', 'switching', 'everyday']
  },
  grit: {
    name: '8-Item Grit Scale for Children',
    description: 'Perseverance and passion assessment',
    duration: 5,
    ageRange: [8, 18],
    items: 8
  },
  decision: {
    name: 'ADMQ Decision Making',
    description: 'Decision-making style assessment',
    duration: 8,
    ageRange: [12, 18],
    items: 22
  },
  habit: {
    name: 'Habit Change Inventory',
    description: 'Bad habit identification and change readiness',
    duration: 6,
    ageRange: [10, 18],
    items: 5
  },
  aptitude: {
    name: 'CogAT Mini Aptitude Test',
    description: 'Cognitive abilities assessment',
    duration: 15,
    ageRange: [6, 18],
    domains: ['verbal', 'quantitative', 'nonverbal']
  }
}

// Mock database functions (replace with actual database calls)
const mockDatabase = {
  assessments: new Map(),
  results: new Map(),
  
  getQuestions: (module: string, gradeLevel: number) => {
    const questions = getModuleQuestions(module, gradeLevel)
    return questions
  },
  
  saveSession: (sessionData: any) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const session = {
      id,
      ...sessionData,
      createdAt: new Date().toISOString()
    }
    mockDatabase.assessments.set(id, session)
    return session
  },
  
  saveResult: (resultData: any) => {
    const id = `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const result = {
      id,
      ...resultData,
      createdAt: new Date().toISOString()
    }
    mockDatabase.results.set(id, result)
    return result
  },
  
  getUserResults: (userId: string) => {
    return Array.from(mockDatabase.results.values())
      .filter(result => result.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }
}

// GET /api/mitram/assessments - Get available assessment modules
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const gradeLevel = parseInt(searchParams.get('gradeLevel') || '10')
    const module = searchParams.get('module')

    if (module) {
      // Get specific module details with questions
      if (!ASSESSMENT_MODULES[module as keyof typeof ASSESSMENT_MODULES]) {
        return NextResponse.json({
          success: false,
          error: 'Invalid assessment module'
        }, { status: 400 })
      }

      const moduleConfig = ASSESSMENT_MODULES[module as keyof typeof ASSESSMENT_MODULES]
      const questions = mockDatabase.getQuestions(module, gradeLevel)

      return NextResponse.json({
        success: true,
        module: {
          ...moduleConfig,
          id: module,
          questions,
          gradeLevel
        }
      })
    }

    // Get all available modules
    const modules = Object.entries(ASSESSMENT_MODULES).map(([key, config]) => ({
      id: key,
      ...config,
      available: gradeLevel >= config.ageRange[0] && gradeLevel <= config.ageRange[1]
    }))

    return NextResponse.json({
      success: true,
      modules,
      userGrade: gradeLevel
    })

  } catch (error) {
    console.error('Error fetching assessments:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch assessments'
    }, { status: 500 })
  }
}

// POST /api/mitram/assessments - Submit assessment responses
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, module, responses, sessionId, gradeLevel, board } = body

    // Validate required fields
    if (!userId || !module || !responses || !gradeLevel) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 })
    }

    // Validate module
    if (!ASSESSMENT_MODULES[module as keyof typeof ASSESSMENT_MODULES]) {
      return NextResponse.json({
        success: false,
        error: 'Invalid assessment module'
      }, { status: 400 })
    }

    // Calculate scores based on module
    const scores = calculateModuleScores(module, responses, gradeLevel)
    
    // Generate recommendations
    const recommendations = generateRecommendations(module, scores, gradeLevel)
    
    // Save session if provided
    if (sessionId) {
      mockDatabase.saveSession({
        id: sessionId,
        userId,
        module,
        status: 'completed',
        responses,
        endTime: new Date().toISOString(),
        gradeLevel,
        board
      })
    }

    // Save results
    const result = mockDatabase.saveResult({
      userId,
      module,
      score: scores.overall,
      subScores: scores.detailed,
      recommendations,
      percentile: calculatePercentile(scores.overall, module, gradeLevel),
      gradeLevel,
      board
    })

    // Check for alerts
    const alerts = checkForAlerts(scores, module, gradeLevel)

    return NextResponse.json({
      success: true,
      resultId: result.id,
      scores: scores,
      recommendations,
      alerts,
      nextSteps: getNextSteps(module, scores)
    })

  } catch (error) {
    console.error('Error submitting assessment:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to submit assessment'
    }, { status: 500 })
  }
}

/**
 * Get questions for a specific module and grade level
 */
function getModuleQuestions(module: string, gradeLevel: number) {
  const questionSets = {
    attention: [
      {
        id: 'att_1',
        type: 'selective_attention',
        title: 'Market Focus Task',
        description: 'In this busy Indian marketplace scene, focus only on the fruit vendors.',
        instruction: 'Click on all the apple sellers you can find. Ignore other vendors.',
        stimuli: 'marketplace_scene_1',
        timeLimit: 60,
        culturalContext: 'indian'
      },
      {
        id: 'att_2',
        type: 'sustained_attention',
        title: 'Cricket Boundary Watch',
        description: 'Watch this cricket match highlight and stay alert.',
        instruction: 'Press SPACE every time you see a boundary (4 or 6 runs).',
        stimuli: 'cricket_highlight_1',
        timeLimit: 300,
        culturalContext: 'indian'
      }
    ],
    
    grit: [
      {
        id: 'grit_1',
        type: 'consistency',
        question: 'मैं अक्सर कोई नया लक्ष्य निर्धारित करता हूँ लेकिन बाद में उस पर काम करना बंद कर देता हूँ।',
        englishTranslation: 'I often set a goal but later choose to pursue a different one.',
        options: [
          { value: 1, text: 'बिल्कुल मेरे जैसा नहीं', english: 'Not like me at all' },
          { value: 2, text: 'मेरे जैसा नहीं', english: 'Not much like me' },
          { value: 3, text: 'कुछ हद तक मेरे जैसा', english: 'Somewhat like me' },
          { value: 4, text: 'ज्यादातर मेरे जैसा', english: 'Mostly like me' },
          { value: 5, text: 'बिल्कुल मेरे जैसा', english: 'Very much like me' }
        ],
        reverse: true
      },
      {
        id: 'grit_2',
        type: 'perseverance',
        question: 'कठिनाइयों का सामना करने पर मैं हार नहीं मानता।',
        englishTranslation: 'Setbacks don\'t discourage me.',
        options: [
          { value: 1, text: 'बिल्कुल मेरे जैसा नहीं', english: 'Not like me at all' },
          { value: 2, text: 'मेरे जैसा नहीं', english: 'Not much like me' },
          { value: 3, text: 'कुछ हद तक मेरे जैसा', english: 'Somewhat like me' },
          { value: 4, text: 'ज्यादातर मेरे जैसा', english: 'Mostly like me' },
          { value: 5, text: 'बिल्कुल मेरे जैसा', english: 'Very much like me' }
        ],
        reverse: false
      }
    ],
    
    decision: [
      {
        id: 'dec_1',
        type: 'vigilance',
        question: 'When choosing between IIT-JEE and NEET preparation, I carefully research all aspects before deciding.',
        options: [
          { value: 1, text: 'Never true' },
          { value: 2, text: 'Rarely true' },
          { value: 3, text: 'Sometimes true' },
          { value: 4, text: 'Often true' },
          { value: 5, text: 'Always true' }
        ]
      }
    ],
    
    habit: [
      {
        id: 'hab_1',
        type: 'cue_identification',
        question: 'What usually triggers your mobile phone usage during study time?',
        options: [
          { value: 1, text: 'Notifications' },
          { value: 2, text: 'Boredom' },
          { value: 3, text: 'Difficult topics' },
          { value: 4, text: 'Friend messages' },
          { value: 5, text: 'Other' }
        ]
      }
    ],
    
    aptitude: [
      {
        id: 'apt_1',
        type: 'verbal',
        question: 'विद्या : ज्ञान :: धन : ?',
        englishTranslation: 'Knowledge : Wisdom :: Wealth : ?',
        options: [
          { value: 'A', text: 'पैसा (Money)' },
          { value: 'B', text: 'संपत्ति (Property)' },
          { value: 'C', text: 'सुख (Happiness)' },
          { value: 'D', text: 'शक्ति (Power)' }
        ],
        correct: 'C'
      }
    ]
  }

  return questionSets[module as keyof typeof questionSets] || []
}

/**
 * Calculate scores for different modules
 */
function calculateModuleScores(module: string, responses: any, gradeLevel: number) {
  switch (module) {
    case 'attention':
      return calculateAttentionScores(responses)
    case 'grit':
      return calculateGritScores(responses)
    case 'decision':
      return calculateDecisionScores(responses)
    case 'habit':
      return calculateHabitScores(responses)
    case 'aptitude':
      return calculateAptitudeScores(responses)
    default:
      return { overall: 0, detailed: {} }
  }
}

function calculateAttentionScores(responses: any) {
  // Mock calculation - replace with actual scoring logic
  return {
    overall: 75,
    detailed: {
      selectivity: 80,
      sustained: 70,
      switching: 75,
      everyday: 78
    }
  }
}

function calculateGritScores(responses: any) {
  // Calculate grit score from 8-item responses
  let total = 0
  let count = 0
  
  Object.values(responses).forEach((response: any) => {
    if (typeof response === 'number') {
      total += response
      count++
    }
  })
  
  const average = count > 0 ? total / count : 0
  
  return {
    overall: Math.round(average * 20), // Convert to 0-100 scale
    detailed: {
      consistency: Math.round((average - 0.5) * 20),
      perseverance: Math.round((average + 0.5) * 20)
    }
  }
}

function calculateDecisionScores(responses: any) {
  return {
    overall: 68,
    detailed: {
      vigilance: 75,
      panic: 45,
      complacency: 60,
      evasiveness: 40
    }
  }
}

function calculateHabitScores(responses: any) {
  return {
    overall: 65,
    detailed: {
      cueIdentification: 70,
      routineAwareness: 60,
      rewardUnderstanding: 65,
      changeReadiness: 68
    }
  }
}

function calculateAptitudeScores(responses: any) {
  return {
    overall: 82,
    detailed: {
      verbal: 85,
      quantitative: 78,
      nonverbal: 83
    }
  }
}

/**
 * Generate recommendations based on scores
 */
function generateRecommendations(module: string, scores: any, gradeLevel: number): string[] {
  const recommendations: string[] = []
  
  switch (module) {
    case 'attention':
      if (scores.detailed.sustained < 60) {
        recommendations.push('Practice meditation for 10 minutes daily to improve sustained attention')
        recommendations.push('Use shorter study sessions (15-20 minutes) with frequent breaks')
      }
      if (scores.detailed.selectivity < 60) {
        recommendations.push('Practice focusing exercises in noisy environments')
      }
      break
      
    case 'grit':
      if (scores.overall < 60) {
        recommendations.push('Set smaller, achievable goals to build consistency')
        recommendations.push('Find a study buddy for accountability')
        recommendations.push('Celebrate small wins to maintain motivation')
      }
      break
      
    // Add more module-specific recommendations
  }
  
  return recommendations
}

/**
 * Calculate percentile based on grade norms
 */
function calculatePercentile(score: number, module: string, gradeLevel: number): number {
  // Mock percentile calculation - replace with actual norm data
  const gradeAdjustment = gradeLevel >= 11 ? 5 : 0
  return Math.min(99, Math.max(1, score + gradeAdjustment - 10))
}

/**
 * Check for alerts based on scores
 */
function checkForAlerts(scores: any, module: string, gradeLevel: number) {
  const alerts = []
  
  if (scores.overall < 40) {
    alerts.push({
      type: 'low_score',
      severity: 'high',
      message: `${module} score is below grade level expectations`,
      action: 'Consider intervention strategies'
    })
  }
  
  return alerts
}

/**
 * Get next steps based on assessment results
 */
function getNextSteps(module: string, scores: any) {
  return [
    'Review your detailed results',
    'Share results with parents/teachers',
    'Follow recommended interventions',
    'Retake assessment in 4 weeks'
  ]
}
