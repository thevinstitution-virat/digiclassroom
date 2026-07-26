/**
 * CBSE Answer Formatter - Professional Exam-Ready Response Formatting
 * Transforms RAG responses into CBSE-compliant answer formats
 */

export interface CBSEAnswerTemplate {
  marks: number;
  structure: 'short' | 'medium' | 'long';
  sections: {
    introduction: { required: boolean; wordLimit: number; purpose: string };
    mainBody: { points: number; wordLimitPerPoint: number; structure: string };
    conclusion: { required: boolean; wordLimit: number; purpose: string };
  };
  examTips: string[];
  timeAllocation: number; // minutes
}

export interface CBSEFormattingOptions {
  marks: number;
  questionType: 'definition' | 'explanation' | 'analysis' | 'comparison' | 'evaluation';
  subject: string;
  classLevel: number;
  includeExamTips?: boolean;
  includeTimeManagement?: boolean;
}

export interface FormattedCBSEAnswer {
  content: string;
  structure: CBSEAnswerTemplate;
  examGuidance: {
    timeAllocation: string;
    scoringTips: string[];
    commonMistakes: string[];
  };
  wordCount: number;
  estimatedScore: number;
}

export class CBSEAnswerFormatter {
  private static readonly CBSE_TEMPLATES: Record<string, CBSEAnswerTemplate> = {
    '1-mark': {
      marks: 1,
      structure: 'short',
      sections: {
        introduction: { required: false, wordLimit: 0, purpose: 'Not needed' },
        mainBody: { points: 1, wordLimitPerPoint: 15, structure: 'Direct answer only' },
        conclusion: { required: false, wordLimit: 0, purpose: 'Not needed' }
      },
      examTips: ['Write directly to the point', 'No elaboration needed', 'Use keywords from question'],
      timeAllocation: 1
    },

    '2-mark': {
      marks: 2,
      structure: 'short',
      sections: {
        introduction: { required: false, wordLimit: 0, purpose: 'Not needed' },
        mainBody: { points: 2, wordLimitPerPoint: 25, structure: 'Two distinct points' },
        conclusion: { required: false, wordLimit: 0, purpose: 'Not needed' }
      },
      examTips: ['Present two clear points', 'Use bullet points if helpful', 'Support with examples'],
      timeAllocation: 2
    },

    '3-mark': {
      marks: 3,
      structure: 'short',
      sections: {
        introduction: { required: false, wordLimit: 0, purpose: 'Optional brief context' },
        mainBody: { points: 3, wordLimitPerPoint: 40, structure: 'Three detailed points' },
        conclusion: { required: false, wordLimit: 0, purpose: 'Not needed' }
      },
      examTips: ['Three distinct points mandatory', 'Each point should be substantial', 'Use textbook terminology'],
      timeAllocation: 4
    },

    '5-mark': {
      marks: 5,
      structure: 'medium',
      sections: {
        introduction: { required: true, wordLimit: 30, purpose: 'Context setting and definition' },
        mainBody: { points: 3, wordLimitPerPoint: 60, structure: 'Detailed explanation with examples' },
        conclusion: { required: true, wordLimit: 30, purpose: 'Summary and significance' }
      },
      examTips: ['Must have introduction and conclusion', 'Use subheadings if helpful', 'Include relevant examples'],
      timeAllocation: 7
    },

    '6-mark': {
      marks: 6,
      structure: 'medium',
      sections: {
        introduction: { required: true, wordLimit: 40, purpose: 'Comprehensive context' },
        mainBody: { points: 4, wordLimitPerPoint: 70, structure: 'Detailed analysis with evidence' },
        conclusion: { required: true, wordLimit: 40, purpose: 'Synthesis and implications' }
      },
      examTips: ['Comprehensive coverage required', 'Use diagrams if applicable', 'Show analytical thinking'],
      timeAllocation: 9
    },

    '8-mark': {
      marks: 8,
      structure: 'long',
      sections: {
        introduction: { required: true, wordLimit: 50, purpose: 'Detailed context and scope' },
        mainBody: { points: 5, wordLimitPerPoint: 80, structure: 'In-depth analysis with multiple perspectives' },
        conclusion: { required: true, wordLimit: 50, purpose: 'Comprehensive summary and evaluation' }
      },
      examTips: ['Show deep understanding', 'Multiple perspectives needed', 'Use case studies if relevant'],
      timeAllocation: 12
    },

    '10-mark': {
      marks: 10,
      structure: 'long',
      sections: {
        introduction: { required: true, wordLimit: 60, purpose: 'Comprehensive introduction with thesis' },
        mainBody: { points: 6, wordLimitPerPoint: 100, structure: 'Detailed analysis with critical evaluation' },
        conclusion: { required: true, wordLimit: 60, purpose: 'Critical synthesis and future implications' }
      },
      examTips: ['Demonstrate critical thinking', 'Use multiple sources', 'Show evaluation skills'],
      timeAllocation: 15
    }
  };

  /**
   * Format content according to CBSE answer patterns
   */
  static formatAnswer(
    content: string,
    options: CBSEFormattingOptions
  ): FormattedCBSEAnswer {
    console.log(`🎯 Formatting CBSE answer: ${options.marks} marks, ${options.questionType}`);

    const template = this.getTemplate(options.marks);
    const formattedContent = this.applyTemplate(content, template, options);
    const examGuidance = this.generateExamGuidance(template, options);

    return {
      content: formattedContent,
      structure: template,
      examGuidance,
      wordCount: this.countWords(formattedContent),
      estimatedScore: this.estimateScore(formattedContent, template)
    };
  }

  /**
   * Get appropriate template for marks
   */
  private static getTemplate(marks: number): CBSEAnswerTemplate {
    const templateKey = `${marks}-mark`;
    
    if (this.CBSE_TEMPLATES[templateKey]) {
      return this.CBSE_TEMPLATES[templateKey];
    }

    // Find closest template
    if (marks <= 1)
  return this.CBSE_TEMPLATES['1-mark'];
    if (marks <= 2)
  return this.CBSE_TEMPLATES['2-mark'];
    if (marks <= 3)
  return this.CBSE_TEMPLATES['3-mark'];
    if (marks <= 5)
  return this.CBSE_TEMPLATES['5-mark'];
    if (marks <= 6)
  return this.CBSE_TEMPLATES['6-mark'];
    if (marks <= 8)
  return this.CBSE_TEMPLATES['8-mark'];
    
    return this.CBSE_TEMPLATES['10-mark'];
  }

  /**
   * Apply template structure to content
   */
  private static applyTemplate(
    content: string,
    template: CBSEAnswerTemplate,
    options: CBSEFormattingOptions
  ): string {
    let formattedAnswer = '';

    // Add introduction if required
    if (template.sections.introduction.required) {
      const introduction = this.generateIntroduction(content, options);
      formattedAnswer += `**Introduction:**\n${introduction}\n\n`;
    }

    // Format main body
    const mainBody = this.formatMainBody(content, template, options);
    formattedAnswer += `**Main Analysis:**\n${mainBody}\n\n`;

    // Add conclusion if required
    if (template.sections.conclusion.required) {
      const conclusion = this.generateConclusion(content, options);
      formattedAnswer += `**Conclusion:**\n${conclusion}\n\n`;
    }

    // Add exam tips if requested
    if (options.includeExamTips) {
      formattedAnswer += this.addExamTips(template);
    }

    return formattedAnswer.trim();
  }

  /**
   * Generate contextual introduction
   */
  private static generateIntroduction(content: string, options: CBSEFormattingOptions): string {
    const topic = this.extractMainTopic(content);
    
    switch (options.questionType) {
      case 'definition':
        return `${topic} is a fundamental concept in ${options.subject} that requires clear understanding for Class ${options.classLevel} students.`;
      
      case 'explanation':
        return `Understanding ${topic} is crucial for comprehending the broader concepts in ${options.subject}. This analysis examines the key aspects and implications.`;
      
      case 'analysis':
        return `${topic} presents multiple dimensions that require careful analysis. The following examination breaks down the various components and their relationships.`;
      
      case 'comparison':
        return `Comparing different aspects of ${topic} helps develop a comprehensive understanding of the concept and its applications.`;
      
      case 'evaluation':
        return `Evaluating ${topic} requires critical assessment of various factors, evidence, and implications within the context of ${options.subject}.`;
      
      default:
        return `${topic} is an important concept that requires detailed examination and understanding.`;
    }
  }

  /**
   * Format main body with proper structure
   */
  private static formatMainBody(
    content: string,
    template: CBSEAnswerTemplate,
    options: CBSEFormattingOptions
  ): string {
    const points = this.extractKeyPoints(content, template.sections.mainBody.points);
    let formattedBody = '';

    points.forEach((point, index) => {
      const pointNumber = index + 1;
      const formattedPoint = this.enhancePoint(point, options);
      
      if (template.marks >= 5) {
        formattedBody += `### ${pointNumber}. ${this.generatePointHeading(point, options)}\n`;
        formattedBody += `${formattedPoint}\n\n`;
      } else {
        formattedBody += `**${pointNumber}.** ${formattedPoint}\n\n`;
      }
    });

    return formattedBody.trim();
  }

  /**
   * Generate conclusion
   */
  private static generateConclusion(content: string, options: CBSEFormattingOptions): string {
    const topic = this.extractMainTopic(content);
    
    return `In conclusion, ${topic} represents a significant concept in ${options.subject} that demonstrates the interconnected nature of various elements. Understanding these relationships is essential for academic success and practical application.`;
  }

  /**
   * Extract main topic from content
   */
  private static extractMainTopic(content: string): string {
    // Simple extraction - in production, this could be more sophisticated
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    const firstSentence = sentences[0]?.trim() || 'the topic';
    
    // Extract key terms (simplified approach)
    const words = firstSentence.split(' ');
    const importantWords = words.filter(word => 
      word.length > 4 && 
      !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will'].includes(word.toLowerCase())
    );
    
    return importantWords.slice(0, 3).join(' ') || 'the concept';
  }

  /**
   * Extract key points from content
   */
  private static extractKeyPoints(content: string, targetPoints: number): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length <= targetPoints) {
      return sentences.map(s => s.trim());
    }

    // Distribute sentences evenly across target points
    const pointSize = Math.ceil(sentences.length / targetPoints);
    const points: string[] = [];

    for (let i = 0; i < targetPoints; i++) {
      const startIndex = i * pointSize;
      const endIndex = Math.min(startIndex + pointSize, sentences.length);
      const pointSentences = sentences.slice(startIndex, endIndex);
      points.push(pointSentences.join('. ').trim());
    }

    return points;
  }

  /**
   * Enhance individual point
   */
  private static enhancePoint(point: string, options: CBSEFormattingOptions): string {
    let enhanced = point.trim();
    
    // Add academic language
    if (!enhanced.match(/^(According to|Based on|The analysis shows|Evidence indicates)/)) {
      enhanced = `The analysis shows that ${enhanced.charAt(0).toLowerCase() + enhanced.slice(1)}`;
    }

    // Ensure proper ending
    if (!enhanced.endsWith('.')) {
      enhanced += '.';
    }

    return enhanced;
  }

  /**
   * Generate point heading
   */
  private static generatePointHeading(point: string, options: CBSEFormattingOptions): string {
    const words = point.split(' ').slice(0, 4);
    return words.join(' ').replace(/[.,:;]/g, '');
  }

  /**
   * Generate exam guidance
   */
  private static generateExamGuidance(
    template: CBSEAnswerTemplate,
    options: CBSEFormattingOptions
  ): FormattedCBSEAnswer['examGuidance'] {
    return {
      timeAllocation: `Allocate ${template.timeAllocation} minutes for this ${template.marks}-mark question`,
      scoringTips: [
        ...template.examTips,
        `Target ${Math.ceil(template.marks * 0.8)} marks minimum`,
        'Use textbook terminology for better scores'
      ],
      commonMistakes: this.getCommonMistakes(template.marks, options.questionType)
    };
  }

  /**
   * Get common mistakes for question type
   */
  private static getCommonMistakes(marks: number, questionType: string): string[] {
    const general = [
      'Not reading the question carefully',
      'Exceeding or falling short of word limit',
      'Poor time management'
    ];

    const specific = {
      'definition': ['Being too vague', 'Missing key characteristics'],
      'explanation': ['Lack of examples', 'Insufficient detail'],
      'analysis': ['Superficial treatment', 'Missing critical evaluation'],
      'comparison': ['One-sided comparison', 'Missing conclusion'],
      'evaluation': ['Lack of evidence', 'No balanced judgment']
    };

        // @ts-ignore
    return [...general, ...(specific[questionType] || [])];
  }

  /**
   * Add exam tips section
   */
  private static addExamTips(template: CBSEAnswerTemplate): string {
    return `\n**📝 Exam Tips:**\n${template.examTips.map(tip => `• ${tip}`).join('\n')}\n`;
  }

  /**
   * Count words in content
   */
  private static countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Estimate score based on content quality
   */
  private static estimateScore(content: string, template: CBSEAnswerTemplate): number {
    const wordCount = this.countWords(content);
    const expectedWords = template.sections.mainBody.points * template.sections.mainBody.wordLimitPerPoint;
    
    let score = template.marks;

    // Adjust based on word count
    if (wordCount < expectedWords * 0.7) {
      score *= 0.7; // Insufficient content
    } else if (wordCount > expectedWords * 1.5) {
      score *= 0.9; // Too verbose
    }

    return Math.round(score * 10) / 10;
  }
}
