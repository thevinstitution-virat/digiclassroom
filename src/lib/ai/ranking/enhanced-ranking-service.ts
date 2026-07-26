/**
 * Enhanced Ranking Service
 * Context-aware chunk ranking with completeness and quality scoring
 * 
 * Features:
 * - Completeness scoring (does chunk fully answer query?)
 * - Cross-reference scoring (does chunk reference tables/diagrams?)
 * - Recency scoring (prefer latest curriculum updates)
 * - Educational relevance boosting
 * - Query-type specific ranking
 */

export interface ChunkRankingScore {
  // Base scores
  vectorSimilarity: number        // 0-1 from Qdrant
  metadataBoost: number           // 0-0.2 (current implementation)
  
  // New scoring dimensions
  completenessScore: number       // 0-0.3 (NEW)
  crossReferenceScore: number     // 0-0.2 (NEW)
  recencyScore: number            // 0-0.1 (NEW)
  
  // Final score
  finalScore: number              // Weighted sum
}

export interface RankedChunk {
  id: string
  text: string
  metadata: Record<string, any>
  score: number
  ranking: ChunkRankingScore
  relevanceReason: string
}

export interface RankingOptions {
  queryIntent: string
  queryComplexity: string
  requiresMultipleChunks: boolean
  optimalChunkCount: number
}

/**
 * Enhanced ranking with completeness and quality scoring
 */
export async function rankChunksEnhanced(
  chunks: Array<{
    id: string
    text: string
    metadata: Record<string, any>
    score: number
  }>,
  query: string,
  studentProfile: {
    board?: string
    classLevel?: string
    subject?: string
  },
  options: RankingOptions
): Promise<RankedChunk[]> {
  
  if (chunks.length === 0) {
    return []
  }
  
  console.log(`[Enhanced Ranking] Ranking ${chunks.length} chunks for query: "${query.substring(0, 50)}..."`)
  
  // Step 1: Calculate all scoring dimensions
  const rankedChunks = chunks.map(chunk => {
    const ranking = calculateEnhancedScore(chunk, query, studentProfile, options)
    
    return {
      ...chunk,
      ranking,
      score: ranking.finalScore,
      relevanceReason: generateRelevanceReason(ranking, options)
    }
  })
  
  // Step 2: Sort by final score
  rankedChunks.sort((a, b) => b.ranking.finalScore - a.ranking.finalScore)
  
  // Step 3: Log top results
  console.log(`[Enhanced Ranking] Top 3 chunks:`)
  rankedChunks.slice(0, 3).forEach((chunk, idx) => {
    console.log(`  ${idx + 1}. Score: ${chunk.ranking.finalScore.toFixed(3)} (Vector: ${chunk.ranking.vectorSimilarity.toFixed(3)}, Completeness: ${chunk.ranking.completenessScore.toFixed(3)})`)
  })
  
  return rankedChunks
}

/**
 * Calculate enhanced ranking score
 */
function calculateEnhancedScore(
  chunk: any,
  query: string,
  studentProfile: any,
  options: RankingOptions
): ChunkRankingScore {
  
  // Base vector similarity (from Qdrant)
  const vectorSimilarity = typeof chunk.score === 'number' ? chunk.score : 0
  
  // Metadata boost (existing logic)
  const metadataBoost = calculateMetadataBoost(chunk.metadata, studentProfile)
  
  // NEW: Completeness score
  const completenessScore = calculateCompletenessScore(chunk, query, options)
  
  // NEW: Cross-reference score
  const crossReferenceScore = calculateCrossReferenceScore(chunk, options)
  
  // NEW: Recency score
  const recencyScore = calculateRecencyScore(chunk.metadata)
  
  // Calculate final weighted score
  const finalScore = 
    vectorSimilarity * 0.50 +        // 50% weight on vector similarity
    metadataBoost * 1.0 +            // Direct boost (0-0.2)
    completenessScore * 1.0 +        // Direct boost (0-0.3)
    crossReferenceScore * 1.0 +      // Direct boost (0-0.2)
    recencyScore * 1.0               // Direct boost (0-0.1)
  
  return {
    vectorSimilarity,
    metadataBoost,
    completenessScore,
    crossReferenceScore,
    recencyScore,
    finalScore
  }
}

/**
 * Calculate metadata boost (existing logic)
 */
function calculateMetadataBoost(metadata: any, studentProfile: any): number {
  let boost = 0
  
  // Subject match
  if (studentProfile.subject && normalize(metadata.subject) === normalize(studentProfile.subject)) {
    boost += 0.10
  }
  
  // Class level match
  if (studentProfile.classLevel && normalize(metadata.classLevel) === normalize(studentProfile.classLevel)) {
    boost += 0.05
  }
  
  // Board match
  if (studentProfile.board && normalize(metadata.board) === normalize(studentProfile.board)) {
    boost += 0.05
  }
  
  return Math.min(boost, 0.20) // Cap at 0.20
}

/**
 * Calculate completeness score
 * Does this chunk contain a complete answer or just a fragment?
 */
function calculateCompletenessScore(
  chunk: any,
  query: string,
  options: RankingOptions
): number {
  
  let score = 0
  const text = chunk.text.toLowerCase()
  const queryLower = query.toLowerCase()
  
  // Factor 1: Chunk length appropriateness
  const wordCount = chunk.text.split(/\s+/).length
  
  if (options.queryIntent === 'definition') {
    // Definitions should be concise (50-200 words)
    if (wordCount >= 50 && wordCount <= 200) score += 0.10
    else if (wordCount < 50) score += 0.05 // Too short
    else score += 0.03 // Too long
  } else if (options.queryIntent === 'explanation') {
    // Explanations should be detailed (150-400 words)
    if (wordCount >= 150 && wordCount <= 400) score += 0.10
    else if (wordCount < 150) score += 0.05
    else score += 0.08
  } else if (options.queryIntent === 'comparison') {
    // Comparisons need substantial content (200-500 words)
    if (wordCount >= 200 && wordCount <= 500) score += 0.10
    else score += 0.05
  }
  
  // Factor 2: Contains key query terms
  const queryTerms = extractKeyTerms(queryLower)
  const matchedTerms = queryTerms.filter(term => text.includes(term))
  const termCoverage = queryTerms.length > 0 ? matchedTerms.length / queryTerms.length : 0
  score += termCoverage * 0.10
  
  // Factor 3: Structural completeness indicators
  const hasIntroduction = /^(the |a |an |in |this |these |those )/i.test(chunk.text)
  const hasConclusion = /(therefore|thus|hence|in conclusion|finally)/i.test(text)
  const hasExamples = /(for example|for instance|such as|like)/i.test(text)
  
  if (hasIntroduction) score += 0.02
  if (hasConclusion && options.queryComplexity !== 'simple') score += 0.03
  if (hasExamples && options.queryIntent === 'explanation') score += 0.05
  
  return Math.min(score, 0.30) // Cap at 0.30
}

/**
 * Calculate cross-reference score
 * Does chunk reference tables, diagrams, or other supporting materials?
 */
function calculateCrossReferenceScore(
  chunk: any,
  options: RankingOptions
): number {
  
  let score = 0
  const metadata = chunk.metadata || {}
  const text = chunk.text.toLowerCase()
  
  // Factor 1: Has tables (valuable for data-heavy queries)
  if (metadata.hasTables || metadata.contains_table) {
    score += 0.08
  }
  
  // Factor 2: Has formulas (valuable for STEM queries)
  if (metadata.hasFormulas || metadata.contains_equation) {
    score += 0.08
  }
  
  // Factor 3: References figures/diagrams
  const hasFigureRef = /(figure|diagram|chart|graph|image|illustration)/i.test(text)
  if (hasFigureRef) {
    score += 0.04
  }
  
  return Math.min(score, 0.20) // Cap at 0.20
}

/**
 * Calculate recency score
 * Prefer chunks from latest curriculum updates
 */
function calculateRecencyScore(metadata: any): number {
  // TODO: Implement when we have curriculum version metadata
  // For now, return 0
  return 0
}

/**
 * Extract key terms from query
 */
function extractKeyTerms(query: string): string[] {
  const stopWords = new Set([
    'what', 'where', 'when', 'which', 'who', 'why', 'how',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then',
    'of', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'with'
  ])
  
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
}

/**
 * Generate human-readable relevance reason
 */
function generateRelevanceReason(
  ranking: ChunkRankingScore,
  options: RankingOptions
): string {
  
  const reasons: string[] = []
  
  // Vector similarity
  if (ranking.vectorSimilarity > 0.8) {
    reasons.push('High semantic similarity')
  } else if (ranking.vectorSimilarity > 0.6) {
    reasons.push('Good semantic match')
  }
  
  // Completeness
  if (ranking.completenessScore > 0.20) {
    reasons.push('Complete answer')
  } else if (ranking.completenessScore > 0.10) {
    reasons.push('Partial answer')
  }
  
  // Cross-references
  if (ranking.crossReferenceScore > 0.10) {
    reasons.push('Contains supporting materials')
  }
  
  // Metadata
  if (ranking.metadataBoost > 0.15) {
    reasons.push('Perfect curriculum match')
  } else if (ranking.metadataBoost > 0.05) {
    reasons.push('Good curriculum match')
  }
  
  return reasons.length > 0 ? reasons.join(', ') : 'Relevant content'
}

/**
 * Normalize string for comparison
 */
function normalize(value: unknown): string | undefined {
  if (typeof value !== 'string')
  return undefined
  return value.trim().toLowerCase()
}

/**
 * Filter chunks by minimum quality threshold
 */
export function filterByQualityThreshold(
  chunks: RankedChunk[],
  minScore: number = 0.3
): RankedChunk[] {
  return chunks.filter(chunk => chunk.ranking.finalScore >= minScore)
}

/**
 * Select optimal chunks based on query requirements
 */
export function selectOptimalChunks(
  chunks: RankedChunk[],
  optimalCount: number,
  ensureDiversity: boolean = true
): RankedChunk[] {
  
  if (chunks.length <= optimalCount) {
    return chunks
  }
  
  if (!ensureDiversity) {
    return chunks.slice(0, optimalCount)
  }
  
  // Ensure diversity by selecting from different chapters/sections
  const selected: RankedChunk[] = []
  const usedChapters = new Set<string>()
  
  // First pass: Select top chunks from different chapters
  for (const chunk of chunks) {
    if (selected.length >= optimalCount) break
    
    const chapter = chunk.metadata.chapter || 'unknown'
    if (!usedChapters.has(chapter)) {
      selected.push(chunk)
      usedChapters.add(chapter)
    }
  }
  
  // Second pass: Fill remaining slots with highest-scoring chunks
  for (const chunk of chunks) {
    if (selected.length >= optimalCount) break
    if (!selected.includes(chunk)) {
      selected.push(chunk)
    }
  }
  
  return selected
}

