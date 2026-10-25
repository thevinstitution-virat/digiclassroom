// Who may use the evaluator tools. Not an app role: an evaluator is a signed-in user with
// an ACTIVE hw_eval_rater row (migration 015), and the tools are off unless
// HW_EVAL_TOOLS_ENABLED is set. Super admins manage raters and tasks; they do not rate
// unless they also have a rater row. The session lookup is in actor.ts.

import { getHwConfig } from '../config';
import { HwError } from '../errors';

export interface EvalRater {
  id: string;
  pseudonym: string;
  skills: string[];
}

export interface EvalActor {
  userId: string;
  isSuperAdmin: boolean;
  /** Present only for an active rater. */
  rater: EvalRater | null;
}

export function requireToolsEnabled(): void {
  if (!getHwConfig().HW_EVAL_TOOLS_ENABLED) throw new HwError('FEATURE_DISABLED', 'The evaluation tools are switched off.');
}

export function requireRater(a: EvalActor): EvalRater {
  if (!a.rater) throw new HwError('FORBIDDEN', 'This page is for evaluators.');
  return a.rater;
}

export function requireSuperAdmin(a: EvalActor): void {
  if (!a.isSuperAdmin) throw new HwError('FORBIDDEN', 'Only the platform owner can manage evaluation.');
}
