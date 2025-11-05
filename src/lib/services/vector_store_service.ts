/**
 * Enhanced Vector Store Service for Educational Content
 * Integrates with Qdrant for curriculum-aligned content retrieval
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { qdrantSearch } from '../ai/rag/qdrant-search';
import type { ICacheService } from './interfaces';
import { RedisCacheService } from './implementations/redis-cache.service';

export interface EducationalContext {
  query: string;
  grade_level: number;
  subject: string;
  board_type: 'CBSE' | 'ICSE' | 'State Board';
  limit?: number;
  content_types?: string[];
  requires_equations?: boolean;
  requires_tables?: boolean;
  cognitive_level?: string;
}

export interface ContentResult {
  text: string;
  metadata: {
    subject: string;
    class_level: string;
    chapter?: string;
    page?: number;
    content_type: string;
    source: string;
    relevance_score: number;
  };
  score: number;
}

export interface SearchResponse {
  results: ContentResult[];
  total_results: number;
  search_strategy: string;
  processing_time: number;
  confidence: number;
}

export class VectorStoreService {
  private client: QdrantClient;
  private collectionName = 'digiclassroom';
  private cacheService: ICacheService;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      checkCompatibility: false
    });

    // Initialize Redis cache service (enterprise implementation)
    this.cacheService = new RedisCacheService({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    });

    console.log('🔍 Vector Store Service initialized with Redis caching');
  }

  /**
   * Search for relevant educational content
   */
  async search_relevant_content(context: EducationalContext): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Vector Search: ${context.query.substring(0, 50)}... for Class ${context.grade_level} ${context.subject}`);

      // Step 1: Check cache first
      // Generate cache key from context
      const cacheKey = `vector_search:${context.query}:${context.grade_level}:${context.subject}:${context.board_type}`;
      const cachedResult = await this.cacheService.get<SearchResponse>(cacheKey);

      if (cachedResult) {
        console.log(`⚡ Cache hit for vector search - ${Date.now() - startTime}ms`);
        return cachedResult;
      }

      // Step 2: Perform search if not cached
      console.log(`🔍 Cache miss - performing vector search`);

      // Map grade level to class format (Arabic numerals for consistency)
      const classLevel = `Class ${context.grade_level}`;

      // Use enhanced Qdrant search
      const searchOptions = {
        subject: context.subject,
        classLevel,
        topK: context.limit || 5,
        enableHybridSearch: true,
        enableFallback: true,
        requiresEquations: context.requires_equations || false,
        requiresTables: context.requires_tables || false,
        contentTypes: context.content_types || ['text'],
        sectionLevel: 3
      };

      const qdrantResponse = await qdrantSearch.search(context.query, searchOptions);
      
      const processingTime = Date.now() - startTime;
      
      // Transform Qdrant results to our format
      const results: ContentResult[] = qdrantResponse.results.map(result => ({
        text: result.content,
        metadata: {
          subject: result.metadata.subject || context.subject,
          class_level: result.metadata.classLevel || classLevel,
          chapter: result.metadata.chapter,
          page: result.metadata.page,
          content_type: result.metadata.content_type || 'text',
          source: result.metadata.source || 'textbook',
          relevance_score: result.score
        },
        score: result.score
      }));

      console.log(`✅ Found ${results.length} relevant content pieces in ${processingTime}ms`);

      const searchResponse: SearchResponse = {
        results,
        total_results: results.length,
        search_strategy: qdrantResponse.search_strategy || 'vector_search',
        processing_time: processingTime,
        confidence: this.calculateConfidence(results)
      };

      // Step 3: Cache the results for future use (7 days TTL)
      const cacheKey = `vector_search:${context.query}:${context.grade_level}:${context.subject}:${context.board_type}`;
      await this.cacheService.set(cacheKey, searchResponse, {
        ttl: 7 * 24 * 60 * 60, // 7 days
        tags: [`subject:${context.subject}`, `grade:${context.grade_level}`]
      });

      return searchResponse;
      
    } catch (error) {
      console.error('❌ Vector Store Search Error:', error);
      
      // Return empty results with error context
      return {
        results: [],
        total_results: 0,
        search_strategy: 'error_fallback',
        processing_time: Date.now() - startTime,
        confidence: 0
      };
    }
  }

  /**
   * Search for homework-specific content with Socratic guidance focus
   */
  async search_homework_content(context: EducationalContext): Promise<SearchResponse> {
    const enhancedContext = {
      ...context,
      content_types: ['examples', 'solutions', 'step_by_step', 'practice_problems'],
      cognitive_level: this.getCognitiveLevelForGrade(context.grade_level)
    };
    
    return this.search_relevant_content(enhancedContext);
  }

  /**
   * Search for comprehensive topic explanations
   */
  async search_explanation_content(context: EducationalContext): Promise<SearchResponse> {
    const enhancedContext = {
      ...context,
      limit: 10, // More comprehensive for explanations
      content_types: ['definitions', 'concepts', 'explanations', 'examples', 'applications'],
      cognitive_level: this.getCognitiveLevelForGrade(context.grade_level)
    };
    
    return this.search_relevant_content(enhancedContext);
  }

  /**
   * Format search results for educational context
   */
  format_educational_context(results: ContentResult[]): string {
    if (results.length === 0) {
      return "No specific textbook content found for this query.";
    }

    let formattedContext = "📚 Relevant Textbook Content:\n\n";
    
    results.forEach((result, index) => {
      formattedContext += `${index + 1}. **${result.metadata.subject} - ${result.metadata.class_level}**\n`;
      
      if (result.metadata.chapter) {
        formattedContext += `   Chapter: ${result.metadata.chapter}\n`;
      }
      
      formattedContext += `   Content: ${result.text.substring(0, 300)}...\n`;
      formattedContext += `   Relevance: ${(result.score * 100).toFixed(1)}%\n\n`;
    });
    
    return formattedContext;
  }

  /**
   * Format context specifically for Socratic tutoring
   */
  format_socratic_context(results: ContentResult[]): string {
    if (results.length === 0) {
      return "Use general knowledge to guide the student.";
    }

    let context = "📖 Textbook Reference (use to guide, don't quote directly):\n\n";
    
    results.forEach((result, index) => {
      context += `Reference ${index + 1}: ${result.text.substring(0, 200)}...\n\n`;
    });
    
    context += "Use this content to ask guiding questions and provide hints, but don't give direct answers.";
    
    return context;
  }

  private convertGradeToRoman(grade: number): string {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romanNumerals[grade - 1] || grade.toString();
  }

  private getCognitiveLevelForGrade(gradeLevel: number): string {
    if (gradeLevel <= 3) return "remember_understand";
    if (gradeLevel <= 6) return "understand_apply";
    if (gradeLevel <= 8) return "apply_analyze";
    if (gradeLevel <= 10) return "analyze_evaluate";
    return "evaluate_create";
  }

  private calculateConfidence(results: ContentResult[]): number {
    if (results.length === 0) return 0;
    
    const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    const resultCount = Math.min(results.length / 5, 1); // Normalize by expected result count
    
    return Math.min(avgScore * resultCount, 1);
  }

  /**
   * Get available subjects for a grade level
   */
  async get_available_subjects(gradeLevel: number): Promise<string[]> {
    try {
      const classLevel = `Class ${this.convertGradeToRoman(gradeLevel)}`;
      
      // Get unique subjects for this class level
      const response = await this.client.scroll(this.collectionName, {
        limit: 100,
        with_payload: true,
        filter: {
          must: [
            {
              key: 'classLevel',
              match: { value: classLevel }
            }
          ]
        }
      });

      const subjects = new Set<string>();
      response.points.forEach(point => {
        if (point.payload.subject) {
          subjects.add(point.payload.subject as string);
        }
      });

      return Array.from(subjects).sort();
      
    } catch (error) {
      console.error('❌ Error getting available subjects:', error);
      return ['General']; // Fallback
    }
  }
}
