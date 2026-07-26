/**
 * Base Agent Interface and Types
 * All agents implement this contract for consistency
 */

import type { AgentCapabilities, AgentConfig } from './agent-capabilities';

// ============================================================================
// Agent Request/Response Types
// ============================================================================

export interface AgentRequest {
  query: string;
  subject: string;
  classLevel: string;
  board?: string;
  userId: string;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentResponse {
  content: string;
  metadata: {
    agentName: string;
    route: string;
    complexity?: string;
    sources: string[];
    fidelity: number;
    latency: number;
    cached: boolean;
  };
}

export interface StreamingAgentResponse {
  stream: AsyncGenerator<string>;
  metadata: {
    agentName: string;
    route: string;
    sources: string[];
  };
}

// ============================================================================
// Base Agent Interface
// ============================================================================

export interface IAgent {
  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig;

  /**
   * Execute agent logic (non-streaming)
   */
  execute(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Execute agent logic (streaming)
   */
  executeStreaming(request: AgentRequest): Promise<StreamingAgentResponse>;

  /**
   * Validate if agent can handle this request
   */
  canHandle(request: AgentRequest): boolean;
}

// ============================================================================
// Abstract Base Agent (Optional - provides common functionality)
// ============================================================================

export abstract class BaseAgent implements IAgent {
  protected capabilities: AgentCapabilities;
  protected config: AgentConfig;

  constructor(capabilities: AgentCapabilities, config: AgentConfig) {
    this.capabilities = capabilities;
    this.config = config;
  }

  getConfig(): AgentConfig {
    return this.config;
  }

  abstract execute(request: AgentRequest): Promise<AgentResponse>;
  abstract executeStreaming(request: AgentRequest): Promise<StreamingAgentResponse>;

  canHandle(request: AgentRequest): boolean {
    // Default implementation - can be overridden
    return true;
  }

  /**
   * Helper: Build context from search results
   */
  protected buildContext(results: Record<string, unknown>[]): string {
    return results
      .map((r, idx) => `[Source ${idx + 1}]\n${r.text}`)
      .join('\n\n---\n\n');
  }

  /**
   * Helper: Extract sources from search results
   */
  protected extractSources(results: Record<string, unknown>[]): string[] {
    return results.map(r => {
      const meta = r.metadata;
      return `${meta.subject} - Class ${meta.class_level} - ${meta.content_type}`;
    });
  }

  /**
   * Helper: Calculate turn count from conversation history
   */
  protected calculateTurnCount(history: ConversationMessage[]): number {
    return history.filter(m => m.role === 'user').length;
  }

  /**
   * Helper: Get last user message
   */
  protected getLastUserMessage(history: ConversationMessage[]): string | null {
    const userMessages = history.filter(m => m.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1].content : null;
  }

  /**
   * Helper: Format conversation history for prompt
   */
  protected formatConversationHistory(history: ConversationMessage[]): string {
    return history
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
  }

  /**
   * Helper: Measure execution time
   */
  protected async measureExecutionTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
}

