// Exam packages (docs/hw-eval/exam-packages.md): every decision a timed attempt needs, as pure functions. No database, no clock of its own —
// `now` is always passed in, so the rules are tested exactly and the server stays the only authority on time.
//
// The four decisions that matter:
//   * may this learner start this set now (entitlement, allowance, an attempt already open, the set published);
//   * when does their time end, and how long after that may they still upload pages;
//   * is a photographed page good enough to send to the reader (refused before it costs a token, not after);
//   * how the 8 parameters are assembled — and which of them is simply unavailable, which the report says rather than guesses.
//
// Marks are NOT decided here. They come from the official marking scheme through the strict marking path, which code turns into marks
// (grader/strict.ts). The 8-parameter profile never moves a mark.

import { PHOTO_LIMITS } from '../photo/rules';

export interface PackageLike {
  id: string;
  status: 'draft' | 'published' | 'retired';
  attemptsPerSet: number;
}

export interface EntitlementLike {
  packageId: string;
  status: 'active' | 'expired' | 'refunded';
  startsAt: Date;
  expiresAt: Date | null;
  /** Overrides the package's allowance when set. */
  attemptsPerSet: number | null;
}

export interface SetLike {
  id: string;
  status: 'draft' | 'published' | 'retired';
  durationMinutes: number;
  graceMinutes: number;
}

export interface AttemptLike {
  status: 'started' | 'time_up' | 'uploaded' | 'evaluating' | 'reported' | 'abandoned';
  expiresAt: Date;
  uploadDeadlineAt: Date;
}

/** The learner's allowance for one set: their entitlement's override, else the package's own number. */
export function effectiveAttempts(pkg: PackageLike, ent: EntitlementLike | null): number {
  return ent?.attemptsPerSet ?? pkg.attemptsPerSet;
}

export type NotStarted =
  | 'not_entitled'
  | 'entitlement_not_begun'
  | 'entitlement_expired'
  | 'entitlement_refunded'
  | 'package_not_published'
  | 'set_not_published'
  | 'attempts_exhausted'
  | 'attempt_open';

export type StartVerdict = { ok: true; attemptNo: number; allowed: number } | { ok: false; why: NotStarted; detail?: string };

/**
 * May this learner start this set now? The next attempt number comes back with the verdict, so the caller never computes it twice.
 * An attempt that is still `started` or `time_up` blocks a new one: the learner finishes or abandons it first, otherwise two clocks run at once.
 */
export function startVerdict(input: {
  now: Date;
  pkg: PackageLike;
  set: SetLike;
  entitlement: EntitlementLike | null;
  attemptsUsed: number;
  hasOpenAttempt: boolean;
}): StartVerdict {
  const { now, pkg, set, entitlement: ent, attemptsUsed, hasOpenAttempt } = input;
  if (pkg.status !== 'published') return { ok: false, why: 'package_not_published' };
  if (set.status !== 'published') return { ok: false, why: 'set_not_published' };
  if (!ent) return { ok: false, why: 'not_entitled' };
  if (ent.status === 'refunded') return { ok: false, why: 'entitlement_refunded' };
  if (ent.startsAt.getTime() > now.getTime()) return { ok: false, why: 'entitlement_not_begun' };
  if (ent.status === 'expired' || (ent.expiresAt !== null && ent.expiresAt.getTime() <= now.getTime())) {
    return { ok: false, why: 'entitlement_expired' };
  }
  if (hasOpenAttempt) return { ok: false, why: 'attempt_open' };
  const allowed = effectiveAttempts(pkg, ent);
  if (attemptsUsed >= allowed) return { ok: false, why: 'attempts_exhausted', detail: `${attemptsUsed} of ${allowed} used` };
  return { ok: true, attemptNo: attemptsUsed + 1, allowed };
}

/** The clock for one attempt: when writing time ends, and the last moment a page may be uploaded. Both are stored and never recomputed. */
export function clockFor(startedAt: Date, set: Pick<SetLike, 'durationMinutes' | 'graceMinutes'>): { expiresAt: Date; uploadDeadlineAt: Date } {
  const expiresAt = new Date(startedAt.getTime() + set.durationMinutes * 60_000);
  return { expiresAt, uploadDeadlineAt: new Date(expiresAt.getTime() + set.graceMinutes * 60_000) };
}

export const remainingMs = (now: Date, expiresAt: Date): number => Math.max(0, expiresAt.getTime() - now.getTime());
export const isTimeUp = (now: Date, expiresAt: Date): boolean => now.getTime() >= expiresAt.getTime();

/**
 * Where an attempt stands now, worked out when it is read (no scheduled job is needed for the clock to be honoured):
 *   started, writing time over                      -> time_up   (ended at the moment the time ran out, not when we noticed)
 *   started or time_up, upload window over, no page -> abandoned (nothing to mark)
 *   started or time_up, upload window over, pages  -> uploaded  (handed in with the pages it has, at the deadline)
 * Anything else is unchanged (null).
 */
export function settle(now: Date, a: AttemptLike & { acceptedPages: number }):
  | { status: 'time_up'; endedAt: Date }
  | { status: 'abandoned'; endedAt: Date; failureReason: 'no_pages_uploaded' }
  | { status: 'uploaded'; endedAt: Date; submittedAt: Date }
  | null {
  const open = a.status === 'started' || a.status === 'time_up';
  if (open && a.acceptedPages === 0 && now.getTime() > a.uploadDeadlineAt.getTime()) {
    return { status: 'abandoned', endedAt: a.expiresAt, failureReason: 'no_pages_uploaded' };
  }
  if (open && a.acceptedPages > 0 && now.getTime() > a.uploadDeadlineAt.getTime()) {
    return { status: 'uploaded', endedAt: a.expiresAt, submittedAt: a.uploadDeadlineAt };
  }
  if (a.status === 'started' && isTimeUp(now, a.expiresAt)) return { status: 'time_up', endedAt: a.expiresAt };
  return null;
}

export type NoUpload = 'too_early' | 'too_late' | 'wrong_status';
export type UploadVerdict = { ok: true; remainingMs: number } | { ok: false; why: NoUpload };

/**
 * Pages are uploaded after writing time ends and before the grace window closes. Uploading early is refused: the point of the clock is that the
 * learner writes for the paper's own duration. A learner who finishes early ends the attempt first, which sets the clock to `time_up`.
 */
export function uploadVerdict(now: Date, attempt: AttemptLike): UploadVerdict {
  if (attempt.status !== 'started' && attempt.status !== 'time_up' && attempt.status !== 'uploaded') return { ok: false, why: 'wrong_status' };
  if (!isTimeUp(now, attempt.expiresAt) && attempt.status === 'started') return { ok: false, why: 'too_early' };
  if (now.getTime() > attempt.uploadDeadlineAt.getTime()) return { ok: false, why: 'too_late' };
  return { ok: true, remainingMs: attempt.uploadDeadlineAt.getTime() - now.getTime() };
}

// The photo checks (what a page must be to be worth reading) are shared with photo answers: lib/hw/photo/rules.ts.
export { SOFT_PAGE_PROBLEMS, pageVerdict, type PageFacts, type PageProblem, type PageVerdict } from '../photo/rules';

export const PAGE_LIMITS = {
  ...PHOTO_LIMITS,
  /** A board paper is rarely more than 30 sides; this stops a runaway upload, not a learner. */
  maxPages: 40,
} as const;

/**
 * Batch halves the price of reading and marking and takes up to 24 hours, so it is the default and the learner is told when their report is due.
 * The standard path is used when the learner paid for an instant report, or when the batch could not come back in time to be worth batching.
 */
export function batchDecision(input: { now: Date; instantRequested: boolean; batchWindowHours: number; promisedBy: Date | null }):
  { mode: 'batch'; readyBy: Date } | { mode: 'standard'; reason: 'instant_requested' | 'promise_too_soon' } {
  if (input.instantRequested) return { mode: 'standard', reason: 'instant_requested' };
  const readyBy = new Date(input.now.getTime() + input.batchWindowHours * 3_600_000);
  if (input.promisedBy && readyBy.getTime() > input.promisedBy.getTime()) return { mode: 'standard', reason: 'promise_too_soon' };
  return { mode: 'batch', readyBy };
}

// ---------------------------------------------------------------------------
// The eight parameters
// ---------------------------------------------------------------------------

export const EIGHT_PARAMETERS = [
  'step_marking',
  'factual_correctness',
  'spelling',
  'grammar',
  'punctuation',
  'presentation',
  'diagrams_and_tables',
  'textbook_adherence',
] as const;
export type ParameterId = (typeof EIGHT_PARAMETERS)[number];

/** Which pass can answer each parameter. Nothing is guessed from a pass that cannot see what it would need. */
export const PARAMETER_SOURCE: Record<ParameterId, 'marking' | 'writing' | 'reader' | 'library'> = {
  step_marking: 'marking',
  factual_correctness: 'marking',
  spelling: 'writing',
  grammar: 'writing',
  punctuation: 'writing',
  presentation: 'reader',
  diagrams_and_tables: 'reader',
  textbook_adherence: 'library',
};

export type Band = 'strong' | 'fair' | 'weak';
export interface ParameterResult {
  id: ParameterId;
  /** 0..1, or null when the pass that answers this parameter did not run. */
  score: number | null;
  band: Band | 'unavailable';
  note: string;
}

export const bandOf = (score: number): Band => (score >= 0.8 ? 'strong' : score >= 0.5 ? 'fair' : 'weak');

/**
 * Assembles the profile from whatever passes actually ran. A parameter whose pass did not run is `unavailable` with a plain reason — never a
 * score invented from the others. Textbook adherence needs the library hub, which is not deployed everywhere.
 */
export function profileFrom(input: {
  scores: Partial<Record<ParameterId, number>>;
  ranPasses: { marking: boolean; writing: boolean; reader: boolean; library: boolean };
  notes?: Partial<Record<ParameterId, string>>;
}): ParameterResult[] {
  const why: Record<'marking' | 'writing' | 'reader' | 'library', string> = {
    marking: 'the answers were not marked',
    writing: 'the writing check did not run',
    reader: 'the pages were not read',
    library: 'the textbook library is not connected here',
  };
  return EIGHT_PARAMETERS.map((id) => {
    const source = PARAMETER_SOURCE[id];
    const score = input.scores[id];
    if (!input.ranPasses[source] || score === undefined) {
      return { id, score: null, band: 'unavailable' as const, note: input.notes?.[id] ?? why[source] };
    }
    const clamped = Math.min(1, Math.max(0, score));
    return { id, score: clamped, band: bandOf(clamped), note: input.notes?.[id] ?? '' };
  });
}

export interface QuestionOutcome {
  itemId: string;
  chapter: string;
  marks: number;
  awarded: number;
  /** Value-point kinds the learner missed on this question. */
  missedKinds: string[];
}

export interface WeakArea {
  chapter: string;
  marks: number;
  awarded: number;
  share: number;
  questions: number;
  missedKinds: string[];
}

/**
 * Weak areas, worst first: marks lost by chapter, with the kinds of value point most often missed. A chapter the learner was never asked about
 * does not appear — this says where they lost marks, not where they might.
 */
export function weakAreas(outcomes: QuestionOutcome[], opts: { minMarks?: number } = {}): WeakArea[] {
  const min = opts.minMarks ?? 0;
  const by = new Map<string, WeakArea>();
  for (const o of outcomes) {
    const chapter = o.chapter || 'unlabelled';
    const row = by.get(chapter) ?? { chapter, marks: 0, awarded: 0, share: 0, questions: 0, missedKinds: [] };
    row.marks += o.marks;
    row.awarded += o.awarded;
    row.questions += 1;
    for (const k of o.missedKinds) if (!row.missedKinds.includes(k)) row.missedKinds.push(k);
    by.set(chapter, row);
  }
  return [...by.values()]
    .filter((r) => r.marks >= min)
    .map((r) => ({ ...r, share: r.marks === 0 ? 0 : r.awarded / r.marks }))
    .sort((a, b) => a.share - b.share || b.marks - a.marks || a.chapter.localeCompare(b.chapter));
}
