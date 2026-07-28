/**
 * Answer Post-Processor for AI Tutor Responses
 * Enforces academic structure and proper formatting on AI-generated answers
 * Ensures consistent visual hierarchy regardless of AI output quality
 */

export interface ProcessedAnswer {
  formattedAnswer: string
  structure: {
    hasIntroduction: boolean
    hasBody: boolean
    hasConclusion: boolean
    bodyFormat: 'numbered_points' | 'paragraphs' | 'table' | 'steps'
    pointCount: number
  }
  appliedTransformations: string[]
}

export class AnswerPostProcessor {
  
  /**
   * Main processing method - enforces academic structure on any answer
   */
  static processAnswer(rawAnswer: string, questionType?: string): ProcessedAnswer {
    const transformations: string[] = []
    let processed = rawAnswer.trim()

    // Step 0: Pre-process to fix common AI mistakes (missing line breaks)
    processed = this.preProcess(processed)
    transformations.push('Pre-processed text')

    // Step 1: Normalize line breaks and spacing
    processed = this.normalizeSpacing(processed)
    transformations.push('Normalized spacing')

    // Step 2: Detect and enhance structure
    const structure = this.detectStructure(processed)
    
    // Step 3: Apply formatting based on detected structure
    if (structure.bodyFormat === 'numbered_points') {
      processed = this.formatNumberedPoints(processed)
      transformations.push('Enhanced numbered points formatting')
    } else if (structure.bodyFormat === 'table') {
      processed = this.formatTable(processed)
      transformations.push('Enhanced table formatting')
    } else if (structure.bodyFormat === 'steps') {
      processed = this.formatSteps(processed)
      transformations.push('Enhanced step-by-step formatting')
    } else {
      processed = this.formatParagraphs(processed)
      transformations.push('Enhanced paragraph formatting')
    }

    // Step 4: Enhance headings and sections
    processed = this.enhanceHeadings(processed)
    transformations.push('Enhanced headings')

    // Step 5: Format key terms and definitions
    processed = this.formatKeyTerms(processed)
    transformations.push('Formatted key terms')

    // Step 5.5: Format multiple choice options
    processed = this.formatMultipleChoice(processed)
    transformations.push('Formatted multiple choice options')

    // Step 6: Ensure proper introduction
    if (!structure.hasIntroduction) {
      processed = this.ensureIntroduction(processed)
      transformations.push('Added introduction structure')
    }

    // Step 7: Clean up and finalize
    processed = this.finalCleanup(processed)
    transformations.push('Final cleanup')

    // Step 8: Validate output quality
    const validationWarnings = this.validateOutput(processed)
    if (validationWarnings.length > 0) {
      console.warn('⚠️ Answer formatting validation warnings:', validationWarnings)
      transformations.push(`Validation: ${validationWarnings.length} warnings`)
    }

    return {
      formattedAnswer: processed,
      structure: this.detectStructure(processed),
      appliedTransformations: transformations
    }
  }

  /**
   * Pre-process text to fix common AI mistakes
   */
  private static preProcess(text: string): string {
    return text
      // Fix double colons (::) that should be bold closing (**:) - MUST BE FIRST
      .replace(/::/g, ':**')
      // Fix "Questions Mentioned:###" pattern (the screenshot issue)
      // Only match if there's NO space after the colon
      .replace(/([A-Za-z\s]+):(#{1,3}[^\s])/g, '$1\n\n$2')
      // Fix missing line breaks before headings (e.g., "text.###" -> "text.\n\n###")
      .replace(/([.!?])(#{1,3}\s)/g, '$1\n\n$2')
      // Fix missing line breaks after headings before numbered points (e.g., "###Heading:1." -> "###Heading:\n\n1.")
      .replace(/(#{1,3}\s[^:\n]+:)(\d+\.\s+)/g, '$1\n\n$2')
      // Fix missing line breaks before numbered points (e.g., "text.1." -> "text.\n\n1.")
      .replace(/([.!?])(\d+\.\s+)/g, '$1\n\n$2')
      // Fix missing space after numbered points (e.g., "1.Text" -> "1. Text")
      .replace(/(\d+\.)([A-Z])/g, '$1 $2')
  }

  /**
   * Normalize spacing and line breaks
   */
  private static normalizeSpacing(text: string): string {
    return text
      // Fix headings that got split (e.g., "### Heading\n\n:" -> "### Heading:")
      .replace(/(#{1,3}\s[^\n:]+)\n+:/g, '$1:')
      // Fix headings that got split with text after (e.g., "### Key Point\n\ns:" -> "### Key Points:")
      .replace(/(#{1,3}\s[^\n]+)\n+([a-z]+:)/g, '$1$2')
      // Fix missing line breaks before headings (e.g., "text###" -> "text\n\n###")
      // BUT: Don't match if the character before is also a # (to avoid breaking ###)
      .replace(/([^\n#])(#{1,3}\s)/g, '$1\n\n$2')
      // Fix missing line breaks before numbered points (e.g., "text1." -> "text\n\n1.")
      .replace(/([^\n])(\d+\.\s+\*\*)/g, '$1\n\n$2')
      // Remove excessive blank lines (more than 2)
      .replace(/\n{4,}/g, '\n\n\n')
      // Ensure consistent spacing before headings (single newline -> double newline)
      .replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2')
      // Remove trailing spaces
      .replace(/[ \t]+$/gm, '')
      .trim()
  }

  /**
   * Detect the structure of the answer
   */
  private static detectStructure(text: string): ProcessedAnswer['structure'] {
    const lines = text.split('\n')
    
    // Detect numbered points
    const numberedPointPattern = /^\s*\d+\.\s+/
    const numberedPoints = lines.filter(line => numberedPointPattern.test(line))
    
    // Detect table
    const hasTable = text.includes('|') && text.split('\n').filter(line => line.includes('|')).length >= 3
    
    // Detect steps (Given, Formula, Solution, etc.)
    const stepKeywords = ['given:', 'formula:', 'solution:', 'step 1:', 'step 2:', 'calculation:']
    const hasSteps = stepKeywords.some(keyword => text.toLowerCase().includes(keyword))
    
    // Detect introduction (first paragraph before numbered points or sections)
    const firstParagraphEnd = text.indexOf('\n\n')
    const hasIntroduction = firstParagraphEnd > 0 && firstParagraphEnd < 300
    
    // Detect conclusion
    const hasConclusion = text.toLowerCase().includes('conclusion') || 
                          text.toLowerCase().includes('in summary') ||
                          text.toLowerCase().includes('therefore')
    
    let bodyFormat: ProcessedAnswer['structure']['bodyFormat'] = 'paragraphs'
    if (hasTable) bodyFormat = 'table'
    else if (hasSteps) bodyFormat = 'steps'
    else if (numberedPoints.length >= 2) bodyFormat = 'numbered_points'
    
    return {
      hasIntroduction,
      hasBody: true,
      hasConclusion,
      bodyFormat,
      pointCount: numberedPoints.length
    }
  }

  /**
   * Format numbered points with proper hierarchy
   */
  private static formatNumberedPoints(text: string): string {
    // First, ensure numbered points are on separate lines
    let preprocessed = text
      // Fix cases like "text.1. Point" -> "text.\n\n1. Point"
      .replace(/([.!?])(\d+\.\s+)/g, '$1\n\n$2')
      // Fix cases like "text1. Point" -> "text\n\n1. Point"
      .replace(/([a-z])(\d+\.\s+\*\*)/g, '$1\n\n$2')

    const lines = preprocessed.split('\n')
    const formatted: string[] = []
    let inNumberedSection = false
    let sectionHeaderAdded = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Detect numbered point
      const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)

      if (numberedMatch) {
        // Add section header before first numbered point if not present
        if (!inNumberedSection && !sectionHeaderAdded) {
          // Check if there's already a heading before this
          const prevNonEmpty = this.getPreviousNonEmptyLine(lines, i)
          if (!prevNonEmpty || !prevNonEmpty.match(/^#{1,3}\s/)) {
            formatted.push('')
            formatted.push('### Key Points:')
            formatted.push('')
            sectionHeaderAdded = true
          }
          inNumberedSection = true
        }

        const number = numberedMatch[1]
        const content = numberedMatch[2]

        // Check if content has a bold heading already (either **text**: or text:**)
        const boldMatch1 = content.match(/^\*\*([^*]+)\*\*:?\s*(.*)$/) // **text**: format
        const boldMatch2 = content.match(/^([^:]+):\*\*\s*(.*)$/) // text:** format (from :: conversion)

        if (boldMatch1) {
          // Format: **Heading**: explanation
          const heading = boldMatch1[1].trim()
          const explanation = boldMatch1[2].trim()

          formatted.push(`${number}. **${heading}:**`)
          if (explanation) {
            formatted.push('')
            formatted.push(`   ${explanation}`)
          }
        } else if (boldMatch2) {
          // Format: Heading:** explanation (from :: conversion)
          const heading = boldMatch2[1].trim()
          const explanation = boldMatch2[2].trim()

          formatted.push(`${number}. **${heading}:**`)
          if (explanation) {
            formatted.push('')
            formatted.push(`   ${explanation}`)
          }
        } else {
          // No bold heading - try to extract one
          const colonIndex = content.indexOf(':')
          if (colonIndex > 0 && colonIndex < 50) {
            // Has a colon - use text before colon as heading
            const heading = content.substring(0, colonIndex).trim()
            const explanation = content.substring(colonIndex + 1).trim()

            formatted.push(`${number}. **${heading}:**`)
            if (explanation) {
              formatted.push('')
              formatted.push(`   ${explanation}`)
            }
          } else {
            // No clear heading - use first few words
            const words = content.split(' ')
            if (words.length > 5) {
              const heading = words.slice(0, 3).join(' ')
              const explanation = words.slice(3).join(' ')

              formatted.push(`${number}. **${heading}:**`)
              formatted.push('')
              formatted.push(`   ${explanation}`)
            } else {
              formatted.push(`${number}. **${content}**`)
            }
          }
        }
        formatted.push('')
      } else if (inNumberedSection && trimmed && !trimmed.match(/^#{1,3}\s/)) {
        // Continuation of previous point
        if (formatted[formatted.length - 1] === '') {
          formatted[formatted.length - 1] = `   ${trimmed}`
        } else {
          formatted.push(`   ${trimmed}`)
        }
      } else {
        formatted.push(line)
        if (trimmed.match(/^#{1,3}\s/)) {
          inNumberedSection = false
        }
      }
    }

    return formatted.join('\n')
  }

  /**
   * Format table with proper markdown
   */
  private static formatTable(text: string): string {
    // Ensure table has proper spacing
    return text.replace(/(\|[^\n]+\|)\n([^|\n])/g, '$1\n\n$2')
               .replace(/([^|\n])\n(\|[^\n]+\|)/g, '$1\n\n$2')
  }

  /**
   * Format step-by-step solutions
   */
  private static formatSteps(text: string): string {
    return text
      .replace(/^(given|formula|solution|step \d+|calculation|answer):/gim, '**$1:**')
      .replace(/\n(given|formula|solution|step \d+|calculation|answer):/gim, '\n\n**$1:**')
  }

  /**
   * Format paragraphs with proper spacing
   */
  private static formatParagraphs(text: string): string {
    const lines = text.split('\n')
    const formatted: string[] = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      // Ensure paragraphs are separated
      if (trimmed && i > 0 && formatted[formatted.length - 1] && !formatted[formatted.length - 1].match(/^#{1,3}\s/)) {
        const prevTrimmed = formatted[formatted.length - 1].trim()
        if (prevTrimmed && !prevTrimmed.endsWith(':') && !trimmed.match(/^[-*•]/)) {
          formatted.push('')
        }
      }
      
      formatted.push(line)
    }
    
    return formatted.join('\n')
  }

  /**
   * Enhance headings with proper markdown
   */
  private static enhanceHeadings(text: string): string {
    const lines = text.split('\n')
    const formatted: string[] = []

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i]
      const trimmed = line.trim()

      // Skip empty lines
      if (!trimmed) {
        formatted.push(line)
        continue
      }

      // Skip lines that are already headings or numbered points
      if (trimmed.match(/^#{1,3}\s/) || trimmed.match(/^\d+\./)) {
        formatted.push(line)
        continue
      }

      // Check if it's a section heading keyword
      const headingKeywords = [
        'introduction', 'key features', 'key points', 'main points', 'characteristics',
        'types', 'examples', 'conclusion', 'summary', 'definition',
        'explanation', 'importance', 'significance', 'advantages', 'disadvantages',
        'questions mentioned', 'important questions', 'solutions', 'classification'
      ]

      const lowerTrimmed = trimmed.toLowerCase().replace(/[:\*]/g, '').trim()
      const isHeading = headingKeywords.some(keyword =>
        lowerTrimmed === keyword ||
        lowerTrimmed === keyword + 's' ||
        lowerTrimmed.startsWith(keyword + ' ')
      )

      if (isHeading) {
        // Convert to heading
        const headingText = trimmed.replace(/^[\*]+|[\*:]+$/g, '').trim()
        line = `### ${headingText}`
      }

      formatted.push(line)
    }

    return formatted.join('\n')
  }

  /**
   * Format key terms with bold and proper structure
   */
  private static formatKeyTerms(text: string): string {
    // Format definitions (Term: Definition or Term - Definition)
    // BUT: Skip lines that are already headings (start with #)
    return text.replace(/^([A-Z][^#\n]+):\s+([^.\n]+)/gm, (match, term, def) => {
      // Don't format if it looks like a heading
      if (term.match(/^#{1,3}\s/)) {
        return match
      }
      return `**${term}:** ${def}`
    }).replace(/^([A-Z][a-zA-Z\s]+)\s+-\s+([^.\n]+)/gm, '**$1** - $2')
  }

  /**
   * Format multiple choice options to list format
   * Converts: (a) Ice (b) Milk (c) Iron
   * To: - **(a)** Ice\n- **(b)** Milk\n- **(c)** Iron
   */
  private static formatMultipleChoice(text: string): string {
    // Check if text contains multiple choice pattern
    if (!/\([a-e]\)[^\n)]+\([a-e]\)/.test(text)) {
      return text // No multiple choice detected
    }

    // Convert multiple choice options to list format
    return text.replace(
      /\(([a-e])\)\s*([^()]+?)(?=\s*\([a-e]\)|$)/gi,
      (match, letter, optionText) => {
        // Clean up the option text
        const cleanText = optionText.trim().replace(/\s+/g, ' ')
        return `\n- **(${letter.toLowerCase()})** ${cleanText}`
      }
    ).replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
  }

  /**
   * Ensure the answer has a proper introduction
   */
  private static ensureIntroduction(text: string): string {
    // If answer starts with numbered points or heading, it needs an introduction
    const firstLine = text.trim().split('\n')[0]
    if (firstLine.match(/^(\d+\.|#{1,3}\s)/)) {
      // Missing introduction - the answer jumps straight to points
      // We can't add content, but we can add a heading
      return text
    }
    return text
  }

  /**
   * Final cleanup and polish
   */
  private static finalCleanup(text: string): string {
    return text
      // Remove excessive blank lines
      .replace(/\n{4,}/g, '\n\n\n')
      // Ensure proper spacing before headings (single newline -> double newline)
      .replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2')
      // Ensure proper spacing around tables
      .replace(/([^|\n])\n(\|)/g, '$1\n\n$2')
      .replace(/(\|[^\n]+)\n([^|\n])/g, '$1\n\n$2')
      // Remove trailing spaces
      .replace(/[ \t]+$/gm, '')
      // Ensure single trailing newline
      .trim()
  }

  /**
   * Helper: Get previous non-empty line
   */
  private static getPreviousNonEmptyLine(lines: string[], currentIndex: number): string | null {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const trimmed = lines[i].trim()
      if (trimmed)
  return trimmed
    }
    return null
  }

  /**
   * Validate output quality and detect common formatting issues
   * Returns array of warning messages (empty if no issues)
   */
  private static validateOutput(text: string): string[] {
    const warnings: string[] = []

    // Check 1: Malformed heading syntax (missing space after ###)
    if (/[^#\s]###[^#\s]/.test(text) || /###[^#\s]/.test(text)) {
      warnings.push('Malformed heading detected - missing space after ###')
    }

    // Check 2: Duplicate consecutive headings (e.g., "### Introduction\n### Introduction")
    const duplicateHeadingMatch = text.match(/###\s*([^\n]+)\n+###\s*\1/i)
    if (duplicateHeadingMatch) {
      warnings.push(`Duplicate heading detected: "${duplicateHeadingMatch[1]}"`)
    }

    // Check 3: Unclosed bold formatting (odd number of **)
    const boldMarkers = text.match(/\*\*/g)
    if (boldMarkers && boldMarkers.length % 2 !== 0) {
      warnings.push('Unclosed bold formatting detected (odd number of ** markers)')
    }

    // Check 4: Unclosed italic formatting (odd number of single *)
    // Only count single asterisks that aren't part of **
    const textWithoutBold = text.replace(/\*\*/g, '')
    const italicMarkers = textWithoutBold.match(/\*/g)
    if (italicMarkers && italicMarkers.length % 2 !== 0) {
      warnings.push('Unclosed italic formatting detected (odd number of * markers)')
    }

    // Check 5: Empty list items (- followed by newline or another -)
    if (/\n\s*-\s*\n/.test(text) || /\n\s*-\s*-/.test(text)) {
      warnings.push('Empty list item detected')
    }

    // Check 6: Heading immediately followed by another heading (no content between)
    if (/###[^\n]+\n+###/.test(text)) {
      warnings.push('Consecutive headings without content detected')
    }

    // Check 7: Numbered points without proper formatting (e.g., "1.Text" instead of "1. Text")
    if (/\d+\.[A-Z]/.test(text)) {
      warnings.push('Numbered point missing space after period (e.g., "1.Text" should be "1. Text")')
    }

    // Check 8: Section header followed immediately by numbered point without heading
    const sectionWithoutHeading = /^[A-Z][^.!?\n]{10,}:\n+\d+\./m.test(text)
    if (sectionWithoutHeading) {
      warnings.push('Section header not converted to ### heading format')
    }

    // Check 9: Multiple choice options not properly formatted as list
    const hasMultipleChoice = /\([a-e]\)[^\n)]+\([a-e]\)/.test(text)
    const hasListFormat = /\n\s*-\s*\*\*\([a-e]\)\*\*/.test(text)
    if (hasMultipleChoice && !hasListFormat) {
      warnings.push('Multiple choice options detected but not formatted as list')
    }

    // Check 10: Excessive consecutive blank lines (more than 2)
    if (/\n{4,}/.test(text)) {
      warnings.push('Excessive blank lines detected (more than 2 consecutive)')
    }

    return warnings
  }
}

