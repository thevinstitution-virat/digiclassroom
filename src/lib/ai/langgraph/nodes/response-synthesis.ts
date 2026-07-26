import type { TutorGraphState } from '../state'
import { UnifiedFormatter } from '../../formatting/unified-formatter'

export function responseSynthesisNode(state: TutorGraphState): TutorGraphState {
  const generation = state.generation
  if (!generation) {
    console.log('⚠️ Response Synthesis: No generation found')
    return {
      ...state,
      draftAnswer: undefined,
      finalAnswer: undefined
    }
  }

  console.log('📝 Response Synthesis: Processing answer...')
  console.log('📏 Direct answer length:', generation.directAnswer?.length || 0)
  console.log('🔑 Key terms count:', generation.keyTerms?.length || 0)

  // Detect content type from question
        // @ts-ignore
  const question = state.question || ''
  let contentType: 'plain' | 'mathematical' | 'chemical' = 'plain'
  if (/calculat|solve|equation|formula/i.test(question)) {
    contentType = 'mathematical'
  } else if (/chemical|reaction|compound|element|H2O|CO2/i.test(question)) {
    contentType = 'chemical'
  }

  // Detect question type
  const commandWord = generation.questionAnalysis?.commandWord || 'other'
  const questionType = ['define', 'explain', 'compare', 'calculate', 'list'].includes(commandWord)
    ? commandWord as any
    : 'other'

  // Use unified formatter - single formatting pass
  const result = UnifiedFormatter.format({
    contentType,
    questionType,
    rawAnswer: generation.directAnswer.trim(),
    keyTerms: generation.keyTerms
  })

  if (result.warnings.length > 0) {
    console.warn('⚠️ Formatting warnings:', result.warnings)
  }

  console.log('📊 Detected structure:', result.structure)
  console.log('📝 Formatted answer (first 500 chars):', result.formattedAnswer.substring(0, 500))

  const assembled = result.formattedAnswer

  console.log('✅ Response Synthesis: Final answer length:', assembled.length)
  console.log('📄 Response Synthesis: First 200 chars:', assembled.substring(0, 200))

  return {
    ...state,
    draftAnswer: assembled,
    finalAnswer: assembled
  }
}

