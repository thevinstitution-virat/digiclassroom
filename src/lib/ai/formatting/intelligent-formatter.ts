/**
 * Intelligent Content Formatting Engine for AI Tutor Responses
 * Coordinates all formatting engines and applies appropriate formatting based on content analysis
 */

import { ContentAnalyzer, ContentAnalysis, ContentSegment } from './content-analyzer'
import { PlainTextFormatter, FormattedContent } from './plain-text-formatter'
import { MathFormatter, FormattedMathContent } from './math-formatter'
import { ChemistryFormatter, FormattedChemicalContent } from './chemistry-formatter'

export interface IntelligentFormattingResult {
  originalContent: string
  formattedContent: string
  contentAnalysis: ContentAnalysis
  appliedFormatters: string[]
  formattingMetadata: {
    requiresMathjax: boolean
    requiresChemicalRendering: boolean
    hasCodeBlocks: boolean
    hasDiagrams: boolean
    accessibilityScore: number
  }
  performanceMetrics: {
    analysisTime: number
    formattingTime: number
    totalTime: number
  }
  qualityAssurance: {
    errors: string[]
    warnings: string[]
    suggestions: string[]
  }
}

export interface FormattingOptions {
  classLevel?: string
  subject?: string
  userRole?: 'student' | 'teacher' | 'parent' | 'admin'
  enableAdvancedFormatting?: boolean
  enableAccessibilityFeatures?: boolean
  enableDiagramGeneration?: boolean
  maxFormattingComplexity?: 'basic' | 'intermediate' | 'advanced'
}

export class IntelligentFormatter {
  /**
   * Main formatting method that analyzes content and applies appropriate formatting
   */
  static async formatContent(
    content: string, 
    options: FormattingOptions = {}
  ): Promise<IntelligentFormattingResult> {
    const startTime = Date.now()
    
    // Initialize result object
    const result: IntelligentFormattingResult = {
      originalContent: content,
      formattedContent: content,
      contentAnalysis: {} as ContentAnalysis,
      appliedFormatters: [],
      formattingMetadata: {
        requiresMathjax: false,
        requiresChemicalRendering: false,
        hasCodeBlocks: false,
        hasDiagrams: false,
        accessibilityScore: 0
      },
      performanceMetrics: {
        analysisTime: 0,
        formattingTime: 0,
        totalTime: 0
      },
      qualityAssurance: {
        errors: [],
        warnings: [],
        suggestions: []
      }
    }

    try {
      // Phase 1: Content Analysis with error handling
      const analysisStartTime = Date.now()
      try {
        result.contentAnalysis = ContentAnalyzer.analyzeContent(content, options.classLevel)
      } catch (analysisError) {
        console.warn('Content analysis failed, using plain text fallback:', analysisError)
        // Fallback to plain content analysis
        result.contentAnalysis = {
          contentType: 'plain',
          confidence: 0.5,
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
          classLevel: options.classLevel
        }
        result.qualityAssurance.warnings.push('Content analysis failed, using plain text formatting')
      }
      result.performanceMetrics.analysisTime = Date.now() - analysisStartTime

      // Phase 2: Apply Appropriate Formatting with error handling
      const formattingStartTime = Date.now()

      try {
        switch (result.contentAnalysis.contentType) {
          case 'mathematical':
            result.formattedContent = await this.applyMathematicalFormatting(content, options, result)
            result.appliedFormatters.push('Mathematical Formatter')
            break

          case 'chemical':
            result.formattedContent = await this.applyChemicalFormatting(content, options, result)
            result.appliedFormatters.push('Chemical Formatter')
            break

          case 'mixed':
            result.formattedContent = await this.applyMixedFormatting(content, options, result)
            result.appliedFormatters.push('Mixed Content Formatter')
            break

          default:
            result.formattedContent = await this.applyPlainTextFormatting(content, options, result)
            result.appliedFormatters.push('Plain Text Formatter')
            break
        }
      } catch (formattingError) {
        console.warn('Specific formatting failed, falling back to plain text:', formattingError)
        result.formattedContent = await this.applyPlainTextFormatting(content, options, result)
        result.appliedFormatters.push('Plain Text Formatter (Fallback)')
        result.qualityAssurance.warnings.push('Advanced formatting failed, using plain text fallback')
      }

      result.performanceMetrics.formattingTime = Date.now() - formattingStartTime

      // Phase 3: Post-processing and Enhancement with error handling
      if (options.enableAdvancedFormatting) {
        try {
          result.formattedContent = await this.applyAdvancedFormatting(result.formattedContent, options, result)
          result.appliedFormatters.push('Advanced Formatter')
        } catch (advancedError) {
          console.warn('Advanced formatting failed, skipping:', advancedError)
          result.qualityAssurance.warnings.push('Advanced formatting features were skipped due to an error')
        }
      }

      // Phase 4: Quality Assurance with error handling
      try {
        await this.performQualityAssurance(result, options)
      } catch (qaError) {
        console.warn('Quality assurance failed, skipping:', qaError)
        result.qualityAssurance.warnings.push('Quality assurance checks were skipped due to an error')
      }

      // Phase 5: Accessibility Enhancement with error handling
      if (options.enableAccessibilityFeatures) {
        try {
          result.formattedContent = await this.enhanceAccessibility(result.formattedContent, result)
          result.appliedFormatters.push('Accessibility Enhancer')
        } catch (accessibilityError) {
          console.warn('Accessibility enhancements failed, skipping:', accessibilityError)
          result.qualityAssurance.warnings.push('Accessibility enhancements were skipped due to an error')
        }
      }

    } catch (error) {
      result.qualityAssurance.errors.push(`Formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      result.formattedContent = content // Fallback to original content
    }

    // Calculate total time
    result.performanceMetrics.totalTime = Date.now() - startTime

    return result
  }

  /**
   * Apply mathematical formatting
   */
  private static async applyMathematicalFormatting(
    content: string, 
    options: FormattingOptions, 
    result: IntelligentFormattingResult
  ): Promise<string> {
    const mathFormatted = MathFormatter.formatMathContent(content, options.classLevel)
    
    result.formattingMetadata.requiresMathjax = mathFormatted.requiresMathjax
    
    // Add transformation details to quality assurance
    if (mathFormatted.appliedTransformations.length > 0) {
      result.qualityAssurance.suggestions.push(
        `Applied ${mathFormatted.appliedTransformations.length} mathematical transformations`
      )
    }

    return mathFormatted.content
  }

  /**
   * Apply chemical formatting
   */
  private static async applyChemicalFormatting(
    content: string,
    options: FormattingOptions,
    result: IntelligentFormattingResult
  ): Promise<string> {
    const chemFormatted = ChemistryFormatter.formatChemicalContent(content, options.classLevel)

    result.formattingMetadata.requiresChemicalRendering = chemFormatted.requiresChemicalRendering

    // Check for structural formula needs with context
    const structuralNeeds = ChemistryFormatter.needsStructuralFormula(content, options.subject, options.classLevel)
    if (structuralNeeds.length > 0) {
      result.qualityAssurance.suggestions.push(
        `Generated ${structuralNeeds.length} structural formula(s): ${structuralNeeds.map(s => s.compound).join(', ')}`
      )
    }

    // Validate chemical formulas
    for (const formula of chemFormatted.formulas) {
      const validation = ChemistryFormatter.validateChemicalFormula(formula.formatted)
      if (!validation.isValid) {
        result.qualityAssurance.warnings.push(...validation.errors)
      }
    }

    return chemFormatted.content
  }

  /**
   * Apply mixed content formatting
   */
  private static async applyMixedFormatting(
    content: string, 
    options: FormattingOptions, 
    result: IntelligentFormattingResult
  ): Promise<string> {
    // Segment content and apply appropriate formatting to each segment
    const segments = ContentAnalyzer.segmentContent(content)
    let formattedContent = ''
    let currentIndex = 0

    for (const segment of segments) {
      // Add any text between segments
      if (segment.startIndex > currentIndex) {
        formattedContent += content.substring(currentIndex, segment.startIndex)
      }

      // Apply appropriate formatting based on segment type
      let segmentFormatted = segment.content
      
      switch (segment.type) {
        case 'math':
          const mathResult = MathFormatter.formatMathContent(segment.content, options.classLevel)
          segmentFormatted = mathResult.content
          result.formattingMetadata.requiresMathjax = result.formattingMetadata.requiresMathjax || mathResult.requiresMathjax
          break
          
        case 'chemistry':
          const chemResult = ChemistryFormatter.formatChemicalContent(segment.content, options.classLevel)
          segmentFormatted = chemResult.content
          result.formattingMetadata.requiresChemicalRendering = result.formattingMetadata.requiresChemicalRendering || chemResult.requiresChemicalRendering
          break
          
        case 'code':
          segmentFormatted = this.formatCodeBlock(segment.content)
          result.formattingMetadata.hasCodeBlocks = true
          break
          
        default:
          const plainResult = PlainTextFormatter.formatContent(segment.content, options.classLevel)
          segmentFormatted = plainResult.content
          break
      }

      formattedContent += segmentFormatted
      currentIndex = segment.endIndex
    }

    // Add any remaining content
    if (currentIndex < content.length) {
      formattedContent += content.substring(currentIndex)
    }

    return formattedContent
  }

  /**
   * Apply plain text formatting
   */
  private static async applyPlainTextFormatting(
    content: string, 
    options: FormattingOptions, 
    result: IntelligentFormattingResult
  ): Promise<string> {
    const plainFormatted = PlainTextFormatter.formatContent(content, options.classLevel)
    
    // Add formatting statistics to suggestions
    const summary = PlainTextFormatter.generateFormattingSummary(plainFormatted)
    if (summary !== 'No special formatting applied to this content.') {
      result.qualityAssurance.suggestions.push(summary)
    }

    return plainFormatted.content
  }

  /**
   * Apply advanced formatting features
   */
  private static async applyAdvancedFormatting(
    content: string, 
    options: FormattingOptions, 
    result: IntelligentFormattingResult
  ): Promise<string> {
    let enhanced = content

    // Generate diagrams if requested and content supports it
    if (options.enableDiagramGeneration && this.shouldGenerateDiagrams(content, result.contentAnalysis)) {
      enhanced = await this.generateDiagrams(enhanced, options)
      result.formattingMetadata.hasDiagrams = true
    }

    // Add interactive elements for different user roles
    if (options.userRole === 'teacher') {
      enhanced = this.addTeacherEnhancements(enhanced)
    } else if (options.userRole === 'student') {
      enhanced = this.addStudentEnhancements(enhanced, options.classLevel)
    }

    // Add CBSE curriculum alignment markers
    enhanced = this.addCurriculumAlignment(enhanced, options)

    return enhanced
  }

  /**
   * Perform quality assurance checks
   */
  private static async performQualityAssurance(
    result: IntelligentFormattingResult, 
    options: FormattingOptions
  ): Promise<void> {
    const { formattedContent, contentAnalysis } = result

    // Check content length and complexity
    if (formattedContent.length > 5000) {
      result.qualityAssurance.warnings.push('Content is quite long - consider breaking into sections')
    }

    // Validate mathematical expressions if present
    if (contentAnalysis.detectedElements.hasEquations) {
      const mathExpressions = ContentAnalyzer.extractMathExpressions(formattedContent)
      for (const expr of mathExpressions) {
        const validation = MathFormatter.validateLatex(expr.expression)
        if (!validation.isValid) {
          result.qualityAssurance.errors.push(...validation.errors)
        }
      }
    }

    // Check accessibility
    const accessibilityIssues = PlainTextFormatter.validateAccessibility(formattedContent)
    result.qualityAssurance.warnings.push(...accessibilityIssues.map(issue => issue.issue))
    result.qualityAssurance.suggestions.push(...accessibilityIssues.map(issue => issue.suggestion))

    // Calculate accessibility score
    result.formattingMetadata.accessibilityScore = this.calculateAccessibilityScore(formattedContent, accessibilityIssues)

    // Class-level appropriateness check
    if (options.classLevel) {
      const appropriatenessCheck = this.checkClassLevelAppropriateness(formattedContent, options.classLevel)
      if (!appropriatenessCheck.isAppropriate) {
        result.qualityAssurance.warnings.push(appropriatenessCheck.reason)
      }
    }
  }

  /**
   * Enhance content for accessibility
   */
  private static async enhanceAccessibility(
    content: string, 
    result: IntelligentFormattingResult
  ): Promise<string> {
    let enhanced = content

    // Add alt text for mathematical expressions
    if (result.formattingMetadata.requiresMathjax) {
      enhanced = enhanced.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
        return `$$${latex}$$ <!-- Math: ${latex.replace(/\\/g, '')} -->`
      })
    }

    // Add descriptions for chemical formulas
    if (result.formattingMetadata.requiresChemicalRendering) {
      enhanced = enhanced.replace(/([A-Z][a-z]?<sub>\d+<\/sub>)/g, (match) => {
        return `${match} <!-- Chemical formula -->`
      })
    }

    // Add semantic markup
    enhanced = enhanced.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    enhanced = enhanced.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    enhanced = enhanced.replace(/<u>([^<]+)<\/u>/g, '<mark>$1</mark>')

    return enhanced
  }

  /**
   * Format code blocks with syntax highlighting hints
   */
  private static formatCodeBlock(code: string): string {
    // Detect language
    let language = 'text'
    if (code.includes('def ') || code.includes('import ')) language = 'python'
    else if (code.includes('function ') || code.includes('const ')) language = 'javascript'
    else if (code.includes('<html>') || code.includes('<div>')) language = 'html'
    else if (code.includes('class ') && code.includes('{')) language = 'css'

    return `\`\`\`${language}\n${code.replace(/```/g, '')}\n\`\`\``
  }

  /**
   * Check if content should have diagrams generated
   */
  private static shouldGenerateDiagrams(content: string, analysis: ContentAnalysis): boolean {
    const diagramKeywords = [
      'diagram', 'chart', 'graph', 'flowchart', 'timeline', 'structure',
      'process', 'cycle', 'system', 'organization', 'hierarchy'
    ]
    
    return diagramKeywords.some(keyword => 
      content.toLowerCase().includes(keyword)
    ) && analysis.confidence > 0.7
  }

  /**
   * Generate simple ASCII diagrams
   */
  private static async generateDiagrams(content: string, options: FormattingOptions): Promise<string> {
    // This is a simplified implementation - in practice, you might use libraries like mermaid.js
    let enhanced = content

    // Simple timeline generation
    if (content.toLowerCase().includes('timeline')) {
      const timelineRegex = /(\d{4})[:\-\s]+([^.\n]+)/g
      const matches = Array.from(content.matchAll(timelineRegex))
      
      if (matches.length > 1) {
        const timeline = matches.map(match => `${match[1]} ──── ${match[2]}`).join('\n')
        enhanced += `\n\n**Timeline:**\n\`\`\`\n${timeline}\n\`\`\`\n`
      }
    }

    return enhanced
  }

  /**
   * Add teacher-specific enhancements
   */
  private static addTeacherEnhancements(content: string): string {
    let enhanced = content

    // Add teaching tips
    enhanced = enhanced.replace(/\*\*([^*]+)\*\*/g, (match, term) => {
      return `${match} 📚 *[Teaching tip: Emphasize this concept]*`
    })

    return enhanced
  }

  /**
   * Add student-specific enhancements
   */
  private static addStudentEnhancements(content: string, classLevel?: string): string {
    let enhanced = content

    const classNumber = classLevel ? parseInt(classLevel.replace(/[^0-9]/g, '')) : 10

    if (classNumber <= 8) {
      // Add encouraging emojis for younger students
      enhanced = enhanced.replace(/\*\*([^*]+)\*\*/g, '🌟 **$1** 🌟')
    }

    return enhanced
  }

  /**
   * Add CBSE curriculum alignment markers
   */
  private static addCurriculumAlignment(content: string, options: FormattingOptions): string {
    let enhanced = content

    if (options.classLevel && options.subject) {
      enhanced = `*CBSE ${options.classLevel} - ${options.subject}*\n\n${enhanced}`
    }

    return enhanced
  }

  /**
   * Calculate accessibility score
   */
  private static calculateAccessibilityScore(content: string, issues: Array<{issue: string, suggestion: string}>): number {
    let score = 100

    // Deduct points for accessibility issues
    score -= issues.length * 10

    // Check for positive accessibility features
    if (content.includes('**')) score += 5 // Has headings
    if (content.includes('<mark>')) score += 5 // Has highlighted content
    if (content.includes('<!-- ')) score += 10 // Has alt text/descriptions

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Check if content is appropriate for class level
   */
  private static checkClassLevelAppropriateness(content: string, classLevel: string): {isAppropriate: boolean, reason: string} {
    const classNumber = parseInt(classLevel.replace(/[^0-9]/g, ''))
    
    // Check for advanced concepts in lower classes
    if (classNumber <= 8) {
      const advancedTerms = ['calculus', 'derivatives', 'integrals', 'organic chemistry', 'quantum']
      const hasAdvancedTerms = advancedTerms.some(term => content.toLowerCase().includes(term))
      
      if (hasAdvancedTerms) {
        return {
          isAppropriate: false,
          reason: 'Content contains advanced concepts that may be too complex for this class level'
        }
      }
    }

    return { isAppropriate: true, reason: '' }
  }
}
