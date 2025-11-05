import type { TutorGraphState } from '../state'
import { analyzeQueryAndGenerateVariations } from '../../../services/query-analysis-service'

export async function queryAnalysisNode(state: TutorGraphState): Promise<TutorGraphState> {
  const analysis = await analyzeQueryAndGenerateVariations(state.query, state.studentProfile)

  return {
    ...state,
    analysis
  }
}

