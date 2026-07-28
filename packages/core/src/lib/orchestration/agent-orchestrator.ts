/**
 * Agent Orchestrator - Routes requests to appropriate agents
 * Handles agent lifecycle, error recovery, and fallback strategies
 */

import type { Container } from '@/lib/di/container';
import type { IAgent, AgentRequest, AgentResponse, StreamingAgentResponse } from '@/lib/agents/core/base-agent';
import type { IAnalyticsService } from '@/lib/services/interfaces';
import { SERVICE_NAMES } from '@/lib/di/service-registry';

export interface OrchestrationRequest extends AgentRequest {
  menuIntent: string;
  streaming?: boolean;
}

export interface OrchestrationResult {
  response: AgentResponse | StreamingAgentResponse;
  agentUsed: string;
  fallbackUsed: boolean;
}

export class AgentOrchestrator {
  private agents = new Map<string, IAgent>();
  private analyticsService: IAnalyticsService | null = null;

  constructor(private container: Container) {}

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(intent: string, agent: IAgent): void {
    this.agents.set(intent, agent);
    console.log(`📝 Registered agent: ${intent} (${agent.getConfig().name})`);
  }

  /**
   * Initialize analytics service (lazy)
   */
  private async getAnalyticsService(): Promise<IAnalyticsService> {
    if (!this.analyticsService) {
      this.analyticsService = await this.container.resolve<IAnalyticsService>(SERVICE_NAMES.ANALYTICS);
    }
    return this.analyticsService;
  }

  /**
   * Route request to appropriate agent and execute
   */
  async execute(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const { menuIntent, streaming = false } = request;

    console.log(`🎯 [Orchestrator] Routing intent: ${menuIntent}`);

    try {
      // 1. Find appropriate agent
      const agent = this.findAgent(menuIntent, request);
      
      if (!agent) {
        console.warn(`⚠️ [Orchestrator] No agent found for intent: ${menuIntent}`);
        return this.handleFallback(request, streaming);
      }

      // 2. Execute agent
      const response = streaming
        ? await agent.executeStreaming(request)
        : await agent.execute(request);

      // 3. Track analytics
      const duration = Date.now() - startTime;
      const analytics = await this.getAnalyticsService();
      await analytics.trackAgentExecution(agent.getConfig().name, duration, true);

      console.log(`✅ [Orchestrator] Executed ${agent.getConfig().name} in ${duration}ms`);

      return {
        response,
        agentUsed: agent.getConfig().name,
        fallbackUsed: false
      };

    } catch (error) {
      console.error(`❌ [Orchestrator] Error executing agent:`, error);

      // Track failure
      const duration = Date.now() - startTime;
      const analytics = await this.getAnalyticsService();
      await analytics.trackAgentExecution(menuIntent, duration, false);

      // Fallback to default agent
      return this.handleFallback(request, streaming);
    }
  }

  /**
   * Find the best agent for the request
   */
  private findAgent(intent: string, request: AgentRequest): IAgent | null {
    // 1. Try exact intent match
    const exactMatch = this.agents.get(intent);
    if (exactMatch && exactMatch.canHandle(request)) {
      return exactMatch;
    }

    // 2. Try to find any agent that can handle the request
    for (const [, agent] of this.agents) {
      if (agent.canHandle(request)) {
        console.log(`🔄 [Orchestrator] Using fallback agent: ${agent.getConfig().name}`);
        return agent;
      }
    }

    return null;
  }

  /**
   * Handle fallback when no agent can process the request
   */
  private async handleFallback(
    request: OrchestrationRequest,
    streaming: boolean
  ): Promise<OrchestrationResult> {
    console.log(`🆘 [Orchestrator] Using fallback response`);

    const fallbackContent = this.generateFallbackContent(request);

    if (streaming) {
      return {
        response: {
          stream: this.streamFallback(fallbackContent),
          metadata: {
            agentName: 'fallback',
            route: 'fallback',
            sources: []
          }
        },
        agentUsed: 'fallback',
        fallbackUsed: true
      };
    }

    return {
      response: {
        content: fallbackContent,
        metadata: {
          agentName: 'fallback',
          route: 'fallback',
          sources: [],
          fidelity: 0,
          latency: 0,
          cached: false
        }
      },
      agentUsed: 'fallback',
      fallbackUsed: true
    };
  }

  private generateFallbackContent(request: OrchestrationRequest): string {
    return `I'm here to help you with your ${request.subject} studies for ${request.classLevel}!

However, I'm having trouble understanding your request. Could you please:
- Rephrase your question more specifically?
- Mention which chapter or topic you're studying?
- Let me know what type of help you need (homework, explanation, exam prep, etc.)?

I'm ready to assist you once I understand better!`;
  }

  private async *streamFallback(content: string): AsyncGenerator<string> {
    const words = content.split(' ');
    for (let i = 0; i < words.length; i += 10) {
      yield words.slice(i, i + 10).join(' ') + ' ';
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Get list of registered agents
   */
  getRegisteredAgents(): Array<{ intent: string; name: string; description: string }> {
    return Array.from(this.agents.entries()).map(([intent, agent]) => ({
      intent,
      name: agent.getConfig().name,
      description: agent.getConfig().description
    }));
  }

  /**
   * Health check for all agents
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [intent, agent] of this.agents) {
      try {
        // Simple check - can the agent be instantiated and configured?
        const config = agent.getConfig();
        health[intent] = !!config.name;
      } catch (error) {
        health[intent] = false;
      }
    }

    return health;
  }
}

