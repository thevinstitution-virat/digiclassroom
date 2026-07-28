/**
 * Retrieval Strategy A/B Test Template
 * Tests: Dense-only vs Hybrid (dense + sparse with RRF)
 * 
 * Hypothesis: Hybrid retrieval improves answer quality with acceptable
 * search time increase
 */

import { getUserVariant } from '../traffic-splitter'

const EXPERIMENT_ID = 'exp-retrieval-strategy-comparison'

export interface RetrievalStrategyConfig {
  strategy: 'dense' | 'hybrid'
  useBM25: boolean
  useRRF: boolean
  estimatedSearchTime: number
}

const VARIANT_A_CONFIG: RetrievalStrategyConfig = {
  strategy: 'dense',
  useBM25: false,
  useRRF: false,
  estimatedSearchTime: 300
}

const VARIANT_B_CONFIG: RetrievalStrategyConfig = {
  strategy: 'hybrid',
  useBM25: true,
  useRRF: true,
  estimatedSearchTime: 450
}

/**
 * Get retrieval strategy with A/B test
 */
export async function getRetrievalStrategyWithExperiment(
  userId: string
): Promise<{
  strategy: 'dense' | 'hybrid'
  useBM25: boolean
  useRRF: boolean
  variant: 'A' | 'B'
  experimentId: string
}> {
  // Get user's variant assignment
  const assignment = await getUserVariant(userId, EXPERIMENT_ID, 50)
  
  // Select config based on variant
  const config = assignment.variant === 'A' ? VARIANT_A_CONFIG : VARIANT_B_CONFIG
  
  console.log(`[Retrieval Strategy Experiment] User ${userId} -> Variant ${assignment.variant} (${config.strategy})`)
  
  return {
    strategy: config.strategy,
    useBM25: config.useBM25,
    useRRF: config.useRRF,
    variant: assignment.variant,
    experimentId: EXPERIMENT_ID
  }
}

/**
 * Create the experiment in database
 */
export async function createRetrievalStrategyExperiment() {
  const experimentConfig = {
    experimentName: 'Retrieval Strategy: Dense vs Hybrid',
    experimentType: 'retrieval_strategy' as const,
    description: 'Test if hybrid retrieval (dense + sparse with RRF) improves answer quality',
    hypothesis: 'H0: Dense-only retrieval performs the same as hybrid retrieval. H1: Hybrid retrieval improves answer quality with acceptable search time increase.',
    variantAConfig: VARIANT_A_CONFIG,
    variantBConfig: VARIANT_B_CONFIG,
    trafficSplitPercentage: 50,
    primaryMetric: 'faithfulness_score',
    secondaryMetrics: ['relevance_score', 'response_time_ms'],
    successThreshold: 0.05,
    minSampleSize: 300,
    notes: 'Acceptable if search time increase is < 150ms and faithfulness improves by +0.05'
  }
  
  return experimentConfig
}

/**
 * Expected metrics
 */
export const EXPECTED_METRICS = {
  variantA: {
    faithfulness: 0.85,
    relevance: 0.83,
    searchTime: 300
  },
  variantB: {
    faithfulness: 0.90,
    relevance: 0.88,
    searchTime: 450
  },
  targets: {
    faithfulnessImprovement: 0.05,
    relevanceImprovement: 0.05,
    maxSearchTimeIncrease: 150
  }
}

