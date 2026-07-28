/**
 * Scope Validation Node — Checks if the query is within NCERT curriculum scope.
 */

import type { TutorState } from '../TutorGraphState';

export async function scopeValidationNode(state: TutorState): Promise<Partial<TutorState>> {
    const query = state.messages.at(-1)?.content as string;

    // Simple scope validation: check if retrieval found relevant chunks
    // If confidence is very low and no chunks matched, it's likely out of scope
    const hasRelevantContent = state.retrievedChunks.length > 0 && state.confidenceScore > 0.15;

    if (hasRelevantContent) {
        return { ncertScopeValid: true };
    }

    // Build polite refusal message
    const refusalMessage =
        `I can only answer questions based on your NCERT ${state.subject} textbook ` +
        `for Grade ${state.grade}. This question seems to be outside that scope. ` +
        `Please ask something from your curriculum.`;

    return {
        ncertScopeValid: false,
        scopeViolationDetails: `Low confidence (${state.confidenceScore.toFixed(2)}) with ${state.retrievedChunks.length} chunks`,
        scopeViolationResponse: refusalMessage,
    };
}
