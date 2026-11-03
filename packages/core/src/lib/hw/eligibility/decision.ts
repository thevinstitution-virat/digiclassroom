// The product rule (roadmap 5.3), pure: may an AI suggestion be created and shown for a group? Only when the registry says the group is
// eligible AND the configuration it was promoted for is the configuration running now. Everything else, including no record at all,
// means no suggestion: the teacher marks by hand. The default for every group is "not eligible".

import { EXACT_MATCH_MODEL, BLANK_MODEL } from '../grader/exact-match';

export type EligibilityReason = 'eligible' | 'enforcement_off' | 'no_record' | 'insufficient_data' | 'not_yet' | 'config_changed';

export interface EligibilityDecision { eligible: boolean; reason: EligibilityReason }

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
export const aiOffMessage = (reason: EligibilityReason): string =>
  reason === 'config_changed'
    ? 'AI suggestions are paused for this kind of question: the marking setup changed and has not been re-checked yet. Please mark by hand.'
    : 'AI suggestions are not switched on for this kind of question yet. Please mark by hand.';

/** A suggestion made by a rule in code (a blank answer, or an exact match to an accepted answer) is not an AI suggestion. */
export const isRuleModel = (model: string): boolean => model === EXACT_MATCH_MODEL || model === BLANK_MODEL;
