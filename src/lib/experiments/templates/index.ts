/**
 * A/B Testing Experiment Templates
 * 
 * Provides 4 pre-configured experiment templates:
 * 1. Embedding Model Comparison (3-large vs 3-small)
 * 2. Chunk Count Optimization (3 vs 4 chunks)
 * 3. Retrieval Strategy Comparison (dense vs hybrid)
 * 4. Prompt Variation Testing (current vs optimized)
 */

export * from './embedding-model-experiment'
export * from './chunk-count-experiment'
export * from './retrieval-strategy-experiment'
export * from './prompt-variation-experiment'

/**
 * Get all available experiment templates
 */
export async function getAllExperimentTemplates() {
  const { createEmbeddingModelExperiment } = await import('./embedding-model-experiment')
  const { createChunkCountExperiment } = await import('./chunk-count-experiment')
  const { createRetrievalStrategyExperiment } = await import('./retrieval-strategy-experiment')
  const { createPromptVariationExperiment } = await import('./prompt-variation-experiment')
  
  return [
    await createEmbeddingModelExperiment(),
    await createChunkCountExperiment(),
    await createRetrievalStrategyExperiment(),
    await createPromptVariationExperiment()
  ]
}

