/**
 * Query Decomposition Service for Enhanced RAG Pipeline
 * 
 * Breaks complex multi-part queries into simpler atomic sub-queries
 * to improve retrieval accuracy for complex questions.
 * 
 * Examples:
 * - "Compare A with B" → ["What is A?", "What is B?", "How do A and B differ?"]
 * - "Explain X and how it affects Y" → ["What is X?", "What is Y?", "How does X affect Y?"]
 */

import OpenAI from 'openai';

export interface SubQuery {
  query: string;
  type: 'factual' | 'comparison' | 'cause-effect' | 'multi-step' | 'general';
  priority: number; // 1-5, higher = more important
  dependencies?: number[]; // Indices of sub-queries this depends on
}

export interface QueryDecomposition {
  isComplex: boolean;
  originalQuery: string;
  subQueries: SubQuery[];
  reasoning: string;
  complexity: {
    hasComparison: boolean;
    hasMultiPart: boolean;
    hasCauseEffect: boolean;
    hasMultiStep: boolean;
    wordCount: number;
    estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
  };
}

export class QueryDecomposer {
  private openai: OpenAI;
  private maxSubQueries: number;
  private complexityThreshold: number;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.maxSubQueries = parseInt(process.env.MAX_SUB_QUERIES || '5');
    this.complexityThreshold = parseInt(process.env.QUERY_DECOMPOSITION_THRESHOLD || '15');
  }

  /**
   * Analyze query complexity using heuristics
   */
  analyzeComplexity(query: string): QueryDecomposition['complexity'] {
    const words = query.trim().split(/\s+/);
    const wordCount = words.length;
    const lowerQuery = query.toLowerCase();

    // Detect comparison keywords
    const comparisonKeywords = [
      'compare', 'comparison', 'difference', 'differences', 'versus', 'vs',
      'contrast', 'similar', 'dissimilar', 'alike', 'unlike', 'between'
    ];
    const hasComparison = comparisonKeywords.some(kw => lowerQuery.includes(kw));

    // Detect multi-part keywords
    const multiPartKeywords = [
      ' and ', ' also ', ' additionally ', ' furthermore ', ' moreover ',
      ' as well as ', ' along with ', ' together with '
    ];
    const hasMultiPart = multiPartKeywords.some(kw => lowerQuery.includes(kw));

    // Detect cause-effect keywords
    const causeEffectKeywords = [
      'why', 'how', 'explain', 'reason', 'because', 'cause', 'effect',
      'impact', 'influence', 'affect', 'result', 'consequence', 'lead to'
    ];
    const hasCauseEffect = causeEffectKeywords.some(kw => lowerQuery.includes(kw));

    // Detect multi-step keywords
    const multiStepKeywords = [
      'first', 'then', 'after', 'before', 'next', 'finally', 'sequence',
      'step', 'process', 'procedure', 'stages', 'phases'
    ];
    const hasMultiStep = multiStepKeywords.some(kw => lowerQuery.includes(kw));

    // Estimate overall complexity
    let complexityScore = 0;
    if (hasComparison) complexityScore += 2;
    if (hasMultiPart) complexityScore += 2;
    if (hasCauseEffect) complexityScore += 1;
    if (hasMultiStep) complexityScore += 1;
    if (wordCount > 20) complexityScore += 2;
    if (wordCount > 30) complexityScore += 1;

    let estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    if (complexityScore === 0) {
      estimatedComplexity = 'simple';
    } else if (complexityScore <= 2) {
      estimatedComplexity = 'moderate';
    } else if (complexityScore <= 4) {
      estimatedComplexity = 'complex';
    } else {
      estimatedComplexity = 'very_complex';
    }

    return {
      hasComparison,
      hasMultiPart,
      hasCauseEffect,
      hasMultiStep,
      wordCount,
      estimatedComplexity
    };
  }

  /**
   * Determine if query should be decomposed based on complexity
   */
  shouldDecompose(query: string): boolean {
    const complexity = this.analyzeComplexity(query);
    
    // Decompose if:
    // 1. Query is complex or very complex
    // 2. Query has comparison or multi-part structure
    // 3. Query is longer than threshold
    return (
      complexity.estimatedComplexity === 'complex' ||
      complexity.estimatedComplexity === 'very_complex' ||
      complexity.hasComparison ||
      (complexity.hasMultiPart && complexity.wordCount >= this.complexityThreshold)
    );
  }

  /**
   * Decompose query into sub-queries using GPT-4
   */
  async decomposeQuery(query: string): Promise<QueryDecomposition> {
    console.log(`🔍 Analyzing query complexity: "${query}"`);

    // Analyze complexity first
    const complexity = this.analyzeComplexity(query);
    
    console.log(`📊 Complexity analysis:`, {
      estimatedComplexity: complexity.estimatedComplexity,
      wordCount: complexity.wordCount,
      hasComparison: complexity.hasComparison,
      hasMultiPart: complexity.hasMultiPart,
      hasCauseEffect: complexity.hasCauseEffect,
      hasMultiStep: complexity.hasMultiStep
    });

    // If query is simple, don't decompose
    if (!this.shouldDecompose(query)) {
      console.log(`✅ Query is simple, no decomposition needed`);
      return {
        isComplex: false,
        originalQuery: query,
        subQueries: [{
          query: query,
          type: 'general',
          priority: 5
        }],
        reasoning: 'Query is simple and does not require decomposition',
        complexity
      };
    }

    console.log(`🔄 Query is complex, decomposing into sub-queries...`);

    // Use GPT-4 to decompose the query
    const systemPrompt = `You are a query decomposition expert for an educational RAG system. Your task is to break down complex student queries into simpler, atomic sub-queries that can be answered independently.

Guidelines:
1. Break complex queries into 2-${this.maxSubQueries} atomic sub-queries
2. Each sub-query should be self-contained and answerable independently
3. Preserve the intent and context of the original query
4. For comparisons, create separate queries for each entity being compared, plus a comparison query
5. For cause-effect questions, create queries for the cause, effect, and relationship
6. For multi-part questions, create separate queries for each part
7. Assign priority (1-5) based on importance to answering the original query
8. Identify dependencies between sub-queries if any

Return a JSON object with this structure:
{
  "subQueries": [
    {
      "query": "atomic sub-query text",
      "type": "factual|comparison|cause-effect|multi-step|general",
      "priority": 1-5,
      "dependencies": [indices of dependent sub-queries, if any]
    }
  ],
  "reasoning": "brief explanation of decomposition strategy"
}`;

    const userPrompt = `Decompose this student query into atomic sub-queries:

"${query}"

Context: This is for a Geography textbook (Class 9, NCERT). The query is about Indian geography topics like location, climate, physical features, etc.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      console.log(`✅ Decomposed into ${result.subQueries?.length || 0} sub-queries`);
      console.log(`📝 Reasoning: ${result.reasoning}`);

      return {
        isComplex: true,
        originalQuery: query,
        subQueries: result.subQueries || [],
        reasoning: result.reasoning || 'No reasoning provided',
        complexity
      };

    } catch (error) {
      console.error('❌ Query decomposition failed:', error);
      
      // Fallback: return original query as single sub-query
      return {
        isComplex: false,
        originalQuery: query,
        subQueries: [{
          query: query,
          type: 'general',
          priority: 5
        }],
        reasoning: 'Decomposition failed, using original query',
        complexity
      };
    }
  }

  /**
   * Get statistics about decomposition
   */
  getStats() {
    return {
      maxSubQueries: this.maxSubQueries,
      complexityThreshold: this.complexityThreshold
    };
  }
}

// Singleton instance
export const queryDecomposer = new QueryDecomposer();

