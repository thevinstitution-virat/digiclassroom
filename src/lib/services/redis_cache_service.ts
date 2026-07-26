import { logger } from '@/lib/logger';

import { createClient } from 'redis';
import type { RedisClientType } from 'redis';
import { ServiceLifecycleManager } from './service-lifecycle-manager';
import type { ICacheService, CacheOptions } from './interfaces';

export interface RedisCacheConfig {
  url?: string;
  password?: string;
  defaultTTL?: number;
  keyPrefix?: string;
}

export class RedisCacheService implements ICacheService {
  private client: RedisClientType | null = null;
  private config: RedisCacheConfig;
  private isConnected = false;
  private stats = { hits: 0, misses: 0 };

  static getInstance(): RedisCacheService {
    return ServiceLifecycleManager.getInstance('RedisCacheService', () => new RedisCacheService());
  }

  constructor(config?: RedisCacheConfig) {
    this.config = {
      url: config?.url || process.env.REDIS_URL || 'redis://localhost:6379',
      password: config?.password || process.env.REDIS_PASSWORD,
      defaultTTL: config?.defaultTTL || 86400, // 24 hours
      keyPrefix: config?.keyPrefix || 'virat_gyankosh:'
    };
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return;
    }

    try {
      // Only include password if it's a non-empty string
      const password = this.config.password && this.config.password.length > 0
        ? this.config.password
        : undefined;

      this.client = createClient({
        url: this.config.url,
        ...(password ? { password } : {}),
        socket: {
          connectTimeout: 5000, // 5 second timeout
          reconnectStrategy: (retries) => {
            // Stop retrying after 3 attempts to avoid blocking
            if (retries > 3) {
              logger.warn('[Redis] Max reconnection attempts reached, disabling cache');
              return false;
            }
            return Math.min(retries * 100, 1000);
          }
        }
      });

      this.client.on('error', (err) => logger.error({ error: err }, 'Redis Client Error:'));
      this.client.on('connect', () => logger.info('✅ Redis connected'));
      this.client.on('disconnect', () => logger.info('❌ Redis disconnected'));

      await this.client.connect();
      this.isConnected = true;
      logger.info('✅ Redis cache service initialized');
    } catch (error) {
      logger.error({ error: error }, 'Failed to connect to Redis:');
      // Don't throw - allow graceful degradation
      this.isConnected = false;
      this.client = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      this.client = null;
    }
  }

  private getKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      const value = await this.client!.get(this.getKey(key));
      if (value) {
        this.stats.hits++;
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error({ error: error }, 'Redis get error:');
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      const ttl = options?.ttl || this.config.defaultTTL || 86400;
      await this.client!.setEx(
        this.getKey(key),
        ttl,
        JSON.stringify(value)
      );
    } catch (error) {
      logger.error({ error: error }, 'Redis set error:');
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      await this.client!.del(this.getKey(key));
    } catch (error) {
      logger.error({ error: error }, 'Redis delete error:');
    }
  }

  async deleteByTags(tags: string[]): Promise<void> {
    // For tag-based invalidation, we'd need to maintain tag->key mappings
    // For now, implement a simple pattern-based deletion
    for (const tag of tags) {
      await this.invalidateByPattern(`*${tag}*`);
    }
  }

  async clear(): Promise<void> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      // Only clear keys with our prefix
      const keys = await this.client!.keys(`${this.config.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client!.del(keys);
      }
    } catch (error) {
      logger.error({ error: error }, 'Redis clear error:');
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      const result = await this.client!.exists(this.getKey(key));
      return result === 1;
    } catch (error) {
      logger.error({ error: error }, 'Redis exists error:');
      return false;
    }
  }

  async getStats(): Promise<{ hits: number; misses: number; hitRate: number }> {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate
    };
  }

  // Legacy methods for backward compatibility
  async cacheVectorSearchResults(key: string, results: unknown, ttl = 3600): Promise<void> {
    await this.set(key, results, { ttl });
  }

  async getCachedVectorSearchResults(key: string): Promise<any | null> {
    return await this.get(key);
  }

  async cacheVerificationResult(key: string, result: unknown, ttl = 3600): Promise<void> {
    await this.set(key, result, { ttl });
  }

  async getCachedVerificationResult(key: string): Promise<any | null> {
    return await this.get(key);
  }

  async cacheModelResponse(key: string, response: unknown, ttl = 3600): Promise<void> {
    await this.set(key, response, { ttl });
  }

  async getCachedModelResponse(key: string): Promise<any | null> {
    return await this.get(key);
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    try {
      const keys = await this.client!.keys(this.getKey(pattern));
      if (keys.length > 0) {
        await this.client!.del(keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error({ error: error }, 'Redis invalidateByPattern error:');
      return 0;
    }
  }

  async clearAll(): Promise<void> {
    await this.clear();
  }
}

export function getRedisCacheService(): RedisCacheService {
  return RedisCacheService.getInstance();
}

export async function initializeRedisCache(): Promise<RedisCacheService> {
  const service = RedisCacheService.getInstance();
  await service.connect();
  return service;
}
