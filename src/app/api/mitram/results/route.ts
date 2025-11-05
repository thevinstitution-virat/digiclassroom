/**
 * Mitram Results API
 * Handles retrieval and analysis of assessment results
 */

import { NextRequest, NextResponse } from 'next/server'

// Mock database for results
const mockResultsDB = {
  results: new Map(),
  progress: new Map(),
  
  getUserResults: (userId: string, module?: string) => {
    const allResults = Array.from(mockResultsDB.results.values())
      .filter((result: any) => result.userId === userId)
    
    if (module) {
      return allResults.filter((result: any) => result.module === module)
    }
    
    return allResults.sort((a: any, b: any) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  },
  
  getProgressData: (userId: string) => {
    return mockResultsDB.progress.get(userId) || generateMockProgress(userId)
  },
  
  getClassAnalytics: (gradeLevel: number, board: string) => {
    return generateClassAnalytics(gradeLevel, board)
  }
}

// Initialize with some mock data
function initializeMockData() {
  const sampleResults = [
    {
      id: 'result_1',
      userId: 'user_123',
      module: 'attention',
      score: 75,
      subScores: {
        selectivity: 80,
        sustained: 70,
        switching: 75,
        everyday: 78
      },
      percentile: 65,
      gradeLevel: 10,
      board: 'CBSE',
      recommendations: [
        'Practice meditation for 10 minutes daily',
        'Use shorter study sessions with breaks'
      ],
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: 'result_2',
      userId: 'user_123',
      module: 'grit',
      score: 68,
      subScores: {
        consistency: 65,
        perseverance: 72
      },
      percentile: 58,
      gradeLevel: 10,
      board: 'CBSE',
      recommendations: [
        'Set smaller, achievable goals',
        'Find a study buddy for accountability'
      ],
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]
  
  sampleResults.forEach(result => {
    mockResultsDB.results.set(result.id, result)
  })
}

initializeMockData()

// GET /api/mitram/results - Get user assessment results
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const module = searchParams.get('module')
    const includeProgress = searchParams.get('includeProgress') === 'true'
    const includeAnalytics = searchParams.get('includeAnalytics') === 'true'
    const gradeLevel = parseInt(searchParams.get('gradeLevel') || '10')
    const board = searchParams.get('board') || 'CBSE'

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId parameter'
      }, { status: 400 })
    }

    // Get user results
    const results = mockResultsDB.getUserResults(userId, module || undefined)
    
    // Prepare response data
    const responseData: any = {
      success: true,
      results: results.map(result => ({
        ...result,
        moduleDisplayName: getModuleDisplayName(result.module),
        scoreInterpretation: interpretScore(result.score, result.module),
        improvementTrend: calculateImprovementTrend(results, result.module)
      })),
      summary: generateResultsSummary(results)
    }

    // Include progress data if requested
    if (includeProgress) {
      responseData.progress = mockResultsDB.getProgressData(userId)
    }

    // Include class analytics if requested
    if (includeAnalytics) {
      responseData.classAnalytics = mockResultsDB.getClassAnalytics(gradeLevel, board)
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error fetching results:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch results'
    }, { status: 500 })
  }
}

// POST /api/mitram/results - Generate detailed report
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, reportType, modules, dateRange } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing userId'
      }, { status: 400 })
    }

    // Get results based on criteria
    let results = mockResultsDB.getUserResults(userId)
    
    // Filter by modules if specified
    if (modules && modules.length > 0) {
      results = results.filter((result: any) => modules.includes(result.module))
    }
    
    // Filter by date range if specified
    if (dateRange) {
      const startDate = new Date(dateRange.start)
      const endDate = new Date(dateRange.end)
      results = results.filter((result: any) => {
        const resultDate = new Date(result.createdAt)
        return resultDate >= startDate && resultDate <= endDate
      })
    }

    // Generate comprehensive report
    const report = generateComprehensiveReport(results, reportType)

    return NextResponse.json({
      success: true,
      report,
      generatedAt: new Date().toISOString(),
      totalAssessments: results.length
    })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate report'
    }, { status: 500 })
  }
}

/**
 * Get display name for assessment modules
 */
function getModuleDisplayName(module: string): string {
  const displayNames = {
    attention: 'Focus & Attention',
    grit: 'Perseverance & Grit',
    decision: 'Decision Making',
    habit: 'Habit Management',
    aptitude: 'Cognitive Aptitude'
  }
  return displayNames[module as keyof typeof displayNames] || module
}

/**
 * Interpret score based on module and grade norms
 */
function interpretScore(score: number, module: string): string {
  if (score >= 80) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 60) return 'Average'
  if (score >= 50) return 'Below Average'
  return 'Needs Attention'
}

/**
 * Calculate improvement trend for a specific module
 */
function calculateImprovementTrend(allResults: any[], module: string): string {
  const moduleResults = allResults
    .filter((result: any) => result.module === module)
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  
  if (moduleResults.length < 2) return 'Insufficient Data'
  
  const firstScore = moduleResults[0].score
  const lastScore = moduleResults[moduleResults.length - 1].score
  const improvement = lastScore - firstScore
  
  if (improvement > 10) return 'Improving'
  if (improvement < -10) return 'Declining'
  return 'Stable'
}

/**
 * Generate summary of all results
 */
function generateResultsSummary(results: any[]) {
  if (results.length === 0) {
    return {
      totalAssessments: 0,
      averageScore: 0,
      strongestArea: null,
      weakestArea: null,
      overallTrend: 'No Data'
    }
  }

  const moduleScores = results.reduce((acc: any, result: any) => {
    if (!acc[result.module]) {
      acc[result.module] = []
    }
    acc[result.module].push(result.score)
    return acc
  }, {})

  const moduleAverages = Object.entries(moduleScores).map(([module, scores]: [string, any]) => ({
    module,
    average: scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length
  }))

  const strongestArea = moduleAverages.reduce((max, current) => 
    current.average > max.average ? current : max
  )
  
  const weakestArea = moduleAverages.reduce((min, current) => 
    current.average < min.average ? current : min
  )

  const totalScore = results.reduce((sum, result) => sum + result.score, 0)
  const averageScore = totalScore / results.length

  return {
    totalAssessments: results.length,
    averageScore: Math.round(averageScore),
    strongestArea: getModuleDisplayName(strongestArea.module),
    weakestArea: getModuleDisplayName(weakestArea.module),
    overallTrend: calculateOverallTrend(results),
    moduleBreakdown: moduleAverages.map(item => ({
      module: getModuleDisplayName(item.module),
      average: Math.round(item.average),
      interpretation: interpretScore(item.average, item.module)
    }))
  }
}

/**
 * Calculate overall improvement trend
 */
function calculateOverallTrend(results: any[]): string {
  if (results.length < 4) return 'Insufficient Data'
  
  const sortedResults = results.sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  
  const firstHalf = sortedResults.slice(0, Math.floor(sortedResults.length / 2))
  const secondHalf = sortedResults.slice(Math.floor(sortedResults.length / 2))
  
  const firstAvg = firstHalf.reduce((sum, r) => sum + r.score, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, r) => sum + r.score, 0) / secondHalf.length
  
  const improvement = secondAvg - firstAvg
  
  if (improvement > 5) return 'Improving'
  if (improvement < -5) return 'Declining'
  return 'Stable'
}

/**
 * Generate mock progress data
 */
function generateMockProgress(userId: string) {
  return {
    userId,
    modules: {
      attention: {
        baseline: 65,
        current: 75,
        improvement: 15.4,
        assessments: 3,
        trend: 'improving',
        nextRecommended: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      grit: {
        baseline: 60,
        current: 68,
        improvement: 13.3,
        assessments: 2,
        trend: 'improving',
        nextRecommended: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    },
    overallProgress: {
      totalAssessments: 5,
      averageImprovement: 14.4,
      consistencyScore: 78,
      engagementLevel: 'high'
    }
  }
}

/**
 * Generate class analytics
 */
function generateClassAnalytics(gradeLevel: number, board: string) {
  return {
    gradeLevel,
    board,
    classSize: 150,
    moduleAverages: {
      attention: 72,
      grit: 68,
      decision: 65,
      habit: 70,
      aptitude: 75
    },
    percentileRanks: {
      '25th': 58,
      '50th': 70,
      '75th': 82,
      '90th': 90
    },
    topPerformers: 12,
    needingSupport: 18,
    improvementRate: 23.5
  }
}

/**
 * Generate comprehensive report
 */
function generateComprehensiveReport(results: any[], reportType: string) {
  const summary = generateResultsSummary(results)
  
  const report = {
    type: reportType,
    summary,
    detailedAnalysis: {
      strengths: identifyStrengths(results),
      areasForImprovement: identifyWeaknesses(results),
      recommendations: generatePersonalizedRecommendations(results),
      interventionPlan: createInterventionPlan(results)
    },
    progressTracking: {
      timeline: createProgressTimeline(results),
      milestones: identifyMilestones(results),
      goals: suggestGoals(results)
    },
    parentTeacherInsights: {
      communicationPrompts: generateCommunicationPrompts(results),
      homeStrategies: suggestHomeStrategies(results),
      schoolSupport: suggestSchoolSupport(results)
    }
  }

  return report
}

/**
 * Helper functions for report generation
 */
function identifyStrengths(results: any[]): string[] {
  // Analyze results to identify student strengths
  return [
    'Strong sustained attention abilities',
    'Good perseverance in challenging tasks',
    'Effective decision-making under pressure'
  ]
}

function identifyWeaknesses(results: any[]): string[] {
  return [
    'Difficulty with selective attention in noisy environments',
    'Tendency to switch goals frequently',
    'Impulsive decision-making patterns'
  ]
}

function generatePersonalizedRecommendations(results: any[]): string[] {
  return [
    'Practice mindfulness meditation 10 minutes daily',
    'Use noise-canceling headphones during study',
    'Set weekly micro-goals instead of long-term objectives',
    'Implement the STOP technique for decision-making'
  ]
}

function createInterventionPlan(results: any[]) {
  return {
    immediate: [
      'Start daily attention training exercises',
      'Implement structured study schedule'
    ],
    shortTerm: [
      'Join peer study groups',
      'Practice decision-making scenarios'
    ],
    longTerm: [
      'Develop personal learning strategies',
      'Build consistent habit patterns'
    ]
  }
}

function createProgressTimeline(results: any[]) {
  return results.map(result => ({
    date: result.createdAt,
    module: result.module,
    score: result.score,
    milestone: result.score > 80 ? 'Achievement Unlocked' : null
  }))
}

function identifyMilestones(results: any[]) {
  return [
    { date: '2024-01-15', achievement: 'First Assessment Completed' },
    { date: '2024-02-01', achievement: 'Attention Score Above 75' },
    { date: '2024-02-15', achievement: 'Consistent Improvement Trend' }
  ]
}

function suggestGoals(results: any[]) {
  return [
    { module: 'attention', target: 85, timeframe: '4 weeks' },
    { module: 'grit', target: 75, timeframe: '6 weeks' },
    { module: 'decision', target: 80, timeframe: '8 weeks' }
  ]
}

function generateCommunicationPrompts(results: any[]) {
  return [
    'Discuss your child\'s attention strengths and how to leverage them',
    'Explore together what motivates your child to persevere',
    'Practice decision-making scenarios as a family activity'
  ]
}

function suggestHomeStrategies(results: any[]) {
  return [
    'Create a distraction-free study environment',
    'Establish consistent daily routines',
    'Celebrate small achievements regularly',
    'Model good decision-making processes'
  ]
}

function suggestSchoolSupport(results: any[]) {
  return [
    'Request seating away from distractions',
    'Ask for extended time on complex tasks',
    'Suggest breaking large projects into smaller steps',
    'Recommend peer mentoring opportunities'
  ]
}
