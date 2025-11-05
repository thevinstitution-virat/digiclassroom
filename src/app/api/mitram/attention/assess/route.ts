/**
 * TEA-Ch² Focus Check Assessment API
 * Processes assessment results and generates recommendations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { AttentionScoringEngine } from '@/lib/attention/ScoringEngine'

// Type definitions for API
interface AttentionResponse {
  stimulusId: string
  stimulusType: 'target' | 'distractor' | 'neutral'
  responseTime: number
  correct: boolean
  timestamp: number
  screenPosition: { x: number; y: number }
  trialNumber: number
  sessionTime: number
}

interface BehaviorMetrics {
  totalTime: number
  idleTime: number
  distractionEvents: number
  clickAccuracy: number
  responseVariability: number
  engagementScore: number
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      console.log('❌ Unauthorized access attempt')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    console.log('📊 Assessment API received data:', {
      hasResponses: !!body.responses,
      responsesLength: body.responses?.length,
      hasBehaviorMetrics: !!body.behaviorMetrics,
      subtestId: body.subtestId,
      userGrade: body.userGrade,
      userAge: body.userAge
    })

    const { responses, behaviorMetrics, subtestId, userGrade, userAge } = body

    // Validate input data with detailed logging
    if (!responses || !Array.isArray(responses)) {
      console.log('❌ Invalid responses:', { responses: typeof responses, isArray: Array.isArray(responses) })
      return NextResponse.json(
        { error: 'Invalid responses data - must be an array', received: typeof responses },
        { status: 400 }
      )
    }

    if (responses.length === 0) {
      console.log('❌ Empty responses array')
      return NextResponse.json(
        { error: 'No responses provided - assessment appears incomplete' },
        { status: 400 }
      )
    }

    if (!behaviorMetrics || typeof behaviorMetrics !== 'object') {
      console.log('❌ Invalid behavior metrics:', { behaviorMetrics: typeof behaviorMetrics })
      return NextResponse.json(
        { error: 'Invalid behavior metrics - must be an object', received: typeof behaviorMetrics },
        { status: 400 }
      )
    }

    if (!subtestId) {
      console.log('❌ Missing subtestId')
      return NextResponse.json(
        { error: 'Missing subtestId' },
        { status: 400 }
      )
    }

    if (!userGrade || !userAge) {
      console.log('❌ Missing user info:', { userGrade, userAge })
      return NextResponse.json(
        { error: 'Missing user grade or age information' },
        { status: 400 }
      )
    }

    // Initialize scoring engine
    const scoringEngine = new AttentionScoringEngine()
    
    // Calculate basic performance metrics
    const correctResponses = responses.filter((r: AttentionResponse) => r.correct)
    const accuracy = correctResponses.length / responses.length
    const averageReactionTime = correctResponses.reduce((sum: number, r: AttentionResponse) => 
      sum + r.responseTime, 0) / correctResponses.length || 0

    // Calculate attention scores based on test type
    let selectiveScore = 0
    let sustainedScore = 0
    let switchingScore: number | undefined

    // For Balloon Hunt (selective attention test)
    if (subtestId.includes('BALLOON_HUNT') || subtestId.includes('selective')) {
      // Selective attention scoring
      selectiveScore = Math.round(accuracy * 100)
      
      // Adjust for reaction time (faster = better for selective attention)
      const rtBonus = Math.max(0, (1000 - averageReactionTime) / 1000 * 10)
      selectiveScore = Math.min(100, selectiveScore + rtBonus)
      
      // Adjust for engagement
      const engagementBonus = (behaviorMetrics.engagementScore - 50) / 50 * 5
      selectiveScore = Math.max(0, Math.min(100, selectiveScore + engagementBonus))
    }

    // For sustained attention tests
    if (subtestId.includes('sustained') || subtestId.includes('BARKING') || subtestId.includes('VIGIL')) {
      // Sustained attention scoring - consistency over time is key
      sustainedScore = Math.round(accuracy * 100)
      
      // Penalty for high variability (inconsistent performance)
      const consistencyPenalty = behaviorMetrics.responseVariability * 10
      sustainedScore = Math.max(0, sustainedScore - consistencyPenalty)
      
      // Bonus for low distraction events
      const distractionPenalty = Math.min(behaviorMetrics.distractionEvents * 5, 20)
      sustainedScore = Math.max(0, sustainedScore - distractionPenalty)
    }

    // For switching attention tests (ages 8-15 only)
    if (userAge >= 8 && (subtestId.includes('switching') || subtestId.includes('REDS_BLUES'))) {
      switchingScore = Math.round(accuracy * 100)
      
      // Switching requires flexibility - penalize high reaction times more
      const rtPenalty = Math.min(averageReactionTime / 100, 15)
      switchingScore = Math.max(0, switchingScore - rtPenalty)
    }

    // Calculate percentile ranks
    const selectivePercentile = selectiveScore > 0 
      ? scoringEngine.calculatePercentileRank(selectiveScore / 100, 'selective', userAge)
      : undefined
    
    const sustainedPercentile = sustainedScore > 0
      ? scoringEngine.calculatePercentileRank(sustainedScore / 100, 'sustained', userAge)
      : undefined
    
    const switchingPercentile = switchingScore !== undefined
      ? scoringEngine.calculatePercentileRank(switchingScore / 100, 'switching', userAge)
      : undefined

    // Calculate overall everyday attention index
    const everydayIndex = scoringEngine.calculateEverydayIndex(
      selectiveScore,
      sustainedScore,
      switchingScore
    )

    // Create assessment result
    const assessment = {
      id: `assessment_${Date.now()}`,
      userId,
      testDate: new Date(),
      selectiveScore: selectiveScore > 0 ? selectiveScore : undefined,
      sustainedScore: sustainedScore > 0 ? sustainedScore : undefined,
      switchingScore,
      selectivePercentile,
      sustainedPercentile,
      switchingPercentile,
      everydayIndex,
      belowThreshold: scoringEngine.shouldTriggerParentAlert({
        id: '',
        userId,
        testDate: new Date(),
        selectivePercentile,
        sustainedPercentile,
        switchingPercentile,
        everydayIndex,
        user: { name: 'Student', grade: userGrade, age: userAge }
      } as any),
      user: {
        name: 'Student',
        grade: userGrade,
        age: userAge
      }
    }

    // Generate Pomodoro recommendations
    const pomodoroConfig = scoringEngine.adaptPomodoroSession(assessment as any, userGrade)

    // Generate parent report if needed
    let parentReport = null
    if (assessment.belowThreshold) {
      parentReport = scoringEngine.generateParentReport(assessment as any)
    }

    // Store assessment in localStorage (in production, save to database)
    const assessmentData = {
      ...assessment,
      responses: responses.length,
      behaviorMetrics,
      pomodoroRecommendations: pomodoroConfig,
      parentReport
    }

    return NextResponse.json({
      success: true,
      assessment: assessmentData,
      pomodoroRecommendations: pomodoroConfig,
      parentReport,
      message: assessment.belowThreshold 
        ? 'Assessment completed. Attention support recommended.'
        : 'Assessment completed successfully!'
    })

  } catch (error) {
    console.error('Assessment processing error:', error)
    return NextResponse.json(
      { error: 'Assessment processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // In production, this would fetch from database
    // For now, return mock assessment generation info
    return NextResponse.json({
      success: true,
      message: 'Assessment generation endpoint ready',
      availableTests: [
        {
          id: 'balloon_hunt',
          name: 'Balloon Hunt',
          type: 'selective',
          ageRange: [5, 15],
          duration: 120
        },
        {
          id: 'sound_counter',
          name: 'Sound Counter',
          type: 'sustained',
          ageRange: [5, 15],
          duration: 120
        },
        {
          id: 'color_sorter',
          name: 'Color & Shape Sorter',
          type: 'switching',
          ageRange: [8, 15],
          duration: 180
        }
      ]
    })

  } catch (error) {
    console.error('Assessment generation error:', error)
    return NextResponse.json(
      { error: 'Assessment generation failed' },
      { status: 500 }
    )
  }
}
