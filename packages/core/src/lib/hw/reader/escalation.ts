// What to do with one answer after a read. Pure, so the thresholds are tested exactly.

import type { ReadAnswerResult } from './types';

export interface EscalationPolicy {
  /** HW_READ_ESCALATE_BELOW */
  escalateBelow: number;
  /** HW_UNCLEAR_ESCALATE_ABOVE */
  unclearAbove: number;
}

export type ReadDecision =
  | { action: 'accept' }
  | { action: 'escalate'; reason: string }
  | { action: 'needs_review'; reason: string };

function doubt(r: ReadAnswerResult, p: EscalationPolicy): string | null {
  if (r.confidence < p.escalateBelow) return `reader confidence ${r.confidence.toFixed(2)} is below ${p.escalateBelow}`;
  if (r.unclearCount > p.unclearAbove) return `${r.unclearCount} unreadable words (more than ${p.unclearAbove})`;
  return null;
}

/**
 * Tier 1 doubtful -> escalate to tier 2. Tier 2 still doubtful -> the teacher reads the
 * original (needs_review). A blank page is accepted as blank: there is nothing to re-read.
 */
export function decideAfterRead(r: ReadAnswerResult, tier: 1 | 2, p: EscalationPolicy): ReadDecision {
  if (r.blank) return { action: 'accept' };
  const why = doubt(r, p);
  if (!why) return { action: 'accept' };
  if (tier === 1) return { action: 'escalate', reason: why };
  return { action: 'needs_review', reason: `Hard to read even for the stronger reader: ${why}. Please check the original.` };
}
