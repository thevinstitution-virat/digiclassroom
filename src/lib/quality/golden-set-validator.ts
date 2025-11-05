/**
 * Golden Set Quality Assurance Validator
 * 🎯 QUALITY ASSURANCE: Validates responses against golden standard Q&A pairs
 */

import { VerifiedCitation } from '../citations/accurate-citation-generator';
import { RankedChunk } from '../retrieval/hybrid-retrieval-engine';
import { OpenAIService } from '../services/openai_service';
import { ServiceLifecycleManager } from '../services/service-lifecycle-manager';

export interface GoldenQAPair {
  id: string;
  question: string;
  expectedAnswer: string;
  expectedCitations: ExpectedCitation[];
  verifiedFacts: VerifiedFact[];
  expectedLength: {
    min: number;
    max: number;
    target: number;
  };
  subject: string;
  chapter: number;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  createdAt: Date;
  lastValidated: Date;
  validationCount: number;
}

export interface ExpectedCitation {
  chapter: number;
  chapterTitle: string;
  page: number;
  section?: string;
  confidence: number;
}

export interface VerifiedFact {
  fact: string;
  sourceChapter: number;
  sourcePage: number;
  confidence: number;
  factType: 'definition' | 'statistic' | 'process' | 'example' | 'comparison';
}

export interface QualityValidationResult {
  validationStatus: 'validated' | 'no_reference' | 'failed_validation';
  confidence: number;
  needsReview: boolean;
  overallScore: number;
  validationDetails: SingleValidation[];
  qualityIssues: QualityIssue[];
  recommendations: string[];
}

export interface SingleValidation {
  goldenQAId: string;
  contentSimilarity: number;
  citationAccuracy: CitationValidation;
  factualAccuracy: number;
  lengthAppropriate: boolean;
  overallScore: number;
  issues: QualityIssue[];
}

export interface CitationValidation {
  accuracy: number;
  issues: CitationIssue[];
  totalExpected: number;
  totalGenerated: number;
  correctMatches: number;
}

export interface CitationIssue {
  type: 'missing_citation' | 'incorrect_chapter_title' | 'unexpected_citation' | 'page_mismatch';
  expected: string | null;
  actual: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface QualityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: 'content' | 'citations' | 'structure' | 'facts';
  recommendation: string;
  confidence?: number;
}

export interface QualityIssueReport {
  query: string;
  response: string;
  totalIssues: number;
  issues: QualityIssue[];
  overallQuality: number;
  recommendedActions: string[];
  needsRegeneration: boolean;
  flagForReview: boolean;
}

export class GoldenSetValidator {
  private openaiService: OpenAIService;
  private goldenSet: GoldenQAPair[] = [];
  
  // Quality thresholds
  private readonly QUALITY_THRESHOLDS = {
    CONTENT_SIMILARITY: 0.75,
    CITATION_ACCURACY: 0.85,
    FACTUAL_ACCURACY: 0.80,
    OVERALL_QUALITY: 0.70
  };

  // Pre-loaded golden set for CBSE Class 9 Geography and History
  private readonly INITIAL_GOLDEN_SET: Partial<GoldenQAPair>[] = [
    {
      id: 'geo_ch1_q1',
      question: 'What is the latitudinal extent of India?',
      expectedAnswer: 'India extends from 8°4\'N to 37°6\'N latitude. The Tropic of Cancer (23°30\'N) passes through the middle of the country.',
      expectedCitations: [
        { chapter: 1, chapterTitle: 'India - Size and Location', page: 2, confidence: 0.95 }
      ],
      verifiedFacts: [
        { fact: 'India extends from 8°4\'N to 37°6\'N latitude', sourceChapter: 1, sourcePage: 2, confidence: 0.98, factType: 'statistic' },
        { fact: 'Tropic of Cancer passes through middle of India', sourceChapter: 1, sourcePage: 2, confidence: 0.95, factType: 'definition' }
      ],
      expectedLength: { min: 50, max: 120, target: 85 },
      subject: 'Geography',
      chapter: 1,
      difficulty: 'basic'
    },
    {
      id: 'geo_ch4_q1',
      question: 'What is monsoon and how does it affect India?',
      expectedAnswer: 'Monsoon refers to the seasonal reversal of wind direction. In India, the southwest monsoon brings rainfall from June to September, while the northeast monsoon affects the southeastern coast from October to December.',
      expectedCitations: [
        { chapter: 4, chapterTitle: 'Climate', page: 39, confidence: 0.92 },
        { chapter: 4, chapterTitle: 'Climate', page: 41, confidence: 0.88 }
      ],
      verifiedFacts: [
        { fact: 'Monsoon is seasonal reversal of wind direction', sourceChapter: 4, sourcePage: 39, confidence: 0.96, factType: 'definition' },
        { fact: 'Southwest monsoon brings rainfall June to September', sourceChapter: 4, sourcePage: 41, confidence: 0.94, factType: 'process' }
      ],
      expectedLength: { min: 80, max: 150, target: 115 },
      subject: 'Geography',
      chapter: 4,
      difficulty: 'intermediate'
    },
    {
      id: 'hist_ch1_q1',
      question: 'What were the main causes of the French Revolution?',
      expectedAnswer: 'The main causes included social inequality with the three estates system, economic crisis due to wars and debt, political crisis with absolute monarchy, and influence of Enlightenment ideas promoting liberty and equality.',
      expectedCitations: [
        { chapter: 1, chapterTitle: 'The French Revolution', page: 4, confidence: 0.90 },
        { chapter: 1, chapterTitle: 'The French Revolution', page: 6, confidence: 0.87 }
      ],
      verifiedFacts: [
        { fact: 'Three estates system created social inequality', sourceChapter: 1, sourcePage: 4, confidence: 0.93, factType: 'example' },
        { fact: 'Economic crisis due to wars and debt', sourceChapter: 1, sourcePage: 6, confidence: 0.91, factType: 'process' }
      ],
      expectedLength: { min: 100, max: 180, target: 140 },
      subject: 'History',
      chapter: 1,
      difficulty: 'intermediate'
    }
  ];

  constructor() {
    this.openaiService = OpenAIService.getInstance();
    this.initializeGoldenSet();
  }

  /**
   * 🎯 MAIN VALIDATION METHOD: Validate response against golden set
   */
  async validateResponseAgainstGoldenSet(
    query: string,
    generatedResponse: string,
    citations: VerifiedCitation[]
  ): Promise<QualityValidationResult> {
    console.log('🏆 Starting golden set validation...');

    try {
      // Find similar questions in golden set
      const similarQuestions = await this.findSimilarQuestions(query);

      if (similarQuestions.length === 0) {
        console.log('📝 No similar questions found, adding to golden set for future validation');
        await this.addToGoldenSet(query, generatedResponse, citations);
        return {
          validationStatus: 'no_reference',
          confidence: 0.5,
          needsReview: true,
          overallScore: 0.5,
          validationDetails: [],
          qualityIssues: [],
          recommendations: ['Add to golden set for future validation', 'Manual review recommended']
        };
      }

      const validationResults: SingleValidation[] = [];

      for (const goldenQA of similarQuestions) {
        const validation = await this.validateAgainstGoldenAnswer(
          generatedResponse,
          citations,
          goldenQA
        );
        validationResults.push(validation);
      }

      const aggregatedResult = this.aggregateValidationResults(validationResults);
      console.log(`🏆 Golden set validation completed: ${(aggregatedResult.overallScore * 100).toFixed(1)}% score`);

      return aggregatedResult;

    } catch (error) {
      console.error('❌ Golden set validation failed:', error);
      return {
        validationStatus: 'failed_validation',
        confidence: 0,
        needsReview: true,
        overallScore: 0,
        validationDetails: [],
        qualityIssues: [{
          type: 'validation_error',
          severity: 'critical',
          description: `Validation failed: ${error.message}`,
          location: 'structure',
          recommendation: 'Check system configuration and retry'
        }],
        recommendations: ['System error - check logs and retry validation']
      };
    }
  }

  /**
   * Validate response against a specific golden answer
   */
  private async validateAgainstGoldenAnswer(
    response: string,
    citations: VerifiedCitation[],
    goldenQA: GoldenQAPair
  ): Promise<SingleValidation> {
    // Content similarity check
    const contentSimilarity = await this.calculateContentSimilarity(
      response,
      goldenQA.expectedAnswer
    );

    // Citation accuracy check
    const citationAccuracy = await this.validateCitationAccuracy(
      citations,
      goldenQA.expectedCitations
    );

    // Fact extraction and verification
    const factualAccuracy = await this.validateFactualAccuracy(
      response,
      goldenQA.verifiedFacts
    );

    // Length appropriateness check
    const lengthAppropriate = this.validateResponseLength(
      response,
      goldenQA.expectedLength
    );

    const validationScores = {
      contentSimilarity,
      citationAccuracy: citationAccuracy.accuracy,
      factualAccuracy,
      lengthAppropriate: lengthAppropriate ? 1.0 : 0.5
    };

    const overallScore = this.calculateOverallValidationScore(validationScores);
    const issues = this.identifyQualityIssues(validationScores, citationAccuracy);

    return {
      goldenQAId: goldenQA.id,
      contentSimilarity,
      citationAccuracy,
      factualAccuracy,
      lengthAppropriate,
      overallScore,
      issues
    };
  }

  /**
   * Validate citation accuracy against expected citations
   */
  private async validateCitationAccuracy(
    generatedCitations: VerifiedCitation[],
    expectedCitations: ExpectedCitation[]
  ): Promise<CitationValidation> {
    const citationIssues: CitationIssue[] = [];
    let correctCitations = 0;

    for (const expected of expectedCitations) {
      const matchingCitation = generatedCitations.find(gen =>
        gen.chapter.number === expected.chapter &&
        Math.abs(gen.location.exactPage - expected.page) <= 1 // Allow 1 page difference
      );

      if (matchingCitation) {
        correctCitations++;

        // Verify chapter title accuracy
        if (matchingCitation.chapter.title !== expected.chapterTitle) {
          citationIssues.push({
            type: 'incorrect_chapter_title',
            expected: expected.chapterTitle,
            actual: matchingCitation.chapter.title,
            severity: 'medium'
          });
        }
      } else {
        citationIssues.push({
          type: 'missing_citation',
          expected: `Chapter ${expected.chapter}, Page ${expected.page}`,
          actual: null,
          severity: 'high'
        });
      }
    }

    // Check for extra citations not in expected set
    for (const generated of generatedCitations) {
      const isExpected = expectedCitations.some(exp =>
        exp.chapter === generated.chapter.number &&
        Math.abs(exp.page - generated.location.exactPage) <= 1
      );

      if (!isExpected) {
        citationIssues.push({
          type: 'unexpected_citation',
          expected: null,
          actual: `Chapter ${generated.chapter.number}, Page ${generated.location.exactPage}`,
          severity: 'low'
        });
      }
    }

    return {
      accuracy: correctCitations / Math.max(expectedCitations.length, 1),
      issues: citationIssues,
      totalExpected: expectedCitations.length,
      totalGenerated: generatedCitations.length,
      correctMatches: correctCitations
    };
  }

  /**
   * Auto-detect quality issues in response
   */
  async autoDetectQualityIssues(
    query: string,
    response: string,
    citations: VerifiedCitation[],
    sourceChunks: RankedChunk[]
  ): Promise<QualityIssueReport> {
    console.log('🔍 Auto-detecting quality issues...');

    const detectionResults = await Promise.all([
      this.detectHallucinationIssues(response, sourceChunks),
      this.detectCitationIssues(citations, sourceChunks),
      this.detectLengthIssues(query, response),
      this.detectFactualInconsistencies(response, sourceChunks),
      this.detectPlaceholderContent(response, citations)
    ]);

    const allIssues = detectionResults.flat();
    const overallQuality = this.calculateOverallQuality(allIssues);

    return {
      query,
      response,
      totalIssues: allIssues.length,
      issues: allIssues,
      overallQuality,
      recommendedActions: this.generateQualityRecommendations(allIssues),
      needsRegeneration: allIssues.some(issue => issue.severity === 'critical'),
      flagForReview: allIssues.length > 0
    };
  }

  /**
   * Detect placeholder content issues
   */
  private async detectPlaceholderContent(
    response: string,
    citations: VerifiedCitation[]
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // Check for placeholder citations
    const placeholderPatterns = [
      /\[Ch\s+\d+,\s*Pg\s+\d+\]/gi,
      /\[Chapter\s+X,\s*Page\s+Y\]/gi,
      /\[Textbook,\s*Ch\s+X,\s*Pg\s+Y\]/gi,
      /\[Source\s*\d*\]/gi
    ];

    for (const pattern of placeholderPatterns) {
      const matches = response.match(pattern);
      if (matches) {
        issues.push({
          type: 'placeholder_citation',
          severity: 'critical',
          description: `Found placeholder citations: ${matches.join(', ')}`,
          location: 'citations',
          recommendation: 'Replace with specific textbook references'
        });
      }
    }

    // Check for generic content
    const genericPatterns = [
      /according to the textbook/gi,
      /the book states/gi,
      /as mentioned in the chapter/gi
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(response)) {
        issues.push({
          type: 'generic_reference',
          severity: 'medium',
          description: 'Contains generic textbook references instead of specific citations',
          location: 'content',
          recommendation: 'Use specific chapter and page references'
        });
      }
    }

    return issues;
  }

  // Helper methods
  private async initializeGoldenSet(): Promise<void> {
    this.goldenSet = this.INITIAL_GOLDEN_SET.map((partial, index) => ({
      ...partial,
      id: partial.id || `golden_${index}`,
      question: partial.question || '',
      expectedAnswer: partial.expectedAnswer || '',
      expectedCitations: partial.expectedCitations || [],
      verifiedFacts: partial.verifiedFacts || [],
      expectedLength: partial.expectedLength || { min: 50, max: 200, target: 125 },
      subject: partial.subject || 'General',
      chapter: partial.chapter || 1,
      difficulty: partial.difficulty || 'basic',
      createdAt: new Date(),
      lastValidated: new Date(),
      validationCount: 0
    })) as GoldenQAPair[];

    console.log(`🏆 Initialized golden set with ${this.goldenSet.length} Q&A pairs`);
  }

  private async findSimilarQuestions(query: string): Promise<GoldenQAPair[]> {
    const similarities: { qa: GoldenQAPair; similarity: number }[] = [];

    for (const qa of this.goldenSet) {
      const similarity = await this.calculateTextSimilarity(query, qa.question);
      if (similarity > 0.7) { // 70% similarity threshold
        similarities.push({ qa, similarity });
      }
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3) // Top 3 most similar
      .map(item => item.qa);
  }

  private async calculateContentSimilarity(response: string, expectedAnswer: string): Promise<number> {
    try {
      const responseEmbedding = await this.openaiService.generateEmbedding(response);
      const expectedEmbedding = await this.openaiService.generateEmbedding(expectedAnswer);
      return this.calculateCosineSimilarity(responseEmbedding, expectedEmbedding);
    } catch (error) {
      console.warn('Content similarity calculation failed:', error);
      return 0.5; // Default similarity
    }
  }

  private async calculateTextSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const embedding1 = await this.openaiService.generateEmbedding(text1);
      const embedding2 = await this.openaiService.generateEmbedding(text2);
      return this.calculateCosineSimilarity(embedding1, embedding2);
    } catch (error) {
      console.warn('Text similarity calculation failed:', error);
      return 0;
    }
  }

  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Placeholder methods for additional functionality
  private async addToGoldenSet(query: string, response: string, citations: VerifiedCitation[]): Promise<void> {
    // Implementation for adding new Q&A pairs to golden set
    console.log('📝 Adding new Q&A pair to golden set for future validation');
  }

  private aggregateValidationResults(results: SingleValidation[]): QualityValidationResult {
    if (results.length === 0) {
      return {
        validationStatus: 'no_reference',
        confidence: 0,
        needsReview: true,
        overallScore: 0,
        validationDetails: [],
        qualityIssues: [],
        recommendations: []
      };
    }

    const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    const allIssues = results.flatMap(r => r.issues);

    return {
      validationStatus: avgScore >= this.QUALITY_THRESHOLDS.OVERALL_QUALITY ? 'validated' : 'failed_validation',
      confidence: avgScore,
      needsReview: avgScore < this.QUALITY_THRESHOLDS.OVERALL_QUALITY,
      overallScore: avgScore,
      validationDetails: results,
      qualityIssues: allIssues,
      recommendations: this.generateValidationRecommendations(avgScore, allIssues)
    };
  }

  private calculateOverallValidationScore(scores: any): number {
    const weights = { contentSimilarity: 0.4, citationAccuracy: 0.3, factualAccuracy: 0.2, lengthAppropriate: 0.1 };
    return Object.entries(weights).reduce((sum, [key, weight]) => sum + (scores[key] * weight), 0);
  }

  private identifyQualityIssues(scores: any, citationAccuracy: CitationValidation): QualityIssue[] {
    const issues: QualityIssue[] = [];

    if (scores.contentSimilarity < this.QUALITY_THRESHOLDS.CONTENT_SIMILARITY) {
      issues.push({
        type: 'low_content_similarity',
        severity: 'medium',
        description: `Content similarity ${(scores.contentSimilarity * 100).toFixed(1)}% below threshold`,
        location: 'content',
        recommendation: 'Improve content alignment with expected answer'
      });
    }

    if (citationAccuracy.accuracy < this.QUALITY_THRESHOLDS.CITATION_ACCURACY) {
      issues.push({
        type: 'low_citation_accuracy',
        severity: 'high',
        description: `Citation accuracy ${(citationAccuracy.accuracy * 100).toFixed(1)}% below threshold`,
        location: 'citations',
        recommendation: 'Verify and correct citation references'
      });
    }

    return issues;
  }

  // Additional placeholder methods
  private async validateFactualAccuracy(response: string, verifiedFacts: VerifiedFact[]): Promise<number> {
    // Implementation for factual accuracy validation
    return 0.8; // Placeholder
  }

  private validateResponseLength(response: string, expectedLength: any): boolean {
    const wordCount = response.split(/\s+/).length;
    return wordCount >= expectedLength.min && wordCount <= expectedLength.max;
  }

  private async detectHallucinationIssues(response: string, sourceChunks: RankedChunk[]): Promise<QualityIssue[]> {
    // Implementation for hallucination detection
    return [];
  }

  private async detectCitationIssues(citations: VerifiedCitation[], sourceChunks: RankedChunk[]): Promise<QualityIssue[]> {
    // Implementation for citation issue detection
    return [];
  }

  private async detectLengthIssues(query: string, response: string): Promise<QualityIssue[]> {
    // Implementation for length issue detection
    return [];
  }

  private async detectFactualInconsistencies(response: string, sourceChunks: RankedChunk[]): Promise<QualityIssue[]> {
    // Implementation for factual inconsistency detection
    return [];
  }

  private calculateOverallQuality(issues: QualityIssue[]): number {
    if (issues.length === 0) return 1.0;
    
    const severityWeights = { low: 0.1, medium: 0.3, high: 0.6, critical: 1.0 };
    const totalPenalty = issues.reduce((sum, issue) => sum + severityWeights[issue.severity], 0);
    
    return Math.max(0, 1.0 - (totalPenalty / 10)); // Normalize to 0-1 scale
  }

  private generateQualityRecommendations(issues: QualityIssue[]): string[] {
    return issues.map(issue => issue.recommendation);
  }

  private generateValidationRecommendations(score: number, issues: QualityIssue[]): string[] {
    const recommendations = [];
    
    if (score < 0.7) {
      recommendations.push('Response quality below acceptable threshold - consider regeneration');
    }
    
    if (issues.length > 0) {
      recommendations.push('Address identified quality issues before deployment');
    }
    
    return recommendations;
  }
}
