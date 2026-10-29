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
// It also adds up the tokens of every OpenAI call the request makes (agents, RAG graph, plain completions), for the
// token windows below.
const modelStore = new AsyncLocalStorage<{ model?: string; tokens: { input: number; output: number } }>();

/** Runs a request handler in its own scope; the tier's model set inside it is seen by that request only. */
export function withTutorScope<T>(fn: () => T): T {
  return modelStore.run({ tokens: { input: 0, output: 0 } }, fn);
}

/** Sets the tier's model for the rest of this request. Outside a scope it does nothing (the old model stays). */
export function useTutorModelForRequest(model: string | null): void {
  const scope = modelStore.getStore();
  if (scope && model) scope.model = model;
}

/** The model the current request's tier asked for, if any. */
export const tutorModelOverride = (): string | undefined => modelStore.getStore()?.model;

/** Adds one OpenAI call's usage to the current request. Outside a scope (scripts, ingestion) it does nothing. */
export function addTutorTokens(input: number, output: number): void {
  const scope = modelStore.getStore();
  if (!scope) return;
  scope.tokens.input += Math.max(0, input || 0);
  scope.tokens.output += Math.max(0, output || 0);
}

/** What the current request's OpenAI calls have cost so far. */
export const tutorRequestTokens = (): { input: number; output: number } => ({ ...(modelStore.getStore()?.tokens ?? { input: 0, output: 0 }) });

// ── Token quota in 4-hour windows (TUTOR_TOKEN_QUOTA_ENABLED), the same rules as Varta's ──────────────────────
//
// A window opens with the first answer after the last one closed and lasts TUTOR_WINDOW_HOURS (4), so a day holds at
// most six. Paid: TUTOR_WINDOW_TOKENS (150,000) per window, 75% Basic, 25% Prime (TUTOR_PRIME_SHARE); a free trial
// has TUTOR_TRIAL_TOKEN_SHARE (half). A question is let in while its tier has tokens left.

export const tutorTokenQuotaEnabled = (env: Env = process.env): boolean => (env.TUTOR_TOKEN_QUOTA_ENABLED ?? '').trim().toLowerCase() === 'true';

export function tutorWindowLimits(trial: boolean, env: Env = process.env): TutorTierLimits & { hours: number } {
  const n = parseInt(env.TUTOR_WINDOW_TOKENS ?? '', 10);
  const paid = Number.isFinite(n) && n >= 0 ? n : 150_000;
  const trialShare = Math.min(1, Math.max(0, Number(env.TUTOR_TRIAL_TOKEN_SHARE ?? '0.5') || 0));
  const h = parseInt(env.TUTOR_WINDOW_HOURS ?? '', 10);
  const hours = Number.isFinite(h) && h >= 1 ? h : 4;
  const total = trial ? Math.floor(paid * trialShare) : paid;
  return { ...tutorTierLimits(total, env), hours };
}

export interface TutorWindow {
  startedAt: Date | null;
  resetsAt: Date | null;
  used: TutorTierUsage;
}

/** The current window from a student's answers of the last day, oldest first. */
export function currentTutorWindow(answers: { at: Date; tier: string; tokens: number }[], now: Date, hours: number): TutorWindow {
  const span = hours * 3600_000;
  let start: number | null = null;
  for (const a of answers) {
    const t = a.at.getTime();
    if (start === null || t >= start + span) start = t;
  }
  if (start === null || now.getTime() >= start + span) return { startedAt: null, resetsAt: null, used: { basic: 0, prime: 0 } };
  const used: TutorTierUsage = { basic: 0, prime: 0 };
  for (const a of answers) {
    if (a.at.getTime() < start) continue;
    if (a.tier === 'prime') used.prime += a.tokens;
    else used.basic += a.tokens;
  }
  return { startedAt: new Date(start), resetsAt: new Date(start + span), used };
}

/** "4:30 pm" in India time, for the message that says when a window resets. */
export const resetClock = (d: Date | null): string =>
  d ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }) : 'soon';
