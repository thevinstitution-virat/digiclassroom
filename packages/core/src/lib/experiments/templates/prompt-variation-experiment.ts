/**
 * Prompt Variation A/B Test Template
 * Tests: Current prompt vs Optimized prompt
 * 
 * Hypothesis: Optimized prompt improves clarity and CBSE alignment
 */

import { getUserVariant } from '../traffic-splitter'

const EXPERIMENT_ID = 'exp-prompt-variation-testing'

export interface PromptConfig {
  promptTemplate: string
  includesExperience: boolean
  includesGuidelines: boolean
  includesCitationRequirement: boolean
}

const VARIANT_A_CONFIG: PromptConfig = {
  promptTemplate: `You are an expert CBSE tutor. Answer the following question based on the provided context.

Context: {context}

Question: {question}

Answer:`,
  includesExperience: false,
  includesGuidelines: false,
  includesCitationRequirement: false
}

const VARIANT_B_CONFIG: PromptConfig = {
  promptTemplate: `You are an expert CBSE tutor with 15 years of experience teaching students.

Your answers should:
1. Be factually accurate and aligned with NCERT textbooks
2. Use simple language appropriate for the student's class level
3. Include relevant examples and diagrams where helpful
4. Cite specific textbook chapters and page numbers

Context: {context}

Question: {question}

Answer:`,
  includesExperience: true,
  includesGuidelines: true,
  includesCitationRequirement: true
}

/**
 * Get prompt template with A/B test
 */
export async function getPromptWithExperiment(
  userId: string,
  context: string,
  question: string
): Promise<{
  prompt: string
  variant: 'A' | 'B'
  experimentId: string
}> {
  // Get user's variant assignment
  const assignment = await getUserVariant(userId, EXPERIMENT_ID, 50)
  
  // Select config based on variant
  const config = assignment.variant === 'A' ? VARIANT_A_CONFIG : VARIANT_B_CONFIG
  
  // Replace placeholders
  const prompt = config.promptTemplate
    .replace('{context}', context)
    .replace('{question}', question)
  
  console.log(`[Prompt Experiment] User ${userId} -> Variant ${assignment.variant}`)
  
  return {
    prompt,
    variant: assignment.variant,
    experimentId: EXPERIMENT_ID
  }
}

/**
 * Create the experiment in database
 */
export async function createPromptVariationExperiment() {
  const experimentConfig = {
    experimentName: 'Prompt Variation: Current vs Optimized',
    experimentType: 'prompt_variation' as const,
    description: 'Test if optimized prompt improves clarity and CBSE alignment',
    hypothesis: 'H0: Current prompt performs the same as optimized prompt. H1: Optimized prompt improves clarity and CBSE alignment.',
    variantAConfig: VARIANT_A_CONFIG,
    variantBConfig: VARIANT_B_CONFIG,
    trafficSplitPercentage: 50,
    primaryMetric: 'rating',
    secondaryMetrics: ['faithfulness_score', 'relevance_score'],
    successThreshold: 0.3,
    minSampleSize: 300,
    notes: 'Target: +5% clarity, +5% CBSE alignment, +10% citation quality'
  }
  
  return experimentConfig
}

/**
 * Expected improvements
 */
export const EXPECTED_IMPROVEMENTS = {
  clarity: {
    variantA: 75,
    variantB: 80,
    target: 5
  },
  cbseAlignment: {
    variantA: 80,
    variantB: 85,
    target: 5
  },
  citationQuality: {
    variantA: 60,
    variantB: 70,
    target: 10
  }
}

