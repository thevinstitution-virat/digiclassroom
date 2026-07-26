/**
 * Query Type Detector for DigiClassroom Pro
 * Intelligently detects visualization type from user queries
 * Supports statistical charts, diagrams, and educational visualizations
 */

export interface DetectionResult {
  visualizationType: VisualizationType;
  confidence: number;
  subject?: 'Science' | 'Math' | 'History' | 'Geography' | 'Economics' | 'English' | 'Other';
  reasoning: string;
}

export type VisualizationType =
  | 'comparison_table'
  | 'bar_chart'
  | 'pie_chart'
  | 'line_chart'
  | 'flowchart'
  | 'text_flowchart'
  | 'concept_map'
  | 'timeline'
  | 'hierarchical_tree';

export class QueryTypeDetector {
  /**
   * Intelligently detect visualization type from query and answer
   */
  static detect(query: string, answer: string, metadata?: { subject?: string }): DetectionResult[] {
    const lowerQuery = query.toLowerCase();
    const lowerAnswer = answer.toLowerCase();
    const combined = `${lowerQuery} ${lowerAnswer}`;

    const results: DetectionResult[] = [];

    // Chart detection patterns
    const chartPatterns = {
      bar_chart: {
        patterns: [
          /\b(bar|horizontal|vertical|compare|comparison)\s+(chart|graph|diagram)/i,
          /\bshow.*?(bar|column).*?chart\b/i,
          /\bhow.*?(distributed|spread|compared)/i,
          /\bcompare.*?(data|statistics|numbers|values)/i,
        ],
        keywords: ['compare', 'comparison', 'distributed', 'spread', 'bar chart', 'column chart'],
      },
      pie_chart: {
        patterns: [
          /\bpie\s+(chart|diagram)/i,
          /\b(proportion|percentage|distribution)\s+(of|by)/i,
          /\bshow.*?(percentage|proportion|share)/i,
          /\b(composition|makeup|breakdown)\s+of/i,
        ],
        keywords: ['percentage', 'proportion', 'share', 'pie chart', 'composition', 'breakdown'],
      },
      line_chart: {
        patterns: [
          /\b(line|trend|growth|decline)\s+(chart|graph|over)/i,
          /\bhow.*?(change|trend|evolve|grow|decline)/i,
          /\bover\s+(time|period|year|decade|century)/i,
          /\b(increase|decrease|fluctuat).*?over/i,
        ],
        keywords: ['trend', 'growth', 'over time', 'change', 'line graph', 'evolution'],
      },
    };

    // Check for numerical data in answer
    const hasNumbers = /\d+(\.\d+)?(%|\s|,|$)/g.test(answer);
    const hasMultipleNumbers = (answer.match(/\d+/g) || []).length >= 3;

    // Detect statistical charts
    for (const [type, config] of Object.entries(chartPatterns)) {
      const patternMatches = config.patterns.filter(p => p.test(combined)).length;
      const keywordMatches = config.keywords.filter(k => combined.includes(k)).length;

      let confidence = 0;

      // Pattern matching (0-0.5)
      confidence += (patternMatches / config.patterns.length) * 0.5;

      // Keyword matching (0-0.3)
      confidence += (keywordMatches / config.keywords.length) * 0.3;

      // Numerical data presence (0-0.2)
      if (hasNumbers) confidence += 0.1;
      if (hasMultipleNumbers) confidence += 0.1;

      if (confidence >= 0.4) {
        results.push({
          visualizationType: type as VisualizationType,
          confidence,
          subject: this.detectSubject(combined, metadata),
          reasoning: `Detected ${type} (confidence: ${(confidence * 100).toFixed(0)}%) - ${patternMatches} pattern matches, ${keywordMatches} keyword matches`,
        });
      }
    }

    // Flowchart detection
    if (/\b(process|step|procedure|flow|sequence|stage|mechanism|cycle)\b/i.test(combined)) {
      const confidence = 0.7;
      results.push({
        visualizationType: 'flowchart',
        confidence,
        subject: this.detectSubject(combined, metadata),
        reasoning: `Detected flowchart (confidence: ${(confidence * 100).toFixed(0)}%) - process/sequence keywords found`,
      });
    }

    // Concept map detection
    if (/\b(relationship|concept|connection|relate|link|associate)\b/i.test(combined)) {
      const confidence = 0.6;
      results.push({
        visualizationType: 'concept_map',
        confidence,
        subject: this.detectSubject(combined, metadata),
        reasoning: `Detected concept map (confidence: ${(confidence * 100).toFixed(0)}%) - relationship keywords found`,
      });
    }

    // Timeline detection
    if (/\b(timeline|history|chronolog|when|year|date|period|era|century)\b/i.test(combined)) {
      const hasYears = /\b(1[0-9]{3}|20[0-9]{2})\b/g.test(answer);
      const confidence = hasYears ? 0.8 : 0.6;
      results.push({
        visualizationType: 'timeline',
        confidence,
        subject: this.detectSubject(combined, metadata),
        reasoning: `Detected timeline (confidence: ${(confidence * 100).toFixed(0)}%) - temporal keywords found`,
      });
    }

    // Comparison table detection
    if (/\b(difference|compare|distinguish|versus|vs|differentiate|contrast)\b/i.test(combined)) {
      const confidence = 0.7;
      results.push({
        visualizationType: 'comparison_table',
        confidence,
        subject: this.detectSubject(combined, metadata),
        reasoning: `Detected comparison table (confidence: ${(confidence * 100).toFixed(0)}%) - comparison keywords found`,
      });
    }

    // Hierarchical tree detection
    if (/\b(classification|types of|kinds of|categories|classify|taxonomy|hierarchy)\b/i.test(combined)) {
      const confidence = 0.7;
      results.push({
        visualizationType: 'hierarchical_tree',
        confidence,
        subject: this.detectSubject(combined, metadata),
        reasoning: `Detected hierarchical tree (confidence: ${(confidence * 100).toFixed(0)}%) - classification keywords found`,
      });
    }

    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);

    return results;
  }

  /**
   * Detect subject area from query and answer
   */
  private static detectSubject(
    combined: string,
    metadata?: { subject?: string }
  ): 'Science' | 'Math' | 'History' | 'Geography' | 'Economics' | 'English' | 'Other' {
    // Use metadata if available
    if (metadata?.subject) {
      const subjectMap: Record<string, any> = {
        'Physics': 'Science',
        'Chemistry': 'Science',
        'Biology': 'Science',
        'Science': 'Science',
        'Mathematics': 'Math',
        'Math': 'Math',
        'History': 'History',
        'Geography': 'Geography',
        'Economics': 'Economics',
        'English': 'English',
      };
      return subjectMap[metadata.subject] || 'Other';
    }

    // Detect from content
    if (/\b(atom|molecule|reaction|cell|photosynthesis|physics|biology|chemistry|force|energy|circuit)\b/i.test(combined)) {
      return 'Science';
    }

    if (/\b(equation|theorem|geometry|probability|calculus|algebra|triangle|angle|function)\b/i.test(combined)) {
      return 'Math';
    }

    if (/\b(century|empire|war|civilization|revolution|dynasty|ruler|independence|colonial)\b/i.test(combined)) {
      return 'History';
    }

    if (/\b(continent|climate|population|latitude|longitude|map|river|mountain|region)\b/i.test(combined)) {
      return 'Geography';
    }

    if (/\b(trade|economy|gdp|production|inflation|market|demand|supply|price)\b/i.test(combined)) {
      return 'Economics';
    }

    if (/\b(poem|poetry|literature|author|novel|story|grammar|writing)\b/i.test(combined)) {
      return 'English';
    }

    return 'Other';
  }

  /**
   * Get the best visualization type (highest confidence)
   */
  static getBestType(query: string, answer: string, metadata?: { subject?: string }): DetectionResult | null {
    const results = this.detect(query, answer, metadata);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Check if query should generate visualizations
   */
  static shouldGenerateVisualization(query: string, answer: string): boolean {
    const results = this.detect(query, answer);
    return results.length > 0 && results[0].confidence >= 0.4;
  }
}

