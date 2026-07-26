import type { TutorGraphState } from '../state'
import { OpenAIService } from '../../../services/openai_service'
import { commandWordDetector } from '../../question-analysis/command-word-detector'
import { answerTemplateEngine } from '../../question-analysis/answer-template-engine'
import { getRedisClient } from '../graph'
import { generateCacheKey } from '../../cache/cache-key-generator'
import { evaluateRAGASBackground } from '../../../ragas/evaluator'
import { questionPremiseValidator } from '../../validation/question-premise-validator'

const MAX_CONTEXTS_FOR_PROMPT = 5  // Reduced from 8 for faster generation

// Dynamic token limits based on question type (40% reduction from fixed 3000)
const MAX_TOKENS_BY_TYPE: Record<string, number> = {
  'define': 500,
  'list': 600,
  'state': 500,
  'name': 500,
  'identify': 600,
  'explain': 1500,
  'describe': 1500,
  'illustrate': 1500,
  'outline': 1200,
  'compare': 2000,
  'contrast': 2000,
  'differentiate': 2000,
  'distinguish': 2000,
  'analyze': 2500,
  'analyse': 2500,
  'evaluate': 2500,
  'assess': 2500,
  'discuss': 2000,
  'justify': 2000,
  'argue': 2000,
  'examine': 2000,
  'calculate': 800,
  'solve': 1000,
  'derive': 1200,
  'prove': 1500,
  'default': 1500
}

interface GenerationJSON {
  answer: string
  key_terms: Array<{ term: string; definition: string }>
}

/**
 * Determine optimal number of context chunks based on question complexity
 */
function getOptimalContextCount(commandWord: string, estimatedMarks: number, questionLength: number): number {
  // Simple questions need fewer contexts
  const simpleCommands = ['define', 'state', 'name', 'list', 'identify']
  if (simpleCommands.includes(commandWord.toLowerCase())) {
    return 2
  }

  // Medium complexity questions
  const mediumCommands = ['explain', 'describe', 'illustrate', 'outline', 'calculate', 'solve']
  if (mediumCommands.includes(commandWord.toLowerCase())) {
    return estimatedMarks <= 3 ? 3 : 4
  }

  // Complex questions need more contexts
  const complexCommands = ['analyze', 'analyse', 'evaluate', 'assess', 'compare', 'contrast', 'differentiate', 'discuss', 'justify', 'examine']
  if (complexCommands.includes(commandWord.toLowerCase())) {
    return estimatedMarks >= 5 ? 5 : 4
  }

  // Default: use marks and question length as heuristics
  if (estimatedMarks >= 5 || questionLength > 100) {
    return 5
  } else if (estimatedMarks >= 3) {
    return 4
  } else {
    return 3
  }
}

/**
 * Get dynamic max tokens based on command word
 */
function getDynamicMaxTokens(commandWord: string): number {
  const normalizedCommand = commandWord.toLowerCase()
  return MAX_TOKENS_BY_TYPE[normalizedCommand] || MAX_TOKENS_BY_TYPE['default']
}

export async function generationNode(state: TutorGraphState): Promise<TutorGraphState> {
  // Analyze the question first to determine optimal context count
  const questionAnalysis = commandWordDetector.analyzeQuestion(state.query)

  // Dynamic context selection based on question complexity
  const optimalContextCount = getOptimalContextCount(
    questionAnalysis.commandWord,
    questionAnalysis.estimatedMarks,
    state.query.length
  )

  const contexts = (state.rankedChunks ?? []).slice(0, optimalContextCount)

  if (contexts.length === 0) {
    return {
      ...state,
      generation: undefined,
      draftAnswer: undefined
    }
  }

  // ============================================
  // PREMISE VALIDATION: Check for false premises
  // ============================================
  let questionToAnswer = state.query;
  let premiseWarning: string | undefined;

  try {
    const premiseValidation = await questionPremiseValidator.validatePremise(
      state.query,
      {
        retrievedChunks: contexts.map(c => ({
          text: c.text,
          metadata: c.metadata
        })),
        conversationHistory: [] // TODO: Add conversation history from state
      }
    );

    if (premiseValidation.hasFalsePremise && premiseValidation.confidence > 0.7) {
      console.log(`⚠️ [Generation] False premise detected in question!`);
      console.log(`   Original: "${state.query}"`);
      console.log(`   Corrected: "${premiseValidation.correctedQuestion}"`);
      console.log(`   Explanation: ${premiseValidation.explanation}`);

      // Use corrected question for answer generation
      if (premiseValidation.correctedQuestion) {
        questionToAnswer = premiseValidation.correctedQuestion;
        premiseWarning = `⚠️ **Note:** The question contained a factual error. ${premiseValidation.explanation}`;
      }
    }
  } catch (error) {
    console.error('❌ [Generation] Premise validation failed:', error);
    // Continue with original question if validation fails
  }

  // Calculate dynamic max tokens based on command word
  const maxTokens = getDynamicMaxTokens(questionAnalysis.commandWord)

  console.log('📊 Question Analysis:', {
    commandWord: questionAnalysis.commandWord,
    category: questionAnalysis.category,
    estimatedMarks: questionAnalysis.estimatedMarks,
    wordCount: questionAnalysis.wordCount,
    structure: questionAnalysis.answerStructure.body.format,
    contextCount: contexts.length,
    maxTokens: maxTokens
  })

  console.log(`[Generation] Using maxTokens: ${maxTokens} for command word: "${questionAnalysis.commandWord}"`)

  // ============================================
  // CACHE CHECK: Try to retrieve cached answer
  // ============================================
  const redis = getRedisClient()
  const cacheKey = generateCacheKey(
    state.query,
        // @ts-ignore
    state.studentProfile?.grade,
    state.studentProfile?.subject
  )

  if (redis) {
    try {
      const cachedResponse = await redis.get(cacheKey)

      if (cachedResponse) {
        console.log(`[Cache] ✅ HIT for question: "${state.query.substring(0, 50)}..."`)

        // Parse cached response
        const parsed = JSON.parse(cachedResponse) as GenerationJSON

        console.log('✅ Using cached answer:', parsed.answer.substring(0, 200))

        const structured = {
          directAnswer: parsed.answer,
          explanationSteps: [],
          keyTerms: parsed.key_terms,
          questionAnalysis
        }

        // Run RAGAS evaluation for cached answers too (in background)
        const contextTexts = contexts.map(c => c.text)

        evaluateRAGASBackground(
          {
            question: state.query,
            answer: parsed.answer,
            context: contextTexts,
            cacheKey: cacheKey
          },
          (ragasResult) => {
            console.log(`[RAGAS] Cached answer evaluation complete`)
            console.log(`[RAGAS] Faithfulness: ${ragasResult.faithfulnessScore.toFixed(3)}, Relevance: ${ragasResult.relevanceScore.toFixed(3)}`)
          }
        )

        return {
          ...state,
          generation: structured,
          metadata: {
            ...state.metadata,
            cached: true,
            cacheKey: cacheKey,
            ragasScores: {
              faithfulness: null,
              relevance: null,
              contextPrecision: null,
              contextRecall: null
            }
          }
        }
      } else {
        console.log(`[Cache] ❌ MISS for question: "${state.query.substring(0, 50)}..."`)
      }
    } catch (error) {
      console.error('[Cache] Error reading from cache:', error instanceof Error ? error.message : 'Unknown error')
      // Continue with normal generation if cache read fails
    }
  }

  // ============================================
  // NORMAL GENERATION: Cache miss or unavailable
  // ============================================

  // Build context text with minimal metadata
  const contextText = contexts
    .map((chunk, index) => {
      return `[${index + 1}] ${chunk.text}`
    })
    .join('\n\n')

  // Generate optimized prompts for OpenAI automatic caching
  // System prompt is static (cacheable), user prompt has dynamic content last
  const systemPrompt = answerTemplateEngine.generateSystemPrompt()

  // Use corrected question if premise validation detected an error
  const userPrompt = answerTemplateEngine.generateOptimizedUserPrompt(
    questionToAnswer, // Use corrected question instead of original
    questionAnalysis,
    contextText
  )

  // Add premise warning to user prompt if needed
  const finalUserPrompt = premiseWarning
    ? `${premiseWarning}\n\n${userPrompt}`
    : userPrompt;

  console.log('📝 SYSTEM PROMPT (static - cacheable):')
  console.log(systemPrompt.substring(0, 500) + '...')
  console.log('\n📝 USER PROMPT (first 1000 chars):')
  console.log(finalUserPrompt.substring(0, 1000))

  const openai = OpenAIService.getInstance()

  // Performance profiling: Track LLM generation time
  const llmStartTime = Date.now()

  // Use streaming to collect the full response
  // Note: Streaming API doesn't return usage stats, but OpenAI's automatic prompt caching
  // still works in the background. Cache hits are logged in non-streaming calls.
  // The system prompt is static and will be cached automatically after ~15 requests.
  let fullResponse = ''
  const streamGenerator = openai.generateChatCompletionStream({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: finalUserPrompt } // Use final prompt with premise warning
    ],
    temperature: 0,
    maxTokens: maxTokens
  })

  // Collect all chunks into full response
  for await (const chunk of streamGenerator) {
    fullResponse += chunk
  }

  const llmDuration = Date.now() - llmStartTime

  // Enhanced performance profiling
  const systemPromptTokens = Math.ceil(systemPrompt.length / 4) // Rough estimate: 1 token ≈ 4 chars
  const userPromptTokens = Math.ceil(userPrompt.length / 4)
  const totalPromptTokens = systemPromptTokens + userPromptTokens

  console.log(`⏱️ [Performance] LLM generation took ${llmDuration}ms`)
  console.log(`📊 [Prompt Stats]`)
  console.log(`   - System prompt: ${systemPrompt.length} chars (~${systemPromptTokens} tokens)`)
  console.log(`   - User prompt: ${userPrompt.length} chars (~${userPromptTokens} tokens)`)
  console.log(`   - Total: ${systemPrompt.length + userPrompt.length} chars (~${totalPromptTokens} tokens)`)
  console.log(`   - Context chunks: ${contexts.length}`)

  // Check if system prompt is large enough for caching
  if (systemPromptTokens >= 1024) {
    console.log(`   ✅ System prompt is large enough for OpenAI caching (≥1024 tokens)`)
    console.log(`   💰 Expected: 50% cost reduction + 60-80% latency reduction after ~15-20 requests`)
  } else {
    console.log(`   ⚠️ System prompt may be too small for optimal caching (<1024 tokens)`)
  }

  if (llmDuration > 5000) {
    console.warn(`⚠️ [Performance] Slow LLM generation detected (${llmDuration}ms > 5000ms)`)
    console.warn(`   Possible causes:`)
    console.warn(`   1. Network latency (check OpenAI region/endpoint)`)
    console.warn(`   2. max_tokens too high (current: ${maxTokens})`)
    console.warn(`   3. Too much context (current: ${contexts.length} chunks)`)
    console.warn(`   4. OpenAI API rate limiting or server load`)
    console.warn(`   5. First request (no cache hit yet - wait for cache to warm up)`)
  }

  console.log('🤖 AI Response (first 500 chars):', fullResponse.substring(0, 500))

  const parsed = parseGenerationJson(fullResponse)

  if (!parsed) {
    console.error('❌ Failed to parse AI response as JSON')
    console.error('📄 Full response:', fullResponse)
    return {
      ...state,
      generation: undefined,
      draftAnswer: undefined,
      metadata: {
        ...state.metadata,
        generationError: 'Failed to parse generator output',
        rawResponse: fullResponse
      }
    }
  }

  console.log('✅ Successfully parsed answer:', parsed.answer.substring(0, 200))

  // ============================================
  // CACHE WRITE: Store answer for future use
  // ============================================
  if (redis) {
    try {
      // Store the parsed response in cache with 24-hour TTL
      const cacheValue = JSON.stringify(parsed)
      await redis.setEx(cacheKey, 86400, cacheValue) // 86400 seconds = 24 hours
      console.log(`[Cache] ✍️ WRITE for question: "${state.query.substring(0, 50)}..."`)
      console.log(`[Cache] Key: ${cacheKey}, TTL: 24 hours`)
    } catch (error) {
      console.error('[Cache] Error writing to cache:', error instanceof Error ? error.message : 'Unknown error')
      // Continue even if cache write fails
    }
  }

  const structured = {
    directAnswer: parsed.answer,
    explanationSteps: [], // No longer used - answer is complete
    keyTerms: parsed.key_terms,
    questionAnalysis // Store for response synthesis
  }

  // ============================================
  // RAGAS EVALUATION: Evaluate answer quality in background
  // ============================================
  // Run RAGAS evaluation asynchronously (non-blocking)
  // This evaluates faithfulness and relevance of the generated answer
  const contextTexts = contexts.map(c => c.text)

  evaluateRAGASBackground(
    {
      question: state.query,
      answer: parsed.answer,
      context: contextTexts,
      cacheKey: cacheKey // Use same cache key for RAGAS results
    },
    (ragasResult) => {
      // Callback executed when RAGAS evaluation completes
      console.log(`[RAGAS] Evaluation complete for question: "${state.query.substring(0, 50)}..."`)
      console.log(`[RAGAS] Faithfulness: ${ragasResult.faithfulnessScore.toFixed(3)}, Relevance: ${ragasResult.relevanceScore.toFixed(3)}, Overall: ${ragasResult.overallScore.toFixed(3)}`)

      // Note: Scores are stored in answer_feedback table via the RAGAS API endpoint
      // when feedback is submitted with the feedbackId
    }
  )

  return {
    ...state,
    generation: structured,
    metadata: {
      ...state.metadata,
      promptContexts: contexts,
      questionAnalysis,
      cached: false,
      // Store RAGAS scores in metadata for passing to frontend
      ragasScores: {
        // These will be populated by the background evaluation
        // For now, we'll set them to null and they'll be updated when feedback is submitted
        faithfulness: null,
        relevance: null,
        contextPrecision: null,
        contextRecall: null
      }
    }
  }
}

function parseGenerationJson(response: string): GenerationJSON | null {
  if (!response)
  return null
  let candidate = response.trim()

  const fencedMatch = candidate.match(/```json\s*([\s\S]*?)```/)
  if (fencedMatch) {
    candidate = fencedMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(candidate) as GenerationJSON
    if (
      typeof parsed.answer === 'string' &&
      Array.isArray(parsed.key_terms)
    ) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

