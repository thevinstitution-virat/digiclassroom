/**
 * Exam Strategy Integrator - Add time management, scoring tips, and mistake prevention
 * Enhances responses with practical exam guidance for CBSE students
 */

export interface ExamStrategyOptions {
  marks: number;
  questionType: 'definition' | 'explanation' | 'analysis' | 'comparison' | 'evaluation';
  subject: string;
  classLevel: number;
  timeLimit?: number; // Total exam time in minutes
  includeTimeManagement?: boolean;
  includeScoringTips?: boolean;
  includeCommonMistakes?: boolean;
}

export interface ExamStrategyResult {
  enhancedContent: string;
  timeManagement: {
    recommendedTime: number;
    timeBreakdown: {
      reading: number;
      planning: number;
      writing: number;
      review: number;
    };
    timeManagementTips: string[];
  };
  scoringStrategy: {
    maxPossibleScore: number;
    targetScore: number;
    scoringTips: string[];
    keywordImportance: string[];
  };
  mistakePrevention: {
    commonMistakes: string[];
    preventionStrategies: string[];
    checklistItems: string[];
  };
}

export class ExamStrategyIntegrator {
  private static readonly TIME_ALLOCATION_MATRIX = {
    // Time per mark in minutes
    1: 1.5,
    2: 2.5,
    3: 4,
    5: 7,
    6: 9,
    8: 12,
    10: 15
  };

  private static readonly SCORING_STRATEGIES = {
    'definition': {
      keyElements: ['Clear definition', 'Key characteristics', 'Example if required'],
      scoringTips: [
        'Use exact textbook terminology',
        'Include all essential components',
        'Provide relevant example if marks allow'
      ]
    },
    'explanation': {
      keyElements: ['Introduction', 'Detailed explanation', 'Examples', 'Conclusion'],
      scoringTips: [
        'Structure your answer clearly',
        'Use subheadings for longer answers',
        'Include specific examples from textbook'
      ]
    },
    'analysis': {
      keyElements: ['Introduction', 'Multiple perspectives', 'Evidence', 'Critical evaluation'],
      scoringTips: [
        'Show analytical thinking',
        'Present multiple viewpoints',
        'Support with evidence from textbook'
      ]
    },
    'comparison': {
      keyElements: ['Introduction', 'Similarities', 'Differences', 'Conclusion'],
      scoringTips: [
        'Use comparison table if helpful',
        'Balance similarities and differences',
        'Draw meaningful conclusions'
      ]
    },
    'evaluation': {
      keyElements: ['Criteria establishment', 'Evidence assessment', 'Balanced judgment'],
      scoringTips: [
        'Establish clear evaluation criteria',
        'Present balanced arguments',
        'Make justified conclusions'
      ]
    }
  };

  /**
   * Integrate exam strategies into content
   */
  static integrateExamStrategies(
    content: string,
    options: ExamStrategyOptions
  ): ExamStrategyResult {
    console.log(`🎯 Integrating exam strategies for ${options.marks}-mark ${options.questionType}`);

    const timeManagement = this.generateTimeManagement(options);
    const scoringStrategy = this.generateScoringStrategy(options);
    const mistakePrevention = this.generateMistakePrevention(options);

    let enhancedContent = content;

    // Add exam guidance sections
    if (options.includeTimeManagement) {
      enhancedContent += this.addTimeManagementSection(timeManagement);
    }

    if (options.includeScoringTips) {
      enhancedContent += this.addScoringTipsSection(scoringStrategy);
    }

    if (options.includeCommonMistakes) {
      enhancedContent += this.addMistakePreventionSection(mistakePrevention);
    }

    return {
      enhancedContent,
      timeManagement,
      scoringStrategy,
      mistakePrevention
    };
  }

  /**
   * Generate time management guidance
   */
  private static generateTimeManagement(options: ExamStrategyOptions): ExamStrategyResult['timeManagement'] {
    const baseTime = this.TIME_ALLOCATION_MATRIX[options.marks] || options.marks * 1.5;
    
    // Adjust for question complexity
    const complexityMultiplier = {
      'definition': 0.8,
      'explanation': 1.0,
      'analysis': 1.2,
      'comparison': 1.1,
      'evaluation': 1.3
    };

    const recommendedTime = Math.round(baseTime * complexityMultiplier[options.questionType]);

    // Time breakdown
    const timeBreakdown = {
      reading: Math.max(1, Math.round(recommendedTime * 0.1)), // 10% for reading
      planning: Math.max(1, Math.round(recommendedTime * 0.15)), // 15% for planning
      writing: Math.round(recommendedTime * 0.65), // 65% for writing
      review: Math.max(1, Math.round(recommendedTime * 0.1)) // 10% for review
    };

    const timeManagementTips = [
      `Allocate exactly ${recommendedTime} minutes for this ${options.marks}-mark question`,
      `Spend ${timeBreakdown.reading} minute(s) reading and understanding the question`,
      `Use ${timeBreakdown.planning} minute(s) to plan your answer structure`,
      `Write for ${timeBreakdown.writing} minutes with focus on key points`,
      `Reserve ${timeBreakdown.review} minute(s)
  for final review and corrections`
    ];

    // Add subject-specific tips
    if (options.subject.toLowerCase().includes('economics')) {
      timeManagementTips.push('Use diagrams to save time while explaining economic concepts');
    } else if (options.subject.toLowerCase().includes('geography')) {
      timeManagementTips.push('Draw labeled diagrams where applicable to enhance your answer');
    }

    return {
      recommendedTime,
      timeBreakdown,
      timeManagementTips
    };
  }

  /**
   * Generate scoring strategy
   */
  private static generateScoringStrategy(options: ExamStrategyOptions): ExamStrategyResult['scoringStrategy'] {
    const strategy = this.SCORING_STRATEGIES[options.questionType];
    const maxPossibleScore = options.marks;
    const targetScore = Math.ceil(options.marks * 0.85); // Target 85% of marks

    const scoringTips = [
      ...strategy.scoringTips,
      `Target minimum ${targetScore} marks out of ${maxPossibleScore}`,
      'Use bullet points for clarity in longer answers',
      'Underline or highlight key terms for examiner attention'
    ];

    // Add class-specific tips
    if (options.classLevel >= 10) {
      scoringTips.push('Show depth of understanding through analysis');
      scoringTips.push('Connect concepts to broader themes where relevant');
    } else {
      scoringTips.push('Focus on clear, simple explanations');
      scoringTips.push('Use examples from daily life to illustrate concepts');
    }

    const keywordImportance = this.generateKeywordGuidance(options.subject, options.questionType);

    return {
      maxPossibleScore,
      targetScore,
      scoringTips,
      keywordImportance
    };
  }

  /**
   * Generate mistake prevention guidance
   */
  private static generateMistakePrevention(options: ExamStrategyOptions): ExamStrategyResult['mistakePrevention'] {
    const commonMistakes = [
      'Not reading the question carefully and missing key requirements',
      'Writing too much for low-mark questions or too little for high-mark questions',
      'Poor time management leading to incomplete answers',
      'Using informal language instead of subject-specific terminology',
      'Not providing examples when required',
      'Failing to structure the answer according to marks allocated'
    ];

    // Add question-type specific mistakes
    const typeSpecificMistakes = {
      'definition': ['Being too vague or too detailed', 'Missing key characteristics'],
      'explanation': ['Lack of logical flow', 'Insufficient examples'],
      'analysis': ['Superficial treatment', 'Missing critical evaluation'],
      'comparison': ['One-sided comparison', 'No clear conclusion'],
      'evaluation': ['Lack of criteria', 'Biased judgment']
    };

    commonMistakes.push(...typeSpecificMistakes[options.questionType]);

    const preventionStrategies = [
      'Read the question twice before starting to write',
      'Underline key instruction words (explain, analyze, compare, etc.)',
      'Plan your answer structure before writing',
      'Check word count and time regularly while writing',
      'Use subject-specific vocabulary throughout',
      'Review your answer for completeness before moving on'
    ];

    const checklistItems = [
      '✓ Question fully understood and all parts addressed',
      '✓ Answer structured according to mark allocation',
      '✓ Key terms and concepts included',
      '✓ Examples provided where appropriate',
      '✓ Conclusion drawn (for higher mark questions)',
      '✓ Handwriting legible and presentation neat'
    ];

    return {
      commonMistakes,
      preventionStrategies,
      checklistItems
    };
  }

  /**
   * Generate keyword guidance for subject
   */
  private static generateKeywordGuidance(subject: string, questionType: string): string[] {
    const subjectKeywords = {
      'Economics': ['economic growth', 'poverty', 'unemployment', 'development', 'resources'],
      'Geography': ['physical features', 'climate', 'vegetation', 'population', 'resources'],
      'History': ['chronology', 'causes', 'effects', 'significance', 'sources'],
      'Political Science': ['democracy', 'constitution', 'rights', 'institutions', 'governance']
    };

    const keywords = subjectKeywords[subject] || ['concept', 'definition', 'example', 'significance'];
    
    return [
      `Use subject-specific terms: ${keywords.slice(0, 3).join(', ')}`,
      'Include textbook terminology for better scores',
      'Define technical terms when first used',
      'Use connecting words to show relationships between ideas'
    ];
  }

  /**
   * Add time management section to content
   */
  private static addTimeManagementSection(timeManagement: ExamStrategyResult['timeManagement']): string {
    return `\n\n**⏰ Time Management Strategy:**\n` +
           `${timeManagement.timeManagementTips.map(tip => `• ${tip}`).join('\n')}\n`;
  }

  /**
   * Add scoring tips section to content
   */
  private static addScoringTipsSection(scoringStrategy: ExamStrategyResult['scoringStrategy']): string {
    return `\n\n**🎯 Scoring Strategy:**\n` +
           `${scoringStrategy.scoringTips.map(tip => `• ${tip}`).join('\n')}\n` +
           `\n**📝 Keyword Guidance:**\n` +
           `${scoringStrategy.keywordImportance.map(tip => `• ${tip}`).join('\n')}\n`;
  }

  /**
   * Add mistake prevention section to content
   */
  private static addMistakePreventionSection(mistakePrevention: ExamStrategyResult['mistakePrevention']): string {
    return `\n\n**⚠️ Common Mistakes to Avoid:**\n` +
           `${mistakePrevention.commonMistakes.slice(0, 4).map(mistake => `• ${mistake}`).join('\n')}\n` +
           `\n**✅ Final Checklist:**\n` +
           `${mistakePrevention.checklistItems.map(item => `${item}`).join('\n')}\n`;
  }

  /**
   * Quick strategy addition for existing content
   */
  static addQuickStrategy(content: string, marks: number, questionType: string): string {
    const timeAllocation = this.TIME_ALLOCATION_MATRIX[marks] || marks * 1.5;
    
    return content + `\n\n**📋 Quick Exam Tips:**\n` +
           `• Time allocation: ${timeAllocation} minutes\n` +
           `• Target score: ${Math.ceil(marks * 0.85)}/${marks} marks\n` +
           `• Use specific examples and textbook terminology\n` +
           `• Structure your answer clearly with proper headings\n`;
  }
}
