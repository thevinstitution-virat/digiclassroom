/**
 * Unified Backend Formatter for AI Tutor Responses
 * Consolidates ALL formatting logic into a single, predictable pipeline
 * Eliminates redundancy and conflicts from the previous 8-layer architecture
 */

export interface KeyTerm {
  term: string
  definition: string
}

export interface FormattingContext {
  contentType: 'plain' | 'mathematical' | 'chemical'
  questionType: 'define' | 'explain' | 'compare' | 'calculate' | 'list' | 'other'
  rawAnswer: string
  keyTerms?: KeyTerm[]
}

export interface FormattedResult {
  formattedAnswer: string
  warnings: string[]
  structure: {
    hasIntroduction: boolean
    hasBody: boolean
    bodyFormat: 'numbered_points' | 'paragraphs' | 'table' | 'steps' | 'multiple_choice'
    pointCount: number
  }
}

export class UnifiedFormatter {
  /**
   * Single entry point for all formatting
   * Eliminates redundancy and ensures consistent output
   */
  static format(context: FormattingContext): FormattedResult {
    const warnings: string[] = []
    
    // Step 1: Clean and normalize input
    let content = this.normalizeInput(context.rawAnswer)
    
    // Step 2: Apply content-specific formatting
    content = this.applyContentTypeFormatting(content, context.contentType)
    
    // Step 3: Apply structure formatting
    const structure = this.detectStructure(content)
    content = this.applyStructureFormatting(content, structure.bodyFormat)
    
    // Step 4: Format headings
    content = this.formatHeadings(content)
    
    // Step 5: Add Key Terms section
    if (context.keyTerms && context.keyTerms.length > 0) {
      content = this.appendKeyTerms(content, context.keyTerms)
    }
    
    // Step 6: Final cleanup
    content = this.finalCleanup(content)
    
    // Step 7: Validate output
    const validationWarnings = this.validateMarkdown(content)
    warnings.push(...validationWarnings)
    
    return {
      formattedAnswer: content,
      warnings,
      structure: this.detectStructure(content)
    }
  }

  /**
   * Normalize input - single pass to clean up common issues
   */
  private static normalizeInput(raw: string): string {
    return raw
      .replace(/\r\n/g, '\n')              // Normalize line breaks
      .replace(/::/g, ':**')               // Fix double colons (AI mistake)
      .replace(/\n{3,}/g, '\n\n')          // Max 2 consecutive newlines
      .replace(/\s+$/gm, '')               // Remove trailing spaces
      .replace(/([A-Za-z\s]+):(#{1,3}[^\s])/g, '$1\n\n$2')  // Fix "Text:###" pattern
      .trim()
  }

  /**
   * Apply content-type specific formatting
   */
  private static applyContentTypeFormatting(content: string, type: string): string {
    switch(type) {
      case 'mathematical':
        return this.formatMathContent(content)
      case 'chemical':
        return this.formatChemistryContent(content)
      default:
        return content
    }
  }

  /**
   * Format mathematical content (equations, formulas)
   */
  private static formatMathContent(content: string): string {
    // Ensure equations are on separate lines
    return content
      .replace(/\$\$([^$]+)\$\$/g, '\n\n$$$$1$$\n\n')  // Block equations
      .replace(/\$([^$]+)\$/g, ' $$$1$$ ')              // Inline equations
      .replace(/\n{3,}/g, '\n\n')
  }

  /**
   * Format chemistry content (formulas, reactions)
   */
  private static formatChemistryContent(content: string): string {
    // Ensure chemical formulas are properly spaced
    return content
      .replace(/([A-Z][a-z]?\d*)\s*\+\s*([A-Z][a-z]?\d*)/g, '$1 + $2')  // Reactions
      .replace(/→/g, ' → ')  // Reaction arrows
      .replace(/\s{2,}/g, ' ')  // Clean up extra spaces
  }

  /**
   * Detect content structure
   */
  private static detectStructure(content: string): FormattedResult['structure'] {
    const lines = content.split('\n').map(l => l.trim()).filter(l => l)
    
    // Check for numbered points
    const numberedPoints = lines.filter(l => /^\d+\.\s+/.test(l))
    const hasNumberedPoints = numberedPoints.length >= 2
    
    // Check for multiple choice
    const hasMultipleChoice = /\([a-e]\)[^\n)]+\([a-e]\)/.test(content)
    
    // Check for table
    const hasTable = /\|[^\n]+\|/.test(content)
    
    // Check for steps (Given, Formula, Solution, etc.)
    const hasSteps = /^(given|formula|solution|step \d+|calculation|answer):/im.test(content)
    
    // Check for introduction
    const hasIntroduction = /^###\s*Introduction/im.test(content) || 
                           lines.length > 0 && !hasNumberedPoints && !hasTable
    
    let bodyFormat: FormattedResult['structure']['bodyFormat'] = 'paragraphs'
    if (hasMultipleChoice) bodyFormat = 'multiple_choice'
    else if (hasNumberedPoints) bodyFormat = 'numbered_points'
    else if (hasTable) bodyFormat = 'table'
    else if (hasSteps) bodyFormat = 'steps'
    
    return {
      hasIntroduction,
      hasBody: lines.length > 0,
      bodyFormat,
      pointCount: numberedPoints.length
    }
  }

  /**
   * Apply structure-specific formatting
   */
  private static applyStructureFormatting(content: string, format: string): string {
    switch(format) {
      case 'multiple_choice':
        return this.formatMultipleChoice(content)
      case 'numbered_points':
        return this.formatNumberedPoints(content)
      case 'table':
        return this.formatTable(content)
      case 'steps':
        return this.formatSteps(content)
      default:
        return this.formatParagraphs(content)
    }
  }

  /**
   * Format multiple choice options - ROBUST IMPLEMENTATION
   * Handles the screenshot issue: (a) Ice (b) Milk (c) Iron (d) Hydrochloric acid
   */
  private static formatMultipleChoice(content: string): string {
    // Check if content has multiple choice pattern: (a) text (b) text
    if (!/\([a-e]\)[^\n)]+\([a-e]\)/i.test(content)) {
      return content
    }

    // Replace inline options with list format
    // Match: (a) text (b) text (c) text etc.
    let formatted = content.replace(
      /\(([a-e])\)\s*([^()]+?)(?=\s*\([a-e]\)|$)/gi,
      (match, letter, text) => {
        // Clean up the text - remove extra spaces
        const cleanText = text.trim().replace(/\s+/g, ' ')
        // Add proper list formatting with explicit spaces
        return `\n- **(${letter.toLowerCase()})** ${cleanText}`
      }
    )

    // Clean up excessive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n')

    // Ensure there's a blank line before the first option
    formatted = formatted.replace(/([^\n])\n- \*\*\(/, '$1\n\n- **(')

    return formatted
  }

  /**
   * Format numbered points with proper hierarchy
   */
  private static formatNumberedPoints(content: string): string {
    const lines = content.split('\n')
    const formatted: string[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Match numbered point: "1. Text" or "1. **Heading:** Text"
      const match = trimmed.match(/^(\d+)\.\s+(.+)$/)
      
      if (match) {
        const [, num, text] = match
        
        // Check if text has a heading (text before colon)
        const colonIndex = text.indexOf(':')
        if (colonIndex > 0 && colonIndex < 80 && !text.startsWith('**')) {
          // Extract heading and elaboration
          const heading = text.substring(0, colonIndex).trim()
          const elaboration = text.substring(colonIndex + 1).trim()
          
          formatted.push(`${num}. **${heading}:**${elaboration ? ' ' + elaboration : ''}`)
        } else {
          formatted.push(line)
        }
      } else {
        formatted.push(line)
      }
    }
    
    return formatted.join('\n')
  }

  /**
   * Format tables with proper spacing
   */
  private static formatTable(content: string): string {
    return content
      .replace(/(\|[^\n]+\|)\n([^|\n])/g, '$1\n\n$2')  // Space after table
      .replace(/([^|\n])\n(\|[^\n]+\|)/g, '$1\n\n$2')  // Space before table
  }

  /**
   * Format step-by-step solutions
   */
  private static formatSteps(content: string): string {
    return content
      .replace(/^(given|formula|solution|step \d+|calculation|answer):/gim, '**$1:**')
      .replace(/\n(given|formula|solution|step \d+|calculation|answer):/gim, '\n\n**$1:**')
  }

  /**
   * Format paragraphs with proper spacing
   */
  private static formatParagraphs(content: string): string {
    const lines = content.split('\n')
    const formatted: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // Add spacing between paragraphs
      if (trimmed && i > 0 && formatted[formatted.length - 1]) {
        const prevTrimmed = formatted[formatted.length - 1].trim()
        if (prevTrimmed && !prevTrimmed.match(/^#{1,3}\s/) && !prevTrimmed.endsWith(':')) {
          formatted.push('')
        }
      }
      
      formatted.push(line)
    }
    
    return formatted.join('\n')
  }

  /**
   * Format headings - convert section keywords to ### format
   */
  private static formatHeadings(content: string): string {
    const lines = content.split('\n')
    const formatted: string[] = []
    
    const headingKeywords = [
      'introduction', 'key points', 'questions mentioned', 'important questions',
      'conclusion', 'summary', 'explanation', 'definition', 'examples',
      'features', 'characteristics', 'types', 'advantages', 'disadvantages'
    ]
    
    for (const line of lines) {
      const trimmed = line.trim()
      
      // Skip if already a heading
      if (trimmed.match(/^#{1,3}\s/)) {
        formatted.push(line)
        continue
      }
      
      // Check if this line is a heading keyword
      const lowerTrimmed = trimmed.toLowerCase().replace(/[:\*]/g, '').trim()
      const isHeading = headingKeywords.some(keyword =>
        lowerTrimmed === keyword ||
        lowerTrimmed === keyword + 's' ||
        lowerTrimmed.startsWith(keyword + ' ')
      )
      
      if (isHeading) {
        // Convert to heading
        const headingText = trimmed.replace(/^[\*]+|[\*:]+$/g, '').trim()
        formatted.push(`### ${headingText}`)
      } else {
        formatted.push(line)
      }
    }
    
    return formatted.join('\n')
  }

  /**
   * Append Key Terms section with improved formatting
   * CRITICAL: Each term must be in its own paragraph for ReactMarkdown to render correctly
   * UPDATED: Using explicit paragraph markers and extra spacing for visual separation
   */
  private static appendKeyTerms(content: string, keyTerms: KeyTerm[]): string {
    const lines = [
      '',
      '',
      '---',
      '',
      '### 📚 Key Terms',
      '',
      ''
    ]

    keyTerms.forEach((term, index) => {
      // Remove citations and clean definition
      const cleanDef = term.definition
        .replace(/\[\d+\]/g, '')
        .replace(/\*\*/g, '')
        .replace(/_{2,}/g, '')
        .trim()

      // CRITICAL FIX: Use explicit paragraph structure
      // Each term name gets its own paragraph with blank lines before and after
      // Each definition gets its own paragraph with blank lines before and after
      // This ensures ReactMarkdown creates separate <p> tags

      lines.push('')  // Blank line before term (creates paragraph break)
      lines.push(`**${term.term}**`)  // Term name in bold
      lines.push('')  // Blank line after term name
      lines.push('')  // Second blank line (forces paragraph separation)
      lines.push(cleanDef)  // Definition text
      lines.push('')  // Blank line after definition
      lines.push('')  // Second blank line after definition

      // Add extra spacing between different terms for visual separation
      if (index < keyTerms.length - 1) {
        lines.push('')  // Extra blank line between terms
      }
    })

    // Ensure proper spacing before appending
    const keyTermsText = lines.join('\n')
    const contentEndsWithNewline = content.endsWith('\n')
    const prefix = contentEndsWithNewline ? '\n' : '\n\n'

    // DEBUG: Log the generated key terms markdown with detailed analysis
    if (process.env.NODE_ENV === 'development') {
      console.log('🔑 KEY TERMS MARKDOWN GENERATED:')
      console.log('━'.repeat(60))
      console.log(keyTermsText)
      console.log('━'.repeat(60))
      console.log('First 500 chars:', keyTermsText.substring(0, 500))
      console.log('Contains newlines:', keyTermsText.includes('\n'))
      console.log('Newline count:', (keyTermsText.match(/\n/g) || []).length)
      console.log('Double newline count:', (keyTermsText.match(/\n\n/g) || []).length)
      console.log('Number of terms:', keyTerms.length)

      // Show structure of first term
      const firstTermLines = keyTermsText.split('\n').slice(0, 15)
      console.log('First term structure:')
      firstTermLines.forEach((line, i) => {
        console.log(`  Line ${i}: "${line}" ${line === '' ? '(BLANK)' : ''}`)
      })
    }

    return content + prefix + keyTermsText + '\n'
  }

  /**
   * Final cleanup pass
   */
  private static finalCleanup(content: string): string {
    return content
      .replace(/\n{4,}/g, '\n\n\n')        // Max 3 consecutive newlines
      .replace(/[ \t]+$/gm, '')            // Remove trailing spaces
      .trim()
  }

  /**
   * Validate markdown syntax
   */
  private static validateMarkdown(content: string): string[] {
    const warnings: string[] = []
    
    // Check 1: Malformed headings (### without space)
    if (/###[^#\s]/.test(content)) {
      warnings.push('Malformed heading detected - missing space after ###')
    }
    
    // Check 2: Unclosed bold formatting
    const boldCount = (content.match(/\*\*/g) || []).length
    if (boldCount % 2 !== 0) {
      warnings.push('Unclosed bold formatting detected')
    }
    
    // Check 3: Unclosed italic formatting
    const textWithoutBold = content.replace(/\*\*/g, '')
    const italicCount = (textWithoutBold.match(/\*/g) || []).length
    if (italicCount % 2 !== 0) {
      warnings.push('Unclosed italic formatting detected')
    }
    
    // Check 4: Empty list items
    if (/\n\s*-\s*\n/.test(content)) {
      warnings.push('Empty list item detected')
    }
    
    // Check 5: Consecutive headings without content
    if (/###[^\n]+\n+###/.test(content)) {
      warnings.push('Consecutive headings without content')
    }
    
    return warnings
  }
}

