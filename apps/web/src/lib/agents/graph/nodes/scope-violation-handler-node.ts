/**
 * Scope Violation Handler Node — Produces polite refusal for out-of-scope queries.
 */

import type { TutorState } from '../TutorGraphState';
import { AIMessage } from '@langchain/core/messages';

export async function scopeViolationHandlerNode(state: TutorState): Promise<Partial<TutorState>> {
    const refusalMessage = state.scopeViolationResponse ??
        'I can only help with your NCERT curriculum content.';

    return {
        finalResponse: refusalMessage,
        messages: [new AIMessage(refusalMessage)],
        confidenceScore: 1.0,  // 100% confident this is out of scope
        citations: [],          // No citations for scope violations
        // citationAttempted = false → Langfuse records -1 sentinel (Phase 2 fix preserved)
    };
}
