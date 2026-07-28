/**
 * RAGAS Answer Relevancy Evaluation
 * Measures if the AI-generated answer addresses the user's question
 * 
 * Algorithm:
 * 1. Generate 3 questions from the answer using GPT-4o-mini
 * 2. Compute embeddings for original question + generated questions
 * 3. Calculate cosine similarity between original and generated questions
 * 4. Score = average similarity
 * 
 * Target: >0.8 relevancy score
 * Execution Time: <3 seconds
 */

import OpenAI from 'openai'

export interface RelevancyResult {
  score: number                 // 0.0 to 1.0
  generatedQuestions: string[]
  similarities: number[]
  executionTime: number         // milliseconds
  cached: boolean
}

export interface RelevancyInput {
  originalQuestion: string
  answer: string
}

/**
 * Evaluate relevancy of an answer to the original question
 */
export async function evaluateRelevancy(
  input: RelevancyInput,
  openai: OpenAI
): Promise<RelevancyResult> {
  const startTime = Date.now()
  
  try {
    // Step 1: Generate questions from answer
    const generatedQuestions = await generateQuestionsFromAnswer(
      input.answer,
      openai
    )
    
    if (generatedQuestions.length === 0) {
      // No questions generated - neutral score
      return {
        score: 0.5,
        generatedQuestions: [],
        similarities: [],
        executionTime: Date.now() - startTime,
        cached: false
      }
    }
    
    // Step 2: Get embeddings for all questions
    const allQuestions = [input.originalQuestion, ...generatedQuestions]
    const embeddings = await getEmbeddings(allQuestions, openai)
    
    if (embeddings.length !== allQuestions.length) {
      console.warn('[RAGAS Relevancy] Embedding count mismatch')
      return {
        score: 0.5,
        generatedQuestions,
        similarities: [],
        executionTime: Date.now() - startTime,
        cached: false
      }
    }
    
    // Step 3: Calculate cosine similarities
    const originalEmbedding = embeddings[0]
    const generatedEmbeddings = embeddings.slice(1)
    
    const similarities = generatedEmbeddings.map(genEmb =>
      cosineSimilarity(originalEmbedding, genEmb)
    )
    
    // Step 4: Calculate average similarity
    const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length
    
    console.log(`[RAGAS Relevancy] Score: ${avgSimilarity.toFixed(3)} (${similarities.length} questions)`)
    
    return {
      score: avgSimilarity,
      generatedQuestions,
      similarities,
      executionTime: Date.now() - startTime,
      cached: false
    }
    
  } catch (error) {
    console.error('[RAGAS Relevancy] Evaluation error:', error)
    
    // Return neutral score on error
    return {
      score: 0.5,
      generatedQuestions: [],
      similarities: [],
      executionTime: Date.now() - startTime,
      cached: false
    }
  }
}

/**
 * Generate questions from an answer using GPT-4o-mini
 */
async function generateQuestionsFromAnswer(
  answer: string,
  openai: OpenAI
): Promise<string[]> {
  const prompt = `Based on the following answer, generate 3 questions that this answer could be responding to.
The questions should be natural and relevant to the content of the answer.

Answer: ${answer}

Return ONLY a JSON object in this exact format:
{"questions": ["question1", "question2", "question3"]}

Generate exactly 3 questions.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at generating relevant questions from answers. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,  // Slightly higher for diversity
      max_tokens: 500,
      response_format: { type: 'json_object' }
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn('[RAGAS Relevancy] No content in question generation response')
      return []
    }
    
    const parsed = JSON.parse(content)
    const questions = parsed.questions || []
    
    console.log(`[RAGAS Relevancy] Generated ${questions.length} questions`)
    return questions
    
  } catch (error) {
    console.error('[RAGAS Relevancy] Question generation error:', error)
    return []
  }
}

/**
 * Get embeddings for multiple texts using text-embedding-3-large
 */
async function getEmbeddings(
  texts: string[],
  openai: OpenAI
): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }
  
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: texts
    })
    
    if (!response.data || response.data.length !== texts.length) {
      console.warn('[RAGAS Relevancy] Embedding count mismatch')
      return []
    }
    
    const embeddings = response.data.map(item => {
      if (!item.embedding) {
        throw new Error('Missing embedding vector in OpenAI response')
      }
      return item.embedding
    })
    
    console.log(`[RAGAS Relevancy] Generated ${embeddings.length} embeddings (${embeddings[0].length} dimensions)`)
    return embeddings
    
  } catch (error) {
    console.error('[RAGAS Relevancy] Embedding generation error:', error)
    return []
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    console.warn('[RAGAS Relevancy] Vector length mismatch in cosine similarity')
    return 0
  }
  
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0
  }
  
  return dotProduct / (magnitudeA * magnitudeB)
}

