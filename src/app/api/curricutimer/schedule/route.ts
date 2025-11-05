/**
 * CurricuTimer Schedule API
 * Generates optimized study schedules based on curriculum and user data
 */

import { NextRequest, NextResponse } from 'next/server'
import { SyllabusParser } from '@/lib/services/syllabusParser'
import { AdaptiveScheduler } from '@/lib/utils/adaptiveScheduler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, grade, board, subject, currentTopic, userPreferences } = body

    // Validate required fields
    if (!userId || !grade || !board || !subject) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, grade, board, subject'
      }, { status: 400 })
    }

    // Load syllabus data
    const syllabus = await SyllabusParser.loadSyllabus(board, grade, subject)
    
    // Get upcoming topics
    const upcomingTopics = SyllabusParser.getUpcomingTopics(syllabus, currentTopic || '')
    
    // Calculate session duration
    let sessionDuration = AdaptiveScheduler.getOptimalStartingDuration(grade, subject)
    
    // If user has preferences, use them
    if (userPreferences?.preferredDuration) {
      sessionDuration = userPreferences.preferredDuration
    }

    // Get current topic data
    const currentChapter = syllabus.chapters.find(ch => 
      ch.topics.includes(currentTopic) || ch.title === currentTopic
    ) || syllabus.chapters[0]

    // Calculate topic priority based on upcoming exams
    const mockExamDates = [
      {
        date: new Date('2024-03-15'),
        type: 'unit_test' as const,
        subject,
        topics: [currentTopic || currentChapter.title]
      },
      {
        date: new Date('2024-04-20'),
        type: 'mid_term' as const,
        subject,
        topics: syllabus.chapters.map(ch => ch.title)
      }
    ]

    const priority = SyllabusParser.calculateTopicPriority(
      currentTopic || currentChapter.title, 
      mockExamDates
    )

    // Calculate break duration
    const breakDuration = AdaptiveScheduler.calculateBreakDuration(sessionDuration, grade)

    // Generate schedule
    const schedule = {
      sessionDuration,
      breakDuration,
      topic: currentTopic || currentChapter.title,
      chapter: currentChapter,
      priority,
      difficulty: 'medium' as const,
      nextTopics: upcomingTopics.slice(0, 3),
      estimatedCompletion: new Date(Date.now() + sessionDuration * 60 * 1000),
      recommendations: [
        `Study ${currentChapter.title} for ${sessionDuration} minutes`,
        `Focus on ${currentChapter.topics.slice(0, 2).join(' and ')}`,
        `Take a ${breakDuration}-minute break after session`,
        priority === 'high' ? 'High priority - exam approaching!' : 'Regular study pace'
      ],
      syllabus: {
        board,
        grade,
        subject,
        totalChapters: syllabus.chapters.length,
        currentChapterIndex: syllabus.chapters.findIndex(ch => ch.id === currentChapter.id)
      }
    }

    return NextResponse.json({
      success: true,
      schedule,
      nextSession: {
        topic: schedule.topic,
        duration: schedule.sessionDuration,
        priority: schedule.priority,
        startTime: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error generating schedule:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate schedule'
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const board = searchParams.get('board')
    const grade = searchParams.get('grade')
    const subject = searchParams.get('subject')

    if (!board || !grade || !subject) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: board, grade, subject'
      }, { status: 400 })
    }

    // Load syllabus data
    const syllabus = await SyllabusParser.loadSyllabus(board, parseInt(grade), subject)

    return NextResponse.json({
      success: true,
      syllabus: {
        board: syllabus.board,
        grade: syllabus.grade,
        subject: syllabus.subject,
        chapters: syllabus.chapters.map(chapter => ({
          id: chapter.id,
          title: chapter.title,
          topics: chapter.topics,
          priority: chapter.priority,
          estimatedHours: chapter.estimatedHours
        }))
      }
    })

  } catch (error) {
    console.error('Error fetching syllabus:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch syllabus data'
    }, { status: 500 })
  }
}
