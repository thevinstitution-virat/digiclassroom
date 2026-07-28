/**
 * RAGAS Faithfulness Evaluation
 * Measures if the AI-generated answer is grounded in the retrieved context
 * 
 * Algorithm:
 * 1. Extract factual claims from the AI answer using GPT-4o-mini
 * 2. For each claim, verify if it's supported by the retrieved context
 * 3. Calculate faithfulness score = verified_claims / total_claims
 * 
 * Target: >0.8 faithfulness score
 * Execution Time: <2 seconds
 */

import OpenAI from 'openai'

export interface FaithfulnessResult {
  score: number              // 0.0 to 1.0
  totalClaims: number
  verifiedClaims: number
  unverifiedClaims: string[]
  executionTime: number      // milliseconds
  cached: boolean
}

export interface FaithfulnessInput {
  answer: string
  context: string[]
}

/**
 * Evaluate faithfulness of an answer against retrieved context
 */
export async function evaluateFaithfulness(
  input: FaithfulnessInput,
  openai: OpenAI
): Promise<FaithfulnessResult> {
  const startTime = Date.now()
  
  try {
    // Step 1: Extract claims from answer
    const claims = await extractClaims(input.answer, openai)
    
    if (claims.length === 0) {
      // No claims to verify - perfect faithfulness
      return {
        score: 1.0,
        totalClaims: 0,
        verifiedClaims: 0,
        unverifiedClaims: [],
        executionTime: Date.now() - startTime,
        cached: false
      }
    }
    
    // Step 2: Verify each claim against context
    const verificationResults = await verifyClaims(
      claims,
      input.context,
      openai
    )
    
    // Step 3: Calculate score
    const verifiedCount = verificationResults.filter(r => r === 'verified').length
    const unverified = claims.filter((_, i) => verificationResults[i] === 'unverified')
    
    return {
      score: verifiedCount / claims.length,
      totalClaims: claims.length,
      verifiedClaims: verifiedCount,
      unverifiedClaims: unverified,
      executionTime: Date.now() - startTime,
      cached: false
    }
    
  } catch (error) {
    console.error('[RAGAS Faithfulness] Evaluation error:', error)
    
    // Return neutral score on error
    return {
      score: 0.5,
      totalClaims: 0,
      verifiedClaims: 0,
      unverifiedClaims: [],
      executionTime: Date.now() - startTime,
      cached: false
    }
  }
}

/**
 * Extract factual claims from an answer using GPT-4o-mini
 */
async function extractClaims(
  answer: string,
  openai: OpenAI
): Promise<string[]> {
  const prompt = `Extract all factual claims from the following answer as a JSON array.
Each claim should be a single, verifiable statement.

Answer: ${answer}

Return ONLY a JSON object in this exact format:
{"claims": ["claim1", "claim2", "claim3"]}

If there are no factual claims, return: {"claims": []}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting factual claims from text. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    })
    
    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn('[RAGAS Faithfulness] No content in claim extraction response')
      return []
    }
    
    const parsed = JSON.parse(content)
    const claims = parsed.claims || []
    
    console.log(`[RAGAS Faithfulness] Extracted ${claims.length} claims`)
    return claims
    
  } catch (error) {
    console.error('[RAGAS Faithfulness] Claim extraction error:', error)
    return []
  }
}

/**
 * Verify claims against context using GPT-4o-mini
 */
async function verifyClaims(
  claims: string[],
  context: string[],
  openai: OpenAI
): Promise<('verified' | 'unverified')[]> {
  const contextText = context.join('\n\n')
  
  const prompt = `Context:
${contextText}

Claims to verify:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each claim, determine if it is supported by the context above.
A claim is "verified" if the context provides evidence for it.
A claim is "unverified" if the context does not support it or contradicts it.

Return ONLY a JSON object in this exact format:
{"results": ["verified", "unverified", "verified", ...]}

The results array must have exactly ${claims.length} elements, one for each claim.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at verifying factual claims against source text. Return only valid JSON.'
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
      console.warn('[RAGAS Faithfulness] No content in verification response')
      return claims.map(() => 'unverified')
    }
    
    const parsed = JSON.parse(content)
    const results = parsed.results || []
    
    // Ensure we have the right number of results
    if (results.length !== claims.length) {
      console.warn(`[RAGAS Faithfulness] Result count mismatch: expected ${claims.length}, got ${results.length}`)
      return claims.map(() => 'unverified')
    }
    
    const verifiedCount = results.filter((r: string) => r === 'verified').length
    console.log(`[RAGAS Faithfulness] Verified ${verifiedCount}/${claims.length} claims`)
    
    return results
    
  } catch (error) {
    console.error('[RAGAS Faithfulness] Claim verification error:', error)
    return claims.map(() => 'unverified')
  }
}

