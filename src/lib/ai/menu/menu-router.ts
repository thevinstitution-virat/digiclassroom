/**
 * Menu-Aware Routing Service
 * Routes queries to specialized agents based on menu selection while preserving existing RAG pipeline
 * 
 * Integration Strategy:
 * - Wraps existing LangGraph pipeline with menu-specific pre/post processing
 * - Maintains backward compatibility (no menu = default RAG pipeline)
 * - Preserves all caching, validation, and streaming functionality
 */

import { HomeworkHelpAgent } from '@/lib/agents/homework_help_agent'
import { TopicExplanationAgent } from '@/lib/agents/topic_explanation_agent'
import { ExamStrategyTool } from '@/lib/agents/exam_preparation_agent'
import { DoubtClearingTool } from '@/lib/agents/doubt_clearing_agent'
import { PersonalizedStudyCoach } from '@/lib/agents/study_tips_agent'
import { runTutorGraph } from '@/lib/ai/langgraph/graph'
import type { TutorGraphState } from '@/lib/ai/langgraph/state'

export type MenuIntent =
  | 'homework_help'
  | 'explain_topic'
  | 'exam_prep'
  | 'clear_doubts'
  | 'study_tips'
  | 'book_structure'
  | 'general_help'

export interface MenuRoutingContext {
  menuIntent?: MenuIntent
  userRole?: 'student' | 'teacher' | 'parent'
  query: string
  profile: {
    board?: string
    classLevel?: string
    subject?: string
    medium?: string
  }
  routingIntent?: any
  userId?: string
  userName?: string  // User's first name for personalization
  conversationHistory?: Array<{role: string, content: string}>
}

export interface MenuRoutingResult {
  answer: string
  sources?: any[]
  keyTerms?: Array<{ term: string; definition: string }>
  metadata?: {
    menuSpecific: boolean
    agentUsed?: string
    fallbackToRAG?: boolean
    [key: string]: any
  }
  // Preserve RAG pipeline outputs
  rankedChunks?: any[]
  hallucinationReport?: any
  ragasScores?: any
}

/**
 * Menu-Aware Router
 * Dispatches to specialized agents or falls back to default RAG pipeline
 */
export class MenuRouter {
  private homeworkAgent: HomeworkHelpAgent
  private topicAgent: TopicExplanationAgent
  private examAgent: ExamStrategyTool
  private doubtAgent: DoubtClearingTool
  private studyCoach: PersonalizedStudyCoach

  constructor() {
    // Initialize specialized agents (lazy loading for performance)
    this.homeworkAgent = new HomeworkHelpAgent()
    this.topicAgent = new TopicExplanationAgent()
    this.examAgent = new ExamStrategyTool()
    this.doubtAgent = new DoubtClearingTool()
    this.studyCoach = new PersonalizedStudyCoach()
  }

  /**
   * Route query based on menu selection
   * Falls back to default RAG pipeline if menu not specified or agent fails
   */
  async route(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    const { menuIntent, query, profile, routingIntent, userId } = context

    console.log(`🔍 [Menu Router Debug] Received context:`, {
      menuIntent,
      menuIntentType: typeof menuIntent,
      isUndefined: menuIntent === undefined,
      isNull: menuIntent === null,
      isEmpty: menuIntent === '',
      isGeneralHelp: menuIntent === 'general_help',
      query: query.substring(0, 50),
      userRole: context.userRole
    })

    // No menu intent = use default RAG pipeline (backward compatibility)
    if (!menuIntent || menuIntent === 'general_help') {
      console.log('📋 [Menu Router] No menu intent - using default RAG pipeline')
      console.log(`🔍 [Menu Router Debug] Reason: menuIntent="${menuIntent}", falsy=${!menuIntent}, isGeneralHelp=${menuIntent === 'general_help'}`)
      return this.executeDefaultRAG(context)
    }

    console.log(`📋 [Menu Router] Routing to: ${menuIntent}`)

    try {
      // Route to specialized agent based on menu intent
      switch (menuIntent) {
        case 'homework_help':
          return await this.routeToHomeworkHelp(context)

        case 'explain_topic':
          return await this.routeToTopicExplanation(context)

        case 'exam_prep':
          return await this.routeToExamPrep(context)

        case 'clear_doubts':
          return await this.routeToDoubtClearing(context)

        case 'study_tips':
          return await this.routeToStudyTips(context)

        case 'book_structure':
          return await this.routeToBookStructure(context)

        default:
          console.log(`⚠️ [Menu Router] Unknown menu intent: ${menuIntent}, falling back to RAG`)
          return this.executeDefaultRAG(context)
      }
    } catch (error) {
      console.error(`❌ [Menu Router] Agent failed for ${menuIntent}:`, error)

      // Enhanced error logging for debugging
      if (error instanceof TypeError && error.message.includes('is not a function')) {
        console.error(`🔍 [Menu Router] Method call error detected - check agent method signatures`)
        console.error(`🔍 [Menu Router] Expected methods:`)
        console.error(`   - homework_help: help_with_homework()`)
        console.error(`   - explain_topic: explain_topic_legacy()`)
        console.error(`   - exam_prep: create_exam_strategy()`)
        console.error(`   - clear_doubts: resolve_doubt_professionally()`)
        console.error(`   - study_tips: provide_study_guidance()`)
      }

      console.log('🔄 [Menu Router] Falling back to default RAG pipeline')
      console.log(`⚠️ [Menu Router] User will receive formal RAG response instead of ${menuIntent} agent response`)

      return this.executeDefaultRAG(context)
    }
  }

  /**
   * Homework Help: Socratic tutoring with step-by-step guidance
   */
  private async routeToHomeworkHelp(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    console.log('📚 [Homework Help] Using Socratic tutoring approach')

    const classNumber = this.extractClassNumber(context.profile.classLevel)

    const response = await this.homeworkAgent.help_with_homework(
      context.query,
      {
        grade_level: classNumber,
        subject: context.profile.subject || 'General',
        board_type: this.normalizeBoardType(context.profile.board),
      },
      context.conversationHistory || []
    )

    return {
      answer: response.guidance, // Correct field name
      sources: [], // Socratic guidance doesn't return sources directly
      keyTerms: [],
      metadata: {
        menuSpecific: true,
        agentUsed: 'homework_help_agent',
        socraticApproach: true,
        guidanceType: response.type,
        requiresStudentResponse: response.requires_student_response,
        encouragementLevel: response.encouragement_level,
        nextSteps: response.next_steps,
        contentVerified: response.content_verified,
        fidelityScore: response.fidelity_score
      }
    }
  }

  /**
   * Deep Dive: Comprehensive explanations with examples and analogies
   */
  private async routeToTopicExplanation(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    console.log('💡 [Deep Dive] Using comprehensive explanation approach')

    const classNumber = this.extractClassNumber(context.profile.classLevel)

    const response = await this.topicAgent.explain_topic_legacy(
      context.query,
      {
        grade_level: classNumber,
        subject: context.profile.subject || 'General',
        board_type: this.normalizeBoardType(context.profile.board),
        explanation_type: 'comprehensive'
      },
      context.conversationHistory || []
    )

    return {
      answer: response.explanation,
      sources: [],
      keyTerms: response.key_concepts?.map(concept => ({
        term: concept,
        definition: ''
      })) || [],
      metadata: {
        menuSpecific: true,
        agentUsed: 'topic_explanation_agent',
        depth: response.depth,
        examplesIncluded: response.examples_included,
        textbookAligned: response.textbook_aligned,
        realWorldApplications: response.real_world_applications,
        memoryAids: response.memory_aids,
        commonMistakes: response.common_mistakes,
        practiceSuggestions: response.practice_suggestions
      }
    }
  }

  /**
   * Ace Your Exams: Study strategies and preparation timeline
   */
  private async routeToExamPrep(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    console.log('🎯 [Ace Your Exams] Creating study strategy')

    // For exam prep, we need to extract chapters/topics from the query
    // If query is general, provide overall exam strategy
    const classNumber = this.extractClassNumber(context.profile.classLevel)
    
    // Extract chapters from query or use subject as default
    const chapters = this.extractChaptersFromQuery(context.query, context.profile.subject)
    
    const response = await this.examAgent.create_exam_strategy(
      chapters,
      {
        grade_level: classNumber,
        subject: context.profile.subject || 'General',
        board_type: this.normalizeBoardType(context.profile.board),
        exam_type: 'regular',
        time_available: 30
      },
      {},
      context.conversationHistory || []
    )

    return {
      answer: response.study_plan,
      sources: [],
      metadata: {
        menuSpecific: true,
        agentUsed: 'exam_preparation_agent',
        chaptersCovered: response.chapters_covered,
        timeline: response.timeline,
        personalized: response.personalized,
        priorityMatrix: response.priority_matrix,
        dailySchedule: response.daily_schedule,
        stressManagementTips: response.stress_management_tips
      }
    }
  }

  /**
   * Doubt Resolution: Enhanced reasoning with misconception clarification
   */
  private async routeToDoubtClearing(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    console.log('❓ [Doubt Resolution] Resolving doubt with enhanced reasoning')

    const classNumber = this.extractClassNumber(context.profile.classLevel)

    const response = await this.doubtAgent.resolve_doubt_professionally({
      doubt_question: context.query,
      grade_level: classNumber,
      subject: context.profile.subject || 'General',
      board_type: this.normalizeBoardType(context.profile.board),
      doubt_type: 'conceptual',
      student_name: context.userName,  // Pass user's first name for personalization
      response_length: 'balanced',
      conversation_history: context.conversationHistory || []
    })

    // Validate response structure
    if (!response?.doubt_resolution) {
      console.error('❌ [Doubt Resolution] Invalid response structure - missing doubt_resolution field')
      throw new Error('DoubtClearingTool returned invalid response structure')
    }

    // Validate conversational format (check for personalization)
    const hasPersonalization = response.doubt_resolution.includes(context.userName || '')
    const hasEmoji = /[\u{1F300}-\u{1F9FF}]/u.test(response.doubt_resolution)
    const hasCitation = response.doubt_resolution.includes('📚') || response.doubt_resolution.includes('Source:')

    if (!hasPersonalization) {
      console.warn('⚠️ [Doubt Resolution] Response missing student name personalization')
    }
    if (!hasEmoji) {
      console.warn('⚠️ [Doubt Resolution] Response missing friendly emoji (expected 👋 or similar)')
    }
    if (!hasCitation) {
      console.warn('⚠️ [Doubt Resolution] Response missing textbook citation (📚 Source:)')
    }

    console.log('✅ [Doubt Resolution] Response generated successfully')
    console.log(`📊 [Doubt Resolution] Quality checks: Personalized=${hasPersonalization}, Emoji=${hasEmoji}, Citation=${hasCitation}`)

    return {
      answer: response.doubt_resolution,
      sources: [],
      keyTerms: response.key_concepts_clarified?.map(concept => ({
        term: concept,
        definition: ''
      })) || [],
      metadata: {
        menuSpecific: true,
        agentUsed: 'doubt_clearing_agent',
        includesExamples: response.includes_examples,
        comprehensive: response.comprehensive,
        analogiesUsed: response.analogies_used,
        misconceptionsAddressed: response.common_misconceptions_addressed,
        practiceSuggestions: response.practice_suggestions,
        qualityChecks: {
          hasPersonalization,
          hasEmoji,
          hasCitation
        }
      }
    }
  }

  /**
   * Virat Insights: Learning strategies and study techniques
   */
  private async routeToStudyTips(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    console.log('📖 [Virat Insights] Providing personalized study guidance')

    const classNumber = this.extractClassNumber(context.profile.classLevel)
    
    const response = await this.studyCoach.create_personalized_study_guidance(
      {
        grade_level: classNumber,
        subject: context.profile.subject,
        learning_style: 'mixed'
      },
      context.query
    )

    return {
      answer: response.personalized_guidance,
      sources: [],
      metadata: {
        menuSpecific: true,
        agentUsed: 'study_tips_agent',
        gradeAppropriate: response.grade_appropriate,
        culturallySensitive: response.culturally_sensitive,
        psychologicallyInformed: response.psychologically_informed,
        studyTechniques: response.study_techniques,
        motivationStrategies: response.motivation_strategies,
        timeManagementTips: response.time_management_tips,
        stressManagementAdvice: response.stress_management_advice
      }
    }
  }

  /**
   * Let's Talk: Textbook navigation and chapter overview
   * Falls back to RAG with structure-focused retrieval
   */
  private async routeToBookStructure(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    console.log('📚 [Let\'s Talk] Providing textbook structure overview')
    
    // For book structure, use RAG but with structure-focused prompt
    const ragResult = await this.executeDefaultRAG(context)
    
    // Enhance with structure-specific formatting
    const structureEnhancedAnswer = this.formatAsBookStructure(ragResult.answer, context)
    
    return {
      ...ragResult,
      answer: structureEnhancedAnswer,
      metadata: {
        ...ragResult.metadata,
        menuSpecific: true,
        agentUsed: 'book_structure_rag',
        structureView: true
      }
    }
  }

  /**
   * Default RAG Pipeline (backward compatibility)
   */
  private async executeDefaultRAG(context: MenuRoutingContext): Promise<MenuRoutingResult> {
    const graphState = await runTutorGraph(
      context.query,
      context.profile,
      context.routingIntent,
      context.userId
    )

    return {
      answer: graphState.finalAnswer || '',
      sources: graphState.rankedChunks || [],
      keyTerms: graphState.generation?.keyTerms || [],
      rankedChunks: graphState.rankedChunks,
      hallucinationReport: graphState.hallucinationReport,
      metadata: {
        menuSpecific: false,
        agentUsed: 'default_rag_pipeline',
        cached: graphState.metadata?.cached,
        ragasScores: graphState.metadata?.ragasScores,
        graphState // Pass through for API compatibility
      }
    }
  }

  // Helper methods
  private extractClassNumber(classLevel?: string): number {
    if (!classLevel)
  return 10
    const match = classLevel.match(/\d+/)
    return match ? parseInt(match[0]) : 10
  }

  private normalizeBoardType(board?: string): 'CBSE' | 'ICSE' | 'State Board' {
    const normalized = (board || 'CBSE').toUpperCase()
    if (normalized.includes('ICSE'))
  return 'ICSE'
    if (normalized.includes('STATE'))
  return 'State Board'
    return 'CBSE'
  }

  private extractChaptersFromQuery(query: string, subject?: string): string[] {
    // Simple extraction - can be enhanced with NLP
    const chapterKeywords = ['chapter', 'unit', 'lesson', 'topic']
    const hasChapterMention = chapterKeywords.some(kw => query.toLowerCase().includes(kw))
    
    if (hasChapterMention) {
      // Extract chapter names/numbers from query
      return [query]
    }
    
    // Default: use subject as chapter
    return [subject || 'General Topics']
  }

  private formatAsBookStructure(answer: string, context: MenuRoutingContext): string {
    // Add structure-specific formatting
    return `# 📚 Textbook Structure Overview\n\n${answer}\n\n---\n\n*This overview is based on ${context.profile.board || 'CBSE'} ${context.profile.subject || 'curriculum'} for ${context.profile.classLevel || 'Class 10'}.*`
  }
}

// Export singleton instance
export const menuRouter = new MenuRouter()

