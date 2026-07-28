/**
 * Embedding Model A/B Test Template
 * Tests: text-embedding-3-large vs text-embedding-3-small
 * 
 * Hypothesis: text-embedding-3-small can replace 3-large with 85% cost reduction
 * and acceptable quality (< 0.05 drop in faithfulness)
 */

import { getUserVariant } from '../traffic-splitter'
import OpenAI from 'openai'

const EXPERIMENT_ID = 'exp-embedding-model-comparison'

export interface EmbeddingModelConfig {
  model: 'text-embedding-3-large' | 'text-embedding-3-small'
  dimensions: number
  costPer1kTokens: number
}

const VARIANT_A_CONFIG: EmbeddingModelConfig = {
  model: 'text-embedding-3-large',
  dimensions: 3072,
  costPer1kTokens: 0.00013
}

const VARIANT_B_CONFIG: EmbeddingModelConfig = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  costPer1kTokens: 0.00002
}

/**
 * Get embedding with A/B test
 * Automatically assigns user to variant and uses appropriate model
 */
export async function getEmbeddingWithExperiment(
  text: string,
  userId: string,
  openai: OpenAI
): Promise<{
  embedding: number[]
  model: string
  variant: 'A' | 'B'
  experimentId: string
}> {
  // Get user's variant assignment
  const assignment = await getUserVariant(userId, EXPERIMENT_ID, 50)
  
  // Select config based on variant
  const config = assignment.variant === 'A' ? VARIANT_A_CONFIG : VARIANT_B_CONFIG
  
  // Get embedding using assigned model
  const response = await openai.embeddings.create({
    model: config.model,
    input: text,
    dimensions: config.dimensions
  })
  
  console.log(`[Embedding Experiment] User ${userId} -> Variant ${assignment.variant} (${config.model})`)
  
  return {
    embedding: response.data[0].embedding,
    model: config.model,
    variant: assignment.variant,
    experimentId: EXPERIMENT_ID
  }
}

/**
 * Create the experiment in database
 */
export async function createEmbeddingModelExperiment() {
  const experimentConfig = {
    experimentName: 'Embedding Model Comparison: 3-large vs 3-small',
    experimentType: 'embedding_model' as const,
    description: 'Test if text-embedding-3-small can replace text-embedding-3-large with acceptable quality',
    hypothesis: 'H0: text-embedding-3-small performs the same as text-embedding-3-large. H1: text-embedding-3-small has lower quality but acceptable performance (< 0.05 drop in faithfulness).',
    variantAConfig: VARIANT_A_CONFIG,
    variantBConfig: VARIANT_B_CONFIG,
    trafficSplitPercentage: 50,
    primaryMetric: 'faithfulness_score',
    secondaryMetrics: ['rating', 'relevance_score', 'response_time_ms'],
    successThreshold: 0.05,
    minSampleSize: 393,
    notes: 'Expected 85% cost reduction. Acceptable if faithfulness drop is < 0.05'
  }
  
  return experimentConfig
}

/**
 * Expected results and decision criteria
 */
export const EXPECTED_RESULTS = {
  scenario1: {
    name: 'Small model is acceptable',
    variantA: {
      rating: 4.0,
      faithfulness: 0.87,
      cost: 0.015
    },
    variantB: {
      rating: 3.95,
      faithfulness: 0.85,
      cost: 0.002
    },
    decision: 'Deploy text-embedding-3-small',
    rationale: '85% cost reduction with minimal quality impact'
  },
  scenario2: {
    name: 'Small model underperforms',
    variantA: {
      rating: 4.0,
      faithfulness: 0.87,
      cost: 0.015
    },
    variantB: {
      rating: 3.5,
      faithfulness: 0.72,
      cost: 0.002
    },
    decision: 'Keep text-embedding-3-large',
    rationale: 'Quality drop is unacceptable despite cost savings'
  }
}

