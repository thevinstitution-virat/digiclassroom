/**
 * Chunk Count A/B Test Template
 * Tests: 3 chunks vs 4 chunks
 * 
 * Hypothesis: Retrieving 4 chunks improves completeness without
 * significantly hurting performance or cost
 */

import { getUserVariant } from '../traffic-splitter'

const EXPERIMENT_ID = 'exp-chunk-count-optimization'

export interface ChunkCountConfig {
  chunkCount: number
  avgContextLength: number
  estimatedGenerationTime: number
}

const VARIANT_A_CONFIG: ChunkCountConfig = {
  chunkCount: 3,
  avgContextLength: 1500,
  estimatedGenerationTime: 2800
}

const VARIANT_B_CONFIG: ChunkCountConfig = {
  chunkCount: 4,
  avgContextLength: 2000,
  estimatedGenerationTime: 3200
}

/**
 * Get chunk count with A/B test
 */
export async function getChunkCountWithExperiment(
  userId: string
): Promise<{
  chunkCount: number
  variant: 'A' | 'B'
  experimentId: string
}> {
  // Get user's variant assignment
  const assignment = await getUserVariant(userId, EXPERIMENT_ID, 50)
  
  // Select config based on variant
  const config = assignment.variant === 'A' ? VARIANT_A_CONFIG : VARIANT_B_CONFIG
  
  console.log(`[Chunk Count Experiment] User ${userId} -> Variant ${assignment.variant} (${config.chunkCount} chunks)`)
  
  return {
    chunkCount: config.chunkCount,
    variant: assignment.variant,
    experimentId: EXPERIMENT_ID
  }
}

/**
 * Create the experiment in database
 */
export async function createChunkCountExperiment() {
  const experimentConfig = {
    experimentName: 'Chunk Count Optimization: 3 vs 4 chunks',
    experimentType: 'chunk_count' as const,
    description: 'Test if retrieving 4 chunks improves completeness without hurting performance',
    hypothesis: 'H0: Retrieving 4 chunks performs the same as 3 chunks. H1: Retrieving 4 chunks improves completeness without significantly hurting performance.',
    variantAConfig: VARIANT_A_CONFIG,
    variantBConfig: VARIANT_B_CONFIG,
    trafficSplitPercentage: 50,
    primaryMetric: 'rating',
    secondaryMetrics: ['faithfulness_score', 'response_time_ms'],
    successThreshold: 0.2,
    minSampleSize: 300,
    notes: 'Acceptable if response time increase is < 500ms and completeness improves by +5'
  }
  
  return experimentConfig
}

/**
 * Decision matrix
 */
export const DECISION_MATRIX = [
  {
    completenessChange: 5,
    responseTimeChange: 300,
    decision: 'Deploy 4 chunks',
    rationale: 'Significant completeness improvement with acceptable performance impact'
  },
  {
    completenessChange: 2,
    responseTimeChange: 600,
    decision: 'Keep 3 chunks',
    rationale: 'Minimal completeness gain not worth performance cost'
  },
  {
    completenessChange: 8,
    responseTimeChange: 400,
    decision: 'Deploy 4 chunks',
    rationale: 'Strong completeness improvement with acceptable performance impact'
  },
  {
    completenessChange: 1,
    responseTimeChange: 200,
    decision: 'Keep 3 chunks',
    rationale: 'Negligible improvement not worth the change'
  }
]

