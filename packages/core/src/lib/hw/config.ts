// Every tunable of the feature comes from the environment, read and validated here.
// Nothing about models, thresholds or prices is hard-coded in the logic that uses them.
//
// Required values are only required when they are used: a missing GEMINI_API_KEY does not
// stop teachers marking by hand, it makes the AI path refuse with NOT_CONFIGURED.

import { z } from 'zod';
import { HwError } from './errors';

const bool = (fallback: boolean) =>
  z.string().optional().transform((v) => (v === undefined || v === '' ? fallback : /^(1|true|yes|on)$/i.test(v)));
const num = (fallback: number, min: number, max: number) =>
  z.string().optional().transform((v, ctx) => {
    if (v === undefined || v === '') return fallback;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `must be a number between ${min} and ${max}` });
      return z.NEVER;
    }
    return n;
  });
const str = () => z.string().optional().transform((v) => (v ? v.trim() : undefined));
const choice = <T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) =>
  z.preprocess((v) => (v === '' ? undefined : typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(values).optional())
    .transform((v) => v ?? fallback);

const provider = () => z.preprocess((v) => (v === '' || v === undefined ? undefined : String(v).trim().toLowerCase()), z.enum(['gemini', 'openrouter', 'openai']).optional());

const EnvSchema = z.object({
  HW_FEATURE_DEFAULT_ENABLED: bool(false),
  HW_AI_PROVIDER: provider().transform((v) => v ?? 'gemini'),
  // Per-step routes; each defaults to HW_AI_PROVIDER. A model id must be one the chosen provider knows
  // (bare "gemini-…" on gemini, "gpt-…" on openai, "vendor/model" on openrouter).
  HW_READ_PROVIDER: provider(),
  HW_ESCALATE_PROVIDER: provider(),
  HW_GRADE_PROVIDER: provider(),
  HW_RUBRIC_PROVIDER: provider(),
  GEMINI_API_KEY: str(),
  OPENROUTER_API_KEY: str(),
  HW_READ_MODEL: str(),
  HW_ESCALATE_MODEL: str(),
  HW_GRADE_MODEL: str(),
  HW_RUBRIC_MODEL: str(),
  HW_BATCH_ENABLED: bool(true),
  HW_THINKING_LEVEL: choice(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const, 'MINIMAL'),
  HW_READ_MEDIA_RESOLUTION: choice(['LOW', 'MEDIUM', 'HIGH'] as const, 'LOW'),
  HW_READ_ESCALATE_BELOW: num(0.7, 0, 1),
  HW_UNCLEAR_ESCALATE_ABOVE: num(3, 0, 1000),
  HW_GRADE_BATCH_SIZE: num(10, 1, 50),
  /** Reasoning effort for marking calls (e.g. low, for gpt-6-luna). Unset = HW_THINKING_LEVEL, as before. */
  HW_GRADE_REASONING_EFFORT: str(),
  HW_GRADE_DEBOUNCE_SECONDS: num(120, 0, 86_400),
  HW_HIGH_CONFIDENCE: num(0.85, 0, 1),
  HW_RENDER_MAX_WIDTH: num(1000, 200, 4000),
  HW_INK_MAX_BYTES: num(512 * 1024, 1024, 20 * 1024 * 1024),
  HW_RENDER_MAX_BYTES: num(1024 * 1024, 1024, 20 * 1024 * 1024),
  HW_BATCH_MAX_BYTES: num(15 * 1024 * 1024, 1024 * 1024, 19 * 1024 * 1024),
  HW_BATCH_POLL_SECONDS: num(60, 10, 3600),
  HW_JOB_STALE_MINUTES: num(10, 1, 1440),
  HW_PRICE_TABLE_JSON: str(),
  HW_CRON_SECRET: str(),
  SARVAM_API_KEY: str(),
  // Answer keys (lib/hw/keys). The verifier must be a different model family from the writer.
  HW_KEY_WRITER_MODEL: str(),
  HW_KEY_WRITER_PROVIDER: provider().optional(),
  HW_KEY_VERIFIER_MODEL: str(),
  HW_KEY_VERIFIER_PROVIDER: provider().optional().transform((v) => v ?? 'openrouter'),
  /** Minimum dense cosine score of the top passage. No default: it is calibrated (scripts/hw-key-calibrate.ts). */
  HW_KEY_R_MIN: z.string().optional().transform((v, ctx) => {
    if (v === undefined || v === '') return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0 || n >= 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be a number between 0 and 1 (exclusive)' });
      return z.NEVER;
    }
    return n;
  }),
  HW_KEY_EXERCISE_THETA: num(0.35, 0, 1),
  HW_KEY_TOP_K: num(30, 1, 100),
  HW_KEY_MAX_PASSAGES: num(6, 1, 20),
  HW_KEY_EMBED_MODEL: z.string().optional().transform((v) => (v ? v.trim() : 'text-embedding-3-large')),
  /** content_item ids whose printed-page mapping a person has checked (comma-separated). */
  HW_KEY_PAGES_VERIFIED: z.string().optional().transform((v) => new Set((v ?? '').split(',').map((x) => x.trim()).filter(Boolean))),
  /** Evaluator tools (raters' queue, task screens, super-admin page). Off unless set. */
  HW_EVAL_TOOLS_ENABLED: bool(false),
  /** Local folder holding datasets/ and key-cache/ (development); unset = read them from R2 under hw-assignments/evals/. */
  HW_EVAL_LOCAL_ROOT: str(),
  /** Datasets open for writing-pad copy tasks (comma-separated name@vN). */
  HW_EVAL_COPY_DATASETS: str(),
  /** Share of answers (0–1) also run with the candidate configuration in shadow mode. 0 = off. */
  HW_SHADOW_RATE: num(0, 0, 1),
  /** Candidate for shadow mode: {"reader":{"model","escalateModel"?},"grader":{"model"}} (either part may be absent). */
  HW_SHADOW_CONFIG_JSON: str(),
  // Cost savings that cannot change an answer, a mark or a key (docs/hw-eval/cost-phase1.md). Each is off unless set.
  /** Homework goes through the provider's batch API with a visible status and a visible fallback to the standard path; tests and urgent work stay standard. */
  HW_HOMEWORK_BATCH_ENABLED: bool(false),
  /** Hours a homework batch may take before it is given up and re-run on the standard path. */
  HW_HOMEWORK_BATCH_DEADLINE_HOURS: num(24, 1, 96),
  /** Work due within this many hours (or already past due) is not batched: the teacher is waiting for it. */
  HW_HOMEWORK_URGENT_HOURS: num(3, 0, 720),
  /** A key built from the official scheme or the textbook for a public question is reused across tenants. */
  HW_SHARED_KEYS_ENABLED: bool(false),
  /**
   * The answer-key verifier is meant to be another model FAMILY from the writer, so it does not share the writer's blind spots. With only one provider's key
   * (say OpenAI for both) that cannot be met: set this true to accept one family. The two models must still differ. A weaker check, chosen by the owner.
   */
  HW_KEY_ALLOW_SAME_FAMILY: bool(false),
  /** One-mark answers equal to an accepted answer (after normalisation) are marked in code. */
  HW_CODE_MARKING_ENABLED: bool(false),
  /** Answers with the same normalised transcript for the same question and key version are marked once. */
  HW_DEDUPE_MARKING_ENABLED: bool(false),
  /** Instruction guard: an answer addressed to the marker is marked alone, flagged to the teacher and left out of bulk accept; a point whose evidence is not in the answer lowers the answer's confidence. */
  HW_INSTRUCTION_GUARD_ENABLED: bool(false),
  /**
   * Strict marking (grade-strict.v2, docs/hw-eval/cost-phase1d.md): ONE answer per call; per key point the model gives a verdict and the
   * verbatim words, and code computes the marks. Off = grade.v1 as before. Part of the eligibility fingerprint: switching it makes every
   * group "configuration changed" until evaluation runs made under the same setting are imported.
   */
  HW_STRICT_MARKING_ENABLED: bool(false),
  /**
   * Self-practice for independent learners (docs/hw-eval/self-practice.md, migration 031). Off = people without an institution have no access.
   * A trial is TRIAL_DAYS long and limited to TRIAL_BUDGET_PAISE of AI cost (reading and marking); a step is not started unless STEP_RESERVE_PAISE
   * is still unspent, so the limit holds to within one step. PLATFORM_BUDGET_PAISE is the practice space's monthly ceiling over all learners.
   */
  HW_SELF_PRACTICE_ENABLED: bool(false),
  HW_SELF_PRACTICE_TRIAL_DAYS: num(7, 1, 90),
  HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: num(1000, 0, 100_000),
  HW_SELF_PRACTICE_STEP_RESERVE_PAISE: num(5, 0, 1000),
  HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE: num(200_000, 0, 100_000_000),
  /** The most questions one learner may start during the trial (each one costs the platform an answer key). */
  HW_SELF_PRACTICE_MAX_ATTEMPTS: num(25, 1, 1000),
  /**
   * InkBuddy offers the free trial only when marks are possible: at least one textbook-key group is eligible for the running marking setup. Set false to
   * open it before any group is promoted (learners then get their handwriting read and no mark).
   */
  HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP: bool(true),
  /**
   * The books InkBuddy offers, as "class:subject:medium" separated by commas (e.g. "9:Science:en,10:Science:en"). Only these can be searched or started:
   * the library places a book at a class, so a scope outside the list could be answered from a book of another subject. Default: the one book in the library.
   */
  HW_SELF_PRACTICE_SCOPES: str(),
  /**
   * Strict marking, "right idea, wrong detail" (docs/hw-eval/verdicts.md): the share of the key point's marks given.
   * zero (the default; phase 1c's behaviour), half (half the point's marks, rounded down to a half mark) or full.
   * The teachers decide this; the code only applies it.
   */
  HW_PARTIAL_CREDIT_RULE: z.preprocess((v) => (v === '' || v === undefined ? undefined : String(v).trim().toLowerCase()), z.enum(['zero', 'half', 'full']).optional()).transform((v) => v ?? 'zero'),
  /** Per-subject override of the rule above, as JSON: {"science":"half","hindi":"full"}. Subjects are matched case-insensitively. */
  HW_PARTIAL_CREDIT_BY_SUBJECT: z.string().optional().transform((v, ctx) => {
    if (v === undefined || v.trim() === '') return {} as Record<string, 'zero' | 'half' | 'full'>;
    let raw: unknown;
    try { raw = JSON.parse(v); } catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'must be JSON like {"science":"half"}' }); return z.NEVER; }
    const parsed = z.record(z.enum(['zero', 'half', 'full'])).safeParse(raw);
    if (!parsed.success) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'every value must be zero, half or full' }); return z.NEVER; }
    return Object.fromEntries(Object.entries(parsed.data).map(([k, x]) => [k.trim().toLowerCase(), x])) as Record<string, 'zero' | 'half' | 'full'>;
  }),
  /** OpenAI GPT-5.6+ models: caching in explicit mode, so nothing is written to a cache that is never read. */
  HW_OPENAI_EXPLICIT_CACHE_ENABLED: bool(false),
  /**
   * Eligibility registry (roadmap 5.3). On (the default): AI marking suggestions are created and shown only for a group the registry says
   * is eligible for the marking configuration running now; every other group is marked by hand. Off: no check (tests, and the owner's
   * emergency switch). Leave it unset in production.
   */
  HW_ELIGIBILITY_ENFORCED: bool(true),
  /** The parent view (roadmap-remaining.md, workstream A): off until the owner decides the policy. A parent sees only the returned work of a child an institution admin linked to them. */
  HW_PARENT_VIEW_ENABLED: bool(false),
  /** Guardian onboarding (migration 030): invitations from an institution admin (B2B) and from the super admin (B2C), and the link they create. Off until the owner switches it on. */
  GUARDIAN_INVITES_ENABLED: bool(false),
  /**
   * A worker that takes only the jobs of institutions whose id starts with this. Unset in production (every job). The integration suites set a
   * prefix of their own, so suites running at the same time in one database never claim, poll or fail each other's jobs (and never a leftover
   * from an earlier run).
   */
  HW_JOB_ORG_PREFIX: str(),
  /**
   * Roadmap 5.2 (decision D3): a question marked with the teacher's own rubric gets no AI suggestion during the pilot, whatever the registry says.
   * Turn this on only when teacher-rubric marking has become its own measured, eligible group. Ignored while HW_ELIGIBILITY_ENFORCED is off.
   */
  HW_TEACHER_RUBRIC_AI_ENABLED: bool(false),
  /**
   * Monitoring and alerts (roadmap 5.4). Rates are over the last 7 Indian-time days, for one group, on the marking setup that was promoted.
   * A rate over its limit raises an alert only when the sample is at least HW_MONITOR_MIN_ANSWERS. Only the two marking-quality alerts
   * (override rate, large override rate) take a group out of 'eligible' automatically, and only while HW_MONITOR_AUTODEMOTE is on; the
   * others (transcript fixes, failed jobs, cost) alert and email but never demote. HW_MONITOR_MIN_GROUP_SIZE hides a group's figures from an
   * institution admin until it has that many answers.
   * Owner's thresholds, PROVISIONAL until Phase 4 has measured real teachers: over 7 days with at least 60 suggestions in the group, demote when more than 5%
   * are changed by a large amount (the large-error gate's own definition of large) or more than 30% are changed at all. Every other alert only warns.
   */
  HW_MONITOR_AUTODEMOTE: bool(true),
  HW_MONITOR_MIN_ANSWERS: num(60, 1, 100000),
  HW_MONITOR_MIN_GROUP_SIZE: num(10, 1, 10000),
  HW_MONITOR_MAX_OVERRIDE_RATE: num(0.3, 0, 1),
  HW_MONITOR_MAX_LARGE_OVERRIDE_RATE: num(0.05, 0, 1),
  HW_MONITOR_MAX_TRANSCRIPT_FIX_RATE: num(0.25, 0, 1),
  HW_MONITOR_MAX_FAILED_JOB_RATE: num(0.1, 0, 1),
  /** Actual cost per answer over this multiple of the projection raises a cost alert. */
  HW_MONITOR_MAX_COST_RATIO: num(1.5, 1, 100),
  /** Projected paise per answer by question type, e.g. {"short": 12, "long": 30}. Empty = none; the cost columns then show no projection. */
  HW_MONITOR_PROJECTED_PAISE_JSON: str(),
  OPENAI_API_KEY: str(),
  QDRANT_URL: str(),
  QDRANT_API_KEY: str(),
  QDRANT_COLLECTION_NAME: str(),
});

export type HwConfig = z.infer<typeof EnvSchema>;

let cached: HwConfig | null = null;

export function getHwConfig(): HwConfig {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new HwError('NOT_CONFIGURED', 'Handwritten assignments are misconfigured.', `Invalid HW env: ${detail}`);
  }
  cached = parsed.data;
  return cached;
}

/** Tests only. */
export function _resetHwConfig(): void {
  cached = null;
}

export type HwModelRole = 'read' | 'escalate' | 'grade' | 'rubric';

export function requireModel(role: HwModelRole): string {
  const c = getHwConfig();
  const model = { read: c.HW_READ_MODEL, escalate: c.HW_ESCALATE_MODEL, grade: c.HW_GRADE_MODEL, rubric: c.HW_RUBRIC_MODEL }[role];
  if (!model) {
    const envName = { read: 'HW_READ_MODEL', escalate: 'HW_ESCALATE_MODEL', grade: 'HW_GRADE_MODEL', rubric: 'HW_RUBRIC_MODEL' }[role];
    throw new HwError('NOT_CONFIGURED', 'AI is not configured for handwritten assignments.', `${envName} is not set`);
  }
  return model;
}

export function requireGeminiKey(): string {
  const key = getHwConfig().GEMINI_API_KEY;
  if (!key) throw new HwError('NOT_CONFIGURED', 'AI is not configured for handwritten assignments.', 'GEMINI_API_KEY is not set');
  return key;
}
