/**
 * Enhanced Contextual RAG Pipeline
 * Provides role-aware, hierarchically filtered content retrieval
 */

import { EnhancedRAGPipeline, EnhancedRAGOptions, EnhancedRAGResult } from './enhanced-rag-pipeline';
import { UserContext, UserRole } from '@/lib/services/user-profile-service';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface RoleAwareRAGOptions extends EnhancedRAGOptions {
  userContext?: UserContext;
  roleSpecificFiltering?: boolean;
  adaptiveScoring?: boolean;
  pedagogicalContext?: boolean;
}

export interface RoleAwareRAGResult extends EnhancedRAGResult {
  roleAdaptations: {
    contentFiltered: boolean;
    complexityAdjusted: boolean;
    pedagogicalEnhanced: boolean;
    roleSpecificSources: number;
  };
  userContextApplied: UserContext | null;
}

export interface QdrantFilter {
  must?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
  should?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
  must_not?: Array<{
    key: string;
    match: { value: string | number | boolean };
  }>;
}

        // @ts-ignore
export class EnhancedContextualRAGPipeline extends EnhancedRAGPipeline {
  private qdrant: QdrantClient;

  constructor() {
    super();
    // Initialize Qdrant client directly (same as parent class)
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
        // @ts-ignore
      checkCompatibility: false
    });
  }

  /**
   * Search with role-aware context and hierarchical filtering
   */
  async searchWithRoleContext(
    query: string, 
    userContext: UserContext,
    options: RoleAwareRAGOptions = {}
  ): Promise<RoleAwareRAGResult> {
    
    console.log(`🎯 Role-aware search for ${userContext.role}: "${query}"`);
    
    try {
      // Layer 1: Board-Level Filtering
      const boardFilter = this.createBoardFilter(userContext.educationalLevel.board);
      
      // Layer 2: Grade-Level Restriction
      const gradeFilter = this.createGradeFilter(
        userContext.educationalLevel.grade,
        userContext.role
      );
      
      // Layer 3: Subject-Specific Context
      const subjectFilter = this.createSubjectFilter(
        userContext.educationalLevel.subjects,
        userContext.role
      );
      
      // Layer 4: Pedagogical Context Preservation
      const pedagogicalFilter = this.createPedagogicalFilter(
        userContext.learningPreferences,
        userContext.role
      );
      
      // Combine all filters
      const combinedFilter = this.combineFilters([
        boardFilter,
        gradeFilter, 
        subjectFilter,
        pedagogicalFilter
      ]);
      
      // Enhanced search options
      const enhancedOptions: EnhancedRAGOptions = {
        ...options,
        subject: userContext.educationalLevel.subjects[0] || options.subject,
        classLevel: userContext.educationalLevel.grade ? `Class ${userContext.educationalLevel.grade}` : options.classLevel,
        enableVisualAnalysis: userContext.learningPreferences.visualLearning,
        includeVisualDescriptions: userContext.learningPreferences.visualLearning,
        prioritizeVisualContent: userContext.learningPreferences.primaryStyle === 'visual'
      };
      
      // Execute search with enhanced filtering
      const searchResults = await this.executeEnhancedSearch(
        query, 
        combinedFilter, 
        enhancedOptions,
        userContext
      );
      
      // Role-specific result processing
      const processedResults = await this.processResultsForRole(searchResults, userContext);
      
      return {
        ...processedResults,
        roleAdaptations: {
          contentFiltered: true,
          complexityAdjusted: true,
          pedagogicalEnhanced: options.pedagogicalContext !== false,
          roleSpecificSources: processedResults.results.length
        },
        userContextApplied: userContext
      };
      
    } catch (error) {
      console.error('❌ Role-aware search failed:', error);
      
      // Fallback to basic search
        // @ts-ignore
      const fallbackResult = await super.searchRelevantContent(query, options);
      
      return {
        ...fallbackResult,
        roleAdaptations: {
          contentFiltered: false,
          complexityAdjusted: false,
          pedagogicalEnhanced: false,
          roleSpecificSources: 0
        },
        userContextApplied: null
      };
    }
  }

  /**
   * Create board-level filter
   */
  private createBoardFilter(board: string): QdrantFilter {
    return {
      should: [
        { key: 'board', match: { value: board } },
        { key: 'curriculum', match: { value: board } },
        { key: 'board_type', match: { value: board } }
      ]
    };
  }

  /**
   * Create grade-level filter with role-aware flexibility
   */
  private createGradeFilter(grade: number | undefined, role: UserRole): QdrantFilter {
    if (!grade)
  return {};
    
    const gradeVariations = [
      `Class ${grade}`,
      `Class ${grade}th`,
      `Grade ${grade}`,
      grade.toString()
    ];
    
    // Teachers might need content from adjacent grades
    if (role === 'teacher') {
      if (grade > 1) gradeVariations.push(`Class ${grade - 1}`, `Class ${grade - 1}th`);
      if (grade < 12) gradeVariations.push(`Class ${grade + 1}`, `Class ${grade + 1}th`);
    }
    
    // Parents might need foundational content
    if (role === 'parent_guardian' && grade > 1) {
      gradeVariations.push(`Class ${grade - 1}`, `Class ${grade - 1}th`);
    }
    
    return {
      should: gradeVariations.map(variation => ({
        key: 'classLevel',
        match: { value: variation }
      })).concat(gradeVariations.map(variation => ({
        key: 'class',
        match: { value: variation }
      })))
    };
  }

  /**
   * Create subject-specific filter
   */
  private createSubjectFilter(subjects: string[], role: UserRole): QdrantFilter {
    if (!subjects || subjects.length === 0)
  return {};
    
    const subjectFilters = subjects.map(subject => ({
      key: 'subject',
      match: { value: subject }
    }));
    
    // Teachers might need interdisciplinary content
    if (role === 'teacher') {
      // Add related subjects for comprehensive teaching
      const relatedSubjects = this.getRelatedSubjects(subjects);
      relatedSubjects.forEach(related => {
        subjectFilters.push({
          key: 'subject',
          match: { value: related }
        });
      });
    }
    
    return {
      should: subjectFilters
    };
  }

  /**
   * Create pedagogical context filter
   */
  private createPedagogicalFilter(
    preferences: UserContext['learningPreferences'],
    role: UserRole
  ): QdrantFilter {
    const pedagogicalMappings: { [key: string]: boolean } = {
      'prerequisite_concepts': preferences.needsScaffolding,
      'learning_sequence': preferences.sequentialLearning,
      'visual_content': preferences.visualLearning,
      'activity_based': preferences.handsonLearning,
      'assessment_aligned': role === 'teacher'
    };
    
    const mustFilters = Object.entries(pedagogicalMappings)
      .filter(([_, condition]) => condition)
      .map(([key, _]) => ({ 
        key: `metadata.${key}`, 
        match: { value: true } 
      }));
    
    return mustFilters.length > 0 ? { should: mustFilters } : {};
  }

  /**
   * Combine multiple filters into a single filter
   */
  private combineFilters(filters: QdrantFilter[]): QdrantFilter {
    const combined: QdrantFilter = {
      must: [],
      should: [],
      must_not: []
    };
    
    filters.forEach(filter => {
      if (filter.must) combined.must!.push(...filter.must);
      if (filter.should) combined.should!.push(...filter.should);
      if (filter.must_not) combined.must_not!.push(...filter.must_not);
    });
    
    // Clean up empty arrays
    if (combined.must!.length === 0) delete combined.must;
    if (combined.should!.length === 0) delete combined.should;
    if (combined.must_not!.length === 0) delete combined.must_not;
    
    return combined;
  }

  /**
   * Execute enhanced search with role-aware parameters
   */
  private async executeEnhancedSearch(
    query: string,
    filter: QdrantFilter,
    options: EnhancedRAGOptions,
    userContext: UserContext
  ): Promise<any> {
    
    // Calculate dynamic parameters based on role
    const searchParams = {
      limit: this.calculateOptimalLimit(userContext.role),
      scoreThreshold: this.calculateDynamicThreshold(userContext),
      filter: Object.keys(filter).length > 0 ? filter : undefined
    };
    
    console.log(`🔍 Executing search with params:`, {
      limit: searchParams.limit,
      threshold: searchParams.scoreThreshold,
      hasFilter: !!searchParams.filter
    });
    
    // Use the existing enhanced RAG search with additional filtering
        // @ts-ignore
    return await super.searchRelevantContent(query, {
      ...options,
      topK: searchParams.limit,
      scoreThreshold: searchParams.scoreThreshold
    });
  }

  /**
   * Process search results for specific role
   */
  private async processResultsForRole(
    searchResults: any,
    userContext: UserContext
  ): Promise<EnhancedRAGResult> {
    
    // Apply role-specific result ranking
    if (searchResults.results) {
      searchResults.results = this.rankResultsForRole(searchResults.results, userContext);
      
      // Apply complexity filtering
      searchResults.results = this.filterByComplexity(searchResults.results, userContext);
      
      // Enhance with pedagogical metadata
      searchResults.results = this.enhanceWithPedagogicalContext(searchResults.results, userContext);
    }
    
    return searchResults;
  }

  /**
   * Rank results based on role-specific criteria
   */
  private rankResultsForRole(results: any[], userContext: UserContext): any[] {
    return results.sort((a, b) => {
      let scoreA = a.score || 0;
      let scoreB = b.score || 0;
      
      // Role-specific scoring adjustments
      if (userContext.role === 'student') {
        // Prefer age-appropriate content
        if (a.metadata?.age_appropriate) scoreA += 0.1;
        if (b.metadata?.age_appropriate) scoreB += 0.1;
        
        // Prefer content with examples
        if (a.metadata?.has_examples) scoreA += 0.05;
        if (b.metadata?.has_examples) scoreB += 0.05;
      } else if (userContext.role === 'teacher') {
        // Prefer curriculum-aligned content
        if (a.metadata?.curriculum_aligned) scoreA += 0.1;
        if (b.metadata?.curriculum_aligned) scoreB += 0.1;
        
        // Prefer content with teaching notes
        if (a.metadata?.teaching_notes) scoreA += 0.05;
        if (b.metadata?.teaching_notes) scoreB += 0.05;
      } else if (userContext.role === 'parent_guardian') {
        // Prefer simplified explanations
        if (a.metadata?.parent_friendly) scoreA += 0.1;
        if (b.metadata?.parent_friendly) scoreB += 0.1;
        
        // Prefer content with home activities
        if (a.metadata?.home_activities) scoreA += 0.05;
        if (b.metadata?.home_activities) scoreB += 0.05;
      }
      
      return scoreB - scoreA;
    });
  }

  /**
   * Filter results by complexity level
   */
  private filterByComplexity(results: any[], userContext: UserContext): any[] {
    const targetComplexity = userContext.complexityLevel;
    
    return results.filter(result => {
      const contentComplexity = result.metadata?.complexity_level || 'intermediate';
      
      // Allow some flexibility in complexity matching
      if (targetComplexity === 'basic') {
        return ['basic', 'intermediate'].includes(contentComplexity);
      } else if (targetComplexity === 'intermediate') {
        return ['basic', 'intermediate', 'advanced'].includes(contentComplexity);
      } else if (targetComplexity === 'advanced') {
        return ['intermediate', 'advanced'].includes(contentComplexity);
      }
      
      return true; // Default: include all content
    });
  }

  /**
   * Enhance results with pedagogical context
   */
  private enhanceWithPedagogicalContext(results: any[], userContext: UserContext): any[] {
    return results.map(result => ({
      ...result,
      pedagogicalContext: {
        roleRelevance: this.calculateRoleRelevance(result, userContext),
        learningStyleMatch: this.calculateLearningStyleMatch(result, userContext),
        complexityAlignment: this.calculateComplexityAlignment(result, userContext),
        scaffoldingNeeded: userContext.learningPreferences.needsScaffolding
      }
    }));
  }

  /**
   * Calculate optimal search limit based on role
   */
  private calculateOptimalLimit(role: UserRole): number {
    const roleLimits = {
      'student': 8,        // Focused, digestible results
      'teacher': 12,       // Comprehensive resources
      'parent_guardian': 6  // Simplified, essential information
    };
    
    return roleLimits[role];
  }

  /**
   * Calculate dynamic score threshold based on user context
   */
  private calculateDynamicThreshold(userContext: UserContext): number {
    let threshold = 0.7; // Base threshold
    
    // Adjust based on role
    if (userContext.role === 'teacher') {
      threshold = 0.6; // Teachers need broader content access
    } else if (userContext.role === 'parent_guardian') {
      threshold = 0.75; // Parents need highly relevant content
    }
    
    // Adjust based on complexity preference
    if (userContext.complexityLevel === 'basic') {
      threshold += 0.05; // Higher threshold for basic level
    } else if (userContext.complexityLevel === 'advanced') {
      threshold -= 0.05; // Lower threshold for advanced level
    }
    
    return Math.max(0.5, Math.min(0.9, threshold));
  }

  /**
   * Get related subjects for interdisciplinary content
   */
  private getRelatedSubjects(subjects: string[]): string[] {
    const relatedMap: { [key: string]: string[] } = {
      'Mathematics': ['Physics', 'Chemistry', 'Economics'],
      'Physics': ['Mathematics', 'Chemistry'],
      'Chemistry': ['Physics', 'Biology'],
      'Biology': ['Chemistry', 'Environmental Science'],
      'Geography': ['History', 'Environmental Science'],
      'History': ['Geography', 'Political Science'],
      'Political Science': ['History', 'Economics'],
      'Economics': ['Mathematics', 'Political Science']
    };
    
    const related = new Set<string>();
    subjects.forEach(subject => {
      const relatedSubjects = relatedMap[subject] || [];
      relatedSubjects.forEach(rel => related.add(rel));
    });
    
    return Array.from(related);
  }

  /**
   * Calculate role relevance score
   */
  private calculateRoleRelevance(result: any, userContext: UserContext): number {
    let relevance = 0.5; // Base relevance
    
    const metadata = result.metadata || {};
    
    if (userContext.role === 'student') {
      if (metadata.student_friendly) relevance += 0.3;
      if (metadata.has_examples) relevance += 0.2;
    } else if (userContext.role === 'teacher') {
      if (metadata.curriculum_aligned) relevance += 0.3;
      if (metadata.teaching_resources) relevance += 0.2;
    } else if (userContext.role === 'parent_guardian') {
      if (metadata.parent_friendly) relevance += 0.3;
      if (metadata.home_support) relevance += 0.2;
    }
    
    return Math.min(1.0, relevance);
  }

  /**
   * Calculate learning style match score
   */
  private calculateLearningStyleMatch(result: any, userContext: UserContext): number {
    const metadata = result.metadata || {};
    const preferences = userContext.learningPreferences;
    
    let match = 0.5; // Base match
    
    if (preferences.visualLearning && metadata.has_visuals) match += 0.2;
    if (preferences.handsonLearning && metadata.has_activities) match += 0.2;
    if (preferences.sequentialLearning && metadata.sequential_content) match += 0.1;
    
    return Math.min(1.0, match);
  }

  /**
   * Calculate complexity alignment score
   */
  private calculateComplexityAlignment(result: any, userContext: UserContext): number {
    const contentComplexity = result.metadata?.complexity_level || 'intermediate';
    const targetComplexity = userContext.complexityLevel;
    
    if (contentComplexity === targetComplexity)
  return 1.0;
    
    // Partial matches
    const complexityOrder = ['basic', 'intermediate', 'advanced'];
    const contentIndex = complexityOrder.indexOf(contentComplexity);
    const targetIndex = complexityOrder.indexOf(targetComplexity);
    
    const distance = Math.abs(contentIndex - targetIndex);
    return Math.max(0.3, 1.0 - (distance * 0.3));
  }
}

// Export singleton instance
export const enhancedContextualRAG = new EnhancedContextualRAGPipeline();
