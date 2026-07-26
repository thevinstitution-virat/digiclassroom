import { logger } from '@/lib/logger';

/**
 * TracingService — Phase 2 Langfuse Observability
 *
 * Non-blocking instrumentation for every agent invocation.
 * Tracks:
 *   - Session span (user → answer round-trip)
 *   - Retrieval sub-span (latency + chunks retrieved)
 *   - Generation sub-span (latency)
 *   - pageNumberPrecision score (0.0–1.0) — key citation quality metric
 *
 * Feature-flagged via archLangfuseTracing — all calls are best-effort.
 * If Langfuse is down or the flag is off, student queries are not affected.
 */

import { getFeatureFlags } from '@/lib/config/feature-flags';
import { LANGFUSE_SCORES } from '@/lib/observability/constants';

// Typed shim so we can import Langfuse lazily without top-level await
type LangfuseClient = import('langfuse').Langfuse;
type LangfuseTrace = ReturnType<LangfuseClient['trace']>;
type LangfuseSpan = ReturnType<LangfuseTrace['span']>;

let lfClient: LangfuseClient | null = null;

async function getClient(): Promise<LangfuseClient | null> {
    if (!getFeatureFlags().archLangfuseTracing)
        return null;
    if (lfClient)
        return lfClient;

    try {
        const { Langfuse } = await import('langfuse');
        lfClient = new Langfuse({
            publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
            secretKey: process.env.LANGFUSE_SECRET_KEY!,
            baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
            flushAt: 20,   // batch uploads
            flushInterval: 10_000, // every 10s
        });
        return lfClient;
    } catch (err) {
        // @ts-ignore
        logger.warn({ data: (err as Error).message }, '[TracingService] Langfuse unavailable:');
        return null;
    }
}

export interface TraceContext {
    sessionId: string;
    userId: string;
    query: string;
    subject: string;
    grade: number;
    agentName: string;
    llmProvider?: string;
}

export interface RetrievalSpanData {
    chunksRetrieved: number;
    rerankingApplied: boolean;
    cacheHit: boolean;
    latencyMs: number;
    topScore: number;
}

export interface GenerationSpanData {
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
}

export interface CitationScoreData {
    // Core citation quality metric
    pageNumberPrecision: number;  // fraction 0.0–1.0, or -1 if no citations attempted
    totalCitations: number;
    citationsWithPage: number;
    // Phase 3 VERIFY-2: distinguishes refusal from actual zero-citation response
    citationAttempted: boolean;   // false = agent refused/out-of-scope — skip precision scoring
    // Response quality
    contentLength: number;
    confidenceScore: number;
    // Phase 5.3: Token usage from ChatOpenAI usage_metadata (optional, no tiktoken)
    tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// ─── Active traces map ────────────────────────────────────────────────────────
// Maps sessionId -> { trace, retrievalSpan, generationSpan }
const activeTraces = new Map<string, { trace: LangfuseTrace; openSpan?: LangfuseSpan }>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start a top-level session trace — call at the beginning of executeAgent()
 */
export async function startSessionTrace(ctx: TraceContext): Promise<void> {
    const client = await getClient();
    if (!client) return;

    try {
        const trace = client.trace({
            sessionId: ctx.sessionId,
            userId: ctx.userId,
            name: `agent:${ctx.agentName}`,
            metadata: { query: ctx.query, subject: ctx.subject, grade: ctx.grade },
        });
        activeTraces.set(ctx.sessionId, { trace });
    } catch { /* non-blocking */ }
}

/**
 * Record retrieval span — call after RetrievalService.search*()
 */
export async function recordRetrievalSpan(sessionId: string, data: RetrievalSpanData): Promise<void> {
    const entry = activeTraces.get(sessionId);
    if (!entry) return;

    try {
        const span = entry.trace.span({
            name: 'retrieval',
            metadata: data,
            startTime: new Date(Date.now() - data.latencyMs),
            endTime: new Date(),
        });
        // immediately end it
        span.end();
    } catch { /* non-blocking */ }
}

/**
 * Record LLM generation span — call after agent.generate()
 */
export async function recordGenerationSpan(sessionId: string, data: GenerationSpanData): Promise<void> {
    const entry = activeTraces.get(sessionId);
    if (!entry) return;

    try {
        entry.trace.span({
            name: 'generation',
            metadata: data,
            startTime: new Date(Date.now() - data.latencyMs),
            endTime: new Date(),
        }).end();
    } catch { /* non-blocking */ }
}

/**
 * Score citation quality and close the trace — call at end of executeAgent()
 * This is the CRITICAL metric for tracking NCERT page-level accuracy.
 *
 * PHASE 3 VERIFY-2: Only scores when citationAttempted is true.
 * Refusals and out-of-scope responses are skipped to prevent
 * metric inflation in the Langfuse dashboard moving average.
 */
export async function scoreCitationQuality(sessionId: string, scoreData: CitationScoreData): Promise<void> {
    const entry = activeTraces.get(sessionId);
    if (!entry) return;

    try {
        // Only score pageNumberPrecision when the agent actually attempted to cite sources.
        // -1 sentinel = no citations attempted (refusal / out-of-scope) — skip scoring.
        if (scoreData.pageNumberPrecision >= 0 && scoreData.citationAttempted) {
            entry.trace.score({
                name: LANGFUSE_SCORES.CITATION_PRECISION,
                value: scoreData.pageNumberPrecision,
                comment: `${scoreData.citationsWithPage}/${scoreData.totalCitations} citations had valid pageNumbers`,
            });
        } else if (!scoreData.citationAttempted) {
            // Still record metadata so we can see refusal rate in Langfuse traces
            entry.trace.score({
                name: LANGFUSE_SCORES.CITATION_PRECISION,
                value: -1,
                comment: 'Skipped — no citations attempted (refusal or out-of-scope)',
            });
        }

        // Always score response confidence
        entry.trace.score({
            name: 'responseConfidence',
            value: scoreData.confidenceScore,
        });

        // Flush non-blocking — run in background microtask
        const client = await getClient();
        if (client) setImmediate(() => client.flushAsync().catch(() => { }));

        activeTraces.delete(sessionId);
    } catch { /* non-blocking */ }
}

/**
 * Compute pageNumberPrecision from an array of citations.
 * Used by BaseAgent before calling scoreCitationQuality.
 *
 * PHASE 3 VERIFY-2:
 * Returns -1 (sentinel) when citationAttempted is false OR citations is empty.
 * This prevents inflating the Langfuse moving average with refusal responses.
 * The caller must filter precision >= 0 before using this as a ratio.
 */
export function computePageNumberPrecision(
    citations: Array<{ pageNumber?: number }>,
    citationAttempted: boolean = true
): number {
    // Refusal or out-of-scope — return sentinel, do not score
    if (!citationAttempted || !citations || citations.length === 0)
        return -1;

    const withPage = citations.filter(c => typeof c.pageNumber === 'number' && c.pageNumber > 0).length;
    return withPage / citations.length;
}
