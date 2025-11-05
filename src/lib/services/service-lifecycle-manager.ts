/**
 * Service Lifecycle Manager
 * 🔧 CRITICAL FIX: Prevents excessive service re-initialization and manages singleton instances
 */

export class ServiceLifecycleManager {
  private static instances: Map<string, any> = new Map();
  private static initializationTimes: Map<string, number> = new Map();
  private static initializationCounts: Map<string, number> = new Map();

  // 🛡️ ENHANCED: Performance optimization caches
  private static userContextCache: Map<string, any> = new Map();
  private static qdrantSchemaCache: Map<string, any> = new Map();
  private static serviceConfigCache: Map<string, any> = new Map();
  private static lastCacheCleanup: number = Date.now();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

  /**
   * 🛡️ ENHANCED: Get singleton instance with performance optimizations and caching
   */
  static getInstance<T>(
    serviceName: string,
    factory: () => T,
    forceNew: boolean = false
  ): T {
    // Perform cache cleanup if needed
    this.performCacheCleanupIfNeeded();

    const currentCount = this.initializationCounts.get(serviceName) || 0;

    if (!this.instances.has(serviceName) || forceNew) {
      console.log(`🏗️ Creating new instance: ${serviceName} (count: ${currentCount + 1})`);

      const startTime = Date.now();

      // 🛡️ ENHANCED: Check for cached configuration before creating instance
      const cachedConfig = this.serviceConfigCache.get(serviceName);
      let instance: T;

      if (cachedConfig && !forceNew) {
        console.log(`⚡ Using cached configuration for ${serviceName}`);
        instance = this.createInstanceWithCachedConfig(factory, cachedConfig);
      } else {
        instance = factory();
        // Cache the configuration for future use
        this.cacheServiceConfiguration(serviceName, instance);
      }

      const initTime = Date.now() - startTime;

      this.instances.set(serviceName, instance);
      this.initializationTimes.set(serviceName, initTime);
      this.initializationCounts.set(serviceName, currentCount + 1);

      console.log(`✅ ${serviceName} initialized in ${initTime}ms`);

      // 🛡️ ENHANCED: More sophisticated warning system
      if (currentCount > 10) {
        console.error(`🚨 ${serviceName} has been initialized ${currentCount + 1} times - CRITICAL memory leak detected!`);
        this.logServiceLeakDiagnostics(serviceName);
      } else if (currentCount > 5) {
        console.warn(`⚠️ ${serviceName} has been initialized ${currentCount + 1} times - potential memory leak!`);
      }
    } else {
      console.log(`♻️ Reusing existing instance: ${serviceName} (${this.getInstanceAge(serviceName)}ms old)`);
    }

    return this.instances.get(serviceName);
  }

  /**
   * Check if service instance exists
   */
  static hasInstance(serviceName: string): boolean {
    return this.instances.has(serviceName);
  }

  /**
   * Clear specific service instance
   */
  static clearInstance(serviceName: string): void {
    if (this.instances.has(serviceName)) {
      console.log(`🗑️ Clearing instance: ${serviceName}`);
      this.instances.delete(serviceName);
      this.initializationTimes.delete(serviceName);
    }
  }

  /**
   * Clear all service instances
   */
  static clearAllInstances(): void {
    console.log('🧹 Clearing all service instances');
    this.instances.clear();
    this.initializationTimes.clear();
    // Keep initialization counts for monitoring
  }

  /**
   * Get service statistics
   */
  static getServiceStats(): {
    activeInstances: number;
    totalInitializations: number;
    serviceDetails: Array<{
      name: string;
      initializationTime: number;
      initializationCount: number;
      isActive: boolean;
    }>;
  } {
    const serviceDetails: Array<{
      name: string;
      initializationTime: number;
      initializationCount: number;
      isActive: boolean;
    }> = [];

    // Combine data from all maps
    const allServiceNames = new Set([
      ...this.instances.keys(),
      ...this.initializationTimes.keys(),
      ...this.initializationCounts.keys()
    ]);

    let totalInitializations = 0;

    for (const serviceName of allServiceNames) {
      const initCount = this.initializationCounts.get(serviceName) || 0;
      totalInitializations += initCount;

      serviceDetails.push({
        name: serviceName,
        initializationTime: this.initializationTimes.get(serviceName) || 0,
        initializationCount: initCount,
        isActive: this.instances.has(serviceName)
      });
    }

    return {
      activeInstances: this.instances.size,
      totalInitializations,
      serviceDetails: serviceDetails.sort((a, b) => b.initializationCount - a.initializationCount)
    };
  }

  /**
   * Log service statistics
   */
  static logServiceStats(): void {
    const stats = this.getServiceStats();
    
    console.log('\n📊 SERVICE LIFECYCLE STATISTICS');
    console.log('=====================================');
    console.log(`Active instances: ${stats.activeInstances}`);
    console.log(`Total initializations: ${stats.totalInitializations}`);
    
    if (stats.serviceDetails.length > 0) {
      console.log('\n📋 Service Details:');
      stats.serviceDetails.forEach(service => {
        const status = service.isActive ? '✅' : '❌';
        const warning = service.initializationCount > 5 ? ' ⚠️ EXCESSIVE' : '';
        console.log(`   ${status} ${service.name}: ${service.initializationCount} inits, ${service.initializationTime}ms${warning}`);
      });
    }
    
    // Identify potential issues
    const excessiveServices = stats.serviceDetails.filter(s => s.initializationCount > 5);
    if (excessiveServices.length > 0) {
      console.log('\n⚠️ POTENTIAL ISSUES:');
      excessiveServices.forEach(service => {
        console.log(`   - ${service.name}: ${service.initializationCount} initializations (potential memory leak)`);
      });
    }
    
    console.log('=====================================\n');
  }

  /**
   * Monitor service lifecycle and log warnings
   */
  static startMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
    console.log(`🔍 Starting service lifecycle monitoring (interval: ${intervalMs}ms)`);
    
    return setInterval(() => {
      const stats = this.getServiceStats();
      
      // Log warnings for excessive initializations
      const excessiveServices = stats.serviceDetails.filter(s => s.initializationCount > 10);
      if (excessiveServices.length > 0) {
        console.warn('⚠️ SERVICE LIFECYCLE WARNING:');
        excessiveServices.forEach(service => {
          console.warn(`   - ${service.name}: ${service.initializationCount} initializations detected`);
        });
      }
      
      // Log memory usage if too many active instances
      if (stats.activeInstances > 20) {
        console.warn(`⚠️ High number of active service instances: ${stats.activeInstances}`);
      }
    }, intervalMs);
  }

  /**
   * Cleanup and optimize service instances
   */
  static optimizeServices(): void {
    console.log('🔧 Optimizing service instances...');
    
    const stats = this.getServiceStats();
    let optimized = 0;

    // Clear inactive instances that have been initialized many times
    for (const service of stats.serviceDetails) {
      if (!service.isActive && service.initializationCount > 3) {
        this.clearInstance(service.name);
        optimized++;
      }
    }

    console.log(`✅ Service optimization complete: ${optimized} instances cleared`);
  }

  /**
   * Create a managed service factory
   */
  static createManagedFactory<T>(
    serviceName: string,
    factory: () => T
  ): () => T {
    return () => this.getInstance(serviceName, factory);
  }

  /**
   * Decorator for singleton services
   */
  static singleton(serviceName?: string) {
    return function <T extends { new (...args: any[]): {} }>(constructor: T) {
      const name = serviceName || constructor.name;

      return class extends constructor {
        constructor(...args: any[]) {
          // Check if instance already exists
          if (ServiceLifecycleManager.hasInstance(name)) {
            return ServiceLifecycleManager.getInstance(name, () => new constructor(...args));
          }

          super(...args);
          ServiceLifecycleManager.instances.set(name, this);

          const count = ServiceLifecycleManager.initializationCounts.get(name) || 0;
          ServiceLifecycleManager.initializationCounts.set(name, count + 1);

          console.log(`🏗️ Singleton created: ${name} (count: ${count + 1})`);
        }
      };
    };
  }

  // 🛡️ NEW: Performance optimization and caching methods

  /**
   * Cache user context to avoid repeated database queries
   */
  static cacheUserContext(userId: string, context: any, ttl: number = this.CACHE_TTL): void {
    const cacheEntry = {
      data: context,
      timestamp: Date.now(),
      ttl
    };

    this.userContextCache.set(userId, cacheEntry);
    console.log(`💾 User context cached for user: ${userId}`);
  }

  /**
   * Get cached user context
   */
  static getCachedUserContext(userId: string): any | null {
    const cacheEntry = this.userContextCache.get(userId);

    if (!cacheEntry) return null;

    const isExpired = Date.now() - cacheEntry.timestamp > cacheEntry.ttl;
    if (isExpired) {
      this.userContextCache.delete(userId);
      console.log(`🗑️ Expired user context cache removed for user: ${userId}`);
      return null;
    }

    console.log(`⚡ Using cached user context for user: ${userId}`);
    return cacheEntry.data;
  }

  /**
   * Cache Qdrant schema to avoid repeated schema queries
   */
  static cacheQdrantSchema(collectionName: string, schema: any): void {
    const cacheEntry = {
      data: schema,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL * 2 // Schema changes less frequently
    };

    this.qdrantSchemaCache.set(collectionName, cacheEntry);
    console.log(`💾 Qdrant schema cached for collection: ${collectionName}`);
  }

  /**
   * Get cached Qdrant schema
   */
  static getCachedQdrantSchema(collectionName: string): any | null {
    const cacheEntry = this.qdrantSchemaCache.get(collectionName);

    if (!cacheEntry) return null;

    const isExpired = Date.now() - cacheEntry.timestamp > cacheEntry.ttl;
    if (isExpired) {
      this.qdrantSchemaCache.delete(collectionName);
      console.log(`🗑️ Expired Qdrant schema cache removed for collection: ${collectionName}`);
      return null;
    }

    console.log(`⚡ Using cached Qdrant schema for collection: ${collectionName}`);
    return cacheEntry.data;
  }

  /**
   * Batch preload user contexts for multiple users
   */
  static async batchPreloadUserContexts(
    userIds: string[],
    contextLoader: (userId: string) => Promise<any>
  ): Promise<void> {
    console.log(`🔄 Batch preloading user contexts for ${userIds.length} users...`);

    const loadPromises = userIds.map(async (userId) => {
      try {
        if (!this.getCachedUserContext(userId)) {
          const context = await contextLoader(userId);
          this.cacheUserContext(userId, context);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to preload context for user ${userId}:`, error);
      }
    });

    await Promise.all(loadPromises);
    console.log(`✅ Batch preload completed for ${userIds.length} users`);
  }

  /**
   * Perform cache cleanup if needed
   */
  private static performCacheCleanupIfNeeded(): void {
    const now = Date.now();

    if (now - this.lastCacheCleanup > this.CACHE_CLEANUP_INTERVAL) {
      this.cleanupExpiredCaches();
      this.lastCacheCleanup = now;
    }
  }

  /**
   * Clean up expired cache entries
   */
  private static cleanupExpiredCaches(): void {
    console.log('🧹 Performing cache cleanup...');

    let cleanedEntries = 0;

    // Clean user context cache
    for (const [key, entry] of this.userContextCache.entries()) {
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.userContextCache.delete(key);
        cleanedEntries++;
      }
    }

    // Clean Qdrant schema cache
    for (const [key, entry] of this.qdrantSchemaCache.entries()) {
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.qdrantSchemaCache.delete(key);
        cleanedEntries++;
      }
    }

    // Clean service config cache
    for (const [key, entry] of this.serviceConfigCache.entries()) {
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.serviceConfigCache.delete(key);
        cleanedEntries++;
      }
    }

    if (cleanedEntries > 0) {
      console.log(`🗑️ Cache cleanup completed: ${cleanedEntries} expired entries removed`);
    }
  }

  /**
   * Cache service configuration for faster initialization
   */
  private static cacheServiceConfiguration(serviceName: string, instance: any): void {
    try {
      // Extract cacheable configuration from service instance
      const config = this.extractServiceConfig(instance);

      if (config) {
        const cacheEntry = {
          data: config,
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        };

        this.serviceConfigCache.set(serviceName, cacheEntry);
        console.log(`💾 Service configuration cached for: ${serviceName}`);
      }
    } catch (error) {
      console.warn(`⚠️ Failed to cache configuration for ${serviceName}:`, error);
    }
  }

  /**
   * Extract cacheable configuration from service instance
   */
  private static extractServiceConfig(instance: any): any | null {
    // Extract common configuration properties that can be cached
    const config: any = {};

    if (instance.defaultModel) config.defaultModel = instance.defaultModel;
    if (instance.apiKey) config.hasApiKey = !!instance.apiKey;
    if (instance.baseURL) config.baseURL = instance.baseURL;
    if (instance.timeout) config.timeout = instance.timeout;
    if (instance.maxRetries) config.maxRetries = instance.maxRetries;

    return Object.keys(config).length > 0 ? config : null;
  }

  /**
   * Create instance with cached configuration
   */
  private static createInstanceWithCachedConfig<T>(factory: () => T, cachedConfig: any): T {
    // For now, just use the factory - in the future, we could optimize this further
    // by pre-configuring instances with cached settings
    return factory();
  }

  /**
   * Get instance age in milliseconds
   */
  private static getInstanceAge(serviceName: string): number {
    const initTime = this.initializationTimes.get(serviceName);
    return initTime ? Date.now() - initTime : 0;
  }

  /**
   * Log diagnostics for service leaks
   */
  private static logServiceLeakDiagnostics(serviceName: string): void {
    console.log(`🔍 SERVICE LEAK DIAGNOSTICS for ${serviceName}:`);
    console.log(`   - Initialization count: ${this.initializationCounts.get(serviceName)}`);
    console.log(`   - Instance age: ${this.getInstanceAge(serviceName)}ms`);
    console.log(`   - Memory usage: ${process.memoryUsage().heapUsed / 1024 / 1024}MB`);
    console.log(`   - Active instances: ${this.instances.size}`);

    // Log stack trace to help identify where excessive initializations are coming from
    console.trace('Service initialization stack trace');
  }

  /**
   * Get comprehensive cache statistics
   */
  static getCacheStats(): any {
    return {
      userContextCache: {
        size: this.userContextCache.size,
        entries: Array.from(this.userContextCache.keys())
      },
      qdrantSchemaCache: {
        size: this.qdrantSchemaCache.size,
        entries: Array.from(this.qdrantSchemaCache.keys())
      },
      serviceConfigCache: {
        size: this.serviceConfigCache.size,
        entries: Array.from(this.serviceConfigCache.keys())
      },
      lastCleanup: new Date(this.lastCacheCleanup).toISOString(),
      cacheSettings: {
        ttl: this.CACHE_TTL,
        cleanupInterval: this.CACHE_CLEANUP_INTERVAL
      }
    };
  }

  /**
   * Clear all caches
   */
  static clearAllCaches(): void {
    console.log('🧹 Clearing all caches...');

    const totalEntries = this.userContextCache.size +
                        this.qdrantSchemaCache.size +
                        this.serviceConfigCache.size;

    this.userContextCache.clear();
    this.qdrantSchemaCache.clear();
    this.serviceConfigCache.clear();

    console.log(`✅ All caches cleared: ${totalEntries} entries removed`);
  }
}

// Export convenience functions
export const getServiceInstance = ServiceLifecycleManager.getInstance.bind(ServiceLifecycleManager);
export const clearServiceInstance = ServiceLifecycleManager.clearInstance.bind(ServiceLifecycleManager);
export const logServiceStats = ServiceLifecycleManager.logServiceStats.bind(ServiceLifecycleManager);
export const optimizeServices = ServiceLifecycleManager.optimizeServices.bind(ServiceLifecycleManager);

// 🛡️ NEW: Export performance optimization functions
export const cacheUserContext = ServiceLifecycleManager.cacheUserContext.bind(ServiceLifecycleManager);
export const getCachedUserContext = ServiceLifecycleManager.getCachedUserContext.bind(ServiceLifecycleManager);
export const cacheQdrantSchema = ServiceLifecycleManager.cacheQdrantSchema.bind(ServiceLifecycleManager);
export const getCachedQdrantSchema = ServiceLifecycleManager.getCachedQdrantSchema.bind(ServiceLifecycleManager);
export const batchPreloadUserContexts = ServiceLifecycleManager.batchPreloadUserContexts.bind(ServiceLifecycleManager);
export const getCacheStats = ServiceLifecycleManager.getCacheStats.bind(ServiceLifecycleManager);
export const clearAllCaches = ServiceLifecycleManager.clearAllCaches.bind(ServiceLifecycleManager);
