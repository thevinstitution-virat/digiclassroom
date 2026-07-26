/**
 * Response Enhancement Pipeline - Comprehensive content improvement system
 * Coordinates all enhancement modules for professional, exam-ready responses
 */

import { CBSEAnswerFormatter, CBSEFormattingOptions, FormattedCBSEAnswer } from '@/lib/agents/cbse-answer-formatter';
import { AcademicToneConverter, ToneConversionOptions, ConversionResult } from './academic-tone-converter';
import { IntelligentFormatter, FormattingOptions } from '../formatting/intelligent-formatter';
import { ExamStrategyIntegrator, ExamStrategyOptions, ExamStrategyResult } from './exam-strategy-integrator';
import { MemoryAidGenerator, MemoryAidOptions, MemoryAidResult } from './memory-aid-generator';

export interface EnhancementRequest {
  content: string;
  questionType: 'definition' | 'explanation' | 'analysis' | 'comparison' | 'evaluation';
  marks: number;
  subject: string;
  classLevel: number;
  citations?: string[];
  options?: {
    includeExamTips?: boolean;
    includeTimeManagement?: boolean;
    enhanceReadability?: boolean;
    optimizeForRevision?: boolean;
    addMemoryAids?: boolean;
  };
}

export interface EnhancementResult {
  originalContent: string;
  enhancedContent: string;
  cbseFormatted: FormattedCBSEAnswer;
  toneConversion: ConversionResult;
  examStrategy?: ExamStrategyResult;
  memoryAids?: MemoryAidResult;
  qualityMetrics: {
    readabilityScore: number;
    academicToneScore: number;
    examReadinessScore: number;
    overallQuality: number;
  };
  processingMetadata: {
    enhancementSteps: string[];
    processingTime: number;
    wordCountImprovement: number;
    structureEnhancements: string[];
  };
  examGuidance: {
    timeAllocation: string;
    scoringStrategy: string[];
    revisionTips: string[];
  };
}

export class ResponseEnhancementPipeline {
  /**
   * Main enhancement method - processes content through all enhancement stages
   */
  static async enhanceResponse(request: EnhancementRequest): Promise<EnhancementResult> {
    const startTime = Date.now();
    console.log(`🚀 Starting response enhancement pipeline for ${request.marks}-mark ${request.questionType}`);

    const enhancementSteps: string[] = [];
    const structureEnhancements: string[] = [];

    // Stage 1: Academic Tone Conversion
    console.log('📝 Stage 1: Academic tone conversion');
    const toneOptions: ToneConversionOptions = {
      academicLevel: request.classLevel <= 10 ? 'school' : 'undergraduate',
      subject: request.subject,
      targetAudience: 'student',
      formalityLevel: request.marks >= 8 ? 'formal' : 'moderate'
    };

    const toneConversion = AcademicToneConverter.convertToAcademicTone(
      request.content,
      toneOptions
    );
    enhancementSteps.push('Academic tone conversion applied');

    // Stage 2: Citation Integration
    console.log('📚 Stage 2: Citation integration');
    let contentWithCitations = toneConversion.enhancedContent;
    if (request.citations && request.citations.length > 0) {
      contentWithCitations = AcademicToneConverter.integrateCitationsNaturally(
        contentWithCitations,
        request.citations
      );
      enhancementSteps.push('Citations integrated naturally');
    }

    // Stage 3: CBSE Formatting
    console.log('🎯 Stage 3: CBSE answer formatting');
    const cbseOptions: CBSEFormattingOptions = {
      marks: request.marks,
      questionType: request.questionType,
      subject: request.subject,
      classLevel: request.classLevel,
      includeExamTips: request.options?.includeExamTips ?? true,
      includeTimeManagement: request.options?.includeTimeManagement ?? true
    };

    const cbseFormatted = CBSEAnswerFormatter.formatAnswer(
      contentWithCitations,
      cbseOptions
    );
    enhancementSteps.push('CBSE answer format applied');
    structureEnhancements.push(`Applied ${cbseFormatted.structure.structure} answer structure`);

    // Stage 4: Readability Enhancement
    console.log('📖 Stage 4: Readability optimization');
    let finalContent = cbseFormatted.content;
    if (request.options?.enhanceReadability) {
      finalContent = this.enhanceReadability(finalContent, request.classLevel);
      enhancementSteps.push('Readability optimization applied');
    }

    // Stage 5: Revision Optimization
    console.log('📋 Stage 5: Revision optimization');
    if (request.options?.optimizeForRevision) {
      finalContent = this.optimizeForRevision(finalContent, request.marks);
      enhancementSteps.push('Revision optimization applied');
      structureEnhancements.push('Added revision-friendly formatting');
    }

    // Stage 6: Exam Strategy Integration
    console.log('🎯 Stage 6: Exam strategy integration');
    let examStrategy: ExamStrategyResult | undefined;
    if (request.options?.includeExamTips || request.options?.includeTimeManagement) {
      const strategyOptions: ExamStrategyOptions = {
        marks: request.marks,
        questionType: request.questionType,
        subject: request.subject,
        classLevel: request.classLevel,
        includeTimeManagement: request.options?.includeTimeManagement,
        includeScoringTips: request.options?.includeExamTips,
        includeCommonMistakes: true
      };

      examStrategy = ExamStrategyIntegrator.integrateExamStrategies(finalContent, strategyOptions);
      finalContent = examStrategy.enhancedContent;
      enhancementSteps.push('Exam strategy integration applied');
      structureEnhancements.push('Added exam guidance and time management tips');
    }

    // Stage 7: Memory Aids Integration
    console.log('🧠 Stage 7: Memory aids integration');
    let memoryAids: MemoryAidResult | undefined;
    if (request.options?.addMemoryAids) {
      const memoryOptions: MemoryAidOptions = {
        subject: request.subject,
        classLevel: request.classLevel,
        contentType: this.determineContentType(request.questionType),
        keyTerms: this.extractKeyTermsFromContent(finalContent),
        difficulty: request.classLevel >= 10 ? 'advanced' : 'intermediate'
      };

      memoryAids = MemoryAidGenerator.generateMemoryAids(finalContent, memoryOptions);
      finalContent = this.integrateMemoryAids(finalContent, memoryAids);
      enhancementSteps.push('Memory aids integrated');
      structureEnhancements.push('Added mnemonics and recall techniques');
    }

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(
      request.content,
      finalContent,
      toneConversion,
      cbseFormatted
    );

    // Generate exam guidance
    const examGuidance = this.generateExamGuidance(cbseFormatted, request);

    const processingTime = Date.now() - startTime;
    console.log(`✅ Enhancement pipeline completed in ${processingTime}ms`);

    return {
      originalContent: request.content,
      enhancedContent: finalContent,
      cbseFormatted,
      toneConversion,
      examStrategy,
      memoryAids,
      qualityMetrics,
      processingMetadata: {
        enhancementSteps,
        processingTime,
        wordCountImprovement: this.calculateWordCountImprovement(request.content, finalContent),
        structureEnhancements
      },
      examGuidance
    };
  }

  /**
   * Enhance readability for specific class levels
   */
  private static enhanceReadability(content: string, classLevel: number): string {
    let enhanced = content;

    if (classLevel <= 8) {
      // Simplify complex sentences for middle school
      enhanced = enhanced.replace(/\b(consequently|nevertheless|furthermore)\b/gi, (match) => {
        const simpler = {
          'consequently': 'as a result',
          'nevertheless': 'however',
          'furthermore': 'also'
        };
        // @ts-ignore
        return simpler[match.toLowerCase()] || match;
      });
    }

    // Add visual breaks for better readability
    enhanced = enhanced.replace(/\*\*([^*]+)\*\*/g, '**$1**\n'); // Add line breaks after headings
    
    // Improve list formatting
    enhanced = enhanced.replace(/(\d+\.\s)/g, '\n$1'); // Add line breaks before numbered points

    return enhanced;
  }

  /**
   * Optimize content for revision
   */
  private static optimizeForRevision(content: string, marks: number): string {
    let optimized = content;

    // Add quick revision points for higher mark questions
    if (marks >= 5) {
      const keyPoints = this.extractKeyPoints(content);
      if (keyPoints.length > 0) {
        optimized += '\n\n**📝 Quick Revision Points:**\n';
        keyPoints.forEach((point, index) => {
          optimized += `• ${point}\n`;
        });
      }
    }

    // Add memory hooks
    optimized += '\n\n**🎯 Remember:** Focus on the main concepts and their relationships for exam success.\n';

    return optimized;
  }

  /**
   * Add memory aids to content
   */
  private static addMemoryAids(content: string, subject: string): string {
    let enhanced = content;

    // Subject-specific memory techniques
    const memoryTechniques = {
      'Economics': [
        '💡 **Memory Tip:** Use the acronym PLIC (Production, Labor, Investment, Consumption) for economic factors',
        '🔗 **Connection:** Link economic concepts to daily life examples for better retention'
      ],
      'Geography': [
        '🗺️ **Memory Tip:** Use location-based mnemonics for geographical features',
        '🌍 **Visualization:** Create mental maps to remember spatial relationships'
      ],
      'History': [
        '📅 **Timeline Tip:** Create chronological chains to remember historical events',
        '👥 **Character Method:** Associate events with key historical figures'
      ],
      'Political Science': [
        '🏛️ **Structure Tip:** Use building blocks analogy for governmental structures',
        '⚖️ **Balance Method:** Remember checks and balances through visual diagrams'
      ]
    };

        // @ts-ignore
    const techniques = memoryTechniques[subject] || [
      '🧠 **Memory Tip:** Create associations between new concepts and familiar ideas',
      '📝 **Study Tip:** Practice active recall by explaining concepts in your own words'
    ];

    enhanced += '\n\n**🧠 Memory Aids:**\n';
        // @ts-ignore
    techniques.forEach(technique => {
      enhanced += `${technique}\n`;
    });

    return enhanced;
  }

  /**
   * Extract key points for revision
   */
  private static extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    // Look for sentences with key indicators
    const keyIndicators = ['important', 'significant', 'crucial', 'essential', 'main', 'primary', 'key'];
    
    const keyPoints = sentences.filter(sentence => 
      keyIndicators.some(indicator => sentence.toLowerCase().includes(indicator))
    ).slice(0, 3); // Limit to 3 key points

    return keyPoints.map(point => point.trim().replace(/^\*\*|\*\*$/g, ''));
  }

  /**
   * Calculate quality metrics
   */
  private static calculateQualityMetrics(
    original: string,
    enhanced: string,
    toneConversion: ConversionResult,
    cbseFormatted: FormattedCBSEAnswer
  ): EnhancementResult['qualityMetrics'] {
    const examReadinessScore = this.calculateExamReadinessScore(enhanced, cbseFormatted);
    
    const overallQuality = Math.round(
      (toneConversion.readabilityScore * 0.3 +
       toneConversion.academicToneScore * 0.3 +
       examReadinessScore * 0.4)
    );

    return {
      readabilityScore: toneConversion.readabilityScore,
      academicToneScore: toneConversion.academicToneScore,
      examReadinessScore,
      overallQuality
    };
  }

  /**
   * Calculate exam readiness score
   */
  private static calculateExamReadinessScore(
    content: string,
    cbseFormatted: FormattedCBSEAnswer
  ): number {
    let score = 50; // Base score

    // Check for proper structure
    if (content.includes('**Introduction:**')) score += 15;
    if (content.includes('**Main Analysis:**')) score += 15;
    if (content.includes('**Conclusion:**')) score += 10;

    // Check for academic language
    const academicTerms = ['demonstrates', 'indicates', 'analysis', 'evidence', 'therefore'];
    const foundTerms = academicTerms.filter(term => content.toLowerCase().includes(term));
    score += foundTerms.length * 2;

    // Check word count appropriateness
    const wordCount = content.split(/\s+/).length;
    const expectedRange = cbseFormatted.structure.marks * 50; // Rough estimate
    if (wordCount >= expectedRange * 0.8 && wordCount <= expectedRange * 1.2) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate word count improvement
   */
  private static calculateWordCountImprovement(original: string, enhanced: string): number {
    const originalCount = original.split(/\s+/).length;
    const enhancedCount = enhanced.split(/\s+/).length;
    return enhancedCount - originalCount;
  }

  /**
   * Generate exam guidance
   */
  private static generateExamGuidance(
    cbseFormatted: FormattedCBSEAnswer,
    request: EnhancementRequest
  ): EnhancementResult['examGuidance'] {
    return {
      timeAllocation: cbseFormatted.examGuidance.timeAllocation,
      scoringStrategy: [
        ...cbseFormatted.examGuidance.scoringTips,
        `Target structure: ${cbseFormatted.structure.structure} format`,
        'Use specific examples from textbook when possible'
      ],
      revisionTips: [
        'Focus on key concepts and their relationships',
        'Practice writing within time limits',
        'Review common mistakes for this question type',
        'Create summary notes for quick revision'
      ]
    };
  }

  /**
   * Quick enhancement for existing responses (lightweight version)
   */
  static quickEnhance(content: string, marks: number, subject: string): string {
    console.log(`⚡ Quick enhancement for ${marks}-mark question`);

    // Apply basic academic tone improvements
    let enhanced = content;

    // Basic transition improvements
    enhanced = enhanced.replace(/\bAlso\b/g, 'Furthermore');
    enhanced = enhanced.replace(/\bBut\b/g, 'However');
    enhanced = enhanced.replace(/\bSo\b/g, 'Therefore');

    // Add basic structure for longer answers
    if (marks >= 5 && !enhanced.includes('**')) {
      const sentences = enhanced.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length >= 3) {
        enhanced = `**Analysis:**\n${enhanced}\n\n**Conclusion:**\nThis demonstrates the key aspects of the concept in ${subject}.`;
      }
    }

    return enhanced;
  }

  /**
   * Determine content type from question type
   */
  private static determineContentType(questionType: string): MemoryAidOptions['contentType'] {
    switch (questionType) {
      case 'definition': return 'definition';
      case 'comparison': return 'comparison';
      case 'analysis': return 'facts';
      case 'explanation': return 'process';
      case 'evaluation': return 'facts';
      default: return 'facts';
    }
  }

  /**
   * Extract key terms from content for memory aids
   */
  private static extractKeyTermsFromContent(content: string): string[] {
    // Look for bold terms, capitalized terms, and important phrases
    const boldTerms = content.match(/\*\*([^*]+)\*\*/g) || [];
    const keyTerms = boldTerms.map(term => term.replace(/\*\*/g, ''));

    // Add important words from headings
    const headings = content.match(/^#+\s+(.+)$/gm) || [];
    const headingTerms = headings.map(heading =>
      heading.replace(/^#+\s+/, '').split(' ').filter(word => word.length > 4)
    ).flat();

    return [...new Set([...keyTerms, ...headingTerms])].slice(0, 6);
  }

  /**
   * Integrate memory aids into content
   */
  private static integrateMemoryAids(content: string, memoryAids: MemoryAidResult): string {
    let enhanced = content;

    if (memoryAids.mnemonics.length > 0) {
      enhanced += '\n\n**🧠 Memory Aids:**\n';
      enhanced += memoryAids.mnemonics.slice(0, 2).map(mnemonic => `${mnemonic}`).join('\n') + '\n';
    }

    if (memoryAids.visualAssociations.length > 0) {
      enhanced += '\n**👁️ Visual Techniques:**\n';
      enhanced += memoryAids.visualAssociations.slice(0, 2).map(visual => `${visual}`).join('\n') + '\n';
    }

    if (memoryAids.recallTechniques.length > 0) {
      enhanced += '\n**🔄 Recall Techniques:**\n';
      enhanced += memoryAids.recallTechniques.slice(0, 2).map(technique => `${technique}`).join('\n') + '\n';
    }

    return enhanced;
  }
}
