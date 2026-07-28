import { logger } from '@/lib/logger';

/**
 * Langfuse Trace Node — Records observability data.
 * Uses existing tracing functions from Phase 2.
 * Runs as a terminal side-effect — no state changes.
 */

import type { TutorState } from '../TutorGraphState';
import { getFeatureFlags } from '@/lib/config/feature-flags';
import { isNCERTCitation } from '@/types/citations';

export async function langfuseTraceNode(state: TutorState): Promise<Partial<TutorState>> {
    if (!getFeatureFlags().archLangfuseTracing)
  return {};

    try {
        // Dynamically import to avoid Langfuse initialization when flag is off
        const { startSessionTrace, recordGenerationSpan, scoreCitationQuality, computePageNumberPrecision } =
            await import('@/lib/agents/core/services/tracing.service');

        const ncertCitations = state.citations.filter(isNCERTCitation);
        const citationAttempted = state.ncertScopeValid;

        // Phase 2 sentinel logic: -1 if not attempted, precision if attempted
        const precision = !citationAttempted ? -1 : computePageNumberPrecision(ncertCitations);

        // Fire-and-forget traces — setImmediate ensures no blocking
        setImmediate(async () => {
            try {
                await startSessionTrace({
                    sessionId: state.sessionId,
                    userId: state.studentId || 'anonymous',
                    query: state.messages.at(-1)?.content as string || '',
                    subject: state.subject,
                    grade: state.grade,
                    agentName: state.agentName,
                    llmProvider: state.llmProvider,
                });

                await recordGenerationSpan(state.sessionId, {
                    latencyMs: state.generationTimeMs,
                });

                await scoreCitationQuality(state.sessionId, {
                    pageNumberPrecision: precision,
                    totalCitations: ncertCitations.length,
                    citationsWithPage: ncertCitations.filter(c => c.pageNumber && c.pageNumber > 0).length,
                    citationAttempted,
                    contentLength: state.rawResponse.length,
                    confidenceScore: state.confidenceScore,
                    // Phase 5.3: Token usage from ChatOpenAI (no external deps)
                    tokenUsage: state.tokenUsage ?? undefined,
                });
            } catch (err) {
                logger.warn('[LangfuseTrace] Non-blocking trace error:', { data: (err as Error).message });
            }
        });
    } catch {
        // Langfuse import failure is non-fatal
    }

    return {}; // No state changes — tracing is a side effect only
}
