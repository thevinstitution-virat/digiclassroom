/**
 * Content Analysis Engine for AI Tutor Responses
 * Automatically detects and classifies content types for appropriate formatting
 */

export interface ContentAnalysis {
  contentType: 'plain' | 'mathematical' | 'chemical' | 'mixed'
  confidence: number
  detectedElements: {
    hasEquations: boolean
    hasChemicalFormulas: boolean
    hasGreekSymbols: boolean
    hasCodeBlocks: boolean
    hasDiagrams: boolean
    hasProperNouns: boolean
    hasDefinitions: boolean
    hasQuotations: boolean
    hasDates: boolean
  }
  subjectHints: string[]
  classLevel?: string
}

export interface ContentSegment {
  type: 'text' | 'math' | 'chemistry' | 'code' | 'diagram'
  content: string
  startIndex: number
  endIndex: number
  confidence: number
}

export class ContentAnalyzer {
  // Mathematical content patterns
  private static readonly MATH_PATTERNS = [
    // Basic mathematical operations and symbols
    /[+\-×÷=≠<>≤≥±∞]/g,
    // Fractions and powers
    /\d+\/\d+|\d+\^\d+|\d+_\d+/g,
    // Greek letters (common in math/physics)
    /[αβγδεζηθικλμνξοπρστυφχψω]|alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega/gi,
    // Mathematical functions
    /\b(sin|cos|tan|log|ln|exp|sqrt|sum|integral|derivative|limit|lim|max|min)\b/gi,
    // Mathematical notation
    /∑|∫|∂|∇|∆|∏|√|∛|∜/g,
    // Equations and formulas
    /\b[a-zA-Z]\s*=\s*[^=]+/g,
    // Units and scientific notation
    /\d+\.?\d*\s*[×x]\s*10\^[+-]?\d+|\d+\.?\d*\s*(m|kg|s|A|K|mol|cd|Hz|N|Pa|J|W|C|V|F|Ω|S|Wb|T|H|lm|lx|Bq|Gy|Sv)\b/gi,
    // Geometric terms
    /\b(triangle|circle|square|rectangle|polygon|angle|radius|diameter|circumference|area|volume|perimeter)\b/gi
  ]

  // Chemical content patterns with context awareness
  private static readonly CHEMISTRY_PATTERNS = [
    // Explicit chemical formulas with subscripts/superscripts (high confidence)
    /\b[A-Z][a-z]?\d+(\([A-Z][a-z]?\d*\))?\d*\b/g,
    // Chemical equations with arrows (high confidence)
    /[A-Z][a-zA-Z0-9\s+()]*[→⇌⇄↔][A-Z][a-zA-Z0-9\s+()]*/g,
    // Ionic charges (high confidence)
    /[A-Z][a-z]?\d*[+-]\d*/g,
    // Chemical processes (medium confidence - only if in chemistry context)
    /\b(oxidation|reduction|combustion|synthesis|decomposition|precipitation|neutralization|electrolysis)\b/gi
  ]

  // Context-aware exclusions for different subjects
  private static readonly CONTEXTUAL_EXCLUSIONS = {
    biology: [
      'water', 'oxygen', 'carbon', 'nitrogen', 'hydrogen', 'air', 'soil', 'food',
      'sugar', 'salt', 'acid', 'protein', 'enzyme', 'vitamin', 'mineral', 'iron',
      'calcium', 'sodium', 'potassium', 'phosphorus', 'chlorine', 'sulfur',
      'magnesium', 'zinc', 'copper', 'blood', 'plasma', 'serum', 'urine', 'saliva',
      'starch', 'glucose', 'fructose', 'cellulose', 'oil', 'fat', 'lipid', 'wax',
      'resin', 'alcohol', 'methane', 'ammonia', 'steam'
    ],
    physics: [
      'mass', 'energy', 'force', 'power', 'current', 'voltage', 'resistance',
      'frequency', 'wavelength', 'heat', 'light', 'sound', 'pressure', 'density',
      'velocity', 'acceleration', 'momentum', 'torque', 'electric', 'magnetic',
      'nuclear', 'atomic', 'radiation', 'photon', 'electron', 'proton', 'neutron',
      'gas', 'liquid', 'solid', 'plasma', 'matter'
    ],
    mathematics: [
      'function', 'equation', 'variable', 'constant', 'coefficient', 'term',
      'expression', 'formula', 'sum', 'product', 'difference', 'quotient',
      'ratio', 'proportion', 'percentage', 'fraction', 'decimal', 'integer',
      'number', 'digit', 'graph', 'chart', 'table', 'matrix', 'vector'
    ],
    geography: [
      'water', 'air', 'soil', 'rock', 'mineral', 'coal', 'oil', 'gas', 'iron',
      'copper', 'gold', 'silver', 'salt', 'sand', 'clay', 'limestone', 'granite',
      'marble', 'diamond'
    ],
    general: [
      'time', 'space', 'place', 'area', 'volume', 'weight', 'height', 'width',
      'length', 'size', 'color', 'shape', 'form', 'type', 'kind', 'way', 'method',
      'process', 'system', 'part'
    ]
  }

  // Chemical context indicators
  private static readonly CHEMICAL_INDICATORS = [
    'molecular formula', 'chemical equation', 'compound', 'reaction', 'synthesis',
    'decomposition', 'catalyst', 'reagent', 'product', 'chemical bond', 'ionic',
    'covalent', 'organic chemistry', 'inorganic chemistry', 'chemical structure',
    'chemical properties', 'chemical composition'
  ]

  // Biological context indicators
  private static readonly BIOLOGICAL_INDICATORS = [
    'tissue', 'cell', 'organ', 'organism', 'living', 'plant', 'animal',
    'biological', 'life', 'growth', 'photosynthesis', 'respiration', 'digestion',
    'circulation', 'reproduction', 'evolution', 'ecosystem', 'habitat', 'species',
    'genetics', 'DNA', 'RNA', 'protein synthesis', 'metabolism'
  ]

  // Code content patterns
  private static readonly CODE_PATTERNS = [
    // Programming keywords
    /\b(function|class|if|else|for|while|return|import|export|const|let|var|def|print|console\.log)\b/g,
    // HTML/CSS
    /<[^>]+>|#[a-zA-Z0-9_-]+|\.[a-zA-Z0-9_-]+/g,
    // Code blocks
    /```[\s\S]*?```|`[^`]+`/g
  ]

  // Proper noun patterns (Indian context)
  private static readonly PROPER_NOUN_PATTERNS = [
    // Historical figures
    /\b(Mahatma Gandhi|Jawaharlal Nehru|Subhas Chandra Bose|Bhagat Singh|Chandragupta Maurya|Ashoka|Akbar|Shah Jahan|Shivaji|Rani Lakshmibai)\b/g,
    // Places
    /\b(India|Delhi|Mumbai|Kolkata|Chennai|Bangalore|Hyderabad|Pune|Ahmedabad|Rajasthan|Punjab|Gujarat|Maharashtra|Tamil Nadu|Kerala|Karnataka)\b/g,
    // Historical events
    /\b(Independence Day|Partition of India|Salt March|Quit India Movement|Sepoy Mutiny|Battle of Plassey|Mughal Empire|British Raj)\b/g,
    // Literary works
    /\b(Ramayana|Mahabharata|Bhagavad Gita|Panchatantra|Gitanjali|Discovery of India)\b/g,
    // Festivals and culture
    /\b(Diwali|Holi|Eid|Christmas|Dussehra|Navratri|Pongal|Onam|Durga Puja)\b/g
  ]

  // Definition patterns
  private static readonly DEFINITION_PATTERNS = [
    /\b(is defined as|means|refers to|is called|is known as|definition|terminology)\b/gi,
    /:\s*[A-Z][^.!?]*[.!?]/g // Colon followed by definition
  ]

  // Date patterns
  private static readonly DATE_PATTERNS = [
    /\b\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(st|nd|rd|th)?,?\s+\d{4}\b/gi,
    /\b\d{4}\s*(AD|BC|CE|BCE)\b/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g
  ]

  // Quotation patterns
  private static readonly QUOTATION_PATTERNS = [
    /"[^"]*"/g,
    /'[^']*'/g,
    /[""][^""]*[""]/g
  ]

  /**
   * Analyze content and determine its type and characteristics
   */
  static analyzeContent(content: string, classLevel?: string): ContentAnalysis {
    const analysis: ContentAnalysis = {
      contentType: 'plain',
      confidence: 0,
      detectedElements: {
        hasEquations: false,
        hasChemicalFormulas: false,
        hasGreekSymbols: false,
        hasCodeBlocks: false,
        hasDiagrams: false,
        hasProperNouns: false,
        hasDefinitions: false,
        hasQuotations: false,
        hasDates: false
      },
      subjectHints: [],
      classLevel
    }

    // Count matches for different content types
    let mathScore = 0
    let chemScore = 0
    let codeScore = 0

    // Analyze mathematical content
    this.MATH_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        mathScore += matches.length
        analysis.detectedElements.hasEquations = true
        if (pattern.source.includes('αβγδε') || pattern.source.includes('alpha|beta')) {
          analysis.detectedElements.hasGreekSymbols = true
        }
      }
    })

    // Analyze chemical content with context awareness
    const hasChemicalContext = this.hasChemicalContext(content, classLevel)
    const hasBiologicalContext = this.hasBiologicalContext(content)

    // Only apply chemical detection if there's chemical context or it's explicitly chemistry
    if (hasChemicalContext || classLevel?.toLowerCase().includes('chemistry')) {
      this.CHEMISTRY_PATTERNS.forEach(pattern => {
        const matches = content.match(pattern)
        if (matches) {
          // Filter out contextually inappropriate matches
          const validMatches = matches.filter(match =>
            this.isValidChemicalMatch(match, content, classLevel, hasBiologicalContext)
          )

          if (validMatches.length > 0) {
            chemScore += validMatches.length
            analysis.detectedElements.hasChemicalFormulas = true
          }
        }
      })
    }

    // Analyze code content
    this.CODE_PATTERNS.forEach(pattern => {
      const matches = content.match(pattern)
      if (matches) {
        codeScore += matches.length
        analysis.detectedElements.hasCodeBlocks = true
      }
    })

    // Analyze other elements
    analysis.detectedElements.hasProperNouns = this.PROPER_NOUN_PATTERNS.some(pattern => pattern.test(content))
    analysis.detectedElements.hasDefinitions = this.DEFINITION_PATTERNS.some(pattern => pattern.test(content))
    analysis.detectedElements.hasQuotations = this.QUOTATION_PATTERNS.some(pattern => pattern.test(content))
    analysis.detectedElements.hasDates = this.DATE_PATTERNS.some(pattern => pattern.test(content))

    // Determine content type based on scores
    const totalScore = mathScore + chemScore + codeScore
    if (totalScore === 0) {
      analysis.contentType = 'plain'
      analysis.confidence = 0.9
    } else if (mathScore > chemScore && mathScore > codeScore) {
      analysis.contentType = mathScore > 3 ? 'mathematical' : 'mixed'
      analysis.confidence = Math.min(0.9, mathScore / 10)
    } else if (chemScore > mathScore && chemScore > codeScore) {
      analysis.contentType = chemScore > 3 ? 'chemical' : 'mixed'
      analysis.confidence = Math.min(0.9, chemScore / 10)
    } else {
      analysis.contentType = 'mixed'
      analysis.confidence = 0.7
    }

    // Generate subject hints
    if (mathScore > 0) analysis.subjectHints.push('mathematics', 'physics')
    if (chemScore > 0) analysis.subjectHints.push('chemistry', 'science')
    if (codeScore > 0) analysis.subjectHints.push('computer science', 'programming')
    if (analysis.detectedElements.hasProperNouns) analysis.subjectHints.push('history', 'social studies', 'literature')

    return analysis
  }

  /**
   * Check if content has chemical context indicators
   */
  private static hasChemicalContext(content: string, classLevel?: string): boolean {
    if (classLevel?.toLowerCase().includes('chemistry'))
  return true

    const lowerContent = content.toLowerCase()
    return this.CHEMICAL_INDICATORS.some(indicator => lowerContent.includes(indicator))
  }

  /**
   * Check if content has biological context indicators
   */
  private static hasBiologicalContext(content: string): boolean {
    const lowerContent = content.toLowerCase()
    return this.BIOLOGICAL_INDICATORS.some(indicator => lowerContent.includes(indicator))
  }

  /**
   * Validate if a potential chemical match is appropriate in the given context
   */
  private static isValidChemicalMatch(
    match: string,
    fullContent: string,
    classLevel?: string,
    hasBiologicalContext: boolean = false
  ): boolean {
    const lowerMatch = match.toLowerCase()
    const subject = this.inferSubjectFromContent(fullContent, classLevel)

    // Check contextual exclusions
        // @ts-ignore
    const exclusions = this.CONTEXTUAL_EXCLUSIONS[subject] || []
    if (exclusions.includes(lowerMatch)) {
      return false
    }

    // If it's in biological context, be more restrictive
    if (hasBiologicalContext) {
      const biologicalExclusions = this.CONTEXTUAL_EXCLUSIONS.biology
      if (biologicalExclusions.includes(lowerMatch)) {
        return false
      }
    }

    // Check for false positive patterns
    if (this.detectFalsePositives(fullContent, match, subject)) {
      return false
    }

    // Calculate confidence and only accept high-confidence matches
    const confidence = this.calculateChemicalConfidence(match, fullContent, subject)
    return confidence > 0.7
  }

  /**
   * Infer subject from content and class level
   */
  private static inferSubjectFromContent(content: string, classLevel?: string): string {
    const lowerContent = content.toLowerCase()

    if (classLevel?.toLowerCase().includes('chemistry'))
  return 'chemistry'
    if (classLevel?.toLowerCase().includes('biology'))
  return 'biology'
    if (classLevel?.toLowerCase().includes('physics'))
  return 'physics'
    if (classLevel?.toLowerCase().includes('math'))
  return 'mathematics'

    // Infer from content
    const biologicalCount = this.BIOLOGICAL_INDICATORS.filter(ind => lowerContent.includes(ind)).length
    const chemicalCount = this.CHEMICAL_INDICATORS.filter(ind => lowerContent.includes(ind)).length

    if (biologicalCount > chemicalCount)
  return 'biology'
    if (chemicalCount > 0)
  return 'chemistry'

    return 'general'
  }

  /**
   * Detect false positive patterns
   */
  private static detectFalsePositives(content: string, candidate: string, subject: string): boolean {
    const falsePositivePatterns = {
      biology: [
        /plant tissue.*water/i,
        /animal tissue.*water/i,
        /cells contain.*water/i,
        /living organisms.*water/i,
        /human body.*water/i,
        /photosynthesis.*oxygen/i,
        /respiration.*oxygen/i,
        /breathing.*oxygen/i,
        /circulation.*oxygen/i,
        /blood.*oxygen/i,
        /food contains.*carbon/i,
        /organic matter.*carbon/i,
        /proteins contain.*nitrogen/i,
        /bones contain.*calcium/i,
        /muscles need.*energy/i
      ],
      physics: [
        /moving object.*mass/i,
        /electric circuit.*current/i,
        /light wave.*frequency/i,
        /sound wave.*frequency/i,
        /heating.*temperature/i,
        /cooling.*temperature/i,
        /flowing.*liquid/i,
        /solid.*melting/i,
        /gas.*expanding/i
      ]
    }

        // @ts-ignore
    const patterns = falsePositivePatterns[subject] || []
        // @ts-ignore
    return patterns.some(pattern => {
      const match = pattern.exec(content)
      if (!match)
  return false

      const matchStart = match.index
      const matchEnd = match.index + match[0].length
      const candidateIndex = content.toLowerCase().indexOf(candidate.toLowerCase())

      return candidateIndex >= matchStart && candidateIndex < matchEnd
    })
  }

  /**
   * Calculate confidence for chemical detection
   */
  private static calculateChemicalConfidence(candidate: string, fullContent: string, subject: string): number {
    let confidence = 0.5

    // Subject relevance
    if (subject === 'chemistry') confidence += 0.3
    else if (subject === 'biology') confidence -= 0.2
    else if (subject === 'physics') confidence -= 0.1

    // Chemical structure indicators
    if (/[A-Z][a-z]?\d+/.test(candidate)) confidence += 0.2
    if (/[A-Z]{2,}/.test(candidate)) confidence += 0.1
    if (/\d+/.test(candidate)) confidence += 0.1

    // Context clues
    const lowerContent = fullContent.toLowerCase()
    const chemicalContextCount = this.CHEMICAL_INDICATORS.filter(ctx => lowerContent.includes(ctx)).length
    const biologicalContextCount = this.BIOLOGICAL_INDICATORS.filter(ctx => lowerContent.includes(ctx)).length

    confidence += (chemicalContextCount * 0.1)
    confidence -= (biologicalContextCount * 0.1)

    // Common words penalty
    const commonWords = ['water', 'air', 'food', 'sugar', 'salt']
    if (commonWords.includes(candidate.toLowerCase())) confidence -= 0.4

    return Math.max(0, Math.min(1, confidence))
  }

  /**
   * Segment content into different types for targeted formatting
   */
  static segmentContent(content: string): ContentSegment[] {
    const segments: ContentSegment[] = []
    let currentIndex = 0

    // Find code blocks first (highest priority)
    const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g
    let match

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > currentIndex) {
        segments.push({
          type: 'text',
          content: content.substring(currentIndex, match.index),
          startIndex: currentIndex,
          endIndex: match.index,
          confidence: 0.9
        })
      }

      // Add code block
      segments.push({
        type: 'code',
        content: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        confidence: 0.95
      })

      currentIndex = match.index + match[0].length
    }

    // Add remaining text
    if (currentIndex < content.length) {
      const remainingContent = content.substring(currentIndex)
      const analysis = this.analyzeContent(remainingContent)
      
      segments.push({
        type: analysis.contentType === 'mathematical' ? 'math' : 
              analysis.contentType === 'chemical' ? 'chemistry' : 'text',
        content: remainingContent,
        startIndex: currentIndex,
        endIndex: content.length,
        confidence: analysis.confidence
      })
    }

    return segments
  }

  /**
   * Extract mathematical expressions for LaTeX formatting
   */
  static extractMathExpressions(content: string): Array<{expression: string, isInline: boolean, startIndex: number, endIndex: number}> {
    const expressions: Array<{expression: string, isInline: boolean, startIndex: number, endIndex: number}> = []
    
    // Look for potential mathematical expressions
    const mathIndicators = [
      /\b[a-zA-Z]\s*=\s*[^=\n]+/g, // Equations
      /\d+\/\d+/g, // Fractions
      /\d+\^\d+/g, // Powers
      /√\d+/g, // Square roots
      /∫[^∫]*d[a-zA-Z]/g, // Integrals
      /∑[^∑]*=/g, // Summations
    ]

    mathIndicators.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        expressions.push({
          expression: match[0],
          isInline: match[0].length < 20, // Simple heuristic
          startIndex: match.index,
          endIndex: match.index + match[0].length
        })
      }
    })

    return expressions.sort((a, b) => a.startIndex - b.startIndex)
  }

  /**
   * Extract chemical formulas and equations
   */
  static extractChemicalContent(content: string): Array<{formula: string, type: 'formula' | 'equation', startIndex: number, endIndex: number}> {
    const chemicals: Array<{formula: string, type: 'formula' | 'equation', startIndex: number, endIndex: number}> = []
    
    // Chemical formulas
    const formulaRegex = /\b[A-Z][a-z]?\d*(\([A-Z][a-z]?\d*\))?\d*\b/g
    let match
    
    while ((match = formulaRegex.exec(content)) !== null) {
      // Verify it's actually a chemical formula (not just a word)
      if (this.isChemicalFormula(match[0])) {
        chemicals.push({
          formula: match[0],
          type: 'formula',
          startIndex: match.index,
          endIndex: match.index + match[0].length
        })
      }
    }

    // Chemical equations (containing arrows)
    const equationRegex = /[A-Z][a-zA-Z0-9\s+()]*[→⇌⇄↔][A-Z][a-zA-Z0-9\s+()]*/g
    while ((match = equationRegex.exec(content)) !== null) {
      chemicals.push({
        formula: match[0],
        type: 'equation',
        startIndex: match.index,
        endIndex: match.index + match[0].length
      })
    }

    return chemicals.sort((a, b) => a.startIndex - b.startIndex)
  }

  /**
   * Helper method to verify if a string is likely a chemical formula
   */
  private static isChemicalFormula(text: string): boolean {
    // Common chemical elements
    const elements = ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Br', 'I']
    const firstTwoChars = text.substring(0, 2)
    const firstChar = text.substring(0, 1)

    // Must start with a valid element
    const hasValidElement = elements.includes(firstTwoChars) || elements.includes(firstChar)
    if (!hasValidElement)
  return false

    // Must have numbers (subscripts) or multiple capital letters to be a formula
    const hasNumbers = /\d/.test(text)
    const hasMultipleCaps = (text.match(/[A-Z]/g) || []).length > 1

    // Single element names without numbers are likely not formulas in most contexts
    if (!hasNumbers && !hasMultipleCaps && text.length <= 2) {
      return false
    }

    return true
  }
}
