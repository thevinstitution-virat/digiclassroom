// The product rule (roadmap 5.3), pure: may an AI suggestion be created and shown for a group? Only when the registry says the group is
// eligible AND the configuration it was promoted for is the configuration running now. Everything else, including no record at all,
// means no suggestion: the teacher marks by hand. The default for every group is "not eligible".

import { EXACT_MATCH_MODEL, BLANK_MODEL, CHOICE_WRONG_MODEL } from '../grader/exact-match';

/** Why a question gets no AI suggestion. The first group is about the kind of question (the registry); the second is about the answer key (roadmap 5.2). */
export type EligibilityReason = 'eligible' | 'enforcement_off' | 'no_record' | 'insufficient_data' | 'not_yet' | 'config_changed' | KeyOffReason;

export const KEY_OFF_REASONS = [
  'teacher_rubric',     // the teacher's own rubric: marked by hand during the pilot
  'key_pending',        // the key is still being built
  'key_not_available',  // the key service is not switched on (R_min not calibrated, or no models set)
  'key_no_grounding',   // no passage or textbook text supports a key
  'key_failed',         // the build failed
  'key_partial',        // some point is only partly supported: never used for marking
  'key_changed',        // a rebuilt key differs from the rubric the assignment was published with
  'key_stale_version',  // the key service changed (prompts, checks, retrieval)
  'key_stale_config',   // models, thresholds (R_min) or the index changed
  'key_stale_book',     // the book text the key cites changed (new edition or reprint)
  'key_stale_question', // the question (text, marks, type, passage) changed after the key was built
] as const;
export type KeyOffReason = (typeof KEY_OFF_REASONS)[number];
export const isKeyOffReason = (r: string): r is KeyOffReason => (KEY_OFF_REASONS as readonly string[]).includes(r);

export interface EligibilityDecision { eligible: boolean; reason: EligibilityReason; /** Present when a suggestion would be made: what it rests on (recorded with every suggestion). */ scheme?: SchemeStamp }

/** Where a suggestion's marking scheme comes from. For a key: its id and the versions it was built with. */
export interface SchemeStamp {
  source: 'board_scheme_key' | 'passage_key' | 'textbook_key' | 'teacher_rubric';
  keyId: string | null;
  keyServiceVersion: string | null;
  configHash: string | null;
}

export interface RegistryRecord { status: 'insufficient_data' | 'not_yet' | 'eligible'; configHash: string | null }

export function decide(record: RegistryRecord | null | undefined, runningHash: string, enforced: boolean): EligibilityDecision {
  if (!enforced) return { eligible: true, reason: 'enforcement_off' };
  if (!record) return { eligible: false, reason: 'no_record' };
  if (record.status !== 'eligible') return { eligible: false, reason: record.status };
  if (record.configHash !== runningHash) return { eligible: false, reason: 'config_changed' };
  return { eligible: true, reason: 'eligible' };
}

/** Both messages start with this: answers waiting with such a reason are re-queued when their group is promoted. */
export const AI_OFF_PREFIX = 'AI suggestions are';

/** What the teacher is told, and what is stored on an answer the AI did not mark. */
export const aiOffMessage = (reason: EligibilityReason): string => {
  switch (reason) {
    case 'config_changed': return 'AI suggestions are paused for this kind of question: the marking setup changed and has not been re-checked yet. Please mark by hand.';
    case 'teacher_rubric': return 'AI suggestions are off for questions marked with your own rubric during the pilot. Please mark by hand.';
    case 'key_pending': return 'AI suggestions are waiting for this question’s answer key to be built. Please mark by hand until it is ready.';
    case 'key_not_available': return 'AI suggestions are off for this question: answer keys are not switched on yet. Please mark by hand.';
    case 'key_no_grounding': return 'AI suggestions are off for this question: no book or passage supports an answer key for it. Please mark by hand.';
    case 'key_failed': return 'AI suggestions are off for this question: its answer key could not be built. Please mark by hand.';
    case 'key_partial': return 'AI suggestions are off for this question: its answer key is only partly supported by the book. Please mark by hand.';
    case 'key_changed': return 'AI suggestions are off for this question: a newer answer key differs from the marking scheme this assignment was published with. Please mark by hand.';
    case 'key_stale_version': return 'AI suggestions are paused for this question: the answer-key service changed, so its key is being rebuilt. Please mark by hand for now.';
    case 'key_stale_config': return 'AI suggestions are paused for this question: the answer-key settings changed (for example the match threshold), so its key is being rebuilt. Please mark by hand for now.';
    case 'key_stale_book': return 'AI suggestions are paused for this question: the book text its key rests on changed, so the key is being rebuilt. Please mark by hand for now.';
    case 'key_stale_question': return 'AI suggestions are paused for this question: the question changed after its key was built, so the key is being rebuilt. Please mark by hand for now.';
    default: return 'AI suggestions are not switched on for this kind of question yet. Please mark by hand.';
  }
};

/** A suggestion made by a rule in code (a blank answer, or an exact match to an accepted answer) is not an AI suggestion. */
export const isRuleModel = (model: string): boolean => model === EXACT_MATCH_MODEL || model === BLANK_MODEL || model === CHOICE_WRONG_MODEL;
