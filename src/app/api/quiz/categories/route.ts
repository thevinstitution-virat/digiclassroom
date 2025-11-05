/**
 * Quiz Categories API
 * Handles quiz category management and retrieval
 */

import { NextRequest, NextResponse } from 'next/server'
import { QuizCategory } from '@/lib/types/quiz'

// Get all quiz categories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gradeLevel = searchParams.get('grade')
    const culturalContext = searchParams.get('cultural')

    console.log(`📚 Getting quiz categories - Grade: ${gradeLevel}, Cultural: ${culturalContext}`)

    // Mock categories data (in production, this would come from database)
    const categories: QuizCategory[] = [
      {
        id: 'cbse-9-10',
        name: 'CBSE Class 9-10',
        description: 'Essential vocabulary for CBSE Class 9-10 students with focus on board exam preparation',
        icon: '📚',
        difficultyLevel: 'medium',
        culturalContext: true,
        subjectArea: 'general',
        gradeLevels: [9, 10],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'cbse-11-12',
        name: 'CBSE Class 11-12',
        description: 'Advanced vocabulary for CBSE Class 11-12 students preparing for competitive exams',
        icon: '🎓',
        difficultyLevel: 'hard',
        culturalContext: true,
        subjectArea: 'general',
        gradeLevels: [11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'jee-neet-science',
        name: 'JEE/NEET Scientific Terms',
        description: 'Scientific vocabulary essential for JEE and NEET competitive examinations',
        icon: '🔬',
        difficultyLevel: 'hard',
        culturalContext: false,
        subjectArea: 'science',
        gradeLevels: [11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'english-literature',
        name: 'English Literature',
        description: 'Literary terms and vocabulary from Indian and international literature',
        icon: '📖',
        difficultyLevel: 'medium',
        culturalContext: true,
        subjectArea: 'literature',
        gradeLevels: [9, 10, 11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'indian-cultural',
        name: 'Indian Cultural Context',
        description: 'Words related to Indian culture, festivals, traditions, and heritage',
        icon: '🇮🇳',
        difficultyLevel: 'medium',
        culturalContext: true,
        subjectArea: 'culture',
        gradeLevels: [9, 10, 11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'business-economics',
        name: 'Business & Economics',
        description: 'Commercial and economic vocabulary for commerce stream students',
        icon: '💼',
        difficultyLevel: 'hard',
        culturalContext: false,
        subjectArea: 'commerce',
        gradeLevels: [11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'daily-usage',
        name: 'Daily Usage Words',
        description: 'Common English words used in everyday Indian conversations',
        icon: '🗣️',
        difficultyLevel: 'easy',
        culturalContext: true,
        subjectArea: 'general',
        gradeLevels: [9, 10, 11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'historical-terms',
        name: 'Historical Terms',
        description: 'Vocabulary related to Indian and world history for social studies',
        icon: '🏛️',
        difficultyLevel: 'medium',
        culturalContext: true,
        subjectArea: 'history',
        gradeLevels: [9, 10, 11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'speed-challenge',
        name: 'Speed Challenge',
        description: 'Quick-fire vocabulary questions to test your speed and accuracy',
        icon: '⚡',
        difficultyLevel: 'medium',
        culturalContext: false,
        subjectArea: 'general',
        gradeLevels: [9, 10, 11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'festival-special',
        name: 'Festival Special',
        description: 'Words related to Indian festivals and celebrations - seasonal content',
        icon: '🎊',
        difficultyLevel: 'easy',
        culturalContext: true,
        subjectArea: 'culture',
        gradeLevels: [9, 10, 11, 12],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]

    // Filter categories based on query parameters
    let filteredCategories = categories

    if (gradeLevel) {
      const grade = parseInt(gradeLevel)
      filteredCategories = filteredCategories.filter(cat => 
        cat.gradeLevels.includes(grade)
      )
    }

    if (culturalContext === 'true') {
      filteredCategories = filteredCategories.filter(cat => cat.culturalContext)
    } else if (culturalContext === 'false') {
      filteredCategories = filteredCategories.filter(cat => !cat.culturalContext)
    }

    // Add statistics for each category (mock data)
    const categoriesWithStats = filteredCategories.map(category => ({
      ...category,
      stats: {
        totalQuestions: Math.floor(Math.random() * 500) + 100,
        averageAccuracy: Math.floor(Math.random() * 30) + 70,
        popularityRank: Math.floor(Math.random() * 10) + 1,
        estimatedDuration: Math.floor(Math.random() * 20) + 10, // minutes
        culturalWords: category.culturalContext ? Math.floor(Math.random() * 50) + 20 : 0
      }
    }))

    console.log(`✅ Retrieved ${categoriesWithStats.length} quiz categories`)

    return NextResponse.json({
      success: true,
      data: categoriesWithStats,
      total: categoriesWithStats.length,
      message: 'Quiz categories retrieved successfully'
    })

  } catch (error) {
    console.error('❌ Get quiz categories error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get quiz categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Get specific category details
export async function POST(request: NextRequest) {
  try {
    const { categoryId } = await request.json()

    if (!categoryId) {
      return NextResponse.json({
        success: false,
        error: 'Category ID is required'
      }, { status: 400 })
    }

    console.log(`🔍 Getting category details: ${categoryId}`)

    // Mock category details (in production, this would come from database)
    const categoryDetails = {
      id: categoryId,
      name: 'CBSE Class 9-10',
      description: 'Essential vocabulary for CBSE Class 9-10 students',
      icon: '📚',
      difficultyLevel: 'medium',
      culturalContext: true,
      subjectArea: 'general',
      gradeLevels: [9, 10],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      detailedStats: {
        totalQuestions: 250,
        questionTypes: {
          mcq: 150,
          synonym: 40,
          antonym: 30,
          cultural: 20,
          fill_blank: 10
        },
        difficultyDistribution: {
          easy: 80,
          medium: 120,
          hard: 50
        },
        subjectBreakdown: {
          general: 150,
          science: 50,
          literature: 30,
          history: 20
        },
        averageCompletionTime: 15, // minutes
        successRate: 78,
        popularWords: [
          'serendipity', 'ubiquitous', 'magnificent', 'extraordinary', 'perseverance'
        ],
        recentlyAdded: 15,
        culturalContextWords: 45
      },
      sampleQuestions: [
        {
          id: 'sample-1',
          questionText: 'What does "serendipity" mean?',
          options: ['संयोग', 'दुर्भाग्य', 'योजना', 'समस्या'],
          correctAnswer: 'संयोग',
          difficulty: 'medium'
        },
        {
          id: 'sample-2',
          questionText: 'Which word means "present everywhere"?',
          options: ['ubiquitous', 'rare', 'unique', 'special'],
          correctAnswer: 'ubiquitous',
          difficulty: 'hard'
        }
      ]
    }

    return NextResponse.json({
      success: true,
      data: categoryDetails,
      message: 'Category details retrieved successfully'
    })

  } catch (error) {
    console.error('❌ Get category details error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get category details'
    }, { status: 500 })
  }
}
