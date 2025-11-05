/**
 * Search Filter Debug Service
 * 🔧 CRITICAL FIX: Diagnoses and fixes vector search filtering issues
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIService } from './openai_service';

export interface DebugReport {
  query: string;
  requestedSubject: string;
  subjectsInDatabase: string[];
  unfilteredCount: number;
  exactMatchCount: number;
  caseInsensitiveCount: number;
  fuzzyMatchCount: number;
  recommendation: string;
  suggestedFilter: any;
  samplePayloads: any[];
}

export interface FilterDiagnostic {
  filterType: string;
  success: boolean;
  resultCount: number;
  error?: string;
  sampleResults?: any[];
}

export class SearchFilterDebugService {
  private qdrantClient: QdrantClient;
  private openaiService: OpenAIService;
  private collectionName = 'ncert-books-enhanced';

  constructor() {
    this.qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
    });
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * 🔧 CRITICAL FIX: Comprehensive search filter debugging
   */
  async debugSubjectFilter(query: string, subject: string): Promise<DebugReport> {
    console.log(`🔍 DEBUG: Searching for "${query}" with subject filter: ${subject}`);
    
    try {
      // Step 1: Generate query embedding
      const queryEmbedding = await this.openaiService.generateEmbedding(query);
      
      // Step 2: Test unfiltered search first
      const unfiltered = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        limit: 10,
        with_payload: true
      });
      console.log(`📊 Unfiltered results: ${unfiltered.length}`);
      
      // Step 3: Analyze database content structure
      const contentAnalysis = await this.analyzeCollectionContent();
      console.log(`📋 Subjects in database:`, contentAnalysis.subjects);
      console.log(`📋 Sample payload structure:`, contentAnalysis.samplePayload);
      
      // Step 4: Test various filter strategies
      const filterTests = await this.testFilterStrategies(queryEmbedding, subject);
      
      // Step 5: Generate recommendation
      const recommendation = this.generateFilterRecommendation(
        contentAnalysis.subjects, 
        subject, 
        filterTests
      );

      return {
        query,
        requestedSubject: subject,
        subjectsInDatabase: contentAnalysis.subjects,
        unfilteredCount: unfiltered.length,
        exactMatchCount: filterTests.exactMatch.resultCount,
        caseInsensitiveCount: filterTests.caseInsensitive.resultCount,
        fuzzyMatchCount: filterTests.fuzzyMatch.resultCount,
        recommendation: recommendation.message,
        suggestedFilter: recommendation.filter,
        samplePayloads: contentAnalysis.samplePayloads
      };
    } catch (error) {
      console.error('❌ Search filter debug failed:', error);
      throw error;
    }
  }

  /**
   * Analyze collection content structure
   */
  private async analyzeCollectionContent(): Promise<{
    subjects: string[];
    samplePayload: any;
    samplePayloads: any[];
    totalPoints: number;
  }> {
    try {
      const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
        limit: 100,
        with_payload: true
      });
      
      const subjects = new Set<string>();
      const samplePayloads: any[] = [];
      
      scrollResult.points.forEach((point, index) => {
        if (point.payload) {
          // Collect all possible subject field variations
          const subjectFields = [
            point.payload.subject,
            point.payload.Subject,
            point.payload.SUBJECT,
            point.payload.metadata?.subject,
            point.payload.class_subject,
            point.payload.textbook_subject
          ];
          
          subjectFields.forEach(subjectValue => {
            if (subjectValue && typeof subjectValue === 'string') {
              subjects.add(subjectValue);
            }
          });
          
          // Collect sample payloads for analysis
          if (index < 5) {
            samplePayloads.push(point.payload);
          }
        }
      });
      
      return {
        subjects: Array.from(subjects),
        samplePayload: samplePayloads[0] || {},
        samplePayloads,
        totalPoints: scrollResult.points.length
      };
    } catch (error) {
      console.error('❌ Failed to analyze collection content:', error);
      return {
        subjects: [],
        samplePayload: {},
        samplePayloads: [],
        totalPoints: 0
      };
    }
  }

  /**
   * Test various filter strategies
   */
  private async testFilterStrategies(
    queryEmbedding: number[], 
    subject: string
  ): Promise<{
    exactMatch: FilterDiagnostic;
    caseInsensitive: FilterDiagnostic;
    fuzzyMatch: FilterDiagnostic;
    fieldVariations: FilterDiagnostic[];
  }> {
    const results = {
      exactMatch: await this.testFilter('Exact Match', {
        must: [{ key: 'subject', match: { value: subject } }]
      }, queryEmbedding),
      
      caseInsensitive: await this.testFilter('Case Insensitive', {
        must: [{ key: 'subject', match: { value: subject.toLowerCase() } }]
      }, queryEmbedding),
      
      fuzzyMatch: await this.testFilter('Fuzzy Match', {
        should: [
          { key: 'subject', match: { value: subject } },
          { key: 'subject', match: { value: subject.toLowerCase() } },
          { key: 'subject', match: { value: subject.toUpperCase() } }
        ]
      }, queryEmbedding),
      
      fieldVariations: []
    };

    // Test different field name variations
    const fieldVariations = ['Subject', 'SUBJECT', 'class_subject', 'textbook_subject'];
    for (const field of fieldVariations) {
      const diagnostic = await this.testFilter(`Field: ${field}`, {
        must: [{ key: field, match: { value: subject } }]
      }, queryEmbedding);
      results.fieldVariations.push(diagnostic);
    }

    return results;
  }

  /**
   * Test a specific filter configuration
   */
  private async testFilter(
    filterType: string, 
    filter: any, 
    queryEmbedding: number[]
  ): Promise<FilterDiagnostic> {
    try {
      const searchResult = await this.qdrantClient.search(this.collectionName, {
        vector: queryEmbedding,
        filter,
        limit: 10,
        with_payload: true
      });

      console.log(`🧪 ${filterType}: ${searchResult.length} results`);

      return {
        filterType,
        success: true,
        resultCount: searchResult.length,
        sampleResults: searchResult.slice(0, 3).map(r => ({
          score: r.score,
          subject: r.payload?.subject,
          content: r.payload?.text?.substring(0, 100) + '...'
        }))
      };
    } catch (error) {
      console.error(`❌ ${filterType} filter failed:`, error);
      return {
        filterType,
        success: false,
        resultCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Generate filter recommendation based on test results
   */
  private generateFilterRecommendation(
    availableSubjects: string[], 
    requestedSubject: string,
    filterTests: any
  ): { message: string; filter: any } {
    
    // Check if exact match worked
    if (filterTests.exactMatch.resultCount > 0) {
      return {
        message: `✅ Exact match works! Found ${filterTests.exactMatch.resultCount} results.`,
        filter: { must: [{ key: 'subject', match: { value: requestedSubject } }] }
      };
    }

    // Check if case insensitive worked
    if (filterTests.caseInsensitive.resultCount > 0) {
      return {
        message: `✅ Case insensitive match works! Use lowercase: "${requestedSubject.toLowerCase()}"`,
        filter: { must: [{ key: 'subject', match: { value: requestedSubject.toLowerCase() } }] }
      };
    }

    // Check field variations
    const workingField = filterTests.fieldVariations.find(f => f.resultCount > 0);
    if (workingField) {
      const fieldName = workingField.filterType.replace('Field: ', '');
      return {
        message: `✅ Found results using field "${fieldName}"! Use this field instead of "subject".`,
        filter: { must: [{ key: fieldName, match: { value: requestedSubject } }] }
      };
    }

    // Find similar subjects
    const similarSubjects = availableSubjects.filter(subj => 
      subj.toLowerCase().includes(requestedSubject.toLowerCase()) ||
      requestedSubject.toLowerCase().includes(subj.toLowerCase())
    );

    if (similarSubjects.length > 0) {
      return {
        message: `⚠️ Subject '${requestedSubject}' not found. Try these similar subjects: ${similarSubjects.join(', ')}`,
        filter: { must: [{ key: 'subject', match: { value: similarSubjects[0] } }] }
      };
    }

    return {
      message: `❌ Subject '${requestedSubject}' not found. Available subjects: ${availableSubjects.slice(0, 10).join(', ')}${availableSubjects.length > 10 ? '...' : ''}`,
      filter: null
    };
  }

  /**
   * 🔧 CRITICAL FIX: Smart subject filter that adapts to database structure
   */
  async createSmartSubjectFilter(subject: string): Promise<any> {
    try {
      console.log(`🔧 Creating smart subject filter for: ${subject}`);

      // First, try exact case match
      const exactMatch = await this.testFilter('Exact Match', {
        must: [{ key: 'subject', match: { value: subject } }]
      }, []);

      if (exactMatch.resultCount > 0) {
        console.log('✅ Exact match works, using exact filter');
        return { must: [{ key: 'subject', match: { value: subject } }] };
      }

      // Try title case version
      const titleCase = subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
      if (titleCase !== subject) {
        const titleCaseMatch = await this.testFilter('Title Case', {
          must: [{ key: 'subject', match: { value: titleCase } }]
        }, []);

        if (titleCaseMatch.resultCount > 0) {
          console.log(`✅ Title case works: ${titleCase}`);
          return { must: [{ key: 'subject', match: { value: titleCase } }] };
        }
      }

      // Try multiple case variations with OR logic
      const caseVariations = [
        subject,
        subject.toLowerCase(),
        subject.toUpperCase(),
        titleCase
      ];

      const shouldFilters = caseVariations.map(variation => ({
        key: 'subject',
        match: { value: variation }
      }));

      console.log(`🔧 Using multi-case filter with ${shouldFilters.length} variations`);
      return {
        should: shouldFilters
      };

    } catch (error) {
      console.error('❌ Smart filter creation failed:', error);
      return null; // Return null to disable filtering
    }
  }

  /**
   * Test the entire search pipeline with debugging
   */
  async testSearchPipeline(query: string, subject: string): Promise<{
    debugReport: DebugReport;
    searchResults: any[];
    recommendedApproach: string;
  }> {
    console.log('🧪 Testing complete search pipeline...');
    
    const debugReport = await this.debugSubjectFilter(query, subject);
    
    // Try the recommended filter
    let searchResults: any[] = [];
    if (debugReport.suggestedFilter) {
      try {
        const queryEmbedding = await this.openaiService.generateEmbedding(query);
        const results = await this.qdrantClient.search(this.collectionName, {
          vector: queryEmbedding,
          filter: debugReport.suggestedFilter,
          limit: 10,
          with_payload: true
        });
        searchResults = results;
      } catch (error) {
        console.error('❌ Recommended filter failed:', error);
      }
    }

    const recommendedApproach = searchResults.length > 0 
      ? `✅ Use the suggested filter: ${JSON.stringify(debugReport.suggestedFilter)}`
      : `⚠️ Consider using unfiltered search or broader subject categories`;

    return {
      debugReport,
      searchResults,
      recommendedApproach
    };
  }
}
