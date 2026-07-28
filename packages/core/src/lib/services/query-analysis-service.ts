interface StudentProfileInput {
  board?: string
  classLevel?: string
  subject?: string
  medium?: string
}

interface QueryAnalysisResult {
  entities: string[]
  curriculumContext: {
    board?: string
    classLevel?: string
    subject?: string
  }
  intent: string
  multiQueries: string[]
}

const INTENT_KEYWORDS: Record<string, string[]> = {
  definition: ['define', 'what is', 'meaning', 'explain'],
  comparison: ['compare', 'difference', 'distinguish'],
  process: ['how', 'steps', 'process', 'describe'],
  application: ['why', 'purpose', 'use', 'application'],
  analysis: ['analyze', 'examine', 'evaluate', 'impact']
}

const STOP_WORDS = new Set([
  'what', 'where', 'when', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else',
  'of', 'in', 'on', 'at', 'to', 'for', 'from', 'by', 'with',
  'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'up', 'down', 'over', 'under',
  'again', 'further', 'once', 'here', 'there', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'don', 'should', 'now'
])

export async function analyzeQueryAndGenerateVariations(
  query: string,
  profile: StudentProfileInput
): Promise<QueryAnalysisResult> {
  const normalized = query.trim()
  const entities = extractEntities(normalized)
  const intent = detectIntent(normalized)

  const multiQueries = buildQueryVariations(normalized, entities, intent, profile)

  return {
    entities,
    curriculumContext: {
      board: profile.board,
      classLevel: profile.classLevel,
      subject: profile.subject
    },
    intent,
    multiQueries
  }
}

function extractEntities(query: string): string[] {
  const candidates = query
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))

  const unique = Array.from(new Set(candidates))
  return unique.slice(0, 6)
}

function detectIntent(query: string): string {
  const lower = query.toLowerCase()
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return intent
    }
  }
  return 'informational'
}

function buildQueryVariations(
  original: string,
  entities: string[],
  intent: string,
  profile: StudentProfileInput
): string[] {
  const variations = new Set<string>()
  variations.add(original)

  const subjectPrefix = profile.subject ? `${profile.subject} ` : ''

  entities.slice(0, 3).forEach((entity) => {
    const capitalized = entity.replace(/^\w/, (c) => c.toUpperCase())
    variations.add(`${subjectPrefix}${capitalized}`)
    variations.add(`${subjectPrefix}${capitalized} NCERT explanation`)
    variations.add(`NCERT ${subjectPrefix}${capitalized} summary`)
  })

  if (intent === 'process') {
    variations.add(`Steps of ${entities.join(' ')} in NCERT`)
  } else if (intent === 'comparison' && entities.length >= 2) {
    variations.add(`Difference between ${entities.slice(0, 2).join(' and ')} in NCERT`)
  } else if (intent === 'definition') {
    variations.add(`Definition of ${entities.join(' ')} NCERT`)
  }

  return Array.from(variations).filter(Boolean).slice(0, 6)
}

