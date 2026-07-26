import type { TutorGraphState } from '../state'
import { enhancedRAG } from '../../rag/enhanced-rag-pipeline'

const MAX_RESULTS_PER_QUERY = 8

export async function retrievalNode(state: TutorGraphState): Promise<TutorGraphState> {
  const retrievalStartTime = Date.now()

  const queries =
    state.analysis?.multiQueries?.length && state.analysis.multiQueries.length > 0
      ? state.analysis.multiQueries
      : [state.query]

  const aggregated = new Map<string, {
    id: string
    text: string
    metadata: Record<string, unknown>
    score: number
  }>()

  const retrievalLogs: Array<{ query: string; total: number }> = []

  // Track experiment info from first query
  let experimentId: string | null = null
  let experimentVariant: 'A' | 'B' | null = null

  for (const queryVariant of queries) {
    const options = {
      subject: state.studentProfile.subject,
      classLevel: state.studentProfile.classLevel,
      topK: MAX_RESULTS_PER_QUERY,
      enableHybridSearch: true,
      enableFallback: true,
      requireTextbookContent: true,
      minRelevanceScore: 0.02,
      userId: state.userId // Pass userId for A/B testing
    }

    const ragResponse = await enhancedRAG.search(queryVariant, options)

    // Capture experiment info from first query
    if (!experimentId && ragResponse?.debug_info?.experiment_id) {
      experimentId = ragResponse.debug_info.experiment_id
      experimentVariant = ragResponse.debug_info.experiment_variant
    }

    const results = ragResponse?.results ?? []
    retrievalLogs.push({ query: queryVariant, total: results.length })

    results.forEach((result) => {
      const key =
        result.id ||
        // @ts-ignore
        `${result.metadata?.bookTitle ?? ''}-${result.metadata?.page ?? ''}-${result.metadata?.chapter ?? ''}-${result.content?.slice(0, 40) ?? ''}`

      const existing = aggregated.get(key)
      const score = typeof result.score === 'number' ? result.score : 0

      if (!existing) {
        aggregated.set(key, {
          id: result.id ?? key,
          text: result.content,
          metadata: result.metadata ?? {},
          score
        })
      } else if (score > existing.score) {
        existing.score = score
        existing.text = result.content
        existing.metadata = result.metadata ?? existing.metadata
      }
    })
  }

  const retrievedChunks = Array.from(aggregated.values()).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))

  const retrievalDuration = Date.now() - retrievalStartTime
  console.log(`⏱️ [Performance] Retrieval node took ${retrievalDuration}ms`)
  console.log(`   - Queries processed: ${queries.length}`)
  console.log(`   - Total chunks retrieved: ${retrievedChunks.length}`)
  console.log(`   - Top score: ${retrievedChunks[0]?.score?.toFixed(3) || 'N/A'}`)

  if (experimentId && experimentVariant) {
    console.log(`🧪 [A/B Test] Experiment: ${experimentId}, Variant: ${experimentVariant}`)
  }

  return {
    ...state,
    retrievedChunks,
    metadata: {
      ...state.metadata,
      retrievalLogs,
      retrievalDuration,
      experimentId,
      experimentVariant
    }
  }
}

