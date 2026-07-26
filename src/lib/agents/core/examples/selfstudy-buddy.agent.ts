import { logger } from '@/lib/logger';

/**
 * Selfstudy Buddy Agent - Socratic tutoring with adaptive questioning
 * Uses composition pattern with AgentCapabilities
 */

import {
  BaseAgent,
  type AgentRequest,
  type AgentResponse,
  type StreamingAgentResponse
} from '../base-agent';
import type { AgentCapabilities, AgentConfig } from '../agent-capabilities';

export class SelfstudyBuddyAgent extends BaseAgent {
  constructor(capabilities: AgentCapabilities) {
    const config: AgentConfig = {
      name: 'selfstudy_buddy',
      description: 'Socratic tutoring with step-by-step guidance',
      contentTypes: ['examples', 'solutions', 'step_by_step', 'practice_problems'],
      topK: 5,
      sectionLevel: 3,
      temperature: 0.7,
      maxTokens: 800
    };

    super(capabilities, config);
  }

  async execute(request: AgentRequest): Promise<AgentResponse> {
    logger.info(`🎓 [Selfstudy Buddy] Processing: ${request.query.substring(0, 50)}...`);

    const { result, duration } = await this.measureExecutionTime(async () => {
      // 1. Search for relevant content
      const searchResults = await this.capabilities.search.search(this.config, {
        query: request.query,
        subject: request.subject,
        classLevel: request.classLevel,
        board: request.board
      });

      if (searchResults.length === 0) {
        return this.generateFallbackResponse(request);
      }

      // 2. Determine Socratic approach based on conversation history
      const turnCount = this.calculateTurnCount(request.conversationHistory || []);
      const approach = this.determineSocraticApproach(turnCount);

      // 3. Build prompt
        // @ts-ignore
      const context = this.buildContext(searchResults);
      const prompt = this.buildSocraticPrompt(request, context, approach);

      // 4. Generate response
      const content = await this.capabilities.generation.generate(this.config, prompt);

      // 5. Verify content fidelity
      const verification = await this.capabilities.verification.verify(
        this.config,
        content,
        searchResults.map(r => r.text)
      );

      return {
        content,
        fidelity: verification.score,
        // @ts-ignore
        sources: this.extractSources(searchResults),
        cached: false
      };
    });

    return {
      content: result.content,
      metadata: {
        agentName: this.config.name,
        route: 'selfstudy_buddy',
        sources: result.sources,
        fidelity: result.fidelity,
        latency: duration,
        cached: result.cached
      }
    };
  }

  async executeStreaming(request: AgentRequest): Promise<StreamingAgentResponse> {
    logger.info(`🎓 [Selfstudy Buddy] Streaming: ${request.query.substring(0, 50)}...`);

    // 1. Search for relevant content
    const searchResults = await this.capabilities.search.search(this.config, {
      query: request.query,
      subject: request.subject,
      classLevel: request.classLevel,
      board: request.board
    });

    if (searchResults.length === 0) {
      const fallback = this.generateFallbackResponse(request);
      return {
        stream: this.capabilities.streaming.stream(fallback.content),
        metadata: {
          agentName: this.config.name,
          route: 'selfstudy_buddy',
          sources: []
        }
      };
    }

    // 2. Determine approach
    const turnCount = this.calculateTurnCount(request.conversationHistory || []);
    const approach = this.determineSocraticApproach(turnCount);

    // 3. Build prompt
        // @ts-ignore
    const context = this.buildContext(searchResults);
    const prompt = this.buildSocraticPrompt(request, context, approach);

    // 4. Generate streaming response
    const stream = this.capabilities.generation.generateStreaming(this.config, prompt);

    return {
      stream,
      metadata: {
        agentName: this.config.name,
        route: 'selfstudy_buddy',
        // @ts-ignore
        sources: this.extractSources(searchResults)
      }
    };
  }

  canHandle(request: AgentRequest): boolean {
    // Selfstudy Buddy can handle most academic questions
    return true;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private determineSocraticApproach(turnCount: number): 'QUESTIONING' | 'GUIDING' {
    // Turn 0: Assess knowledge
    // Turn 1+: Guide with questions
    return turnCount === 0 ? 'QUESTIONING' : 'GUIDING';
  }

  private buildSocraticPrompt(
    request: AgentRequest,
    context: string,
    approach: 'QUESTIONING' | 'GUIDING'
  ): string {
    const basePrompt = `You are a Socratic tutor helping a ${request.classLevel} student with ${request.subject}.

Student's question: "${request.query}"

Relevant textbook content:
${context}

`;

    if (approach === 'QUESTIONING') {
      return basePrompt + `Instead of giving the answer directly, ask 2-3 guiding questions to assess their current understanding of the topic. Be encouraging and supportive.`;
    }

    return basePrompt + `Guide the student step-by-step toward the solution using the Socratic method:
1. Break down the problem into smaller parts
2. Ask leading questions that help them think critically
3. Provide hints, not direct answers
4. Encourage them to explain their reasoning

Be patient, supportive, and adapt to their level of understanding.`;
  }

  private generateFallbackResponse(request: AgentRequest): {
    content: string;
    fidelity: number;
    sources: string[];
    cached: boolean;
  } {
    const content = `I couldn't find specific content about "${request.query}" in your ${request.subject} textbook for ${request.classLevel}.

Could you help me understand better by answering these questions:
- Which chapter or topic is this question from?
- What specific concept are you struggling with?
- Have you tried any approach to solve this problem?

This will help me guide you more effectively!`;

    return {
      content,
      fidelity: 0,
      sources: [],
      cached: false
    };
  }
}

