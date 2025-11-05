/**
 * RAGAS Context Precision Evaluation
 * Measures if relevant chunks are ranked higher than irrelevant ones
 * 
 * Algorithm:
 * 1. For each chunk in retrieved context, determine if it's relevant to the question
 * 2. Calculate precision@k for each position k
 * 3. Context Precision = mean of (precision@k * relevance_indicator_k)
 * 
 * Formula:
 * Context Precision@K = Σ(Precision@k × v_k) / Total relevant items
 * where v_k ∈ {0, 1} is the relevance indicator at rank k
 * 
 * Target: >0.8 context precision score
 * Execution Time: <3 seconds
 */

import OpenAI from 'openai'

export interface ContextPrecisionResult {
  score: number              // 0.0 to 1.0
  totalChunks: number
  relevantChunks: number
  precisionAtK: number[]     // Precision at each position
  relevanceIndicators: boolean[]  // Relevance of each chunk
  executionTime: number      // milliseconds
  cached: boolean
}

export interface ContextPrecisionInput {
  question: string
  answer: string
  context: string[]
}

/**
 * Evaluate context precision - measures if relevant chunks are ranked higher
 */
export async function evaluateContextPrecision(
  input: ContextPrecisionInput,
  openai: OpenAI
): Promise<ContextPrecisionResult> {
  const startTime = Date.now()
  
  try {
    // Step 1: Determine relevance of each chunk
    const relevanceIndicators = await determineChunkRelevance(
      input.question,
      input.answer,
      input.context,
      openai
    )
    
    if (relevanceIndicators.length === 0 || input.context.length === 0) {
      // No chunks to evaluate - neutral score
      return {
        score: 0.5,
        totalChunks: 0,
        relevantChunks: 0,
        precisionAtK: [],
        relevanceIndicators: [],
        executionTime: Date.now() - startTime,
        cached: false
      }
    }
    
    // Step 2: Calculate precision@k for each position
    const precisionAtK: number[] = []
    let truePositives = 0
    
    for (let k = 0; k < relevanceIndicators.length; k++) {
      if (relevanceIndicators[k]) {
        truePositives++
      }
      
      // Precision@k = true_positives / (k + 1)
      const precision = truePositives / (k + 1)
      precisionAtK.push(precision)
    }
    
    // Step 3: Calculate weighted precision (only count relevant positions)
    const totalRelevant = relevanceIndicators.filter(r => r).length
    
    if (totalRelevant === 0) {
      // No relevant chunks found
      return {
        score: 0.0,
        totalChunks: input.context.length,
        relevantChunks: 0,
        precisionAtK,
        relevanceIndicators,
        executionTime: Date.now() - startTime,
        cached: false
      }
    }
    
    // Sum of (precision@k * relevance_indicator_k)
    let weightedSum = 0
    for (let k = 0; k < relevanceIndicators.length; k++) {
      if (relevanceIndicators[k]) {
        weightedSum += precisionAtK[k]
      }
    }
    
    const score = weightedSum / totalRelevant
    
    console.log(`[RAGAS Context Precision] Score: ${score.toFixed(3)} (${totalRelevant}/${input.context.length} relevant chunks)`)
    
    return {
      score,
      totalChunks: input.context.length,
      relevantChunks: totalRelevant,
      precisionAtK,
      relevanceIndicators,
      executionTime: Date.now() - startTime,
      cached: false
    }
    
  } catch (error) {
    console.error('[RAGAS Context Precision] Evaluation error:', error)
    
    // Return neutral score on error
    return {
      score: 0.5,
      totalChunks: input.context.length,
      relevantChunks: 0,
      precisionAtK: [],
      relevanceIndicators: [],
      executionTime: Date.now() - startTime,
      cached: false
    }
  }
}

/**
 * Determine if each chunk is relevant to the question and answer
 * Uses GPT-4o-mini to evaluate relevance
 */
async function determineChunkRelevance(
  question: string,
  answer: string,
  context: string[],
  openai: OpenAI
): Promise<boolean[]> {
  if (context.length === 0) {
    return []
  }
  
  const prompt = `Question: ${question}

Answer: ${answer}

Retrieved Context Chunks:
${context.map((chunk, i) => `${i + 1}. ${chunk}`).join('\n\n')}

For each context chunk above, determine if it is relevant to answering the question.
A chunk is "relevant" if it contains information that helps answer the question or supports the answer.
A chunk is "not_relevant" if it does not contribute to answering the question.

Return ONLY a JSON object in this exact format:
{"relevance": ["relevant", "not_relevant", "relevant", ...]}

The relevance array must have exactly ${context.length} elements, one for each chunk.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at evaluating the relevance of retrieved context to questions. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn('[RAGAS Context Precision] No content in relevance response')
      return context.map(() => false)
    }
    
    const parsed = JSON.parse(content)
    const relevance = parsed.relevance || []
    
    // Ensure we have the right number of results
    if (relevance.length !== context.length) {
      console.warn(`[RAGAS Context Precision] Result count mismatch: expected ${context.length}, got ${relevance.length}`)
      return context.map(() => false)
    }
    
    // Convert to boolean array
    const indicators = relevance.map((r: string) => r === 'relevant')
    
    const relevantCount = indicators.filter(r => r).length
    console.log(`[RAGAS Context Precision] Found ${relevantCount}/${context.length} relevant chunks`)
    
    return indicators
    
  } catch (error) {
    console.error('[RAGAS Context Precision] Relevance determination error:', error)
    return context.map(() => false)
  }
}

