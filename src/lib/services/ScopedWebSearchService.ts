
import { logger } from '@/lib/logger';

import { WebCitation } from '../../types/citations';

// Subjects that can use web search — STEM subjects are BLOCKED
const WEB_SEARCH_ALLOWED_SUBJECTS = new Set([
    'economics',
    'political_science',
    'environmental_studies',
    'social_science',  // for current affairs components only
    'general_knowledge', // Sarvagya explicit web search
]);

// Only trusted government and educational domains
const TRUSTED_DOMAINS = [
    'ncert.nic.in',
    'pib.gov.in',           // Press Information Bureau — official government news
    'censusindia.gov.in',   // Census data
    'rbi.org.in',           // Reserve Bank — economics data
    'mospi.gov.in',         // Ministry of Statistics
    'data.gov.in',          // Government open data
    'education.gov.in',     // Ministry of Education
] as const;

// Query types that justify web search — must be explicitly current-affairs
const CURRENT_AFFAIRS_INDICATORS = [
    'current',
    'recent',
    'latest',
    'today',
    '2024',
    '2025',
    '2026',
    'this year',
    'last year',
    'gdp',
    'census',
    'election',
    'government policy',
    'budget',
];

interface SearchResult {
    url: string;
    title: string;
    snippet: string;
    publishedDate?: string;
}

export class ScopedWebSearchService {

    /**
     * Returns null if subject is blocked or query doesn't warrant web search
     */
    async search(params: {
        query: string;
        subject: string;
        grade: number;
        userId?: string;
    }): Promise<WebCitation[] | null> {
        if (!(process.env.ARCH_WEB_SEARCH_CONNECTOR === 'true' || process.env.ARCH_WEB_SEARCH_CONNECTOR === '1')) return null;

        // Phase 4 pre-flight: rate limit before any API calls
        const rateLimitOk = await this.checkRateLimit(params.userId || 'anonymous');
        if (!rateLimitOk) return null;

        const subjectCleaned = params.subject.toLowerCase().replace(' ', '_');

        // Subject gate — NEVER search web for Physics, Chemistry, Math, Biology
        if (!WEB_SEARCH_ALLOWED_SUBJECTS.has(subjectCleaned)) {
            return null;
        }

        // Query gate — only search if query shows current-affairs intent
        const queryCleaned = params.query.toLowerCase();
        const isCurentAffairsQuery = CURRENT_AFFAIRS_INDICATORS.some(
            indicator => queryCleaned.includes(indicator)
        );

        // Bypass query intent gate if it's an explicit general search from Sarvagya
        if (!isCurentAffairsQuery && subjectCleaned !== 'general_knowledge') {
            // Question is about theory/concepts — NCERT is sufficient, no web needed
            return null;
        }

        // Build domain-restricted search query using Google/Brave advanced syntax
        const domainFilter = TRUSTED_DOMAINS.map(d => `site:${d} `).join(' OR ');
        // If subject is general knowledge, lift domain restrictions for open-ended queries
        const restrictedQuery = subjectCleaned === 'general_knowledge'
            ? params.query
            : `${params.query} (${domainFilter})`;

        try {
            const results = await this.performSearch(restrictedQuery);

            return results.map(r => ({
                url: r.url,
                title: r.title,
                domain: new URL(r.url).hostname,
                publishedDate: r.publishedDate ?? null,
                contentExcerpt: r.snippet.slice(0, 500), // limit excerpt length
                subject: params.subject,
                isNCERTVerified: false as const,         // literal false enforcement
                isGovernmentSource: TRUSTED_DOMAINS.some(
                    d => r.url.includes(d) && d.endsWith('.gov.in')
                ),
                retrievedAt: new Date().toISOString(),
            }));
        } catch (error) {
            logger.error({ error: error }, '[WebSearch] Search failed:');
            return null; // non-fatal — fall back to NCERT-only response
        }
    }

    private async performSearch(query: string): Promise<SearchResult[]> {
        const apiKey = process.env.SEARCH_API_KEY;
        if (!apiKey) {
            logger.warn('[WebSearch] SEARCH_API_KEY not configured. Web search disabled.');
            return [];
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        // Simple implementation using Brave Search API (can be swapped for Serper.dev)
        const response = await fetch(
            `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
            {
                headers: {
                    'Accept': 'application/json',
                    'X-Subscription-Token': apiKey,
                },
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Search API error: ${response.status}`);
        }

        const data = await response.json();
        return data.web?.results?.map((r: any) => ({
            url: r.url,
            title: r.title,
            snippet: r.description,
            publishedDate: r.age,
        })) ?? [];
    }

    /**
     * Redis-backed rate limiter — 10 web searches per user per minute.
     * Uses ioredis lazy import (same pattern as cache.service.ts).
     * Returns true if request is allowed, false if rate limit exceeded.
     */
    private async checkRateLimit(userId: string): Promise<boolean> {
        if (!(process.env.ARCH_REDIS_CACHE === 'true' || process.env.ARCH_REDIS_CACHE === '1'))
            return true; // skip if Redis unavailable

        try {
            const IORedis = (await import('ioredis')).default;
            if (!this._rateLimitRedis) {
                this._rateLimitRedis = new IORedis({
                    host: process.env.REDIS_HOST || 'localhost',
                    port: parseInt(process.env.REDIS_PORT || '6379'),
                    password: process.env.REDIS_PASSWORD || '',
                    keyPrefix: 'dcp:',
                    lazyConnect: true,
                    connectTimeout: 2000,
                    maxRetriesPerRequest: 1,
                    retryStrategy(times) {
                        if (times > 3) {
                            if (times === 4) {
                                logger.warn(
                                    { service: 'WebSearch RateLimiter', attempts: times },
                                    'Redis unavailable — rate limiting disabled. Start Redis to enable.'
                                );
                            }
                            return null;
                        }
                        return Math.min(times * 500, 2000);
                    },
                });

                this._rateLimitRedis.on('error', (err) => {
                    if (this._rateLimitRedis?.status !== 'end') {
                        logger.warn({ err: err.message }, 'WebSearch RateLimiter Redis connection error');
                    }
                });

                await this._rateLimitRedis.connect();
            }

            const key = `rate:brave:${userId}`;
            const count = await this._rateLimitRedis.incr(key);
            if (count === 1) {
                await this._rateLimitRedis.expire(key, 60); // 1-minute window
            }

            if (count > 10) {
                logger.warn(`[WebSearch] Rate limit hit for user ${userId} (${count}/min)`);
                return false;
            }
            return true;
        } catch {
            // Redis failure is non-fatal — allow the request
            return true;
        }
    }

    private _rateLimitRedis: import('ioredis').Redis | null = null;
}
