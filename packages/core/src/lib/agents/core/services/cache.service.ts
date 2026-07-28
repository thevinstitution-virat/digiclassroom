import { logger } from '@/lib/logger';

/**
 * CacheService — Phase 2 Redis Caching Layer
 *
 * Wraps ioredis with explicit per-domain TTLs and:
 * - SHA-256 hashed cache keys (security)
 * - Fail-fast / silent failure (never blocks a student query)
 * - Rolling window limit on session history (memory safety)
 */

import * as crypto from 'crypto';

const ENABLED = () => process.env.ARCH_REDIS_CACHE === 'true' || process.env.ARCH_REDIS_CACHE === '1';

// TTLs sourced from env, with sensible defaults
const TTL = {
    embedding: parseInt(process.env.REDIS_TTL_EMBEDDINGS || '86400'),  // 24h
    rag: parseInt(process.env.REDIS_TTL_RAG || '3600'),   // 1h
    session: parseInt(process.env.REDIS_TTL_SESSION || '86400'),  // 24h
};

// Maximum conversation turns stored per session (memory guard)
const SESSION_WINDOW = 50;

type ConversationTurn = { role: 'user' | 'assistant' | 'system'; content: string };

// Lazy singleton keeps import clean when Redis is disabled
let redis: import('ioredis').Redis | null = null;

async function getClient(): Promise<import('ioredis').Redis | null> {
    if (!ENABLED())
  return null;
    if (redis)
  return redis;

    try {
        const IORedis = (await import('ioredis')).default;
        redis = new IORedis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || '',
            db: 0,
            keyPrefix: 'dcp:',
            lazyConnect: true,
            connectTimeout: 3000,   // fail fast — 3s max
            maxRetriesPerRequest: 1, // single retry then give up
            enableOfflineQueue: false,
        });

        redis.on('error', (err) => {
            logger.warn('[CacheService] Redis error (non-blocking):', { data: err.message });
        });

        await redis.connect();
        logger.info('✅ [CacheService] Redis connected');
        return redis;
    } catch (err) {
        logger.warn('[CacheService] Redis unavailable — degrading gracefully:', { data: (err as Error).message });
        redis = null;
        return null;
    }
}

function hashKey(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

// ─── Embedding Cache ──────────────────────────────────────────────────────────

export async function getCachedEmbedding(text: string): Promise<number[] | null> {
    const client = await getClient();
    if (!client)
  return null;
    try {
        const raw = await client.get(`emb:${hashKey(text)}`);
        return raw ? (JSON.parse(raw) as number[]) : null;
    } catch { return null; }
}

export async function setCachedEmbedding(text: string, vector: number[]): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
        await client.setex(`emb:${hashKey(text)}`, TTL.embedding, JSON.stringify(vector));
    } catch { /* non-blocking */ }
}

// ─── RAG Result Cache ─────────────────────────────────────────────────────────

interface RagCacheKey { query: string; subject: string; grade: number; organizationId?: string | null }

// 🛡️ Batch 2b: org scope must be part of the RAG cache key so one org's cached
// retrieval can never be served to another. null (platform-all) and undefined
// (global-only) are kept as distinct namespaces.
function orgCacheToken(organizationId?: string | null): string {
    if (organizationId === undefined) return 'global-only';
    if (organizationId === null) return 'platform-all';
    return organizationId;
}

export async function getCachedRAGResult<T>(params: RagCacheKey): Promise<T | null> {
    const client = await getClient();
    if (!client)
  return null;
    try {
        const key = `rag:${hashKey(`${orgCacheToken(params.organizationId)}|${params.query}|${params.subject}|${params.grade}`)}`;
        const raw = await client.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch { return null; }
}

export async function setCachedRAGResult<T>(params: RagCacheKey, result: T, ttl?: number): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
        const key = `rag:${hashKey(`${orgCacheToken(params.organizationId)}|${params.query}|${params.subject}|${params.grade}`)}`;
        await client.setex(key, ttl ?? TTL.rag, JSON.stringify(result));
    } catch { /* non-blocking */ }
}

// ─── Session State Cache ──────────────────────────────────────────────────────

export async function getCachedSession(sessionId: string): Promise<ConversationTurn[] | null> {
    const client = await getClient();
    if (!client)
  return null;
    try {
        const raw = await client.get(`sess:${hashKey(sessionId)}`);
        return raw ? (JSON.parse(raw) as ConversationTurn[]) : null;
    } catch { return null; }
}

export async function setCachedSession(sessionId: string, history: ConversationTurn[]): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
        // Rolling window — never cache unbounded history
        const capped = history.slice(-SESSION_WINDOW);
        if (capped.length < history.length) {
            console.debug(`[CacheService] Session window capped: ${history.length} → ${capped.length} turns`);
        }
        await client.setex(`sess:${hashKey(sessionId)}`, TTL.session, JSON.stringify(capped));
    } catch { /* non-blocking */ }
}

// ─── Warm shutdown ────────────────────────────────────────────────────────────

export async function disconnectCache(): Promise<void> {
    if (redis) {
        await redis.quit().catch(() => { /* best-effort */ });
        redis = null;
    }
}
