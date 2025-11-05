/**
 * Application Initializer - Bootstrap the entire application
 * Called once during application startup (Next.js app initialization)
 */

import { Container } from '@/lib/di/container';
import { registerServices, initializeServices, SERVICE_NAMES } from '@/lib/di/service-registry';
import { AgentOrchestrator } from '@/lib/orchestration/agent-orchestrator';
import { AgentCapabilities } from '@/lib/agents/core/agent-capabilities';
import { HomeworkHelpAgent } from '@/lib/agents/homework-help.agent';

import type {
  ILLMService,
  IVectorSearchService,
  ICacheService,
  IContentVerificationService,
  IAnalyticsService
} from '@/lib/services/interfaces';

// Singleton instances
let container: Container | null = null;
let orchestrator: AgentOrchestrator | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the application (idempotent)
 * Safe to call multiple times - will only initialize once
 */
export async function initializeApplication(): Promise<void> {
  // If already initialized, return immediately
  if (container && orchestrator) {
    console.log('✅ Application already initialized');
    return;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log('⏳ Waiting for initialization to complete...');
    await initializationPromise;
    return;
  }

  // Start initialization
  initializationPromise = (async () => {
    console.log('🚀 Initializing Virat Gyankosh AI Tutor...');
    const startTime = Date.now();

    try {
      // 1. Create DI container
      container = Container.getInstance();
      console.log('✅ DI Container created');

      // 2. Register all services
      await registerServices(container);
      console.log('✅ Services registered');

      // 3. Initialize singleton services (pre-warm)
      await initializeServices(container);
      console.log('✅ Services initialized');

      // 4. Create agent orchestrator
      orchestrator = new AgentOrchestrator(container);
      console.log('✅ Agent Orchestrator created');

      // 5. Register all agents
      await registerAgents(container, orchestrator);
      console.log('✅ Agents registered');

      const duration = Date.now() - startTime;
      console.log(`🎉 Application initialized successfully in ${duration}ms`);

    } catch (error) {
      console.error('❌ Application initialization failed:', error);
      throw error;
    }
  })();

  await initializationPromise;
}

/**
 * Register all agents with the orchestrator
 */
async function registerAgents(
  container: Container,
  orchestrator: AgentOrchestrator
): Promise<void> {
  console.log('📝 Registering agents...');

  // Resolve services needed by agents
  const llmService = await container.resolve<ILLMService>(SERVICE_NAMES.LLM);
  const vectorSearchService = await container.resolve<IVectorSearchService>(SERVICE_NAMES.VECTOR_SEARCH);
  const cacheService = await container.resolve<ICacheService>(SERVICE_NAMES.CACHE);
  const verificationService = await container.resolve<IContentVerificationService>(SERVICE_NAMES.CONTENT_VERIFICATION);
  const analyticsService = await container.resolve<IAnalyticsService>(SERVICE_NAMES.ANALYTICS);

  // Create agent capabilities (shared by all agents)
  const capabilities = new AgentCapabilities({
    llmService,
    vectorSearchService,
    cacheService,
    verificationService,
    analyticsService
  });

  // Register agents
  orchestrator.registerAgent('homework_help', new HomeworkHelpAgent(capabilities));
  
  // TODO: Register other agents
  // orchestrator.registerAgent('explain_topic', new TopicExplanationAgent(capabilities));
  // orchestrator.registerAgent('exam_prep', new ExamPrepAgent(capabilities));
  // orchestrator.registerAgent('study_tips', new StudyTipsAgent(capabilities));
  // orchestrator.registerAgent('doubt_resolution', new DoubtResolutionAgent(capabilities));
  // orchestrator.registerAgent('conversational_learning', new ConversationalLearningAgent(capabilities));

  console.log('✅ All agents registered');
}

/**
 * Get the DI container (must be initialized first)
 */
export function getContainer(): Container {
  if (!container) {
    throw new Error('Application not initialized. Call initializeApplication() first.');
  }
  return container;
}

/**
 * Get the agent orchestrator (must be initialized first)
 */
export function getOrchestrator(): AgentOrchestrator {
  if (!orchestrator) {
    throw new Error('Application not initialized. Call initializeApplication() first.');
  }
  return orchestrator;
}

/**
 * Health check for the entire application
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  services: any[];
  agents: Record<string, boolean>;
}> {
  if (!container || !orchestrator) {
    return {
      healthy: false,
      services: [],
      agents: {}
    };
  }

  try {
    const serviceHealth = container.getHealthStatus();
    const agentHealth = await orchestrator.healthCheck();

    const allServicesHealthy = serviceHealth.every(s => s.healthy);
    const allAgentsHealthy = Object.values(agentHealth).every(h => h);

    return {
      healthy: allServicesHealthy && allAgentsHealthy,
      services: serviceHealth,
      agents: agentHealth
    };
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return {
      healthy: false,
      services: [],
      agents: {}
    };
  }
}

/**
 * Graceful shutdown
 */
export async function shutdown(): Promise<void> {
  console.log('🛑 Shutting down application...');

  // TODO: Implement graceful shutdown
  // - Close database connections
  // - Flush analytics
  // - Close Redis connections
  // - Cancel pending requests

  container = null;
  orchestrator = null;
  initializationPromise = null;

  console.log('✅ Application shut down');
}

