/**
 * RAGAS Context Recall Evaluation
 * Measures if retrieved context contains all needed information
 * 
 * Algorithm:
 * 1. Extract claims from the reference answer
 * 2. For each claim, verify if it can be attributed to the retrieved context
 * 3. Context Recall = Supported claims / Total claims
 * 
 * Formula:
 * Context Recall = Number of claims in reference supported by context / Total claims
 * 
 * Target: >0.8 context recall score
 * Execution Time: <3 seconds
 */

import OpenAI from 'openai'

export interface ContextRecallResult {
  score: number              // 0.0 to 1.0
  totalClaims: number
  supportedClaims: number
  unsupportedClaims: string[]
  executionTime: number      // milliseconds
  cached: boolean
}

export interface ContextRecallInput {
  question: string
  reference: string          // Ground truth answer
  context: string[]          // Retrieved context chunks
}

/**
 * Evaluate context recall - measures if context contains needed information
 */
export async function evaluateContextRecall(
  input: ContextRecallInput,
  openai: OpenAI
): Promise<ContextRecallResult> {
  const startTime = Date.now()
  
  try {
    // Step 1: Extract claims from reference answer
    const claims = await extractClaims(input.reference, openai)
    
    if (claims.length === 0) {
      // No claims to verify - perfect score
      return {
        score: 1.0,
        totalClaims: 0,
        supportedClaims: 0,
        unsupportedClaims: [],
        executionTime: Date.now() - startTime,
        cached: false
      }
    }
    
    // Step 2: Verify each claim against retrieved context
    const verificationResults = await verifyClaims(
      claims,
      input.context,
      openai
    )
    
    // Step 3: Calculate recall score
    const supportedCount = verificationResults.filter(r => r.supported).length
    const unsupportedClaims = claims.filter((_, i) => !verificationResults[i].supported)
    const score = supportedCount / claims.length
    
    console.log(`[RAGAS Context Recall] Score: ${score.toFixed(3)} (${supportedCount}/${claims.length} claims supported)`)
    
    return {
      score,
      totalClaims: claims.length,
      supportedClaims: supportedCount,
      unsupportedClaims,
      executionTime: Date.now() - startTime,
      cached: false
    }
    
  } catch (error) {
    console.error('[RAGAS Context Recall] Evaluation error:', error)
    
    // Return neutral score on error
    return {
      score: 0.5,
      totalClaims: 0,
      supportedClaims: 0,
      unsupportedClaims: [],
      executionTime: Date.now() - startTime,
      cached: false
    }
  }
}

/**
 * Extract claims from reference answer
 * Uses GPT-4o-mini to break down the reference into atomic claims
 */
async function extractClaims(
  reference: string,
  openai: OpenAI
): Promise<string[]> {
  const prompt = `Break down the following reference answer into atomic claims.
Each claim should be a single, verifiable statement.

Reference Answer:
${reference}

Return ONLY a JSON object in this exact format:
{"claims": ["claim 1", "claim 2", "claim 3", ...]}`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at breaking down text into atomic claims. Return only valid JSON.'
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
      console.warn('[RAGAS Context Recall] No content in claims extraction response')
      return []
    }
    
    const parsed = JSON.parse(content)
    const claims = parsed.claims || []
    
    console.log(`[RAGAS Context Recall] Extracted ${claims.length} claims from reference`)
    
    return claims
    
  } catch (error) {
    console.error('[RAGAS Context Recall] Claims extraction error:', error)
    return []
  }
}

/**
 * Verify if each claim is supported by the retrieved context
 */
async function verifyClaims(
  claims: string[],
  context: string[],
  openai: OpenAI
): Promise<Array<{ supported: boolean }>> {
  if (claims.length === 0 || context.length === 0) {
    return claims.map(() => ({ supported: false }))
  }
  
  const contextText = context.join('\n\n')
  
  const prompt = `Retrieved Context:
${contextText}

Claims to Verify:
${claims.map((claim, i) => `${i + 1}. ${claim}`).join('\n')}

For each claim above, determine if it can be attributed to (supported by) the retrieved context.
A claim is "supported" if the context contains information that validates or confirms the claim.
A claim is "not_supported" if the context does not contain information to validate the claim.

Return ONLY a JSON object in this exact format:
{"verification": ["supported", "not_supported", "supported", ...]}

The verification array must have exactly ${claims.length} elements, one for each claim.`

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at verifying if claims are supported by context. Return only valid JSON.'
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
      console.warn('[RAGAS Context Recall] No content in verification response')
      return claims.map(() => ({ supported: false }))
    }
    
    const parsed = JSON.parse(content)
    const verification = parsed.verification || []
    
    // Ensure we have the right number of results
    if (verification.length !== claims.length) {
      console.warn(`[RAGAS Context Recall] Result count mismatch: expected ${claims.length}, got ${verification.length}`)
      return claims.map(() => ({ supported: false }))
    }
    
    // Convert to result objects
    const results = verification.map((v: string) => ({
      supported: v === 'supported'
    }))
    
    const supportedCount = results.filter(r => r.supported).length
    console.log(`[RAGAS Context Recall] ${supportedCount}/${claims.length} claims supported by context`)
    
    return results
    
  } catch (error) {
    console.error('[RAGAS Context Recall] Verification error:', error)
    return claims.map(() => ({ supported: false }))
  }
}

