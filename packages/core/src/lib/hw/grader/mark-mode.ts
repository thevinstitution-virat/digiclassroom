// Which marker the product runs. Off (the default): grade.v1, up to HW_GRADE_BATCH_SIZE answers to one question per call, the model
// returns the marks. On (HW_STRICT_MARKING_ENABLED): grade-strict.v2, ONE answer per call; per key point the model gives a verdict and
// the verbatim words, and code computes the marks (grader/strict.ts, partial-credit rule from HW_PARTIAL_CREDIT_RULE).
//
// One answer per call is part of the setting, not a tuning knob: it is what was measured (docs/hw-eval/cost-phase1d.md) and it means nothing
// one student writes can reach another student's mark. The eligibility fingerprint includes the mode, so switching it makes every group
// "configuration changed" until its evaluation runs under the same setting are imported.

import type { AiCall, AiResult, CallOptions } from '../ai';
import { getHwConfig } from '../config';
import { STRICT_PROMPT_VERSION_V2 } from '../prompts/grade-strict.v2';
import { GRADE_PROMPT_VERSION } from '../prompts/grade.v1';
import { ruleFor } from './partial-credit';
import { gradeCall, gradeResultsFrom } from './ai-grader';
import { strictCall, strictResultsFrom } from './strict';
import type { GradeInput, GradeResult } from './types';

export const strictMarkingOn = (): boolean => getHwConfig().HW_STRICT_MARKING_ENABLED;

/** Answers per marking call: one in strict mode, else HW_GRADE_BATCH_SIZE. */
export function markChunkSize(): number {
  const cfg = getHwConfig();
  return cfg.HW_STRICT_MARKING_ENABLED ? 1 : cfg.HW_GRADE_BATCH_SIZE;
}

/** The prompt version the running setup uses (part of the eligibility fingerprint). */
export const markPromptVersion = (): string => (strictMarkingOn() ? STRICT_PROMPT_VERSION_V2 : GRADE_PROMPT_VERSION);

export function markCall(model: string, input: GradeInput, options?: CallOptions): AiCall {
  return strictMarkingOn() ? strictCall(model, input, options, 2) : gradeCall(model, input, options);
}

export function markResultsFrom(res: AiResult, input: GradeInput): GradeResult[] {
  return strictMarkingOn()
    ? strictResultsFrom(res, input, { version: 2, rule: ruleFor(input.question.subject, getHwConfig()) })
    : gradeResultsFrom(res, input);
}
