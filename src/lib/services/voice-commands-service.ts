/**
 * Educational Voice Commands Service
 * Handles context-aware voice commands for educational workflows
 */

export interface VoiceCommand {
  id: string
  patterns: string[]
  action: string
  description: string
  category: 'explanation' | 'quiz' | 'summary' | 'navigation' | 'file' | 'general'
  requiresContext?: boolean
  cbseLevel?: string[]
}

export interface VoiceCommandResult {
  command: VoiceCommand | null
  confidence: number
  extractedText?: string
  parameters?: Record<string, any>
}

export class VoiceCommandsService {
  private commands: VoiceCommand[] = []

  constructor() {
    this.initializeCommands()
  }

  private initializeCommands(): void {
    this.commands = [
      // Explanation Commands (English and Hindi)
      {
        id: 'explain-concept',
        patterns: [
          'explain this',
          'explain this concept',
          'what is this',
          'tell me about this',
          'help me understand this',
          'समझाओ',
          'यह क्या है',
          'इसे समझाओ',
          'मुझे बताओ',
          'समझाने में मदद करो'
        ],
        action: 'explain',
        description: 'Explain the current concept or topic',
        category: 'explanation',
        requiresContext: true
      },
      {
        id: 'explain-step-by-step',
        patterns: [
          'explain step by step',
          'break this down',
          'show me the steps',
          'how do I solve this',
          'कदम दर कदम समझाओ',
          'चरणों में बताओ',
          'कैसे हल करूं',
          'स्टेप बाई स्टेप'
        ],
        action: 'explain_steps',
        description: 'Provide step-by-step explanation',
        category: 'explanation'
      },

      // Quiz Commands (English and Hindi)
      {
        id: 'create-quiz',
        patterns: [
          'create a quiz',
          'make a quiz',
          'test me',
          'quiz me on this',
          'give me questions',
          'क्विज बनाओ',
          'सवाल पूछो',
          'टेस्ट लो',
          'प्रश्न दो',
          'परीक्षा लो'
        ],
        action: 'create_quiz',
        description: 'Create a quiz based on current content',
        category: 'quiz',
        requiresContext: true
      },
      {
        id: 'practice-problems',
        patterns: [
          'give me practice problems',
          'more examples',
          'practice questions',
          'similar problems'
        ],
        action: 'practice_problems',
        description: 'Generate practice problems',
        category: 'quiz'
      },

      // Summary Commands (English and Hindi)
      {
        id: 'summarize-topic',
        patterns: [
          'summarize this',
          'give me a summary',
          'key points',
          'main points',
          'what are the important points',
          'सारांश दो',
          'संक्षेप में बताओ',
          'मुख्य बातें',
          'महत्वपूर्ण पॉइंट्स',
          'सार बताओ'
        ],
        action: 'summarize',
        description: 'Summarize the current topic',
        category: 'summary',
        requiresContext: true
      },

      // File Commands
      {
        id: 'read-file',
        patterns: [
          'read this file',
          'what does this say',
          'analyze this document',
          'extract text from this'
        ],
        action: 'read_file',
        description: 'Read and analyze uploaded file',
        category: 'file',
        requiresContext: true
      },

      // Navigation Commands
      {
        id: 'go-back',
        patterns: [
          'go back',
          'previous topic',
          'back to menu',
          'return'
        ],
        action: 'navigate_back',
        description: 'Navigate back to previous section',
        category: 'navigation'
      },
      {
        id: 'next-topic',
        patterns: [
          'next topic',
          'continue',
          'what\'s next',
          'move forward'
        ],
        action: 'navigate_next',
        description: 'Move to next topic',
        category: 'navigation'
      },

      // General Commands
      {
        id: 'repeat',
        patterns: [
          'repeat that',
          'say that again',
          'can you repeat',
          'repeat please'
        ],
        action: 'repeat',
        description: 'Repeat the last response',
        category: 'general'
      },
      {
        id: 'clear-chat',
        patterns: [
          'clear chat',
          'start over',
          'new conversation',
          'reset'
        ],
        action: 'clear_chat',
        description: 'Clear the current conversation',
        category: 'general'
      }
    ]
  }

  /**
   * Process voice input and detect commands
   */
  processVoiceInput(
    text: string,
    context?: {
      hasUploadedFile?: boolean
      currentTopic?: string
      classLevel?: string
      subject?: string
    }
  ): VoiceCommandResult {
    const normalizedText = text.toLowerCase().trim()
    
    let bestMatch: VoiceCommand | null = null
    let bestConfidence = 0
    let extractedText = text

    // Check each command for pattern matches
    for (const command of this.commands) {
      for (const pattern of command.patterns) {
        const confidence = this.calculatePatternMatch(normalizedText, pattern)
        
        if (confidence > bestConfidence && confidence > 0.7) {
          // Check context requirements
          if (command.requiresContext && !this.hasRequiredContext(command, context)) {
            continue
          }

          bestMatch = command
          bestConfidence = confidence
        }
      }
    }

    // Extract parameters based on command
    const parameters = bestMatch ? this.extractParameters(bestMatch, text, context) : {}

    return {
      command: bestMatch,
      confidence: bestConfidence,
      extractedText,
      parameters
    }
  }

  /**
   * Calculate pattern match confidence
   */
  private calculatePatternMatch(text: string, pattern: string): number {
    const textWords = text.split(/\s+/)
    const patternWords = pattern.split(/\s+/)
    
    // Exact match
    if (text === pattern) return 1.0
    
    // Contains pattern
    if (text.includes(pattern)) return 0.9
    
    // Word overlap
    const overlap = patternWords.filter(word => textWords.includes(word)).length
    const overlapRatio = overlap / patternWords.length
    
    // Fuzzy matching for common variations
    if (overlapRatio >= 0.8) return 0.85
    if (overlapRatio >= 0.6) return 0.75
    
    return 0
  }

  /**
   * Check if required context is available
   */
  private hasRequiredContext(command: VoiceCommand, context?: any): boolean {
    if (!command.requiresContext) return true
    if (!context) return false

    switch (command.action) {
      case 'explain':
      case 'summarize':
        return !!(context.currentTopic || context.hasUploadedFile)
      case 'create_quiz':
        return !!(context.currentTopic || context.hasUploadedFile || context.subject)
      case 'read_file':
        return !!context.hasUploadedFile
      default:
        return true
    }
  }

  /**
   * Extract parameters from voice command
   */
  private extractParameters(
    command: VoiceCommand,
    text: string,
    context?: any
  ): Record<string, any> {
    const parameters: Record<string, any> = {}

    // Add context information
    if (context) {
      parameters.context = context
    }

    // Extract specific parameters based on command
    switch (command.action) {
      case 'create_quiz':
        // Extract number of questions if mentioned
        const questionMatch = text.match(/(\d+)\s*(questions?|problems?)/i)
        if (questionMatch) {
          parameters.questionCount = parseInt(questionMatch[1])
        }
        break

      case 'explain':
        // Extract specific topic if mentioned
        const topicMatch = text.match(/explain\s+(.+)/i)
        if (topicMatch) {
          parameters.specificTopic = topicMatch[1].trim()
        }
        break

      case 'summarize':
        // Extract summary length preference
        if (text.includes('brief') || text.includes('short')) {
          parameters.length = 'brief'
        } else if (text.includes('detailed') || text.includes('long')) {
          parameters.length = 'detailed'
        }
        break
    }

    return parameters
  }

  /**
   * Get available commands for current context
   */
  getAvailableCommands(context?: any): VoiceCommand[] {
    return this.commands.filter(command => {
      if (!command.requiresContext) return true
      return this.hasRequiredContext(command, context)
    })
  }

  /**
   * Get command suggestions based on current context
   */
  getCommandSuggestions(context?: any): string[] {
    const availableCommands = this.getAvailableCommands(context)
    return availableCommands.map(cmd => cmd.patterns[0]).slice(0, 5)
  }

  /**
   * Format command for AI processing
   */
  formatCommandForAI(result: VoiceCommandResult): string {
    if (!result.command) {
      return result.extractedText || ''
    }

    const { command, parameters } = result
    
    let formattedCommand = `[VOICE_COMMAND: ${command.action}]`
    
    if (parameters?.specificTopic) {
      formattedCommand += ` Topic: ${parameters.specificTopic}`
    }
    
    if (parameters?.questionCount) {
      formattedCommand += ` Questions: ${parameters.questionCount}`
    }
    
    if (parameters?.length) {
      formattedCommand += ` Length: ${parameters.length}`
    }
    
    formattedCommand += ` Original: "${result.extractedText}"`
    
    return formattedCommand
  }
}

// Export singleton instance
export const voiceCommandsService = new VoiceCommandsService()
