/**
 * Spaced Repetition API
 * Handles spaced repetition card management and review scheduling
 */

import { NextRequest, NextResponse } from 'next/server'
import { SpacedRepetitionCard, SpacedRepetitionPerformance } from '@/lib/types/quiz'
import { SpacedRepetitionService } from '@/lib/services/spaced-repetition'

const spacedRepetitionService = new SpacedRepetitionService()

// Get due words for review
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = searchParams.get('limit')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    console.log(`🔄 Getting due words for user: ${userId}`)

    // TODO: Get user's spaced repetition cards from database
    // For now, return mock data
    const mockCards: SpacedRepetitionCard[] = [
      {
        id: 'card-1',
        userId,
        wordId: 'word-1',
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        lastReviewed: new Date(Date.now() - 86400000), // Yesterday
        nextReview: new Date(Date.now() - 3600000), // 1 hour ago (due)
        masteryLevel: 20,
        difficultyLevel: 'medium',
        totalReviews: 1,
        correctReviews: 0,
        incorrectReviews: 1,
        learningStage: 'learning',
        culturalContextMastery: 15,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'card-2',
        userId,
        wordId: 'word-2',
        intervalDays: 3,
        repetitions: 2,
        easeFactor: 2.3,
        lastReviewed: new Date(Date.now() - 259200000), // 3 days ago
        nextReview: new Date(Date.now() - 1800000), // 30 minutes ago (due)
        masteryLevel: 60,
        difficultyLevel: 'medium',
        totalReviews: 3,
        correctReviews: 2,
        incorrectReviews: 1,
        learningStage: 'practicing',
        culturalContextMastery: 45,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'card-3',
        userId,
        wordId: 'word-3',
        intervalDays: 7,
        repetitions: 4,
        easeFactor: 2.8,
        lastReviewed: new Date(Date.now() - 604800000), // 7 days ago
        nextReview: new Date(Date.now() + 3600000), // 1 hour from now (not due yet)
        masteryLevel: 85,
        difficultyLevel: 'hard',
        totalReviews: 5,
        correctReviews: 4,
        incorrectReviews: 1,
        learningStage: 'mastering',
        culturalContextMastery: 80,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // Get due words
    const dueWords = spacedRepetitionService.getDueWords(mockCards)
    
    // Apply limit if specified
    const limitNum = limit ? parseInt(limit) : dueWords.length
    const limitedDueWords = dueWords.slice(0, limitNum)

    // Get learning statistics
    const stats = spacedRepetitionService.getLearningStats(mockCards)

    // Calculate optimal session size
    const optimalSessionSize = spacedRepetitionService.calculateOptimalSessionSize(
      dueWords.length,
      5, // Mock user level
      30 // 30 minutes available
    )

    console.log(`✅ Found ${dueWords.length} due words, returning ${limitedDueWords.length}`)

    return NextResponse.json({
      success: true,
      data: {
        dueWords: limitedDueWords,
        stats,
        optimalSessionSize,
        totalDue: dueWords.length,
        recommendations: {
          sessionSize: optimalSessionSize,
          estimatedTime: optimalSessionSize * 1.5, // 1.5 minutes per word
          priority: dueWords.length > 20 ? 'high' : dueWords.length > 10 ? 'medium' : 'low'
        }
      },
      message: `${dueWords.length} words are due for review`
    })

  } catch (error) {
    console.error('❌ Get due words error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get due words',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Update spaced repetition card after review
export async function PUT(request: NextRequest) {
  try {
    const { 
      cardId, 
      userId, 
      performance 
    }: { 
      cardId: string; 
      userId: string; 
      performance: SpacedRepetitionPerformance 
    } = await request.json()

    if (!cardId || !userId || !performance) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 })
    }

    console.log(`🔄 Updating spaced repetition card: ${cardId}`)

    // TODO: Get card from database
    // For now, use mock data
    const mockCard: SpacedRepetitionCard = {
      id: cardId,
      userId,
      wordId: 'word-1',
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 2.5,
      lastReviewed: new Date(Date.now() - 86400000),
      nextReview: new Date(Date.now() - 3600000),
      masteryLevel: 20,
      difficultyLevel: 'medium',
      totalReviews: 1,
      correctReviews: 0,
      incorrectReviews: 1,
      learningStage: 'learning',
      culturalContextMastery: 15,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Calculate next review using spaced repetition algorithm
    const updatedCardData = spacedRepetitionService.calculateNextReview(mockCard, performance)

    // TODO: Update card in database
    const updatedCard = {
      ...mockCard,
      ...updatedCardData
    }

    console.log(`✅ Card updated - Next review: ${updatedCard.nextReview}, Mastery: ${updatedCard.masteryLevel}%`)

    return NextResponse.json({
      success: true,
      data: {
        card: updatedCard,
        nextReview: updatedCard.nextReview,
        masteryLevel: updatedCard.masteryLevel,
        learningStage: updatedCard.learningStage,
        intervalDays: updatedCard.intervalDays
      },
      message: 'Spaced repetition card updated successfully'
    })

  } catch (error) {
    console.error('❌ Update spaced repetition card error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update spaced repetition card',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Create new spaced repetition card
export async function POST(request: NextRequest) {
  try {
    const { userId, wordId } = await request.json()

    if (!userId || !wordId) {
      return NextResponse.json({
        success: false,
        error: 'User ID and Word ID are required'
      }, { status: 400 })
    }

    console.log(`➕ Creating new spaced repetition card for word: ${wordId}`)

    // Create new card
    const newCardData = spacedRepetitionService.createNewCard(userId, wordId)

    // TODO: Save card to database
    const newCard = {
      id: 'card_' + Math.random().toString(36).substr(2, 9),
      ...newCardData
    }

    console.log(`✅ New spaced repetition card created: ${newCard.id}`)

    return NextResponse.json({
      success: true,
      data: newCard,
      message: 'Spaced repetition card created successfully'
    })

  } catch (error) {
    console.error('❌ Create spaced repetition card error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create spaced repetition card',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get spaced repetition statistics
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required'
      }, { status: 400 })
    }

    console.log(`📊 Getting spaced repetition statistics for user: ${userId}`)

    // TODO: Get user's cards from database
    // For now, use mock data
    const mockCards: SpacedRepetitionCard[] = [
      // ... (same mock data as in GET method)
    ]

    const stats = spacedRepetitionService.getLearningStats(mockCards)
    const predictions = spacedRepetitionService.predictNextReviews(mockCards, 7)

    // Calculate additional insights
    const insights = {
      weeklyWorkload: predictions.length,
      averageAccuracy: mockCards.reduce((sum, card) => 
        sum + (card.correctReviews / Math.max(1, card.totalReviews)), 0
      ) / mockCards.length * 100,
      improvementTrend: 'increasing', // Mock data
      recommendedDailyGoal: Math.ceil(stats.dueToday / 7), // Spread over week
      strongestAreas: ['Literature', 'Cultural Context'],
      weakestAreas: ['Scientific Terms', 'Business Vocabulary']
    }

    return NextResponse.json({
      success: true,
      data: {
        stats,
        insights,
        predictions: predictions.slice(0, 7), // Next 7 days
        recommendations: [
          `You have ${stats.dueToday} words due for review today`,
          `Focus on ${insights.weakestAreas[0]} to improve overall performance`,
          `Your ${insights.strongestAreas[0]} mastery is excellent - keep it up!`
        ]
      },
      message: 'Spaced repetition statistics retrieved successfully'
    })

  } catch (error) {
    console.error('❌ Get spaced repetition statistics error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get spaced repetition statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
