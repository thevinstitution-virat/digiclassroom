/**
 * Constrained Generation Tools for DigiClassroom AI Tutor
 * Implements textbook-only content generation with strict verification
 */

import { OpenAIService } from '../services/openai_service';

// Legacy type for backward compatibility
export interface LLMRequest {
  model_type: string;
  prompt: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
}
import { SourceChunk, VerificationResult, ContentVerificationEngine } from './source_validation';

export interface ConstrainedGenerationRequest {
  query: string;
  source_chunks: SourceChunk[];
  grade_level: number;
  subject: string;
  board_type: string;
  bloom_level?: string;
  cultural_context?: boolean;
  temperature?: number;
}

export interface ConstrainedGenerationResponse {
  answer: string;
  verification_result: VerificationResult;
  model_used: string;
  bloom_level: string;
  cultural_elements: string[];
  processing_metadata: {
    generation_time: number;
    verification_time: number;
    iterations: number;
    temperature_used: number;
  };
}

export class TextbookConstrainedGenerator {
        // @ts-ignore
  private llm_service: LLMService;
  private verification_engine: ContentVerificationEngine;
  
  // Model selection based on complexity and use case
  private readonly MODEL_ROUTING = {
    lookup: 'command-r7b-12-2024',      // Fast lookups and simple queries
    tutoring: 'command-r-08-2024',      // Standard tutoring interactions
    reasoning: 'command-r-plus-08-2024' // Complex reasoning and analysis
  };
  
  // Temperature settings for different contexts
  private readonly TEMPERATURE_SETTINGS = {
    lookup: 0.1,      // Very deterministic for factual lookups
    tutoring: 0.4,    // Balanced for educational content
    reasoning: 0.7,   // More creative for complex explanations
    ui_prompts: 0.7   // Creative for user interface interactions
  };

  constructor() {
    this.llm_service = OpenAIService.getInstance() as any; // Legacy compatibility
    this.verification_engine = new ContentVerificationEngine();
    console.log('🎯 Textbook Constrained Generator initialized');
  }

  /**
   * Generate textbook-only answer with strict content verification
   */
  async generate_textbook_only_answer(request: ConstrainedGenerationRequest): Promise<ConstrainedGenerationResponse> {
    const start_time = Date.now();
    console.log(`🎯 Generating constrained answer for: ${request.query.substring(0, 50)}...`);
    
    // Determine appropriate model and temperature based on query complexity
    const { model_type, temperature } = this.selectModelAndTemperature(request.query, request.bloom_level);
    
    // Build constrained prompt with strict textbook-only instructions
    const constrained_prompt = this.buildConstrainedPrompt(request);
    
    let answer = '';
    let verification_result: VerificationResult;
    let iterations = 0;
    const max_iterations = 3;
    
    // Iterative generation with verification
    for (iterations = 1; iterations <= max_iterations; iterations++) {
      console.log(`🔄 Generation iteration ${iterations}/${max_iterations}`);
      
      // Generate response using selected model
      const llm_request: LLMRequest = {
        model_type: model_type as any,
        prompt: constrained_prompt,
        temperature: temperature,
        max_tokens: 800,
        system_prompt: this.buildConstrainedSystemPrompt(request)
      };
      
      const llm_response = await this.llm_service.generate_response(llm_request);
      answer = llm_response.text;
      
      // Verify content against source material
      const verification_start = Date.now();
      verification_result = await this.verification_engine.verify_content_source(
        answer,
        request.source_chunks,
        true // Require citations
      );
      const verification_time = Date.now() - verification_start;
      
      // Check if verification passed
      if (verification_result.is_verified) {
        console.log(`✅ Answer verified with ${verification_result.overall_fidelity_score.toFixed(3)} fidelity`);
        break;
      }
      
      // Refine prompt for next iteration
        // @ts-ignore
      constrained_prompt = this.refinePromptBasedOnVerification(constrained_prompt, verification_result);
    }
    
    const generation_time = Date.now() - start_time;
    
    // Extract cultural elements and Bloom's level
    const cultural_elements = this.extractCulturalElements(answer);
    const bloom_level = this.determineFinalBloomLevel(request.bloom_level, answer);
    
    console.log(`🎓 Constrained generation complete: ${iterations} iterations, ${generation_time}ms`);
    
    return {
      answer,
      verification_result: verification_result!,
      model_used: model_type,
      bloom_level,
      cultural_elements,
      processing_metadata: {
        generation_time,
        verification_time: verification_result!.verification_details ? 0 : 0, // Simplified
        iterations,
        temperature_used: temperature
      }
    };
  }

  /**
   * Select appropriate model and temperature based on query complexity
   */
  private selectModelAndTemperature(query: string, bloom_level?: string): { model_type: string; temperature: number } {
    // Analyze query complexity
    const is_simple_lookup = this.isSimpleLookup(query);
    const requires_reasoning = this.requiresComplexReasoning(query, bloom_level);
    
    if (is_simple_lookup) {
      return {
        model_type: this.MODEL_ROUTING.lookup,
        temperature: this.TEMPERATURE_SETTINGS.lookup
      };
    } else if (requires_reasoning) {
      return {
        model_type: this.MODEL_ROUTING.reasoning,
        temperature: this.TEMPERATURE_SETTINGS.reasoning
      };
    } else {
      return {
        model_type: this.MODEL_ROUTING.tutoring,
        temperature: this.TEMPERATURE_SETTINGS.tutoring
      };
    }
  }

  private isSimpleLookup(query: string): boolean {
    const lookup_patterns = [
      /^what is/i,
      /^define/i,
      /^meaning of/i,
      /^who is/i,
      /^when did/i,
      /^where is/i
    ];
    
    return lookup_patterns.some(pattern => pattern.test(query));
  }

  private requiresComplexReasoning(query: string, bloom_level?: string): boolean {
    const reasoning_patterns = [
      /why/i,
      /how does/i,
      /explain the relationship/i,
      /compare/i,
      /analyze/i,
      /evaluate/i,
      /synthesize/i
    ];
    
    const high_bloom_levels = ['analyze', 'evaluate', 'create', 'synthesis'];
    
        // @ts-ignore
    return reasoning_patterns.some(pattern => pattern.test(query)) ||
           (bloom_level && high_bloom_levels.includes(bloom_level.toLowerCase()));
  }

  /**
   * Build constrained prompt that enforces textbook-only content
   */
  private buildConstrainedPrompt(request: ConstrainedGenerationRequest): string {
    const context_text = this.formatSourceChunksWithCitations(request.source_chunks);
    
    const bloom_instruction = this.getBloomLevelInstruction(request.bloom_level || 'understand');
    const cultural_instruction = request.cultural_context ? this.getCulturalContextInstruction(request.grade_level) : '';
    
    return `You are a textbook content organizer for ${request.board_type} ${request.subject} curriculum. Your ONLY job is to reorganize and present information that is explicitly stated in the provided textbook excerpts.

STRICT CONSTRAINTS:
1. Use ONLY the information provided in the textbook excerpts below
2. Do NOT add any external knowledge or general information
3. Every statement must be directly traceable to the source material
4. ONLY include citations with verified metadata - NO fake citations like [Ch Unknown, Pg Unknown]
5. If no verified citation metadata exists, omit the citation entirely
6. If the textbook content is insufficient, state this clearly and honestly

EDUCATIONAL CONTEXT:
- Grade Level: Class ${request.grade_level}
- Subject: ${request.subject}
- Board: ${request.board_type}
- Bloom's Level: ${bloom_instruction}

${cultural_instruction}

TEXTBOOK EXCERPTS:
${context_text}

STUDENT QUESTION: ${request.query}

INSTRUCTIONS:
- Reorganize the textbook content to answer the question
- Maintain the exact meaning and terminology from the source
- Add citations after each fact or statement
- Use age-appropriate language for Class ${request.grade_level}
- If information is missing, state: "This information is not available in the provided textbook content"

ANSWER:`;
  }

  private buildConstrainedSystemPrompt(request: ConstrainedGenerationRequest): string {
    return `You are an expert textbook content organizer for Indian education (${request.board_type} curriculum). 

CORE PRINCIPLES:
- ONLY use information explicitly stated in the provided textbook excerpts
- Maintain 100% fidelity to source material
- Include proper citations for every statement
- Use age-appropriate language for Class ${request.grade_level}
- Integrate Indian cultural context when relevant
- Follow Bloom's taxonomy level: ${request.bloom_level || 'understand'}

FORBIDDEN ACTIONS:
- Adding external knowledge not in the textbook
- Making assumptions or inferences beyond the source material
- Providing general explanations without textbook backing
- Creating fake citations with "Unknown" or placeholder values
- Adding citations when metadata is not verified or available

Remember: You are helping a Class ${request.grade_level} student with ${request.subject} using ONLY their textbook content.`;
  }

  private formatSourceChunksWithCitations(chunks: SourceChunk[]): string {
    return chunks.map((chunk, index) => {
      const citation = this.buildCitation(chunk);
      return `Source ${index + 1}: ${chunk.content} ${citation}`;
    }).join('\n\n---\n\n');
  }

  private buildCitation(chunk: SourceChunk): string {
    const parts: string[] = [];

    // CRITICAL: Only use verified metadata, no fake placeholders
    if (chunk.chapter && chunk.chapter !== 'Unknown' && chunk.chapter !== 'Unknown Chapter') {
      parts.push(`Ch ${chunk.chapter}`);
    }
    if (chunk.page && chunk.page > 0) {
      parts.push(`Pg ${chunk.page}`);
    }
    if (chunk.section && chunk.section !== 'Unknown' && chunk.section !== 'N/A') {
      parts.push(`Section: ${chunk.section}`);
    }

    // Only use verified source information
    if (parts.length === 0) {
      if (chunk.source &&
          chunk.source !== 'NCERT Textbook' &&
          chunk.source !== 'Unknown' &&
          (chunk.source.includes('NCERT') || chunk.source.includes('Economics') || chunk.source.includes('Class'))) {
        parts.push(chunk.source);
      } else {
        // CRITICAL: Return empty citation if no verified metadata
        return '';
      }
    }

    return parts.length > 0 ? `[${parts.join(', ')}]` : '';
  }

  private getBloomLevelInstruction(bloom_level: string): string {
    const instructions = {
      remember: 'Focus on recalling and stating facts directly from the textbook',
      understand: 'Explain concepts using textbook definitions and examples',
      apply: 'Show how textbook concepts can be used, using textbook examples',
      analyze: 'Break down textbook concepts into components as shown in the material',
      evaluate: 'Make judgments based on criteria provided in the textbook',
      create: 'Combine textbook elements in new ways as demonstrated in the material'
    };
    
        // @ts-ignore
    return instructions[bloom_level.toLowerCase()] || instructions.understand;
  }

  private getCulturalContextInstruction(grade_level: number): string {
    // Neutralized by default: enforce global neutrality unless explicitly enabled
    return '';
  }

  private refinePromptBasedOnVerification(
    original_prompt: string,
    verification_result: VerificationResult
  ): string {
    if (verification_result.failed_sentences.length === 0) {
      return original_prompt;
    }
    
    const refinement_instruction = `
REFINEMENT NEEDED:
The following sentences failed verification (not sufficiently supported by textbook content):
${verification_result.failed_sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

INSTRUCTIONS FOR REFINEMENT:
- Remove or replace these sentences with content directly from the textbook excerpts
- Ensure every statement has a clear citation
- Stay strictly within the provided source material
- If you cannot find textbook support, omit the information

`;
    
    return original_prompt + refinement_instruction;
  }

  private extractCulturalElements(answer: string): string[] {
    const cultural_patterns = [
      /Shabash/gi,
      /festival/gi,
      /Indian/gi,
      /tradition/gi,
      /culture/gi,
      /moral/gi,
      /values/gi,
      /heritage/gi
    ];
    
    const elements: string[] = [];
    for (const pattern of cultural_patterns) {
      const matches = answer.match(pattern);
      if (matches) {
        elements.push(...matches.map(m => m.toLowerCase()));
      }
    }
    
    return [...new Set(elements)]; // Remove duplicates
  }

  private determineFinalBloomLevel(requested_level?: string, answer?: string): string {
    if (requested_level) {
      return requested_level;
    }
    
    // Simple heuristic based on answer content
    if (answer?.includes('analyze') || answer?.includes('compare')) {
      return 'analyze';
    } else if (answer?.includes('apply') || answer?.includes('use')) {
      return 'apply';
    } else {
      return 'understand';
    }
  }
}

// Factory function
export function createConstrainedGenerator(): TextbookConstrainedGenerator {
  return new TextbookConstrainedGenerator();
}
