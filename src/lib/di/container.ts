/**
 * Enterprise-grade Dependency Injection Container
 * Supports: Singleton, Transient, Scoped lifecycles
 * Features: Lazy initialization, circular dependency detection, health checks
 */

export enum ServiceLifecycle {
  SINGLETON = 'singleton',   // One instance for app lifetime
  TRANSIENT = 'transient',   // New instance per request
  SCOPED = 'scoped'          // One instance per request scope
}

export interface ServiceDefinition<T = any> {
  factory: (container: Container) => T | Promise<T>;
  lifecycle: ServiceLifecycle;
  dependencies?: string[];
}

export interface ServiceMetadata {
  name: string;
  lifecycle: ServiceLifecycle;
  instanceCount: number;
  lastAccessed: Date;
  healthy: boolean;
}

export class Container {
  private static instance: Container;
  private services = new Map<string, ServiceDefinition>();
  private singletons = new Map<string, any>();
  private scoped = new Map<string, Map<string, any>>();
  private metadata = new Map<string, ServiceMetadata>();
  private initializationStack: string[] = [];

  private constructor() {}

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a service with the container
   */
  register<T>(
    name: string,
    factory: (container: Container) => T | Promise<T>,
    lifecycle: ServiceLifecycle = ServiceLifecycle.SINGLETON,
    dependencies: string[] = []
  ): void {
    if (this.services.has(name)) {
      console.warn(`⚠️ Service '${name}' already registered. Overwriting...`);
    }

    this.services.set(name, { factory, lifecycle, dependencies });
    this.metadata.set(name, {
      name,
      lifecycle,
      instanceCount: 0,
      lastAccessed: new Date(),
      healthy: true
    });

    console.log(`📦 Registered service: ${name} (${lifecycle})`);
  }

  /**
   * Resolve a service from the container
   */
  async resolve<T>(name: string, scopeId?: string): Promise<T> {
    const definition = this.services.get(name);
    if (!definition) {
      throw new Error(`Service '${name}' not registered in container`);
    }

    // Detect circular dependencies
    if (this.initializationStack.includes(name)) {
      throw new Error(
        `Circular dependency detected: ${this.initializationStack.join(' -> ')} -> ${name}`
      );
    }

    // Update metadata
    const meta = this.metadata.get(name)!;
    meta.lastAccessed = new Date();

    // Handle different lifecycles
    switch (definition.lifecycle) {
      case ServiceLifecycle.SINGLETON:
        return this.resolveSingleton<T>(name, definition);

      case ServiceLifecycle.SCOPED:
        if (!scopeId) {
          throw new Error(`Scoped service '${name}' requires scopeId`);
        }
        return this.resolveScoped<T>(name, definition, scopeId);

      case ServiceLifecycle.TRANSIENT:
        return this.resolveTransient<T>(name, definition);

      default:
        throw new Error(`Unknown lifecycle: ${definition.lifecycle}`);
    }
  }

  private async resolveSingleton<T>(name: string, definition: ServiceDefinition): Promise<T> {
    if (this.singletons.has(name)) {
      console.log(`♻️ Reusing singleton: ${name}`);
      return this.singletons.get(name);
    }

    console.log(`🔨 Creating singleton: ${name}`);
    const instance = await this.createInstance<T>(name, definition);
    this.singletons.set(name, instance);

    const meta = this.metadata.get(name)!;
    meta.instanceCount = 1;

    return instance;
  }

  private async resolveScoped<T>(
    name: string,
    definition: ServiceDefinition,
    scopeId: string
  ): Promise<T> {
    if (!this.scoped.has(scopeId)) {
      this.scoped.set(scopeId, new Map());
    }

    const scopeMap = this.scoped.get(scopeId)!;
    if (scopeMap.has(name)) {
      return scopeMap.get(name);
    }

    const instance = await this.createInstance<T>(name, definition);
    scopeMap.set(name, instance);

    return instance;
  }

  private async resolveTransient<T>(name: string, definition: ServiceDefinition): Promise<T> {
    const instance = await this.createInstance<T>(name, definition);
    
    const meta = this.metadata.get(name)!;
    meta.instanceCount++;

    return instance;
  }

  private async createInstance<T>(name: string, definition: ServiceDefinition): Promise<T> {
    this.initializationStack.push(name);

    try {
      const instance = await definition.factory(this);
      this.initializationStack.pop();
      return instance;
    } catch (error) {
      this.initializationStack.pop();
      
      const meta = this.metadata.get(name)!;
      meta.healthy = false;

      throw new Error(`Failed to create instance of '${name}': ${error}`);
    }
  }

  /**
   * Clear scoped instances for a specific scope
   */
  clearScope(scopeId: string): void {
    this.scoped.delete(scopeId);
  }

  /**
   * Get health status of all services
   */
  getHealthStatus(): ServiceMetadata[] {
    return Array.from(this.metadata.values());
  }

  /**
   * Reset container (for testing)
   */
  reset(): void {
    this.services.clear();
    this.singletons.clear();
    this.scoped.clear();
    this.metadata.clear();
    this.initializationStack = [];
  }
}

