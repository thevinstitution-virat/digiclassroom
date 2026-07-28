/**
 * Redis Cache Service Implementation
 * Features:
 * - Connection pooling
 * - Tag-based invalidation
 * - Hit/miss tracking
 * - Automatic serialization/deserialization
 * - Error handling with fallback
 */

import { createClient, RedisClientType } from 'redis';
import type { ICacheService, CacheOptions } from '../interfaces';
import { APP_CONFIG } from '@/lib/config/app-config';

export interface RedisCacheServiceConfig {
  url?: string;
  password?: string;
  defaultTTL?: number;
  keyPrefix?: string;
}

export class RedisCacheService implements ICacheService {
  private client: RedisClientType;
  private keyPrefix: string;
  private defaultTTL: number;
  private stats = { hits: 0, misses: 0 };
  private connected = false;

  constructor(config?: RedisCacheServiceConfig) {
    this.keyPrefix = config?.keyPrefix || APP_CONFIG.redis.cache.keyPrefix;
    this.defaultTTL = config?.defaultTTL || APP_CONFIG.redis.cache.defaultTTL;

    this.client = createClient({
      url: config?.url || APP_CONFIG.redis.url,
      password: config?.password || APP_CONFIG.redis.password
    });

    this.client.on('error', (err) => {
      console.error('❌ Redis error:', err);
      this.connected = false;
    });

    this.client.on('connect', () => {
      console.log('✅ Redis connected');
      this.connected = true;
    });

    this.client.on('ready', () => {
      console.log('✅ Redis ready');
      this.connected = true;
    });

    // Connect asynchronously
    this.connect();
  }

  private async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      console.log('✅ Redis Cache Service initialized');
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      this.connected = false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.connected) {
      console.warn('⚠️ Redis not connected, cache miss');
      this.stats.misses++;
      return null;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.client.get(fullKey);

      if (value) {
        this.stats.hits++;
        return JSON.parse(value) as T;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error('❌ Redis get error:', error);
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.connected) {
      console.warn('⚠️ Redis not connected, skipping cache set');
      return;
    }

    try {
      const fullKey = this.keyPrefix + key;
      const serialized = JSON.stringify(value);
      const ttl = options?.ttl || this.defaultTTL;

      await this.client.setEx(fullKey, ttl, serialized);

      // Store tags for invalidation
      if (options?.tags) {
        for (const tag of options.tags) {
          await this.client.sAdd(`${this.keyPrefix}tag:${tag}`, fullKey);
        }
      }
    } catch (error) {
      console.error('❌ Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.connected) return;

    try {
      await this.client.del(this.keyPrefix + key);
    } catch (error) {
      console.error('❌ Redis delete error:', error);
    }
  }

  async deleteByTags(tags: string[]): Promise<void> {
    if (!this.connected) return;

    try {
      for (const tag of tags) {
        const keys = await this.client.sMembers(`${this.keyPrefix}tag:${tag}`);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
        await this.client.del(`${this.keyPrefix}tag:${tag}`);
      }
    } catch (error) {
      console.error('❌ Redis deleteByTags error:', error);
    }
  }

  async clear(): Promise<void> {
    if (!this.connected) return;

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('❌ Redis clear error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.connected)
  return false;

    try {
      return (await this.client.exists(this.keyPrefix + key)) === 1;
    } catch (error) {
      console.error('❌ Redis exists error:', error);
      return false;
    }
  }

  async getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
      this.connected = false;
      console.log('✅ Redis disconnected');
    }
  }
}

