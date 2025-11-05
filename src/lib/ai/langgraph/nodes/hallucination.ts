import type { TutorGraphState } from '../state'

export function hallucinationDetectionNode(state: TutorGraphState): TutorGraphState {
  const contexts = (state.metadata?.promptContexts as Array<{ text: string }> | undefined) ?? []
  const generation = state.generation
  const draft = state.draftAnswer ?? generation?.directAnswer ?? ''

  if (!generation || !draft) {
    return {
      ...state,
      hallucinationReport: {
        supported: false,
        unsupportedClaims: ['No generation available']
      }
    }
  }

  const unsupported: string[] = []

  // Only validate the main answer, not key terms (which are educational definitions)
  const segments = [
    generation.directAnswer,
    ...generation.explanationSteps
  ]

  segments.forEach((segment) => {
    if (!segment || !segment.trim()) {
      return
    }
    const citations = extractCitationNumbers(segment)

    // If no citations, check if content is supported by ANY context
    if (citations.length === 0) {
      // Check if segment is supported by any of the contexts
      const supportedByAnyContext = contexts.some((context) =>
        segmentSupportedByContext(segment, context.text)
      )

      if (!supportedByAnyContext) {
        unsupported.push(segment)
      }
      return
    }

    // If citations exist, verify they're valid
    const supported = citations.every((citation) => {
      const context = contexts[citation - 1]
      if (!context) return false
      return segmentSupportedByContext(segment, context.text)
    })

    if (!supported) {
      unsupported.push(segment)
    }
  })

  const isSupported = unsupported.length === 0

  console.log('🔍 Hallucination Detection:', {
    totalSegments: segments.filter(s => s && s.trim()).length,
    unsupportedCount: unsupported.length,
    supported: isSupported
  })

  if (!isSupported) {
    console.log('⚠️ Unsupported segments:', unsupported.slice(0, 2).map(s => s.substring(0, 100)))
  }

  return {
    ...state,
    hallucinationReport: {
      supported: isSupported,
      unsupportedClaims: unsupported
    }
  }
}

function extractCitationNumbers(text: string): number[] {
  const matches = text.match(/\[(\d+)\]/g) || []
  return matches
    .map((match) => {
      const value = parseInt(match.replace(/\D/g, ''), 10)
      return Number.isNaN(value) ? undefined : value
    })
    .filter((value): value is number => typeof value === 'number')
}

function segmentSupportedByContext(segment: string, context: string): boolean {
  const keywords = segment
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, '')
    .split(/\W+/)
    .filter((token) => token.length > 4)
    .slice(0, 8) // Increased from 6 to 8 for better coverage

  if (keywords.length === 0) return true
  const contextLower = context.toLowerCase()
  const matches = keywords.filter((keyword) => contextLower.includes(keyword))

  // More lenient threshold: require only 25% match instead of 33%
  // This reduces false positives while still catching actual hallucinations
  const requiredMatches = Math.max(1, Math.ceil(keywords.length / 4))
  return matches.length >= requiredMatches
}

