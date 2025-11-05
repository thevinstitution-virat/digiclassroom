/**
 * Enhanced Synthesis Agent with Source Constraints
 * Generates answers using ONLY textbook content with strict constraints
 */

import { OpenAIService } from '../services/openai_service';
import { SourceChunk } from './source_verification_agent';

export interface SynthesisRequest {
  query: string;
  retrieved_content: SourceChunk[];
  user_grade: number;
  subject: string;
  board_type: string;
  model_type?: string;
}

export interface SynthesisResult {
  answer: string;
  sources_used: number;
  extraction_method: 'direct_quote' | 'paraphrase' | 'reorganization';
  confidence_level: 'high' | 'medium' | 'low';
  textbook_coverage: number; // Percentage of answer covered by textbook content
}

export class ConstrainedLLMGenerator {
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = OpenAIService.getInstance();
  }

  /**
   * Generate answer using ONLY textbook content with strict constraints
   */
  async generate_textbook_only_answer(
    context: SourceChunk[],
    query: string,
    gradeLevel: number,
    subject: string,
    boardType: string
  ): Promise<string> {
    console.log(`🎯 Generating constrained answer for: ${query.substring(0, 50)}...`);
    
    // Create highly constrained prompt
    const contextText = this.formatContextWithSources(context);
    
    const prompt = `You are a textbook content extractor for ${boardType} ${subject} curriculum. Your ONLY job is to reorganize and present information that is explicitly stated in the provided textbook excerpts.

STRICT RULES - VIOLATION WILL RESULT IN REJECTION:
1. Use ONLY information explicitly present in the textbook excerpts below
2. Do NOT add any general knowledge or explanations not in the text
3. Do NOT create examples unless they are directly from the textbook
4. Do NOT use phrases like "generally", "typically", "usually" unless in the source
5. Start each major point with content directly from the textbook
6. End each statement with [Source: Page X, Chapter Y] citation
7. If textbook content is insufficient, state exactly what is available

Textbook Content for Class ${gradeLevel} ${subject}:
${contextText}

Student Question: ${query}

TASK: Extract and reorganize ONLY the information from the textbook that directly answers this question. 

If the textbook doesn't contain sufficient information, respond with:
"The provided textbook content contains the following relevant information:" and list only what is present with citations.

REQUIRED FORMAT:
- Direct quotes or close paraphrases from textbook
- Clear citations for every statement
- No additional explanations beyond textbook content
- Grade-appropriate language matching the textbook style

Answer:`;

    try {
      const response = await this.openaiService.generateChatCompletion({
        messages: [
          { role: 'system', content: this.buildConstrainedSystemPrompt(gradeLevel, subject, boardType) },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        maxTokens: 800
      });

      const generatedText = response.choices[0]?.message?.content || '';
      console.log(`✅ Constrained generation complete: ${generatedText.length} characters`);
      return generatedText;

    } catch (error) {
      console.error('❌ Constrained generation error:', error);
      throw new Error(`Textbook-only generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format context with clear source attribution
   */
  private formatContextWithSources(context: SourceChunk[]): string {
    if (context.length === 0) {
      return "No textbook content available for this query.";
    }

    let formattedContext = "";
    
    context.forEach((item, index) => {
      formattedContext += `\n--- Source ${index + 1} ---\n`;
      formattedContext += `Textbook: ${item.metadata.textbook_title || 'NCERT Textbook'}\n`;
      formattedContext += `Chapter: ${item.metadata.chapter || 'Unknown'}\n`;
      formattedContext += `Page: ${item.metadata.page_number || 'Unknown'}\n`;
      formattedContext += `Class: ${item.metadata.class_level || 'Unknown'}\n`;
      formattedContext += `Content: ${item.content}\n`;
      formattedContext += `Relevance Score: ${((item.score || 0) * 100).toFixed(1)}%\n`;
    });
    
    return formattedContext;
  }

  /**
   * Build constrained system prompt
   */
  private buildConstrainedSystemPrompt(gradeLevel: number, subject: string, boardType: string): string {
    return `You are a strict textbook content curator for ${boardType} ${subject} curriculum, Class ${gradeLevel}.

CORE PRINCIPLES:
- Extract and reorganize textbook content ONLY
- Never add information beyond source material
- Maintain educational accuracy and grade-appropriate language
- Provide clear source citations for every statement
- Honor Indian educational traditions while staying factual

FORBIDDEN ACTIONS:
- Adding general knowledge not in textbooks
- Creating new examples or analogies
- Using external information or common knowledge
- Generating content without source backing
- Making assumptions beyond textbook content

Your role is to be a faithful curator of official educational content, not a knowledge generator.`;
  }
}

export class ContentExtractor {
  /**
   * Extract content that directly addresses the query from textbook sources
   */
  extract_direct_content(query: string, sources: SourceChunk[]): Array<{
    extract: string;
    source: string;
    relevance: number;
  }> {
    console.log(`🔍 Extracting direct content for: ${query}`);
    
    const relevantExtracts: Array<{
      extract: string;
      source: string;
      relevance: number;
    }> = [];
    
    const queryKeywords = new Set(
      query.toLowerCase()
        .split(/\W+/)
        .filter(word => word.length > 2)
        .filter(word => !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy', 'did', 'she', 'use', 'way', 'why'].includes(word))
    );

    for (const source of sources) {
      const content = source.content;
      const contentWords = new Set(content.toLowerCase().split(/\W+/));
      
      // Calculate keyword overlap
      const overlap = [...queryKeywords].filter(keyword => contentWords.has(keyword)).length;
      const overlapRatio = overlap / queryKeywords.size;
      
      if (overlapRatio > 0.3) { // 30% keyword overlap threshold
        // Extract relevant sentences
        const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
        
        for (const sentence of sentences) {
          const sentenceLower = sentence.toLowerCase();
          const sentenceRelevance = [...queryKeywords].filter(keyword => 
            sentenceLower.includes(keyword)
          ).length / queryKeywords.size;
          
          if (sentenceRelevance > 0.2) { // 20% keyword presence in sentence
            const citation = `${source.metadata.textbook_title || 'NCERT'}, Page ${source.metadata.page_number || 'Unknown'}, Chapter ${source.metadata.chapter || 'Unknown'}`;
            
            relevantExtracts.push({
              extract: sentence,
              source: citation,
              relevance: sentenceRelevance
            });
          }
        }
      }
    }
    
    // Sort by relevance and return top extracts
    relevantExtracts.sort((a, b) => b.relevance - a.relevance);
    
    console.log(`✅ Extracted ${relevantExtracts.length} relevant content pieces`);
    return relevantExtracts.slice(0, 10); // Top 10 most relevant
  }
}

export class EnhancedSynthesisAgent {
  private generator: ConstrainedLLMGenerator;
  private extractor: ContentExtractor;

  constructor() {
    this.generator = new ConstrainedLLMGenerator();
    this.extractor = new ContentExtractor();
  }

  /**
   * Synthesize answer strictly from textbook content
   */
  async synthesize_textbook_answer(request: SynthesisRequest): Promise<SynthesisResult> {
    console.log(`🎯 Synthesizing textbook-only answer for Class ${request.user_grade} ${request.subject}`);
    
    try {
      // Step 1: Extract direct content that addresses the query
      const directExtracts = this.extractor.extract_direct_content(
        request.query,
        request.retrieved_content
      );

      if (directExtracts.length === 0) {
        console.log('⚠️ No direct content extracts found');
        return {
          answer: `The provided textbook content does not contain sufficient information to answer: "${request.query}". Please refer to your textbook or ask a more specific question about the available content.`,
          sources_used: 0,
          extraction_method: 'direct_quote',
          confidence_level: 'low',
          textbook_coverage: 0
        };
      }

      // Step 2: Generate answer using only textbook information
      const synthesizedAnswer = await this.generator.generate_textbook_only_answer(
        request.retrieved_content,
        request.query,
        request.user_grade,
        request.subject,
        request.board_type
      );

      // Step 3: Analyze the synthesis quality
      const textbookCoverage = this.calculateTextbookCoverage(synthesizedAnswer, directExtracts);
      const confidenceLevel = this.assessConfidenceLevel(textbookCoverage, directExtracts.length);

      console.log(`✅ Synthesis complete: ${textbookCoverage.toFixed(1)}% textbook coverage, ${confidenceLevel} confidence`);

      return {
        answer: synthesizedAnswer,
        sources_used: request.retrieved_content.length,
        extraction_method: textbookCoverage > 0.8 ? 'direct_quote' : 'paraphrase',
        confidence_level: confidenceLevel,
        textbook_coverage: textbookCoverage
      };

    } catch (error) {
      console.error('❌ Synthesis error:', error);
      throw new Error(`Textbook synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate what percentage of the answer is covered by textbook content
   */
  private calculateTextbookCoverage(answer: string, extracts: Array<{extract: string; source: string; relevance: number}>): number {
    if (extracts.length === 0) return 0;

    const answerWords = new Set(answer.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const extractWords = new Set();
    
    extracts.forEach(extract => {
      extract.extract.toLowerCase().split(/\W+/).filter(w => w.length > 2).forEach(word => {
        extractWords.add(word);
      });
    });

    const coverage = [...answerWords].filter(word => extractWords.has(word)).length / answerWords.size;
    return Math.min(coverage, 1.0); // Cap at 100%
  }

  /**
   * Assess confidence level based on textbook coverage and extract quality
   */
  private assessConfidenceLevel(coverage: number, extractCount: number): 'high' | 'medium' | 'low' {
    if (coverage > 0.8 && extractCount >= 3) return 'high';
    if (coverage > 0.6 && extractCount >= 2) return 'medium';
    return 'low';
  }
}
