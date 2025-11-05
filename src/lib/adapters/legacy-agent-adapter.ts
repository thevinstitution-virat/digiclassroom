/**
 * Legacy Agent Adapter
 * Provides new enterprise services to existing agents WITHOUT modifying agent code
 * 
 * Usage in existing agents:
 *   const services = LegacyAgentAdapter.getServices();
 *   const embedding = await services.llm.createEmbedding(text);
 */

import { Container } from '@/lib/di/container';
import { registerServices, initializeServices, SERVICE_NAMES } from '@/lib/di/service-registry';
import type {
  ILLMService,
  IVectorSearchService,
  ICacheService,
  IPreGeneratedAnswersService,
  IContentVerificationService,
  IUserService,
  IAnalyticsService
} from '@/lib/services/interfaces';

export interface LegacyAgentServices {
  llm: ILLMService;
  vectorSearch: IVectorSearchService;
  cache: ICacheService;
  preGenAnswers: IPreGeneratedAnswersService;
  verification: IContentVerificationService;
  user: IUserService;
  analytics: IAnalyticsService;
}

export class LegacyAgentAdapter {
  private static container: Container | null = null;
  private static services: LegacyAgentServices | null = null;
  private static initPromise: Promise<void> | null = null;

  /**
   * Initialize services (call once at app startup)
   */
  static async initialize(): Promise<void> {
    if (this.services) return; // Already initialized

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      console.log('🔧 Initializing Legacy Agent Adapter...');

      this.container = Container.getInstance();
      await registerServices(this.container);
      await initializeServices(this.container);

      // Resolve all services
      this.services = {
        llm: await this.container.resolve<ILLMService>(SERVICE_NAMES.LLM),
        vectorSearch: await this.container.resolve<IVectorSearchService>(SERVICE_NAMES.VECTOR_SEARCH),
        cache: await this.container.resolve<ICacheService>(SERVICE_NAMES.CACHE),
        preGenAnswers: await this.container.resolve<IPreGeneratedAnswersService>(SERVICE_NAMES.PRE_GEN_ANSWERS),
        verification: await this.container.resolve<IContentVerificationService>(SERVICE_NAMES.CONTENT_VERIFICATION),
        user: await this.container.resolve<IUserService>(SERVICE_NAMES.USER),
        analytics: await this.container.resolve<IAnalyticsService>(SERVICE_NAMES.ANALYTICS)
      };

      console.log('✅ Legacy Agent Adapter initialized');
    })();

    await this.initPromise;
  }

  /**
   * Get services for use in existing agents
   * Automatically initializes if not already done
   */
  static async getServices(): Promise<LegacyAgentServices> {
    if (!this.services) {
      await this.initialize();
    }
    return this.services!;
  }

  /**
   * Get a specific service
   */
  static async getService<T>(serviceName: string): Promise<T> {
    if (!this.container) {
      await this.initialize();
    }
    return this.container!.resolve<T>(serviceName);
  }

  /**
   * Check if services are initialized
   */
  static isInitialized(): boolean {
    return this.services !== null;
  }

  /**
   * Get container (for advanced usage)
   */
  static getContainer(): Container | null {
    return this.container;
  }
}

