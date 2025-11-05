import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

// CBSE Class-specific curriculum mapping
export const CBSE_CURRICULUM_MAP = {
  '9': {
    Geography: {
      textbook: 'Contemporary India I',
      chapters: [
        'India - Size and Location',
        'Physical Features of India', 
        'Drainage',
        'Climate',
        'Natural Vegetation and Wildlife',
        'Population'
      ],
      qdrantNamespace: 'cbse-class9-geography'
    },
    History: {
      textbook: 'India and the Contemporary World I',
      chapters: [
        'The French Revolution',
        'Socialism in Europe and the Russian Revolution',
        'Nazism and the Rise of Hitler',
        'Forest Society and Colonialism',
        'Pastoralists in the Modern World'
      ],
      qdrantNamespace: 'cbse-class9-history'
    },
    'Political Science': {
      textbook: 'Democratic Politics I',
      chapters: [
        'What is Democracy?',
        'Constitutional Design',
        'Electoral Politics',
        'Working of Institutions',
        'Democratic Rights'
      ],
      qdrantNamespace: 'cbse-class9-polsci'
    },
    Economics: {
      textbook: 'Economics',
      chapters: [
        'The Story of Village Palampur',
        'People as Resource',
        'Poverty as a Challenge',
        'Food Security in India'
      ],
      qdrantNamespace: 'cbse-class9-economics'
    }
  },
  '10': {
    Geography: {
      textbook: 'Contemporary India II',
      chapters: [
        'Resources and Development',
        'Forest and Wildlife Resources',
        'Water Resources',
        'Agriculture',
        'Minerals and Energy Resources',
        'Manufacturing Industries',
        'Lifelines of National Economy'
      ],
      qdrantNamespace: 'cbse-class10-geography'
    },
    History: {
      textbook: 'India and the Contemporary World II',
      chapters: [
        'The Rise of Nationalism in Europe',
        'Nationalism in India',
        'The Making of a Global World',
        'The Age of Industrialisation',
        'Print Culture and the Modern World'
      ],
      qdrantNamespace: 'cbse-class10-history'
    },
    'Political Science': {
      textbook: 'Democratic Politics II',
      chapters: [
        'Power Sharing',
        'Federalism',
        'Democracy and Diversity',
        'Gender, Religion and Caste',
        'Popular Struggles and Movements',
        'Political Parties',
        'Outcomes of Democracy',
        'Challenges to Democracy'
      ],
      qdrantNamespace: 'cbse-class10-polsci'
    },
    Economics: {
      textbook: 'Understanding Economic Development',
      chapters: [
        'Development',
        'Sectors of the Indian Economy',
        'Money and Credit',
        'Globalisation and the Indian Economy',
        'Consumer Rights'
      ],
      qdrantNamespace: 'cbse-class10-economics'
    }
  },
  '11': {
    Geography: {
      textbook: 'Fundamentals of Physical Geography',
      chapters: [
        'Geography as a Discipline',
        'The Origin and Evolution of the Earth',
        'Interior of the Earth',
        'Distribution of Oceans and Continents',
        'Minerals and Rocks',
        'Geomorphic Processes',
        'Landforms and their Evolution',
        'Composition and Structure of Atmosphere',
        'Solar Radiation, Heat Balance and Temperature',
        'Atmospheric Circulation and Weather Systems',
        'Water in the Atmosphere',
        'World Climate and Climate Change',
        'Water (Oceans)',
        'Movements of Ocean Water',
        'Life on the Earth',
        'Biodiversity and Conservation'
      ],
      qdrantNamespace: 'cbse-class11-geography'
    },
    History: {
      textbook: 'Themes in World History',
      chapters: [
        'From the Beginning of Time',
        'Writing and City Life',
        'An Empire Across Three Continents',
        'The Central Islamic Lands',
        'Nomadic Empires',
        'The Three Orders',
        'Changing Cultural Traditions',
        'Confrontation of Cultures',
        'Paths to Modernisation',
        'Displacing Indigenous Peoples',
        'Industrial Revolution'
      ],
      qdrantNamespace: 'cbse-class11-history'
    },
    'Political Science': {
      textbook: 'Political Theory',
      chapters: [
        'Political Theory: An Introduction',
        'Freedom',
        'Equality',
        'Social Justice',
        'Rights',
        'Citizenship',
        'Nationalism',
        'Secularism',
        'Peace',
        'Development'
      ],
      qdrantNamespace: 'cbse-class11-polsci'
    },
    Economics: {
      textbook: 'Indian Economic Development',
      chapters: [
        'Development Policies and Experience (1947-90)',
        'Economic Reforms since 1991',
        'Current challenges facing the Indian Economy',
        'Development Experience of India'
      ],
      qdrantNamespace: 'cbse-class11-economics'
    }
  },
  '12': {
    Geography: {
      textbook: 'Fundamentals of Human Geography',
      chapters: [
        'Human Geography: Nature and Scope',
        'The World Population: Distribution, Density and Growth',
        'Population Composition',
        'Human Development',
        'Primary Activities',
        'Secondary Activities',
        'Tertiary and Quaternary Activities',
        'Transport and Communication',
        'International Trade',
        'Human Settlements'
      ],
      qdrantNamespace: 'cbse-class12-geography'
    },
    History: {
      textbook: 'Themes in Indian History',
      chapters: [
        'Bricks, Beads and Bones',
        'Kings, Farmers and Towns',
        'Kinship, Caste and Class',
        'Thinkers, Beliefs and Buildings',
        'Through the Eyes of Travellers',
        'Bhakti-Sufi Traditions',
        'An Imperial Capital: Vijayanagara',
        'Peasants, Zamindars and the State',
        'Kings and Chronicles',
        'Colonialism and the Countryside',
        'Rebels and the Raj',
        'Colonial Cities',
        'Mahatma Gandhi and the Nationalist Movement',
        'Understanding Partition',
        'Framing the Constitution'
      ],
      qdrantNamespace: 'cbse-class12-history'
    },
    'Political Science': {
      textbook: 'Contemporary World Politics',
      chapters: [
        'The Cold War Era',
        'The End of Bipolarity',
        'US Hegemony in World Politics',
        'Alternative Centres of Power',
        'Contemporary South Asia',
        'International Organisations',
        'Security in the Contemporary World',
        'Environment and Natural Resources',
        'Globalisation'
      ],
      qdrantNamespace: 'cbse-class12-polsci'
    },
    Economics: {
      textbook: 'Introductory Microeconomics',
      chapters: [
        'Introduction to Economics',
        'Theory of Consumer Behaviour',
        'Production and Costs',
        'The Theory of the Firm under Perfect Competition',
        'Market Equilibrium',
        'Non-competitive Markets'
      ],
      qdrantNamespace: 'cbse-class12-economics'
    }
  }
} as const

export type CBSEClass = keyof typeof CBSE_CURRICULUM_MAP
export type CBSESubject = 'Geography' | 'History' | 'Political Science' | 'Economics'

// Get user's class and subject context
export async function getUserClassContext(userId: string): Promise<{
  classId: string
  gradeLevel: string
  subjects: CBSESubject[]
  qdrantNamespaces: string[]
} | null> {
  try {
    const userClass = await executeQuerySingle<{
      class_id: string
      grade_level: number
      subjects: string
      qdrant_namespace: string
    }>(`
      SELECT
        c.id as class_id,
        c.grade_level,
        c.subjects,
        c.qdrant_namespace
      FROM users u
      JOIN classes c ON u.class_id = c.id
      WHERE u.id = ? AND u.class_id IS NOT NULL
    `, [userId])

    if (!userClass) return null

    const subjects = userClass.subjects ? JSON.parse(userClass.subjects) : []
    const gradeLevel = userClass.grade_level.toString() as CBSEClass

    // Get all qdrant namespaces for this class and subjects
    const qdrantNamespaces = subjects.map((subject: CBSESubject) => {
      const curriculumData = CBSE_CURRICULUM_MAP[gradeLevel]?.[subject]
      return curriculumData?.qdrantNamespace
    }).filter(Boolean)

    return {
      classId: userClass.class_id,
      gradeLevel,
      subjects,
      qdrantNamespaces
    }
  } catch (error) {
    console.error('Error getting user class context:', error)
    return null
  }
}

// Validate if a question is within the curriculum scope
export function validateCurriculumScope(
  query: string,
  gradeLevel: CBSEClass,
  subject: CBSESubject
): {
  isValid: boolean
  confidence: number
  suggestedChapters: string[]
  textbookReference: string
} {
  const curriculumData = CBSE_CURRICULUM_MAP[gradeLevel]?.[subject]
  
  if (!curriculumData) {
    return {
      isValid: false,
      confidence: 0,
      suggestedChapters: [],
      textbookReference: ''
    }
  }

  const queryLower = query.toLowerCase()
  const chapters = curriculumData.chapters
  
  // Check if query matches any chapter topics
  let matchingChapters: string[] = []
  let confidence = 0

  chapters.forEach(chapter => {
    const chapterWords = chapter.toLowerCase().split(' ')
    const matches = chapterWords.filter(word => 
      word.length > 3 && queryLower.includes(word)
    ).length

    if (matches > 0) {
      matchingChapters.push(chapter)
      confidence += matches * 0.1
    }
  })

  // Additional keyword matching for subject-specific terms
  const subjectKeywords = getSubjectKeywords(subject)
  const keywordMatches = subjectKeywords.filter(keyword =>
    queryLower.includes(keyword.toLowerCase())
  ).length

  confidence += keywordMatches * 0.15
  confidence = Math.min(confidence, 1.0)

  return {
    isValid: confidence > 0.2, // Threshold for curriculum relevance
    confidence,
    suggestedChapters: matchingChapters.slice(0, 3),
    textbookReference: curriculumData.textbook
  }
}

// Get subject-specific keywords for better matching
function getSubjectKeywords(subject: CBSESubject): string[] {
  const keywords = {
    'Geography': [
      'climate', 'resources', 'agriculture', 'industries', 'population',
      'physical features', 'drainage', 'vegetation', 'wildlife', 'minerals',
      'energy', 'manufacturing', 'transport', 'communication', 'trade'
    ],
    'History': [
      'nationalism', 'freedom struggle', 'partition', 'colonialism',
      'revolution', 'independence', 'british rule', 'gandhi', 'nehru',
      'movement', 'struggle', 'empire', 'civilization', 'culture'
    ],
    'Political Science': [
      'democracy', 'constitution', 'federalism', 'rights', 'citizenship',
      'government', 'politics', 'power', 'authority', 'elections',
      'political parties', 'parliament', 'judiciary', 'executive'
    ],
    'Economics': [
      'development', 'sectors', 'globalization', 'poverty', 'employment',
      'agriculture', 'industry', 'services', 'money', 'credit', 'banking',
      'trade', 'market', 'economy', 'growth', 'planning'
    ]
  }

  return keywords[subject] || []
}

// Get the appropriate Qdrant namespace for a query
export async function getQdrantNamespaceForQuery(
  userId: string,
  subject: CBSESubject,
  gradeLevel?: string
): Promise<string | null> {
  try {
    // First try to get from user's class context
    const userContext = await getUserClassContext(userId)

    if (userContext && userContext.subjects.includes(subject)) {
      const grade = gradeLevel || userContext.gradeLevel
      const curriculumData = CBSE_CURRICULUM_MAP[grade as CBSEClass]?.[subject]
      return curriculumData?.qdrantNamespace || null
    }

    // Fallback: use provided grade level
    if (gradeLevel) {
      const curriculumData = CBSE_CURRICULUM_MAP[gradeLevel as CBSEClass]?.[subject]
      return curriculumData?.qdrantNamespace || null
    }

    return null
  } catch (error) {
    console.error('Error getting Qdrant namespace:', error)
    return null
  }
}

// Enhanced content filtering for class-specific responses
export function buildClassSpecificFilter(
  userContext: Awaited<ReturnType<typeof getUserClassContext>>,
  subject?: CBSESubject,
  additionalFilters?: Record<string, any>
): Record<string, any> {
  const filter: Record<string, any> = {
    ...additionalFilters
  }

  if (userContext) {
    // Filter by grade level
    filter.grade = userContext.gradeLevel

    // Filter by subject if specified
    if (subject && userContext.subjects.includes(subject)) {
      filter.subject = subject

      // Use specific namespace for this class and subject
      const curriculumData = CBSE_CURRICULUM_MAP[userContext.gradeLevel as CBSEClass]?.[subject]
      if (curriculumData) {
        filter.namespace = curriculumData.qdrantNamespace
        filter.textbook = curriculumData.textbook
      }
    } else {
      // Filter by user's enrolled subjects only
      filter.subject = { $in: userContext.subjects }
    }

    // Ensure content is from curriculum textbooks only
    filter.contentType = { $in: ['textbook', 'chapter', 'lesson'] }
    filter.curriculum = 'CBSE'
  }

  return filter
}
