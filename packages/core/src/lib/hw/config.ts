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

const provider = () => z.preprocess((v) => (v === '' || v === undefined ? undefined : String(v).trim().toLowerCase()), z.enum(['gemini', 'openrouter']).optional());

const EnvSchema = z.object({
  HW_FEATURE_DEFAULT_ENABLED: bool(false),
  HW_AI_PROVIDER: provider().transform((v) => v ?? 'gemini'),
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
