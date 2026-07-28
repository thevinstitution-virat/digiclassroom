/**
 * A/B Testing Integration for Embedding Model
 * 
 * Automatically assigns users to embedding model variants and tracks results
 */

import OpenAI from 'openai'
import { getUserVariant } from './traffic-splitter'

const EXPERIMENT_ID = 'exp-001-embedding-model'

export interface EmbeddingWithExperiment {
  embedding: number[]
  variant: 'A' | 'B'
  experimentId: string
  model: string
  dimensions: number
}

export interface BatchEmbeddingsWithExperiment {
  embeddings: number[][]
  variant: 'A' | 'B'
  experimentId: string
  model: string
  dimensions: number
}

/**
 * Generate embedding with A/B test variant assignment
 * 
 * Variant A: text-embedding-3-large (3072 dims) - Current production model
 * Variant B: text-embedding-3-small (1536 dims) - 85% cheaper alternative
 */
export async function generateEmbeddingWithExperiment(
  text: string,
  userId: string,
  openai: OpenAI
): Promise<EmbeddingWithExperiment> {
  
  // Get user's assigned variant (consistent hashing ensures same user always gets same variant)
  const variant = await getUserVariant(userId, EXPERIMENT_ID, 50) // 50/50 split
  
  // Select model based on variant
        // @ts-ignore
  const model = variant === 'A' 
    ? 'text-embedding-3-large'  // Control: Current production model
    : 'text-embedding-3-small'  // Treatment: Cheaper alternative
  
        // @ts-ignore
  const dimensions = variant === 'A' ? 3072 : 1536
  
  console.log(`[A/B Test] User ${userId} → Variant ${variant} (${model}, ${dimensions} dims)`)
  
  try {
    // Generate embedding with assigned model
    const response = await openai.embeddings.create({
      model,
      input: text,
      dimensions // Explicitly set dimensions
    })
    
    const embedding = response.data?.[0]?.embedding
    if (!embedding) {
      throw new Error('Failed to generate embedding from OpenAI API')
    }
    
    return {
      embedding,
        // @ts-ignore
      variant,
      experimentId: EXPERIMENT_ID,
      model,
      dimensions
    }
    
  } catch (error) {
    console.error(`[A/B Test] Embedding generation failed for variant ${variant}:`, error)
    throw error
  }
}

/**
 * Generate batch embeddings with A/B test variant assignment
 */
export async function generateBatchEmbeddingsWithExperiment(
  texts: string[],
  userId: string,
  openai: OpenAI
): Promise<BatchEmbeddingsWithExperiment> {
  
  if (texts.length === 0) {
    return {
      embeddings: [],
      variant: 'A',
      experimentId: EXPERIMENT_ID,
      model: 'text-embedding-3-large',
      dimensions: 3072
    }
  }
  
  // Get user's assigned variant
  const variant = await getUserVariant(userId, EXPERIMENT_ID, 50)
  
  // Select model based on variant
        // @ts-ignore
  const model = variant === 'A' 
    ? 'text-embedding-3-large'
    : 'text-embedding-3-small'
  
        // @ts-ignore
  const dimensions = variant === 'A' ? 3072 : 1536
  
  console.log(`[A/B Test] Batch embedding for user ${userId} → Variant ${variant} (${model}, ${dimensions} dims, ${texts.length} texts)`)
  
  try {
    // Generate embeddings with assigned model
    const response = await openai.embeddings.create({
      model,
      input: texts,
      dimensions
    })
    
    if (!response.data || response.data.length !== texts.length) {
      throw new Error('Embedding count mismatch returned by OpenAI API')
    }
    
    const embeddings = response.data.map(item => {
      if (!item.embedding) {
        throw new Error('Missing embedding vector in OpenAI response')
      }
      return item.embedding
    })
    
    return {
      embeddings,
        // @ts-ignore
      variant,
      experimentId: EXPERIMENT_ID,
      model,
      dimensions
    }
    
  } catch (error) {
    console.error(`[A/B Test] Batch embedding generation failed for variant ${variant}:`, error)
    throw error
  }
}

/**
 * Check if A/B testing is enabled for embeddings
 */
export function isEmbeddingExperimentEnabled(): boolean {
  // Check if experiment is active in database
  // For now, we'll use an environment variable
  return process.env.ENABLE_EMBEDDING_EXPERIMENT === 'true'
}

/**
 * Get embedding with optional A/B testing
 * Falls back to standard embedding if experiment is disabled
 */
export async function getEmbeddingWithOptionalExperiment(
  text: string,
  userId: string | null,
  openai: OpenAI
): Promise<EmbeddingWithExperiment> {
  
  // If experiment is disabled or no userId, use standard embedding
  if (!isEmbeddingExperimentEnabled() || !userId) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text
    })
    
    const embedding = response.data?.[0]?.embedding
    if (!embedding) {
      throw new Error('Failed to generate embedding from OpenAI API')
    }
    
    return {
      embedding,
      variant: 'A',
      experimentId: EXPERIMENT_ID,
      model: 'text-embedding-3-large',
      dimensions: 3072
    }
  }
  
  // Use A/B testing
  return generateEmbeddingWithExperiment(text, userId, openai)
}

/**
 * Get batch embeddings with optional A/B testing
 */
export async function getBatchEmbeddingsWithOptionalExperiment(
  texts: string[],
  userId: string | null,
  openai: OpenAI
): Promise<BatchEmbeddingsWithExperiment> {
  
  // If experiment is disabled or no userId, use standard embedding
  if (!isEmbeddingExperimentEnabled() || !userId) {
    if (texts.length === 0) {
      return {
        embeddings: [],
        variant: 'A',
        experimentId: EXPERIMENT_ID,
        model: 'text-embedding-3-large',
        dimensions: 3072
      }
    }
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: texts
    })
    
    if (!response.data || response.data.length !== texts.length) {
      throw new Error('Embedding count mismatch returned by OpenAI API')
    }
    
    const embeddings = response.data.map(item => {
      if (!item.embedding) {
        throw new Error('Missing embedding vector in OpenAI response')
      }
      return item.embedding
    })
    
    return {
      embeddings,
      variant: 'A',
      experimentId: EXPERIMENT_ID,
      model: 'text-embedding-3-large',
      dimensions: 3072
    }
  }
  
  // Use A/B testing
  return generateBatchEmbeddingsWithExperiment(texts, userId, openai)
}

