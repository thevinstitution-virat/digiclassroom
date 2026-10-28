/**
 * The tutor's two tiers, the same rules as Book Buddy's Varta. Basic answers on an efficient model; Prime answers on a
 * stronger model for a deeper explanation, from a share of the student's daily question limit (their plan's
 * daily_question_limit; TUTOR_PRIME_SHARE, 25% by default). Both answer from the textbook; Prime adds depth.
 *
 * TUTOR_TIERS_ENABLED off: one model as before, the whole limit, no Prime.
 *
 * The chosen model reaches every tutor path through one request-scoped value read by ModelRouter, so the dozen agents
 * and the RAG graph need no change of their own.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export const TUTOR_TIERS = ['basic', 'prime'] as const;
export type TutorTier = (typeof TUTOR_TIERS)[number];

export const isTutorTier = (t: unknown): t is TutorTier => (TUTOR_TIERS as readonly unknown[]).includes(t);

type Env = Record<string, string | undefined>;

export const tutorTiersEnabled = (env: Env = process.env): boolean => (env.TUTOR_TIERS_ENABLED ?? '').trim().toLowerCase() === 'true';

/** The model a tier answers on, or null to leave the tutor's own model choice alone (tiers off, or unset). */
export function tutorTierModel(tier: TutorTier, env: Env = process.env): string | null {
  if (!tutorTiersEnabled(env)) return null;
  const m = tier === 'prime' ? env.TUTOR_PRIME_MODEL : env.TUTOR_BASIC_MODEL;
  return m?.trim() || null;
}

export interface TutorTierLimits {
  total: number;
  basic: number;
  prime: number;
}

/** The plan's daily limit split Basic/Prime. Prime is rounded down, so the share is never exceeded. */
export function tutorTierLimits(total: number, env: Env = process.env): TutorTierLimits {
  const t = Math.max(0, Math.floor(total));
  if (!tutorTiersEnabled(env)) return { total: t, basic: t, prime: 0 };
  const share = Math.min(1, Math.max(0, Number(env.TUTOR_PRIME_SHARE ?? '0.25') || 0));
  const prime = Math.floor(t * share);
  return { total: t, basic: t - prime, prime };
}

export interface TutorTierUsage {
  basic: number;
  prime: number;
}

export type TutorTierDecision =
  | { allowed: true; tier: TutorTier; downgraded: boolean }
  | { allowed: false };

/**
 * Which tier answers: Prime when asked for and some is left; when Prime is used up the question is answered on Basic
 * (downgraded) rather than refused; refused only when the tier that would answer is used up.
 */
export function decideTutorTier(requested: TutorTier, used: TutorTierUsage, limits: TutorTierLimits): TutorTierDecision {
  if (limits.prime === 0 || requested === 'basic') {
    return used.basic < limits.basic ? { allowed: true, tier: 'basic', downgraded: requested === 'prime' } : { allowed: false };
  }
  if (used.prime < limits.prime) return { allowed: true, tier: 'prime', downgraded: false };
  if (used.basic < limits.basic) return { allowed: true, tier: 'basic', downgraded: true };
  return { allowed: false };
}

// One scope per request, holding that request's tier model. A scope is entered with run(), never enterWith(): the
// latter changes the caller's context too, so a request started right after another could inherit its model.
const modelStore = new AsyncLocalStorage<{ model?: string }>();

/** Runs a request handler in its own scope; the tier's model set inside it is seen by that request only. */
export function withTutorScope<T>(fn: () => T): T {
  return modelStore.run({}, fn);
}

/** Sets the tier's model for the rest of this request. Outside a scope it does nothing (the old model stays). */
export function useTutorModelForRequest(model: string | null): void {
  const scope = modelStore.getStore();
  if (scope && model) scope.model = model;
}

/** The model the current request's tier asked for, if any. */
export const tutorModelOverride = (): string | undefined => modelStore.getStore()?.model;
