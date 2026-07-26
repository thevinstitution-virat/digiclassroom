import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { runTutorGraph } from '@/lib/ai/langgraph/graph'
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service'
import { findPreGeneratedAnswer, recordPreGeneratedAnswerHit, generateQuestionHash } from '@/lib/services/pre-generated-answers-service'
import { routeQuery } from '@/lib/ai/routing/query-router'
import { getSemanticCache } from '@/lib/ai/cache/semantic-cache-service'
import { FeedbackStream } from '@/lib/ai/feedback/progressive-feedback'
import { menuRouter, type MenuIntent } from '@/lib/ai/menu/menu-router'
// NEW: Enterprise services integration (non-breaking)
import { LegacyAgentAdapter } from '@/lib/adapters/legacy-agent-adapter'

export const runtime = 'nodejs'

const MAX_CONTEXTS = 8
const KNOWLEDGE_GAP_RESPONSE = 'The answer to this question is not present in the available NCERT textbook material.'

interface StudentProfile {
  board?: string
  classLevel?: string
  subject?: string
  medium?: string
}

export async function POST(req: NextRequest) {
  // ============================================================================
  // STEP 0: INITIALIZE ENTERPRISE SERVICES (Non-blocking, fails gracefully)
  // ============================================================================
  // Initialize new enterprise services in parallel with existing system
  // This is safe and non-breaking - services are available but not required
  await LegacyAgentAdapter.initialize().catch(err => {
    console.warn('⚠️ Enterprise services initialization failed (non-critical):', err.message)
    // Continue with existing services - system works fine without new services
  })

  // Track request start time for analytics
  const requestStartTime = Date.now()

  try {
    // ============================================================================
    // STEP 1: AUTHENTICATION
    // ============================================================================
    const session = await auth.api.getSession({ headers: await headers() })
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json(
        {
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Please sign in to use the AI Tutor'
        },
        { status: 401 }
      )
    }

    const body = await req.json()
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const profile: StudentProfile = {
      board: sanitizeField(body.board) || sanitizeField(body.roleContext?.educationBoard) || 'CBSE',
      classLevel: sanitizeField(body.classLevel) || sanitizeField(body.context?.classLevel),
      subject: sanitizeField(body.subject) || sanitizeField(body.context?.subject),
      medium: sanitizeField(body.medium) || 'English'
    }

    // Extract menu intent from roleContext (NEW: Menu-aware routing)
    const menuIntent = sanitizeField(body.roleContext?.menuIntent) as MenuIntent | undefined
    const userRole = sanitizeField(body.roleContext?.role) as 'student' | 'teacher' | 'parent' | undefined

    // Extract conversation history for context-aware agents (e.g., Homework Help)
    const conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'student' : 'assistant',
        content: String(msg.content || '')
      }))
      : []

    // CRITICAL DEBUG: Always log menu intent extraction
    console.log(`\n${'='.repeat(80)}`)
    console.log(`🎯 [MENU INTENT DEBUG] ${menuIntent || 'general_help'} | Role: ${userRole || 'student'}`)
    console.log(`🔍 [Backend Debug] Raw roleContext:`, JSON.stringify(body.roleContext, null, 2))
    console.log(`🔍 [Backend Debug] menuIntent extracted: "${menuIntent}"`)
    console.log(`🔍 [Backend Debug] menuIntent type: ${typeof menuIntent}`)
    console.log(`🔍 [Backend Debug] menuIntent is undefined: ${menuIntent === undefined}`)
    console.log(`🔍 [Backend Debug] menuIntent is null: ${menuIntent === null}`)
    console.log(`🔍 [Backend Debug] menuIntent is empty string: ${menuIntent === ''}`)
    console.log(`${'='.repeat(80)}\n`)

    // Fetch user's first name for personalization (used by Doubt Resolution agent)
    let userName: string | undefined
    try {
      const user = session?.user as any
      userName = user?.name?.split(' ')[0] || undefined
      if (userName) {
        console.log(`👤 User name: ${userName}`)
      }
    } catch (error) {
      console.warn('⚠️ Failed to fetch user name:', error)
      // Continue without name - agents will handle gracefully
    }

    // Extract class number from classLevel (e.g., "Class 10" -> 10)
    const classNumber = profile.classLevel ? parseInt(profile.classLevel.replace(/\D/g, '')) : 10

    // ============================================================================
    // STEP 2: CHECK DAILY QUESTION QUOTA
    // ============================================================================
    const quotaCheck = await subscriptionValidationService.canAskQuestion(userId)

    if (!quotaCheck.allowed) {
      console.log(`❌ Quota exceeded for user ${userId}: ${quotaCheck.message}`)
      return NextResponse.json(
        {
          error: 'DAILY_LIMIT_EXCEEDED',
          message: quotaCheck.message || 'You have reached your daily question limit',
          remaining: 0,
          limit: quotaCheck.limit,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 429 }
      )
    }

    console.log(`✅ Quota check passed: ${quotaCheck.remaining}/${quotaCheck.limit} remaining`)

    // ============================================================================
    // STEP 3: VALIDATE BOARD ACCESS
    // ============================================================================
    const hasBoardAccess = await subscriptionValidationService.hasAccessToBoard(
      userId,
      profile.board || 'CBSE'
    )

    if (!hasBoardAccess) {
      console.log(`❌ Board access denied for user ${userId}: ${profile.board}`)
      return NextResponse.json(
        {
          error: 'BOARD_ACCESS_DENIED',
          message: `You don't have access to ${profile.board} board. Please upgrade your subscription.`,
          board: profile.board,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 403 }
      )
    }

    // ============================================================================
    // STEP 4: VALIDATE CLASS ACCESS
    // ============================================================================
    const hasClassAccess = await subscriptionValidationService.hasAccessToClass(
      userId,
      profile.board || 'CBSE',
      classNumber
    )

    if (!hasClassAccess) {
      console.log(`❌ Class access denied for user ${userId}: Class ${classNumber}`)
      return NextResponse.json(
        {
          error: 'CLASS_ACCESS_DENIED',
          message: `You don't have access to Class ${classNumber}. Please upgrade your subscription.`,
          board: profile.board,
          class: classNumber,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 403 }
      )
    }

    // ============================================================================
    // STEP 5: VALIDATE SUBJECT ACCESS
    // ============================================================================
    if (profile.subject && profile.subject !== 'general') {
      const hasSubjectAccess = await subscriptionValidationService.hasAccessToSubject(
        userId,
        profile.board || 'CBSE',
        classNumber,
        profile.subject
      )

      if (!hasSubjectAccess) {
        console.log(`❌ Subject access denied for user ${userId}: ${profile.subject}`)
        return NextResponse.json(
          {
            error: 'SUBJECT_ACCESS_DENIED',
            message: `You don't have access to ${profile.subject}. Please upgrade your subscription.`,
            board: profile.board,
            class: classNumber,
            subject: profile.subject,
            upgradeUrl: '/dashboard/user/upgrade'
          },
          { status: 403 }
        )
      }
    }

    console.log(`✅ Access validation passed: ${profile.board} / Class ${classNumber} / ${profile.subject}`)

    // ============================================================================
    // STEP 4: INTELLIGENT QUERY ROUTING
    // ============================================================================
    const routingDecision = await routeQuery(message, profile)
    console.log(`🧭 [Routing] Route: ${routingDecision.route}, Complexity: ${routingDecision.intent.complexity}`)

    // ============================================================================
    // STEP 5: CHECK SEMANTIC CACHE (if route suggests cache-first)
    // ============================================================================
    let semanticCacheResult: any = null
    const semanticCache = getSemanticCache()

    if (routingDecision.route === 'semantic-cache' || routingDecision.route === 'cached-template') {
      try {
        semanticCacheResult = await semanticCache.searchCache(message, {
          classLevel: profile.classLevel,
          subject: profile.subject,
          board: profile.board
        })

        if (semanticCacheResult.found) {
          console.log(`✅ [Semantic Cache] HIT - Similarity: ${(semanticCacheResult.similarity! * 100).toFixed(1)}%`)

          // Track cache hit in analytics (non-blocking)
          LegacyAgentAdapter.getServices().then(services => {
            services.analytics.trackCacheHit('semantic', true).catch(err =>
              console.warn('⚠️ Analytics tracking failed:', err.message)
            )
          }).catch(() => { })
        } else {
          console.log(`❌ [Semantic Cache] MISS - Proceeding to RAG`)

          // Track cache miss in analytics (non-blocking)
          LegacyAgentAdapter.getServices().then(services => {
            services.analytics.trackCacheHit('semantic', false).catch(err =>
              console.warn('⚠️ Analytics tracking failed:', err.message)
            )
          }).catch(() => { })
        }
      } catch (error) {
        console.error('❌ Error checking semantic cache:', error)
      }
    }

    // ============================================================================
    // STEP 6: CHECK PRE-GENERATED ANSWERS (Fallback Cache)
    // ============================================================================
    let isPreGenerated = false
    let preGeneratedAnswer: any = null

    if (!semanticCacheResult?.found && profile.subject && profile.classLevel) {
      try {
        preGeneratedAnswer = await findPreGeneratedAnswer(
          message,
          profile.classLevel,
          profile.subject,
          profile.board || 'CBSE'
        )

        if (preGeneratedAnswer) {
          isPreGenerated = true
          const questionHash = generateQuestionHash(
            message,
            profile.classLevel,
            profile.subject,
            profile.board || 'CBSE'
          )

          // Record hit asynchronously (don't wait)
          recordPreGeneratedAnswerHit(questionHash).catch(err =>
            console.error('Failed to record pre-gen hit:', err)
          )

          console.log(`✅ [Pre-gen] Serving pre-generated answer for question: "${message.substring(0, 50)}..."`)
          console.log(`   Hit count: ${preGeneratedAnswer.hit_count + 1}`)

          // Track pre-gen cache hit in analytics (non-blocking)
          LegacyAgentAdapter.getServices().then(services => {
            services.analytics.trackCacheHit('database', true).catch(err =>
              console.warn('⚠️ Analytics tracking failed:', err.message)
            )
          }).catch(() => { })
        }
      } catch (error) {
        console.error('❌ Error checking pre-generated answers:', error)
        // Continue with normal generation if pre-gen lookup fails
      }
    }

    // ============================================================================
    // STEP 7: GENERATE ANSWER WITH VALIDATION
    // ============================================================================
    let graphState: any
    let answer: string
    let rankedContexts: any[]
    let sourcesPayload: any
    let isCached = false
    let isSemanticCached = false
    let ragasScores: any = null
    let menuSpecificMetadata: any = null

    // Priority 1: Semantic Cache
    if (semanticCacheResult?.found) {
      answer = semanticCacheResult.answer
      rankedContexts = [] // Sources already in cached answer
      sourcesPayload = {
        sources: semanticCacheResult.sources || [],
        metadata: {
          semanticCached: true,
          similarity: semanticCacheResult.similarity,
          isExactMatch: semanticCacheResult.isExactMatch
        }
      }
      isSemanticCached = true
      isCached = true
      console.log(`✅ [Semantic Cache] Serving cached answer`)
    }
    // Priority 2: Pre-generated answers
    else if (isPreGenerated && preGeneratedAnswer) {
      answer = preGeneratedAnswer.answer
      rankedContexts = []
      sourcesPayload = {
        sources: preGeneratedAnswer.sources || [],
        keyTerms: preGeneratedAnswer.key_terms || [],
        metadata: {
          preGenerated: true,
          difficulty: preGeneratedAnswer.difficulty_level,
          hitCount: preGeneratedAnswer.hit_count + 1
        }
      }
      isCached = false
    }
    // Priority 3: Menu-Aware Routing (NEW: Specialized agents or RAG)
    else {
      // Route through menu-aware router
      const menuRoutingResult = await menuRouter.route({
        menuIntent: menuIntent || 'general_help',
        userRole,
        query: message,
        profile,
        routingIntent: routingDecision.intent,
        userId: userId,
        userName,  // Pass user's first name for personalization
        conversationHistory
      })

      answer = menuRoutingResult.answer
      rankedContexts = menuRoutingResult.sources || menuRoutingResult.rankedChunks || []
      menuSpecificMetadata = menuRoutingResult.metadata

      // Validate generation output
      if (!answer || !answer.trim()) {
        console.warn('⚠️ Empty answer generated')
        answer = KNOWLEDGE_GAP_RESPONSE
      }

      // Validate answer is valid markdown (basic check)
      if (!isValidMarkdown(answer)) {
        console.warn('⚠️ Generated answer has markdown issues, using fallback')
        answer = KNOWLEDGE_GAP_RESPONSE
      }

      if (!rankedContexts.length && !menuSpecificMetadata?.menuSpecific) {
        answer = KNOWLEDGE_GAP_RESPONSE
      }

      // For menu-specific responses, create appropriate sources payload
      if (menuSpecificMetadata?.menuSpecific) {
        sourcesPayload = {
          type: 'sources',
          sources: rankedContexts.slice(0, MAX_CONTEXTS).map((source: any, index: number) => ({
            id: `source_${index + 1}`,
            title: source.title || source.metadata?.bookTitle || `NCERT ${profile.subject || ''}`.trim(),
            chapter: source.chapter || source.metadata?.chapter || 'Not specified',
            page: source.page || source.metadata?.pageNumber || source.metadata?.page || 'Not specified',
            subject: source.subject || source.metadata?.subject || profile.subject || 'Not specified',
            class: source.class || source.metadata?.classLevel || profile.classLevel || 'Not specified',
            board: source.board || source.metadata?.board || profile.board || 'Not specified',
            medium: source.medium || source.metadata?.medium || profile.medium || 'Not specified',
            content_preview: source.content_preview || truncateToWords(source.text || '', 20),
            confidence: source.confidence || source.score || 0,
            content_type: 'text',
            citation_validated: true
          })),
          keyTerms: menuRoutingResult.keyTerms || [],
          metadata: {
            menuIntent: menuIntent || 'general_help',
            agentUsed: menuSpecificMetadata.agentUsed,
            ...menuSpecificMetadata
          }
        }
        isCached = false
      } else {
        // Standard RAG pipeline result
        graphState = menuRoutingResult.metadata?.graphState

        if (menuRoutingResult.hallucinationReport && !menuRoutingResult.hallucinationReport.supported) {
          answer += '\n\nNote: Some statements could not be fully validated against the provided NCERT context.'
        }

        sourcesPayload = createSourcesPayload(rankedContexts.slice(0, MAX_CONTEXTS), profile, graphState || {})
        isCached = menuSpecificMetadata?.cached === true

        // Extract RAGAS scores
        ragasScores = menuRoutingResult.metadata?.ragasScores || null
      }

      // Store in semantic cache for future queries (async, don't wait)
      if (answer !== KNOWLEDGE_GAP_RESPONSE && rankedContexts.length > 0) {
        semanticCache.storeAnswer(
          message,
          answer,
          sourcesPayload.sources,
          {
            classLevel: profile.classLevel,
            subject: profile.subject,
            board: profile.board,
            complexity: routingDecision.intent.complexity,
            intent: routingDecision.intent.type,
            menuIntent: menuIntent || 'general_help'
          }
        ).catch(err => console.error('Failed to store in semantic cache:', err))
      }
    }

    // ============================================================================
    // STEP 8: INCREMENT QUESTION COUNT (After successful response)
    // ============================================================================
    try {
      await subscriptionValidationService.incrementQuestionCount(userId, userId, {
        subject: profile.subject || 'general',
        board: profile.board || 'CBSE',
        class: classNumber.toString(),
        menu_type: 'ai_chat',
        timestamp: new Date().toISOString()
      })
      console.log(`✅ Question count incremented for user ${userId}`)
    } catch (error) {
      console.error('❌ Failed to increment question count:', error)
      // Don't fail the request if quota increment fails
    }

    // ============================================================================
    // STEP 9: TRACK REQUEST ANALYTICS (Non-blocking)
    // ============================================================================
    const requestDuration = Date.now() - requestStartTime
    LegacyAgentAdapter.getServices().then(services => {
      services.analytics.trackEvent({
        eventType: 'chat_request',
        userId: userId,
        metadata: {
          menuIntent: menuIntent || 'general_help',
          subject: profile.subject,
          classLevel: profile.classLevel,
          board: profile.board,
          duration: requestDuration,
          cached: isCached || isSemanticCached || isPreGenerated,
          cacheType: isSemanticCached ? 'semantic' : isPreGenerated ? 'pre-generated' : isCached ? 'vector' : 'none',
          agentUsed: menuSpecificMetadata?.agentUsed || 'unknown',
          success: true
        },
        timestamp: new Date()
      }).catch(err => console.warn('⚠️ Analytics tracking failed:', err.message))
    }).catch(() => { })

    console.log(`📊 [Analytics] Request completed in ${requestDuration}ms`)

    return streamResult({
      answer,
      sourcesPayload,
      isCached,
      isPreGenerated,
      isSemanticCached,
      routingDecision,
      ragasScores,
      experimentMetadata: (graphState?.metadata || menuSpecificMetadata?.graphState?.metadata) ? {
        experimentId: (graphState?.metadata?.experimentId || menuSpecificMetadata?.graphState?.metadata?.experimentId) || null,
        experimentVariant: (graphState?.metadata?.experimentVariant || menuSpecificMetadata?.graphState?.metadata?.experimentVariant) || null
      } : null,
      menuMetadata: menuSpecificMetadata ? {
        menuIntent: menuIntent || 'general_help',
        agentUsed: menuSpecificMetadata.agentUsed,
        menuSpecific: menuSpecificMetadata.menuSpecific
      } : null
    })
  } catch (error) {
    console.error('AI Chat API error:', error)

    // Track error in analytics (non-blocking)
    const requestDuration = Date.now() - requestStartTime
    LegacyAgentAdapter.getServices().then(services => {
      services.analytics.trackEvent({
        eventType: 'chat_request',
        userId: 'unknown',
        metadata: {
          duration: requestDuration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date()
      }).catch(() => { })
    }).catch(() => { })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An error occurred while processing your request.'
      },
      { status: 500 }
    )
  }
}

function sanitizeField(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

/**
 * Truncate text to a maximum number of words and format for clean display
 * Ensures Sources & References are concise and well-formatted (max 20 words)
 */
function truncateToWords(text: string, maxWords: number = 20): string {
  // Clean up the text first - remove extra whitespace and newlines
  const cleanedText = text.trim().replace(/\s+/g, ' ')

  const words = cleanedText.split(/\s+/)
  if (words.length <= maxWords) {
    return cleanedText
  }

  // Truncate to maxWords and add ellipsis
  const truncated = words.slice(0, maxWords).join(' ')
  return truncated + '...'
}

function createSourcesPayload(
  contexts: Array<{ id: string; text: string; metadata: Record<string, unknown>; score: number }>,
  profile: StudentProfile,
  graphState: Awaited<ReturnType<typeof runTutorGraph>>
) {
  return {
    type: 'sources',
    sources: contexts.map((context, index) => {
      const metadata = context.metadata || {}
      return {
        id: `source_${index + 1}`,
        title: (metadata.bookTitle as string) || `NCERT ${(metadata.subject as string) || profile.subject || ''}`.trim(),
        chapter: (metadata.chapter as string) || 'Not specified',
        page: metadata.pageNumber ? String(metadata.pageNumber) : metadata.page ? String(metadata.page) : 'Not specified',
        subject: (metadata.subject as string) || profile.subject || 'Not specified',
        class: (metadata.classLevel as string) || (metadata.class as string) || profile.classLevel || 'Not specified',
        board: (metadata.board as string) || profile.board || 'Not specified',
        medium: (metadata.medium as string) || profile.medium || 'Not specified',
        content_preview: truncateToWords(context.text, 20),
        confidence: typeof context.score === 'number' ? context.score : 0,
        content_type: 'text',
        citation_validated: true,
        source_number: index + 1
      }
    }),
    metadata: {
      total_results: contexts.length,
      knowledge_gap: contexts.length === 0,
      hallucination_report: graphState.hallucinationReport ?? null
    }
  }
}

/**
 * Chunk answer into smaller pieces for progressive streaming
 * Splits by sentences for more natural streaming experience
 */
function chunkAnswerForStreaming(answer: string): string[] {
  // Split by sentences (periods, question marks, exclamation marks followed by space or newline)
  const sentences = answer.split(/([.!?]\s+|\n+)/).filter(Boolean)
  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    // If it's just whitespace or newline, add to current chunk
    if (/^\s+$/.test(sentence)) {
      currentChunk += sentence
      continue
    }

    // Add sentence to current chunk
    currentChunk += sentence

    // If chunk is getting large (>100 chars) or ends with punctuation, flush it
    if (currentChunk.length > 100 || /[.!?]\s*$/.test(currentChunk)) {
      chunks.push(currentChunk)
      currentChunk = ''
    }
  }

  // Add any remaining content
  if (currentChunk.trim()) {
    chunks.push(currentChunk)
  }

  return chunks.length ? chunks : [answer]
}

/**
 * Validate markdown syntax - basic checks for critical issues
 */
function isValidMarkdown(content: string): boolean {
  if (!content || typeof content !== 'string') return false

  // Check for unclosed bold formatting
  const boldCount = (content.match(/\*\*/g) || []).length
  if (boldCount % 2 !== 0) {
    console.warn('⚠️ Validation: Unclosed bold formatting detected')
    return false
  }

  // Check for malformed headings (### without space)
  if (/###[^#\s]/.test(content)) {
    console.warn('⚠️ Validation: Malformed heading detected')
    return false
  }

  // Check for excessive consecutive newlines (likely formatting error)
  if (/\n{6,}/.test(content)) {
    console.warn('⚠️ Validation: Excessive newlines detected')
    return false
  }

  return true
}

/**
 * Stream the answer to the frontend using Server-Sent Events (SSE)
 * Provides progressive display for better perceived latency
 * Now includes routing metadata, menu metadata, and RAGAS quality scores for analytics
 */
function streamResult({
  answer,
  sourcesPayload,
  isCached = false,
  isPreGenerated = false,
  isSemanticCached = false,
  routingDecision,
  ragasScores = null,
  experimentMetadata = null,
  menuMetadata = null
}: {
  answer: string;
  sourcesPayload: any;
  isCached?: boolean;
  isPreGenerated?: boolean;
  isSemanticCached?: boolean;
  routingDecision?: any;
  ragasScores?: any;
  experimentMetadata?: { experimentId: string | null; experimentVariant: 'A' | 'B' | null } | null;
  menuMetadata?: { menuIntent: string; agentUsed: string; menuSpecific: boolean } | null;
}) {
  const encoder = new TextEncoder()
  const chunks = chunkAnswerForStreaming(answer)

  // Semantic cache is fastest (10ms), then pre-generated (15ms), then cached (20ms), then fresh (30ms)
  const streamDelay = isSemanticCached ? 10 : (isPreGenerated ? 15 : (isCached ? 20 : 30))
  const streamType = isSemanticCached ? 'semantic-cached' : (isPreGenerated ? 'pre-generated' : (isCached ? 'cached' : 'fresh'))

  console.log(`[Streaming] Sending ${chunks.length} chunks (${streamType})`)

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Send routing metadata first (for analytics and UX)
        if (routingDecision) {
          const routingData = {
            type: 'routing',
            route: routingDecision.route,
            complexity: routingDecision.intent.complexity,
            intent: routingDecision.intent.type,
            confidence: routingDecision.confidence
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(routingData)}\n\n`))
        }

        // Send chunks progressively with small delays for smooth streaming UX
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]

          // Send chunk event
          const chunkData = {
            type: 'chunk',
            content: chunk,
            index: i,
            total: chunks.length
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`))

          // Add small delay between chunks for smooth streaming effect
          // Semantic: 10ms, Pre-generated: 15ms, Cached: 20ms, Fresh: 30ms
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, streamDelay))
          }
        }

        // Send complete event with full answer and sources
        const completeData = {
          type: 'complete',
          answer: answer,
          sources: sourcesPayload,
          cached: isCached,
          preGenerated: isPreGenerated,
          semanticCached: isSemanticCached,
          routing: routingDecision ? {
            route: routingDecision.route,
            complexity: routingDecision.intent.complexity,
            intent: routingDecision.intent.type
          } : undefined,
          menu: menuMetadata ? {
            menuIntent: menuMetadata.menuIntent,
            agentUsed: menuMetadata.agentUsed,
            menuSpecific: menuMetadata.menuSpecific
          } : undefined,
          ragasScores: ragasScores ? {
            faithfulness: ragasScores.faithfulness,
            relevance: ragasScores.relevance,
            contextPrecision: ragasScores.contextPrecision,
            contextRecall: ragasScores.contextRecall
          } : undefined,
          experiment: experimentMetadata ? {
            experimentId: experimentMetadata.experimentId,
            variant: experimentMetadata.experimentVariant
          } : undefined
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeData)}\n\n`))

        // Send done signal
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()

        console.log(`[Streaming] ✅ Completed streaming ${chunks.length} chunks`)
      } catch (error) {
        console.error('[Streaming] ❌ Error:', error)
        controller.error(error)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked'
    }
  })
}
