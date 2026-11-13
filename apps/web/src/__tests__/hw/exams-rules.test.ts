// Exam packages, phase 1: the rules of a timed attempt, without a database (docs/hw-eval/exam-packages.md).

import {
  EIGHT_PARAMETERS,
  PAGE_LIMITS,
  bandOf,
  batchDecision,
  clockFor,
  effectiveAttempts,
  isTimeUp,
  pageVerdict,
  profileFrom,
  settle,
  remainingMs,
  startVerdict,
  uploadVerdict,
  weakAreas,
  type AttemptLike,
  type EntitlementLike,
  type PackageLike,
  type PageFacts,
  type QuestionOutcome,
  type SetLike,
} from '@/lib/hw/exams/rules';

const NOW = new Date('2026-11-11T09:00:00.000Z');
const pkg = (over: Partial<PackageLike> = {}): PackageLike => ({ id: 'p1', status: 'published', attemptsPerSet: 5, ...over });
const set = (over: Partial<SetLike> = {}): SetLike => ({ id: 's1', status: 'published', durationMinutes: 180, graceMinutes: 20, ...over });
const ent = (over: Partial<EntitlementLike> = {}): EntitlementLike => ({
  packageId: 'p1', status: 'active', startsAt: new Date('2026-11-01T00:00:00.000Z'), expiresAt: null, attemptsPerSet: null, ...over,
});

// ── the allowance ────────────────────────────────────────────────────────────
describe('how many attempts a learner has', () => {
  it('uses the package allowance when the entitlement says nothing', () => {
    expect(effectiveAttempts(pkg(), ent())).toBe(5);
    expect(effectiveAttempts(pkg(), null)).toBe(5);
  });

  it('lets one learner be given more or fewer than the package allows', () => {
    expect(effectiveAttempts(pkg(), ent({ attemptsPerSet: 8 }))).toBe(8);
    expect(effectiveAttempts(pkg(), ent({ attemptsPerSet: 1 }))).toBe(1);
  });
});

// ── starting ─────────────────────────────────────────────────────────────────
describe('may this learner start this set', () => {
  const base = { now: NOW, pkg: pkg(), set: set(), entitlement: ent(), attemptsUsed: 0, hasOpenAttempt: false };

  it('gives the next attempt number and the allowance', () => {
    expect(startVerdict({ ...base, attemptsUsed: 2 })).toEqual({ ok: true, attemptNo: 3, allowed: 5 });
  });

  it('refuses a learner with no entitlement', () => {
    expect(startVerdict({ ...base, entitlement: null })).toEqual({ ok: false, why: 'not_entitled' });
  });

  it('refuses a draft or retired package, and a set that is not published', () => {
    expect(startVerdict({ ...base, pkg: pkg({ status: 'draft' }) })).toEqual({ ok: false, why: 'package_not_published' });
    expect(startVerdict({ ...base, pkg: pkg({ status: 'retired' }) })).toEqual({ ok: false, why: 'package_not_published' });
    expect(startVerdict({ ...base, set: set({ status: 'draft' }) })).toEqual({ ok: false, why: 'set_not_published' });
  });

  it('refuses an entitlement that has not begun, has run out, or was refunded', () => {
    expect(startVerdict({ ...base, entitlement: ent({ startsAt: new Date('2026-12-01T00:00:00.000Z') }) }))
      .toEqual({ ok: false, why: 'entitlement_not_begun' });
    expect(startVerdict({ ...base, entitlement: ent({ expiresAt: new Date('2026-11-10T00:00:00.000Z') }) }))
      .toEqual({ ok: false, why: 'entitlement_expired' });
    expect(startVerdict({ ...base, entitlement: ent({ status: 'expired' }) })).toEqual({ ok: false, why: 'entitlement_expired' });
    expect(startVerdict({ ...base, entitlement: ent({ status: 'refunded' }) })).toEqual({ ok: false, why: 'entitlement_refunded' });
  });

  it('refuses a sixth attempt, and says how many were used', () => {
    const v = startVerdict({ ...base, attemptsUsed: 5 });
    expect(v).toMatchObject({ ok: false, why: 'attempts_exhausted' });
    expect(v).toHaveProperty('detail', '5 of 5 used');
  });

  it('allows the sixth when that learner was given more', () => {
    expect(startVerdict({ ...base, attemptsUsed: 5, entitlement: ent({ attemptsPerSet: 8 }) }))
      .toEqual({ ok: true, attemptNo: 6, allowed: 8 });
  });

  it('never runs two clocks at once', () => {
    expect(startVerdict({ ...base, hasOpenAttempt: true })).toEqual({ ok: false, why: 'attempt_open' });
  });

  it('an expiry exactly now has run out (the boundary belongs to the past)', () => {
    expect(startVerdict({ ...base, entitlement: ent({ expiresAt: NOW }) })).toEqual({ ok: false, why: 'entitlement_expired' });
  });
});

// ── the clock ────────────────────────────────────────────────────────────────
describe('the clock', () => {
  it('ends writing time after the paper duration and leaves the grace window for uploading', () => {
    const { expiresAt, uploadDeadlineAt } = clockFor(NOW, set());
    expect(expiresAt.toISOString()).toBe('2026-11-11T12:00:00.000Z');
    expect(uploadDeadlineAt.toISOString()).toBe('2026-11-11T12:20:00.000Z');
  });

  it('allows no grace at all when the set says so', () => {
    expect(clockFor(NOW, set({ graceMinutes: 0 })).uploadDeadlineAt.toISOString()).toBe('2026-11-11T12:00:00.000Z');
  });

  it('counts down and never goes negative', () => {
    const { expiresAt } = clockFor(NOW, set({ durationMinutes: 10 }));
    expect(remainingMs(NOW, expiresAt)).toBe(600_000);
    expect(remainingMs(new Date(NOW.getTime() + 600_000), expiresAt)).toBe(0);
    expect(remainingMs(new Date(NOW.getTime() + 999_999), expiresAt)).toBe(0);
    expect(isTimeUp(new Date(NOW.getTime() + 600_000), expiresAt)).toBe(true);
    expect(isTimeUp(new Date(NOW.getTime() + 599_999), expiresAt)).toBe(false);
  });
});

// ── uploading ────────────────────────────────────────────────────────────────
describe('when pages may be uploaded', () => {
  const attempt = (over: Partial<AttemptLike> = {}): AttemptLike => ({
    status: 'started',
    expiresAt: new Date('2026-11-11T12:00:00.000Z'),
    uploadDeadlineAt: new Date('2026-11-11T12:20:00.000Z'),
    ...over,
  });

  it('refuses an upload while the learner should still be writing', () => {
    expect(uploadVerdict(NOW, attempt())).toEqual({ ok: false, why: 'too_early' });
  });

  it('accepts it once the time is up, and says how long is left to upload', () => {
    const v = uploadVerdict(new Date('2026-11-11T12:05:00.000Z'), attempt({ status: 'time_up' }));
    expect(v).toEqual({ ok: true, remainingMs: 15 * 60_000 });
  });

  it('accepts a learner who ended early (status time_up) before their writing time was over', () => {
    expect(uploadVerdict(new Date('2026-11-11T11:00:00.000Z'), attempt({ status: 'time_up' }))).toMatchObject({ ok: true });
  });

  it('accepts a second page while the booklet is already partly uploaded', () => {
    expect(uploadVerdict(new Date('2026-11-11T12:10:00.000Z'), attempt({ status: 'uploaded' }))).toMatchObject({ ok: true });
  });

  it('refuses after the grace window closes', () => {
    expect(uploadVerdict(new Date('2026-11-11T12:20:01.000Z'), attempt({ status: 'time_up' }))).toEqual({ ok: false, why: 'too_late' });
  });

  it('refuses once the attempt has moved on or was abandoned', () => {
    for (const status of ['evaluating', 'reported', 'abandoned'] as const) {
      expect(uploadVerdict(new Date('2026-11-11T12:05:00.000Z'), attempt({ status }))).toEqual({ ok: false, why: 'wrong_status' });
    }
  });
});

// ── page quality ─────────────────────────────────────────────────────────────
describe('a page the reader can actually read', () => {
  const good: PageFacts = { widthPx: 1600, heightPx: 2200, bytes: 1_200_000, sharpness: 0.6, brightness: 0.5, glare: 0.01 };

  it('accepts a clear page', () => {
    expect(pageVerdict(good)).toEqual({ ok: true });
  });

  it('names what is wrong, one thing at a time', () => {
    expect(pageVerdict({ ...good, widthPx: 600, heightPx: 800 })).toEqual({ ok: false, why: 'too_small' });
    expect(pageVerdict({ ...good, bytes: PAGE_LIMITS.maxBytes + 1 })).toEqual({ ok: false, why: 'too_large' });
    expect(pageVerdict({ ...good, sharpness: 0.1 })).toEqual({ ok: false, why: 'too_blurred' });
    expect(pageVerdict({ ...good, brightness: 0.05 })).toEqual({ ok: false, why: 'too_dark' });
    expect(pageVerdict({ ...good, brightness: 0.98 })).toEqual({ ok: false, why: 'too_bright' });
    expect(pageVerdict({ ...good, brightness: 0.95 })).toEqual({ ok: true }); // a light page with little writing (limit raised 13 Nov 2026)
    expect(pageVerdict({ ...good, glare: 0.5 })).toEqual({ ok: false, why: 'glare' });
  });

  it('accepts a page exactly at each limit', () => {
    expect(pageVerdict({ ...good, widthPx: 1000, heightPx: 1000 })).toEqual({ ok: true });
    expect(pageVerdict({ ...good, sharpness: PAGE_LIMITS.minSharpness })).toEqual({ ok: true });
    expect(pageVerdict({ ...good, brightness: PAGE_LIMITS.minBrightness })).toEqual({ ok: true });
    expect(pageVerdict({ ...good, brightness: PAGE_LIMITS.maxBrightness })).toEqual({ ok: true });
    expect(pageVerdict({ ...good, glare: PAGE_LIMITS.maxGlare })).toEqual({ ok: true });
    expect(pageVerdict({ ...good, bytes: PAGE_LIMITS.maxBytes })).toEqual({ ok: true });
  });
});

// ── batch or standard ────────────────────────────────────────────────────────
describe('batch by default, standard when it has to be', () => {
  it('batches and says when the report is due', () => {
    const d = batchDecision({ now: NOW, instantRequested: false, batchWindowHours: 24, promisedBy: null });
    expect(d).toEqual({ mode: 'batch', readyBy: new Date('2026-11-12T09:00:00.000Z') });
  });

  it('uses the standard path when the learner paid for an instant report', () => {
    expect(batchDecision({ now: NOW, instantRequested: true, batchWindowHours: 24, promisedBy: null }))
      .toEqual({ mode: 'standard', reason: 'instant_requested' });
  });

  it('uses the standard path when a batch could not come back in time to keep the promise', () => {
    expect(batchDecision({ now: NOW, instantRequested: false, batchWindowHours: 24, promisedBy: new Date('2026-11-11T18:00:00.000Z') }))
      .toEqual({ mode: 'standard', reason: 'promise_too_soon' });
  });

  it('still batches when the promise is comfortably after the window', () => {
    expect(batchDecision({ now: NOW, instantRequested: false, batchWindowHours: 6, promisedBy: new Date('2026-11-11T18:00:00.000Z') }))
      .toMatchObject({ mode: 'batch' });
  });
});

// ── the eight parameters ─────────────────────────────────────────────────────
describe('the 8-parameter profile', () => {
  const ran = { marking: true, writing: true, reader: true, library: true };
  const full = {
    step_marking: 0.9, factual_correctness: 0.82, spelling: 0.4, grammar: 0.55,
    punctuation: 0.75, presentation: 0.6, diagrams_and_tables: 0.2, textbook_adherence: 0.7,
  };

  it('reports exactly eight parameters, in a fixed order', () => {
    const p = profileFrom({ scores: full, ranPasses: ran });
    expect(p).toHaveLength(8);
    expect(p.map((x) => x.id)).toEqual([...EIGHT_PARAMETERS]);
  });

  it('bands a score the same way everywhere', () => {
    expect([bandOf(1), bandOf(0.8), bandOf(0.79), bandOf(0.5), bandOf(0.49), bandOf(0)])
      .toEqual(['strong', 'strong', 'fair', 'fair', 'weak', 'weak']);
  });

  it('says a parameter is unavailable rather than guessing it', () => {
    const p = profileFrom({ scores: full, ranPasses: { ...ran, library: false } });
    const textbook = p.find((x) => x.id === 'textbook_adherence')!;
    expect(textbook).toMatchObject({ score: null, band: 'unavailable' });
    expect(textbook.note).toBe('the textbook library is not connected here');
    // the rest are untouched
    expect(p.filter((x) => x.band === 'unavailable')).toHaveLength(1);
  });

  it('marks the writing parameters unavailable together when that pass did not run', () => {
    const p = profileFrom({ scores: full, ranPasses: { ...ran, writing: false } });
    expect(p.filter((x) => x.band === 'unavailable').map((x) => x.id)).toEqual(['spelling', 'grammar', 'punctuation']);
  });

  it('treats a missing score as unavailable even when the pass ran', () => {
    const { presentation, ...rest } = full;
    expect(profileFrom({ scores: rest, ranPasses: ran }).find((x) => x.id === 'presentation'))
      .toMatchObject({ score: null, band: 'unavailable' });
  });

  it('keeps a score inside 0..1', () => {
    const p = profileFrom({ scores: { ...full, spelling: 1.4, grammar: -0.3 }, ranPasses: ran });
    expect(p.find((x) => x.id === 'spelling')).toMatchObject({ score: 1, band: 'strong' });
    expect(p.find((x) => x.id === 'grammar')).toMatchObject({ score: 0, band: 'weak' });
  });
});

// ── weak areas ───────────────────────────────────────────────────────────────
describe('weak areas', () => {
  const outcomes: QuestionOutcome[] = [
    { itemId: 'i1', chapter: 'Light', marks: 5, awarded: 1, missedKinds: ['key_point', 'format'] },
    { itemId: 'i2', chapter: 'Light', marks: 3, awarded: 1, missedKinds: ['key_point'] },
    { itemId: 'i3', chapter: 'Acids', marks: 4, awarded: 4, missedKinds: [] },
    { itemId: 'i4', chapter: 'Heredity', marks: 2, awarded: 1, missedKinds: ['step'] },
    { itemId: 'i5', chapter: '', marks: 1, awarded: 0, missedKinds: ['unit'] },
  ];

  it('groups by chapter and adds up the marks', () => {
    const light = weakAreas(outcomes).find((w) => w.chapter === 'Light')!;
    expect(light).toMatchObject({ marks: 8, awarded: 2, questions: 2 });
    expect(light.share).toBeCloseTo(0.25);
    expect(light.missedKinds).toEqual(['key_point', 'format']);
  });

  it('puts the worst share first and a full-marks chapter last', () => {
    expect(weakAreas(outcomes).map((w) => w.chapter)).toEqual(['unlabelled', 'Light', 'Heredity', 'Acids']);
  });

  it('labels a question with no chapter rather than dropping it', () => {
    expect(weakAreas(outcomes).find((w) => w.chapter === 'unlabelled')).toMatchObject({ marks: 1, awarded: 0, share: 0 });
  });

  it('can ignore chapters that carried too few marks to mean anything', () => {
    expect(weakAreas(outcomes, { minMarks: 3 }).map((w) => w.chapter)).toEqual(['Light', 'Acids']);
  });

  it('is empty for an empty paper', () => {
    expect(weakAreas([])).toEqual([]);
  });
});

describe('settle (phase 3: the clock is honoured when an attempt is read)', () => {
  const t0 = new Date('2027-02-01T09:00:00Z');
  const at = (min: number) => new Date(t0.getTime() + min * 60_000);
  const a = (status: 'started' | 'time_up' | 'uploaded', pages = 0) => ({ status, expiresAt: at(180), uploadDeadlineAt: at(200), acceptedPages: pages });
  it('nothing changes while writing time runs', () => {
    expect(settle(at(179), a('started'))).toBeNull();
  });
  it('time up exactly when the clock says, ended at the expiry rather than when it was noticed', () => {
    expect(settle(at(180), a('started'))).toEqual({ status: 'time_up', endedAt: at(180) });
    expect(settle(at(195), a('started'))).toEqual({ status: 'time_up', endedAt: at(180) });
  });
  it('the upload window still open: a time_up attempt waits', () => {
    expect(settle(at(200), a('time_up'))).toBeNull();
  });
  it('the upload window closed with no page: abandoned, whether or not anyone noticed the time running out', () => {
    expect(settle(at(201), a('time_up'))).toEqual({ status: 'abandoned', endedAt: at(180), failureReason: 'no_pages_uploaded' });
    expect(settle(at(500), a('started'))).toEqual({ status: 'abandoned', endedAt: at(180), failureReason: 'no_pages_uploaded' });
  });
  it('the upload window closed with pages: handed in as it stands, at the deadline', () => {
    expect(settle(at(500), a('time_up', 3))).toEqual({ status: 'uploaded', endedAt: at(180), submittedAt: at(200) });
    expect(settle(at(500), a('started', 1))).toEqual({ status: 'uploaded', endedAt: at(180), submittedAt: at(200) });
    expect(settle(at(199), a('time_up', 3))).toBeNull();
  });
  it('a booklet already handed in is left alone', () => {
    expect(settle(at(500), a('uploaded', 3))).toBeNull();
  });
});
