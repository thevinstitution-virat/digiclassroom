/**
 * Citation Agent - Adds Proper Academic Citations to AI Responses
 * Ensures every statement is properly attributed to textbook sources
 */

import { SourceChunk } from './source_verification_agent';

export interface Citation {
  id: string;
  textbook_title: string;
  chapter: string;
  page_number: number;
  class_level: string;
  subject: string;
  content_excerpt: string;
  citation_format: string;
}

export interface CitationResult {
  answer: string;
  citations: Citation[];
  citation_count: number;
  coverage_percentage: number;
}

export class CitationAgent {
  /**
   * Add proper citations to the answer based on source content
   */
  async add_citations(
    answer: string,
    sourceContent: SourceChunk[]
  ): Promise<CitationResult> {
    console.log(`📚 Adding citations to ${answer.length} character response using ${sourceContent.length} sources`);
    
    try {
      // Extract sentences that need citations
      const sentences = this.extractSentences(answer);
      const citationsMap = new Map<string, Citation>();
      let citatedAnswer = answer;
      let citationCounter = 1;

      // Process each sentence for citation matching
      for (const sentence of sentences) {
        const matchingSource = this.findBestCitationMatch(sentence, sourceContent);
        
        if (matchingSource) {
          const citationId = `cite_${citationCounter}`;
          const citation = this.createCitation(citationId, matchingSource, sentence);
          
          // Add citation marker to the sentence
          const citationMarker = `[${citationCounter}]`;
          citatedAnswer = citatedAnswer.replace(
            sentence,
            `${sentence} ${citationMarker}`
          );
          
          citationsMap.set(citationId, citation);
          citationCounter++;
        }
      }

      // Convert citations map to array
      const citations = Array.from(citationsMap.values());
      
      // Add citations section to the answer
      if (citations.length > 0) {
        citatedAnswer += this.formatCitationsSection(citations);
      }

      const coveragePercentage = (citations.length / sentences.length) * 100;
      
      console.log(`✅ Citations added: ${citations.length} citations for ${sentences.length} sentences (${coveragePercentage.toFixed(1)}% coverage)`);

      return {
        answer: citatedAnswer,
        citations,
        citation_count: citations.length,
        coverage_percentage: coveragePercentage
      };

    } catch (error) {
      console.error('❌ Citation error:', error);
      
      // Return original answer without citations on error
      return {
        answer,
        citations: [],
        citation_count: 0,
        coverage_percentage: 0
      };
    }
  }

  /**
   * Extract meaningful sentences from the answer
   */
  private extractSentences(answer: string): string[] {
    // Split on sentence endings and filter meaningful sentences
    const sentences = answer
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 15) // Only sentences with substantial content
      .filter(s => !s.startsWith('**') && !s.startsWith('#')) // Skip formatting
      .filter(s => !s.includes('[') || !s.includes(']')); // Skip already cited content
    
    return sentences;
  }

  /**
   * Find the best source match for citation
   */
  private findBestCitationMatch(sentence: string, sources: SourceChunk[]): SourceChunk | null {
    let bestMatch: SourceChunk | null = null;
    let bestScore = 0;

    const sentenceWords = new Set(
      sentence.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 2)
    );

    for (const source of sources) {
      const sourceWords = new Set(
        source.content.toLowerCase()
          .split(/\W+/)
          .filter(word => word.length > 2)
      );

      // Calculate word overlap
      const overlap = [...sentenceWords].filter(word => sourceWords.has(word)).length;
      const overlapScore = overlap / sentenceWords.size;

      // Also check if sentence concepts are in source
      const conceptMatch = this.checkConceptualMatch(sentence, source.content);
      const combinedScore = (overlapScore * 0.7) + (conceptMatch * 0.3);

      if (combinedScore > bestScore && combinedScore > 0.3) { // 30% minimum match
        bestScore = combinedScore;
        bestMatch = source;
      }
    }

    return bestMatch;
  }

  /**
   * Check conceptual match between sentence and source
   */
  private checkConceptualMatch(sentence: string, sourceContent: string): number {
    // Simple conceptual matching based on key terms
    const keyTerms = this.extractKeyTerms(sentence);
    const sourceTerms = this.extractKeyTerms(sourceContent);
    
    const matchingTerms = keyTerms.filter(term => 
      sourceTerms.some(sourceTerm => 
        sourceTerm.includes(term) || term.includes(sourceTerm)
      )
    );

    return keyTerms.length > 0 ? matchingTerms.length / keyTerms.length : 0;
  }

  /**
   * Extract key terms from text
   */
  private extractKeyTerms(text: string): string[] {
    // Extract important terms (nouns, technical terms)
    const words = text.toLowerCase().split(/\W+/);
    const keyTerms = words.filter(word => 
      word.length > 4 && // Longer words are more likely to be key terms
      !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'there', 'where', 'when', 'what', 'which', 'their', 'these', 'those'].includes(word)
    );
    
    return [...new Set(keyTerms)]; // Remove duplicates
  }

  /**
   * Create a citation object - ONLY with verified metadata
   */
  private createCitation(
    citationId: string,
    source: SourceChunk,
    sentence: string
  ): Citation {
    const contentExcerpt = source.content.length > 100
      ? source.content.substring(0, 100) + '...'
      : source.content;

    const citationFormat = this.formatAcademicCitation(source);

    // CRITICAL: Only use verified metadata, no fake placeholders
    return {
      id: citationId,
      textbook_title: source.metadata?.textbook_title || 'Textbook',
      chapter: source.metadata?.chapter && source.metadata.chapter !== 'Unknown' ? source.metadata.chapter : '',
      page_number: source.metadata?.page_number && source.metadata.page_number > 0 ? source.metadata.page_number : 0,
      class_level: source.metadata?.class_level && source.metadata.class_level !== 'Unknown Class' ? source.metadata.class_level : '',
      subject: source.metadata?.subject && source.metadata.subject !== 'Unknown Subject' ? source.metadata.subject : '',
      content_excerpt: contentExcerpt,
      citation_format: citationFormat
    };
  }

  /**
   * Format academic citation - ONLY with verified metadata
   */
  private formatAcademicCitation(source: SourceChunk): string {
    const parts: string[] = [];

    // Only add verified metadata components
    if (source.metadata?.textbook_title) {
      parts.push(source.metadata.textbook_title);
    }

    if (source.metadata?.subject && source.metadata.subject !== 'Unknown Subject') {
      parts.push(source.metadata.subject);
    }

    if (source.metadata?.class_level && source.metadata.class_level !== 'Unknown Class') {
      parts.push(source.metadata.class_level);
    }

    if (source.metadata?.chapter && source.metadata.chapter !== 'Unknown Chapter') {
      parts.push(`Chapter: ${source.metadata.chapter}`);
    }

    if (source.metadata?.page_number && source.metadata.page_number > 0) {
      parts.push(`Page ${source.metadata.page_number}`);
    }

    // Include extraction method if present
        // @ts-ignore
    if (source.metadata?.extraction_method) {
        // @ts-ignore
      parts.push(`(${source.metadata.extraction_method})`);
    }

    // CRITICAL: Return meaningful citation or indicate textbook source
    return parts.length > 0 ? parts.join(', ') : 'Textbook content';
  }

  /**
   * Format the citations section
   */
  private formatCitationsSection(citations: Citation[]): string {
    let citationsSection = '\n\n---\n\n## 📚 **References**\n\n';
    
    citations.forEach((citation, index) => {
      citationsSection += `**[${index + 1}]** ${citation.citation_format}\n`;
      citationsSection += `   *"${citation.content_excerpt}"*\n\n`;
    });

    citationsSection += '---\n\n';
    citationsSection += '💡 **Note**: All information is sourced directly from official textbooks to ensure curriculum alignment and accuracy.\n';

    return citationsSection;
  }

  /**
   * Validate citation quality
   */
  validateCitationQuality(citationResult: CitationResult): {
    quality_score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let qualityScore = 1.0;

    // Check citation coverage
    if (citationResult.coverage_percentage < 70) {
      issues.push(`Low citation coverage: ${citationResult.coverage_percentage.toFixed(1)}%`);
      recommendations.push('Increase source matching threshold or improve content retrieval');
      qualityScore -= 0.3;
    }

    // Check citation count
    if (citationResult.citation_count === 0) {
      issues.push('No citations found');
      recommendations.push('Verify source content availability and matching algorithms');
      qualityScore -= 0.5;
    }

    // Check citation diversity
    const uniqueSources = new Set(citationResult.citations.map(c => c.textbook_title));
    if (uniqueSources.size < Math.min(2, citationResult.citations.length)) {
      issues.push('Limited source diversity');
      recommendations.push('Expand source retrieval to include multiple textbooks/chapters');
      qualityScore -= 0.2;
    }

    return {
      quality_score: Math.max(qualityScore, 0),
      issues,
      recommendations
    };
  }
}
