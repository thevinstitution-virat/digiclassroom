/**
 * CBSE/ICSE Command Word Detection Service
 * Detects question command words and classifies question types for intelligent answer structuring
 */

export type CommandWordType = 
  | 'define' 
  | 'state' 
  | 'mention'
  | 'explain' 
  | 'describe' 
  | 'differentiate' 
  | 'distinguish'
  | 'compare'
  | 'calculate' 
  | 'deduce' 
  | 'solve'
  | 'analyze' 
  | 'discuss' 
  | 'evaluate' 
  | 'justify'
  | 'comment'
  | 'case_based'
  | 'assertion_reason'
  | 'general'

export type QuestionCategory = 
  | 'remembering'      // 1 mark - define, state, mention
  | 'understanding'    // 2 marks - explain, differentiate, illustrate
  | 'application'      // 3 marks - apply, calculate, deduce, solve
  | 'higher_order'     // 4-5 marks - analyze, discuss, evaluate, justify
  | 'competency_based' // 4 marks - case-based, assertion-reason
  | 'general'          // Unknown type

export interface QuestionAnalysis {
  commandWord: CommandWordType
  category: QuestionCategory
  estimatedMarks: number
  wordCount?: number // If specified in question
  requiresTable: boolean
  requiresNumberedPoints: boolean
  requiresDiagram: boolean
  requiresExample: boolean
  requiresSteps: boolean
  answerStructure: AnswerStructure
}

export interface AnswerStructure {
  introduction: boolean
  body: {
    format: 'numbered_points' | 'table' | 'steps' | 'paragraphs'
    minPoints: number
    maxPoints: number
  }
  conclusion: boolean
  exampleRequired: boolean
  diagramSuggested: boolean
}

export class CommandWordDetector {
  
  private commandWordPatterns: Map<CommandWordType, string[]> = new Map([
    ['define', ['define', 'what is', 'what are', 'meaning of', 'definition of']],
    ['state', ['state', 'list', 'name', 'identify', 'mention']],
    ['mention', ['mention', 'give', 'write']],
    ['explain', ['explain', 'why', 'how', 'describe the process', 'elaborate']],
    ['describe', ['describe', 'outline', 'give an account']],
    ['differentiate', ['differentiate', 'distinguish', 'difference between']],
    ['distinguish', ['distinguish between', 'contrast']],
    ['compare', ['compare', 'compare and contrast', 'similarities and differences']],
    ['calculate', ['calculate', 'compute', 'find the value']],
    ['deduce', ['deduce', 'derive', 'prove']],
    ['solve', ['solve', 'find', 'determine']],
    ['analyze', ['analyze', 'analyse', 'examine', 'investigate']],
    ['discuss', ['discuss', 'elaborate', 'comment on']],
    ['evaluate', ['evaluate', 'assess', 'critically examine']],
    ['justify', ['justify', 'give reasons', 'why should']],
    ['comment', ['comment', 'remark', 'give your opinion']],
    ['case_based', ['case study', 'based on the passage', 'read the following']],
    ['assertion_reason', ['assertion', 'reason', 'both a and r']]
  ])

  /**
   * Analyze a question to detect command words and determine answer structure
   */
  analyzeQuestion(question: string): QuestionAnalysis {
    const normalizedQuestion = question.toLowerCase().trim()
    
    // Detect command word
    const commandWord = this.detectCommandWord(normalizedQuestion)
    
    // Determine category and marks
    const category = this.categorizeQuestion(commandWord)
    const estimatedMarks = this.estimateMarks(category, normalizedQuestion)
    
    // Extract word count if specified
    const wordCount = this.extractWordCount(normalizedQuestion)
    
    // Determine answer requirements
    const answerStructure = this.determineAnswerStructure(commandWord, category, estimatedMarks, wordCount)
    
    return {
      commandWord,
      category,
      estimatedMarks,
      wordCount,
      requiresTable: this.requiresTable(commandWord),
      requiresNumberedPoints: this.requiresNumberedPoints(category, estimatedMarks),
      requiresDiagram: this.requiresDiagram(normalizedQuestion),
      requiresExample: this.requiresExample(category),
      requiresSteps: this.requiresSteps(commandWord),
      answerStructure
    }
  }

  /**
   * Detect the primary command word in the question
   * Priority: Explicit command words (explain, describe, etc.) > Implicit (what is)
   */
  private detectCommandWord(question: string): CommandWordType {
    // First pass: Check for explicit command words (higher priority)
    const explicitCommands: CommandWordType[] = [
      'explain', 'describe', 'analyze', 'discuss', 'evaluate', 'justify',
      'differentiate', 'distinguish', 'compare', 'calculate', 'solve', 'deduce'
    ]

    for (const commandWord of explicitCommands) {
      const patterns = this.commandWordPatterns.get(commandWord) || []
      for (const pattern of patterns) {
        if (question.includes(pattern)) {
          return commandWord
        }
      }
    }

    // Second pass: Check for implicit command words (lower priority)
    const implicitCommands: CommandWordType[] = [
      'define', 'state', 'mention', 'comment', 'case_based', 'assertion_reason'
    ]

    for (const commandWord of implicitCommands) {
      const patterns = this.commandWordPatterns.get(commandWord) || []
      for (const pattern of patterns) {
        if (question.includes(pattern)) {
          return commandWord
        }
      }
    }

    return 'general'
  }

  /**
   * Categorize question based on command word
   */
  private categorizeQuestion(commandWord: CommandWordType): QuestionCategory {
    const categoryMap: Record<CommandWordType, QuestionCategory> = {
      'define': 'remembering',
      'state': 'remembering',
      'mention': 'remembering',
      'explain': 'understanding',
      'describe': 'understanding',
      'differentiate': 'understanding',
      'distinguish': 'understanding',
      'compare': 'understanding',
      'calculate': 'application',
      'deduce': 'application',
      'solve': 'application',
      'analyze': 'higher_order',
      'discuss': 'higher_order',
      'evaluate': 'higher_order',
      'justify': 'higher_order',
      'comment': 'higher_order',
      'case_based': 'competency_based',
      'assertion_reason': 'competency_based',
      'general': 'general'
    }
    
    return categoryMap[commandWord] || 'general'
  }

  /**
   * Estimate marks based on category and question complexity
   */
  private estimateMarks(category: QuestionCategory, question: string): number {
    // Check if marks are explicitly mentioned
    const marksMatch = question.match(/(\d+)\s*marks?/)
    if (marksMatch) {
      return parseInt(marksMatch[1])
    }

    // Default marks by category
    const defaultMarks: Record<QuestionCategory, number> = {
      'remembering': 1,
      'understanding': 2,
      'application': 3,
      'higher_order': 5,
      'competency_based': 4,
      'general': 3
    }
    
    return defaultMarks[category]
  }

  /**
   * Extract word count requirement from question
   */
  private extractWordCount(question: string): number | undefined {
    const wordCountMatch = question.match(/(\d+)\s*words?/)
    if (wordCountMatch) {
      return parseInt(wordCountMatch[1])
    }
    return undefined
  }

  /**
   * Determine if answer should use a table format
   */
  private requiresTable(commandWord: CommandWordType): boolean {
    return ['differentiate', 'distinguish', 'compare'].includes(commandWord)
  }

  /**
   * Determine if answer should use numbered points
   */
  private requiresNumberedPoints(category: QuestionCategory, marks: number): boolean {
    return marks >= 2 || category === 'higher_order'
  }

  /**
   * Determine if answer should include a diagram
   */
  private requiresDiagram(question: string): boolean {
    const diagramKeywords = ['diagram', 'draw', 'illustrate', 'sketch', 'label']
    return diagramKeywords.some(keyword => question.includes(keyword))
  }

  /**
   * Determine if answer should include examples
   */
  private requiresExample(category: QuestionCategory): boolean {
    return ['understanding', 'application', 'higher_order'].includes(category)
  }

  /**
   * Determine if answer should show steps
   */
  private requiresSteps(commandWord: CommandWordType): boolean {
    return ['calculate', 'solve', 'deduce', 'explain'].includes(commandWord)
  }

  /**
   * Determine the complete answer structure
   */
  private determineAnswerStructure(
    commandWord: CommandWordType, 
    category: QuestionCategory, 
    marks: number,
    wordCount?: number
  ): AnswerStructure {
    
    // For 1-mark questions (define, state)
    if (marks === 1) {
      return {
        introduction: false,
        body: {
          format: 'paragraphs',
          minPoints: 1,
          maxPoints: 2
        },
        conclusion: false,
        exampleRequired: false,
        diagramSuggested: false
      }
    }

    // For differentiate/compare questions
    if (['differentiate', 'distinguish', 'compare'].includes(commandWord)) {
      return {
        introduction: false,
        body: {
          format: 'table',
          minPoints: marks,
          maxPoints: marks + 1
        },
        conclusion: false,
        exampleRequired: false,
        diagramSuggested: false
      }
    }

    // For calculation questions
    if (['calculate', 'solve', 'deduce'].includes(commandWord)) {
      return {
        introduction: false,
        body: {
          format: 'steps',
          minPoints: 3,
          maxPoints: 5
        },
        conclusion: true,
        exampleRequired: false,
        diagramSuggested: false
      }
    }

    // For higher-order questions (4-5 marks)
    if (marks >= 4) {
      return {
        introduction: true,
        body: {
          format: 'numbered_points',
          minPoints: 4,
          maxPoints: 6
        },
        conclusion: true,
        exampleRequired: true,
        diagramSuggested: true
      }
    }

    // For 2-3 mark questions (explain, describe)
    return {
      introduction: false,
      body: {
        format: 'numbered_points',
        minPoints: marks,
        maxPoints: marks + 1
      },
      conclusion: false,
      exampleRequired: true,
      diagramSuggested: false
    }
  }

  /**
   * Generate answer guidelines based on analysis
   */
  generateAnswerGuidelines(analysis: QuestionAnalysis): string {
    const guidelines: string[] = []
    
    // Add command word instruction
    guidelines.push(`Command Word: ${analysis.commandWord.toUpperCase()}`)
    guidelines.push(`Category: ${analysis.category} (${analysis.estimatedMarks} marks)`)
    
    // Add structure guidelines
    if (analysis.answerStructure.introduction) {
      guidelines.push('- Start with a brief introduction/definition (1 mark)')
    }
    
    if (analysis.requiresTable) {
      guidelines.push(`- Present answer in a two-column comparison table with ${analysis.answerStructure.body.minPoints}-${analysis.answerStructure.body.maxPoints} points`)
    } else if (analysis.requiresNumberedPoints) {
      guidelines.push(`- Structure answer in ${analysis.answerStructure.body.minPoints}-${analysis.answerStructure.body.maxPoints} numbered points`)
    } else if (analysis.requiresSteps) {
      guidelines.push('- Show step-by-step working with formulas and calculations')
    }
    
    if (analysis.requiresExample) {
      guidelines.push('- Include at least one relevant example')
    }
    
    if (analysis.answerStructure.conclusion) {
      guidelines.push('- End with a concluding statement')
    }
    
    if (analysis.wordCount) {
      guidelines.push(`- Target word count: approximately ${analysis.wordCount} words`)
    }
    
    return guidelines.join('\n')
  }
}

// Export singleton instance
export const commandWordDetector = new CommandWordDetector()

