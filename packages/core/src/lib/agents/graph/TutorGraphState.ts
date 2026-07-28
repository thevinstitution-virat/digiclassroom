/**
 * TutorGraphState — Shared state for all LangGraph agent graphs.
 * Phase 4: Carries student context, retrieval results, citations, and quality metrics.
 *
 * PRESERVATION RULE A: citations is AnyCitation[], not NCERTCitation[].
 * NCERTCitation.pageNumber and .contentExcerpt MUST survive all node transitions.
 */

import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import type { AnyCitation } from '@/types/citations';
import type { ContentResult } from '@/lib/services/vector_store_service';

export const TutorGraphState = Annotation.Root({

    // ── Conversation ──────────────────────────────────────────────
    messages: Annotation<BaseMessage[]>({
        reducer: (existing, update) => existing.concat(update),
        default: () => [],
    }),

    // ── Student Context (set once at graph entry, immutable) ──────
    studentName: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
    grade: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 9 }),
    subject: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
    language: Annotation<'english' | 'hindi' | 'bilingual'>({ reducer: (x, y) => y ?? x, default: () => 'english' }),
    sessionId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
    studentId: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
    // Optional provider assignment from A/B test logic
    providerVariant: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),

    // Batch 2b — per-org vector isolation directive (set once at graph entry).
    // Reducer keeps null distinct from undefined: `?? ` would collapse them, but they
    // mean different things — null = platform bypass (see all), undefined = global-only.
    //   string    → org sees its own vectors + global (untagged NCERT)
    //   null      → super_admin/admin: no org filter
    //   undefined → fail-closed default: global/untagged content only
    organizationId: Annotation<string | null | undefined>({
        reducer: (x, y) => (y === undefined ? x : y),
        default: () => undefined,
    }),

    // ── Retrieval State ───────────────────────────────────────────
    retrievedChunks: Annotation<ContentResult[]>({ reducer: (x, y) => y ?? x, default: () => [] }),

    // CRITICAL: AnyCitation preserves BOTH NCERTCitation (pageNumber + contentExcerpt)
    // AND WebCitation (url + domain) — do NOT narrow to NCERTCitation[]
    citations: Annotation<AnyCitation[]>({ reducer: (x, y) => y ?? x, default: () => [] }),

    // Separate counters for Langfuse tracking
    ncertCitationCount: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),
    webCitationCount: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),

    // ── Scope Validation State ────────────────────────────────────
    ncertScopeValid: Annotation<boolean>({ reducer: (x, y) => y ?? x, default: () => true }),
    scopeViolationDetails: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
    scopeViolationResponse: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),

    // ── Query Processing State ────────────────────────────────────
    queryType: Annotation<'factual' | 'conceptual' | 'procedural' | 'evaluative' | 'current_affairs'>({
        reducer: (x, y) => y ?? x,
        default: () => 'conceptual',
    }),

    // ── Generation State ──────────────────────────────────────────
    rawResponse: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),
    finalResponse: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => '' }),

    // ── Quality Metrics (for Langfuse tracing) ────────────────────
    confidenceScore: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),
    retrievalTimeMs: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),
    generationTimeMs: Annotation<number>({ reducer: (x, y) => y ?? x, default: () => 0 }),

    // Phase 5.3: Token usage from ChatOpenAI usage_metadata (zero WASM, zero tiktoken)
    tokenUsage: Annotation<{ promptTokens: number; completionTokens: number; totalTokens: number } | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),

    // ── Agent Identity ────────────────────────────────────────────
    agentName: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => 'unknown' }),
    llmProvider: Annotation<string>({ reducer: (x, y) => y ?? x, default: () => 'openai' }),

    // ── Error State ───────────────────────────────────────────────
    error: Annotation<string | null>({ reducer: (x, y) => y ?? x, default: () => null }),
    fallbackLevel: Annotation<0 | 1 | 2 | 3>({ reducer: (x, y) => y ?? x, default: () => 0 }),
    // 0 = primary, 1 = relaxed threshold, 2 = emergency, 3 = graceful refusal
});

export type TutorState = typeof TutorGraphState.State;
