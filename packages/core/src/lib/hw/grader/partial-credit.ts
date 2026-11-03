// Partial credit for "right idea, wrong detail" (phase 1d). The grader reports a verdict; this module is the only place that
// turns the verdict into marks. The rule is the teachers' to set (HW_PARTIAL_CREDIT_RULE, per subject if needed); the code
// does not prefer one. The default, zero, is what phase 1c did.

export const PARTIAL_RULES = ['zero', 'half', 'full'] as const;
export type PartialRule = (typeof PARTIAL_RULES)[number];

/** The four verdicts of grade-strict.v2. grade-strict.v1 could return the first, third and fourth. */
export const FACT_VERDICTS = ['same_fact', 'right_idea_wrong_detail', 'different_fact', 'absent'] as const;
export type FactVerdict = (typeof FACT_VERDICTS)[number];

/**
 * Marks given to a key point of `pointMarks` whose answer has the right idea and one wrong detail.
 * half = half the point's marks, rounded DOWN to a half mark (teachers mark in half marks): 1 -> 0.5, 1.5 -> 0.5, 2 -> 1,
 * and a 0.5-mark point cannot be halved (0). That last case is a consequence of marking in half marks, not a decision about credit.
 */
export function partialCredit(rule: PartialRule, pointMarks: number): number {
  if (rule === 'zero') return 0;
  if (rule === 'full') return pointMarks;
  return Math.floor(pointMarks / 2 / 0.5 + 1e-9) * 0.5;
}

/** Marks of one key point from a verdict (evidence already checked): the single place the rule is applied. */
export function marksFor(verdict: FactVerdict, pointMarks: number, rule: PartialRule): number {
  if (verdict === 'same_fact') return pointMarks;
  if (verdict === 'right_idea_wrong_detail') return partialCredit(rule, pointMarks);
  return 0;
}

export interface RuleSettings {
  HW_PARTIAL_CREDIT_RULE: PartialRule;
  HW_PARTIAL_CREDIT_BY_SUBJECT: Record<string, PartialRule>;
}

/** The rule for a subject: its override when one is set, else the general rule. */
export function ruleFor(subject: string | undefined | null, cfg: RuleSettings): PartialRule {
  const k = (subject ?? '').trim().toLowerCase();
  return (k && cfg.HW_PARTIAL_CREDIT_BY_SUBJECT[k]) || cfg.HW_PARTIAL_CREDIT_RULE;
}
