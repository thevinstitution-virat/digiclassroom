import type { TutorGraphState } from '../state'
import { rankChunksEnhanced, selectOptimalChunks } from '@/lib/ai/ranking/enhanced-ranking-service'

const CLASS_MATCH_WEIGHT = 0.5
const SUBJECT_MATCH_WEIGHT = 0.3
const BOARD_MATCH_WEIGHT = 0.2
const SECTION_CONTINUITY_WEIGHT = 0.1

export async function rankingNode(state: TutorGraphState): Promise<TutorGraphState> {
  const retrieved = state.retrievedChunks ?? []
  if (retrieved.length === 0) {
    return state
  }

  // Use enhanced ranking if routing intent is available
  if (state.routingIntent) {
    console.log('[Ranking] Using enhanced ranking with completeness scoring')

    const rankedChunks = await rankChunksEnhanced(
      retrieved,
      state.query,
      state.studentProfile,
      {
        queryIntent: state.routingIntent.type,
        queryComplexity: state.routingIntent.complexity,
        requiresMultipleChunks: state.routingIntent.requiresMultipleChunks,
        optimalChunkCount: state.routingIntent.optimalChunkCount
      }
    )

    // Select optimal chunks with diversity
    const selectedChunks = selectOptimalChunks(
      rankedChunks,
      state.routingIntent.optimalChunkCount,
      true // Ensure diversity
    )

    return {
      ...state,
      rankedChunks: selectedChunks.map(chunk => ({
        id: chunk.id,
        text: chunk.text,
        metadata: chunk.metadata,
        score: chunk.score
      }))
    }
  }

  // Fallback to legacy ranking (for backward compatibility)
  console.log('[Ranking] Using legacy ranking (no routing intent)')

  const ranked = retrieved
    .map((chunk, idx) => {
      const baseScore = typeof chunk.score === 'number' ? chunk.score : 0
      const metadata = chunk.metadata || {}

      let score = baseScore
      if (state.studentProfile.classLevel && normalize(metadata.classLevel) === normalize(state.studentProfile.classLevel)) {
        score += CLASS_MATCH_WEIGHT
      }
      if (state.studentProfile.subject && normalize(metadata.subject) === normalize(state.studentProfile.subject)) {
        score += SUBJECT_MATCH_WEIGHT
      }
      if (state.studentProfile.board && normalize(metadata.board) === normalize(state.studentProfile.board)) {
        score += BOARD_MATCH_WEIGHT
      }
      if (idx > 0) {
        const previous = retrieved[idx - 1]
        if (
          previous.metadata?.chapter &&
          metadata.chapter &&
          normalize(previous.metadata.chapter) === normalize(metadata.chapter)
        ) {
          score += SECTION_CONTINUITY_WEIGHT
        }
      }

      return {
        ...chunk,
        score
      }
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 16)

  return {
    ...state,
    rankedChunks: ranked
  }
}

function normalize(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.trim().toLowerCase()
}

