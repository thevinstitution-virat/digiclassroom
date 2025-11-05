/**
 * Plain Text Formatting Engine for AI Tutor Responses
 * Applies intelligent formatting to general educational content
 */

export interface FormattingRule {
  pattern: RegExp
  replacement: string | ((match: string, ...groups: string[]) => string)
  priority: number
  description: string
}

export interface FormattedContent {
  content: string
  appliedRules: string[]
  formattingStats: {
    headingsFormatted: number
    properNounsFormatted: number
    definitionsFormatted: number
    quotationsFormatted: number
    datesFormatted: number
    keyTermsFormatted: number
  }
}

export class PlainTextFormatter {
  private static readonly FORMATTING_RULES: FormattingRule[] = [
    // Priority 1: Code blocks (preserve as-is)
    {
      pattern: /```[\s\S]*?```/g,
      replacement: (match) => match, // Preserve code blocks
      priority: 1,
      description: 'Preserve code blocks'
    },

    // Priority 2: Headings and section titles
    {
      pattern: /^(Chapter \d+:|Section \d+:|Part \d+:|Unit \d+:)/gm,
      replacement: '**$1**',
      priority: 2,
      description: 'Format chapter/section headings'
    },
    {
      pattern: /^([A-Z][A-Za-z\s]{2,30}:)(?=\s)/gm,
      replacement: '**$1**',
      priority: 2,
      description: 'Format topic headings'
    },

    // Priority 3: Proper nouns - Historical figures
    {
      pattern: /\b(Mahatma Gandhi|Jawaharlal Nehru|Subhas Chandra Bose|Bhagat Singh|Chandragupta Maurya|Ashoka|Akbar|Shah Jahan|Shivaji|Rani Lakshmibai|Abdul Kalam|Rabindranath Tagore|Swami Vivekananda|Sardar Patel)\b/g,
      replacement: '*$1*',
      priority: 3,
      description: 'Format historical figures'
    },

    // Priority 3: Proper nouns - Places
    {
      pattern: /\b(India|Bharat|Delhi|Mumbai|Kolkata|Chennai|Bangalore|Hyderabad|Pune|Ahmedabad|Rajasthan|Punjab|Gujarat|Maharashtra|Tamil Nadu|Kerala|Karnataka|Uttar Pradesh|Madhya Pradesh|Bihar|West Bengal|Andhra Pradesh|Telangana|Odisha|Assam|Himachal Pradesh|Uttarakhand|Goa|Haryana|Jharkhand|Chhattisgarh|Manipur|Meghalaya|Mizoram|Nagaland|Sikkim|Tripura|Arunachal Pradesh)\b/g,
      replacement: '*$1*',
      priority: 3,
      description: 'Format place names'
    },

    // Priority 3: Proper nouns - Historical events
    {
      pattern: /\b(Independence Day|Partition of India|Salt March|Quit India Movement|Sepoy Mutiny|Battle of Plassey|Mughal Empire|British Raj|Indian National Congress|Muslim League|Khilafat Movement|Non-Cooperation Movement|Civil Disobedience Movement)\b/g,
      replacement: '*$1*',
      priority: 3,
      description: 'Format historical events'
    },

    // Priority 3: Proper nouns - Literary works
    {
      pattern: /\b(Ramayana|Mahabharata|Bhagavad Gita|Panchatantra|Gitanjali|Discovery of India|Hind Swaraj|Anandamath|Godan|Kamayani|Saraswatichandra)\b/g,
      replacement: '*$1*',
      priority: 3,
      description: 'Format literary works'
    },

    // Priority 4: Definitions and key terminology
    {
      pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+is\s+defined\s+as\s+([^.!?]+[.!?])/g,
      replacement: '**$1** is defined as <u>$2</u>',
      priority: 4,
      description: 'Format definitions'
    },
    {
      pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+means\s+([^.!?]+[.!?])/g,
      replacement: '**$1** means <u>$2</u>',
      priority: 4,
      description: 'Format meaning explanations'
    },
    {
      pattern: /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+refers\s+to\s+([^.!?]+[.!?])/g,
      replacement: '**$1** refers to <u>$2</u>',
      priority: 4,
      description: 'Format reference explanations'
    },

    // Priority 5: Quotations
    {
      pattern: /"([^"]+)"/g,
      replacement: '<u>"$1"</u>',
      priority: 5,
      description: 'Format quotations'
    },
    {
      pattern: /'([^']+)'/g,
      replacement: '<u>\'$1\'</u>',
      priority: 5,
      description: 'Format single quotes'
    },

    // Priority 6: Dates and years
    {
      pattern: /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/g,
      replacement: '<u>$1</u>',
      priority: 6,
      description: 'Format full dates'
    },
    {
      pattern: /\b(\d{4}\s*(?:AD|BC|CE|BCE))\b/g,
      replacement: '<u>$1</u>',
      priority: 6,
      description: 'Format historical years'
    },
    {
      pattern: /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})\b/g,
      replacement: '<u>$1</u>',
      priority: 6,
      description: 'Format month-day-year dates'
    },

    // Priority 7: Key terms and important facts
    {
      pattern: /\b(Important|Note|Remember|Key Point|Fact|Definition|Conclusion|Summary):\s*([^.!?]+[.!?])/g,
      replacement: '**$1:** <u>$2</u>',
      priority: 7,
      description: 'Format key information markers'
    },

    // Priority 8: CBSE-specific terms
    {
      pattern: /\b(CBSE|NCERT|Board Exam|Class [IVX]+|Grade \d+|Semester|Annual Exam|Unit Test|Practical Exam)\b/g,
      replacement: '**$1**',
      priority: 8,
      description: 'Format CBSE terminology'
    },

    // Priority 9: Subject-specific terms
    {
      pattern: /\b(Mathematics|Science|Physics|Chemistry|Biology|History|Geography|Civics|Economics|English|Hindi|Sanskrit|Computer Science|Physical Education|Art|Music)\b/g,
      replacement: '**$1**',
      priority: 9,
      description: 'Format subject names'
    },

    // Priority 10: Festivals and cultural terms
    {
      pattern: /\b(Diwali|Holi|Eid|Christmas|Dussehra|Navratri|Pongal|Onam|Durga Puja|Karva Chauth|Raksha Bandhan|Janmashtami|Ram Navami|Maha Shivratri|Gudi Padwa|Baisakhi|Ganesh Chaturthi)\b/g,
      replacement: '*$1*',
      priority: 10,
      description: 'Format festival names'
    }
  ]

  /**
   * Apply intelligent formatting to plain text content
   */
  static formatContent(content: string, classLevel?: string): FormattedContent {
    let formattedContent = content
    const appliedRules: string[] = []
    const stats = {
      headingsFormatted: 0,
      properNounsFormatted: 0,
      definitionsFormatted: 0,
      quotationsFormatted: 0,
      datesFormatted: 0,
      keyTermsFormatted: 0
    }

    // Sort rules by priority
    const sortedRules = this.FORMATTING_RULES.sort((a, b) => a.priority - b.priority)

    // Apply formatting rules
    for (const rule of sortedRules) {
      const originalContent = formattedContent

      if (typeof rule.replacement === 'string') {
        formattedContent = formattedContent.replace(rule.pattern, rule.replacement)
      } else {
        formattedContent = formattedContent.replace(rule.pattern, rule.replacement)
      }

      // Track if rule was applied
      if (originalContent !== formattedContent) {
        appliedRules.push(rule.description)
        this.updateStats(rule, stats)
      }
    }

    // Apply class-level specific formatting
    if (classLevel) {
      formattedContent = this.applyClassLevelFormatting(formattedContent, classLevel)
    }

    return {
      content: formattedContent,
      appliedRules,
      formattingStats: stats
    }
  }

  /**
   * Apply class-level specific formatting adjustments
   */
  private static applyClassLevelFormatting(content: string, classLevel: string): string {
    const classNumber = parseInt(classLevel.replace(/[^0-9]/g, ''))
    
    if (classNumber <= 5) {
      // Primary level - simpler formatting, more visual cues
      content = content.replace(/\*\*([^*]+)\*\*/g, '🌟 **$1** 🌟') // Add stars to headings
      content = content.replace(/<u>([^<]+)<\/u>/g, '📝 <u>$1</u>') // Add note emoji to underlined text
    } else if (classNumber <= 8) {
      // Middle school - moderate formatting
      content = content.replace(/\*\*([^*]+)\*\*/g, '📚 **$1**') // Add book emoji to headings
    } else if (classNumber <= 10) {
      // Secondary level - standard formatting with exam focus
      content = content.replace(/\b(Board Exam|Annual Exam|Unit Test)\b/g, '🎯 **$1**')
    } else {
      // Senior secondary - advanced formatting with competitive exam focus
      content = content.replace(/\b(JEE|NEET|Competitive Exam)\b/g, '🏆 **$1**')
    }

    return content
  }

  /**
   * Update formatting statistics
   */
  private static updateStats(rule: FormattingRule, stats: FormattedContent['formattingStats']): void {
    if (rule.description.includes('heading')) {
      stats.headingsFormatted++
    } else if (rule.description.includes('figures') || rule.description.includes('places') || rule.description.includes('events') || rule.description.includes('works')) {
      stats.properNounsFormatted++
    } else if (rule.description.includes('definition') || rule.description.includes('meaning')) {
      stats.definitionsFormatted++
    } else if (rule.description.includes('quotation') || rule.description.includes('quotes')) {
      stats.quotationsFormatted++
    } else if (rule.description.includes('date') || rule.description.includes('year')) {
      stats.datesFormatted++
    } else if (rule.description.includes('key') || rule.description.includes('important')) {
      stats.keyTermsFormatted++
    }
  }

  /**
   * Extract and format key information blocks
   */
  static extractKeyInformation(content: string): Array<{type: string, content: string, formatted: string}> {
    const keyInfo: Array<{type: string, content: string, formatted: string}> = []

    // Extract definitions
    const definitionRegex = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:is defined as|means|refers to)\s+([^.!?]+[.!?])/g
    let match
    while ((match = definitionRegex.exec(content)) !== null) {
      keyInfo.push({
        type: 'definition',
        content: match[0],
        formatted: `**${match[1]}** is defined as <u>${match[2]}</u>`
      })
    }

    // Extract important facts
    const factRegex = /(Important|Note|Remember|Key Point|Fact):\s*([^.!?]+[.!?])/g
    while ((match = factRegex.exec(content)) !== null) {
      keyInfo.push({
        type: 'fact',
        content: match[0],
        formatted: `**${match[1]}:** <u>${match[2]}</u>`
      })
    }

    // Extract quotations
    const quoteRegex = /"([^"]+)"/g
    while ((match = quoteRegex.exec(content)) !== null) {
      keyInfo.push({
        type: 'quotation',
        content: match[0],
        formatted: `<u>"${match[1]}"</u>`
      })
    }

    return keyInfo
  }

  /**
   * Generate summary of formatting applied
   */
  static generateFormattingSummary(formatted: FormattedContent): string {
    const { formattingStats, appliedRules } = formatted
    const total = Object.values(formattingStats).reduce((sum, count) => sum + count, 0)
    
    if (total === 0) {
      return 'No special formatting applied to this content.'
    }

    const summary = [
      `Applied ${total} formatting enhancements:`,
      formattingStats.headingsFormatted > 0 ? `• ${formattingStats.headingsFormatted} headings formatted` : '',
      formattingStats.properNounsFormatted > 0 ? `• ${formattingStats.properNounsFormatted} proper nouns italicized` : '',
      formattingStats.definitionsFormatted > 0 ? `• ${formattingStats.definitionsFormatted} definitions highlighted` : '',
      formattingStats.quotationsFormatted > 0 ? `• ${formattingStats.quotationsFormatted} quotations underlined` : '',
      formattingStats.datesFormatted > 0 ? `• ${formattingStats.datesFormatted} dates emphasized` : '',
      formattingStats.keyTermsFormatted > 0 ? `• ${formattingStats.keyTermsFormatted} key terms highlighted` : ''
    ].filter(line => line !== '').join('\n')

    return summary
  }

  /**
   * Validate formatted content for accessibility
   */
  static validateAccessibility(content: string): Array<{issue: string, suggestion: string}> {
    const issues: Array<{issue: string, suggestion: string}> = []

    // Check for excessive formatting
    const boldCount = (content.match(/\*\*[^*]+\*\*/g) || []).length
    const italicCount = (content.match(/\*[^*]+\*/g) || []).length
    const underlineCount = (content.match(/<u>[^<]+<\/u>/g) || []).length

    if (boldCount > 10) {
      issues.push({
        issue: 'Too many bold elements may overwhelm screen readers',
        suggestion: 'Consider reducing bold formatting to only the most important terms'
      })
    }

    if (italicCount > 15) {
      issues.push({
        issue: 'Excessive italic formatting may reduce readability',
        suggestion: 'Limit italic formatting to proper nouns and emphasis'
      })
    }

    if (underlineCount > 8) {
      issues.push({
        issue: 'Too many underlined elements may confuse users',
        suggestion: 'Reserve underlining for definitions and quotations only'
      })
    }

    // Check for proper heading structure
    if (!content.includes('**') && content.length > 500) {
      issues.push({
        issue: 'Long content without headings may be difficult to navigate',
        suggestion: 'Consider adding section headings to break up the content'
      })
    }

    return issues
  }
}
