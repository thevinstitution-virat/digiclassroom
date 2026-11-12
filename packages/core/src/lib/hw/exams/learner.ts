// Exam packages, phase 3: the learner's side — the catalogue, one package with its sets and attempts, starting a set against the server's clock,
// finishing early, abandoning, and reading the paper while the clock runs. Every decision is a pure rule in rules.ts; this module loads the rows,
// asks the rule, and writes. The clock is the server's: started_at is the server's now, and expires_at / upload_deadline_at are stored once and
// never recomputed (migration 034 refuses any change). Statuses that follow from time passing are settled whenever an attempt is read
// (rules.settle), so no scheduled job is needed for the clock to be honoured.
//
// Not here yet: the photographed pages (phase 4) and the hw_assignment each attempt is marked through (phase 5). assignment_id stays NULL until then.

import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { hwBankQuestion } from '@/db/hw-bank-schema';
import { hwExamAttempt, hwExamEntitlement, hwExamPackage, hwExamPage, hwExamSet, hwExamSetItem, type ExamAttemptStatus } from '@/db/hw-exams-schema';
import { HwError } from '@/lib/hw/errors';
import type { Exec } from '@/lib/hw/db';
import { getHwConfig } from '@/lib/hw/config';
import { learnerFigures, type LearnerFigure } from '@/lib/hw/bank/figures';
import { clockFor, effectiveAttempts, remainingMs, settle, startVerdict, type EntitlementLike, type NotStarted } from './rules';
import { sheetLayout } from './sheet';
import { poolsOf, visibleTo } from './practice';

export const examsEnabled = (): boolean => getHwConfig().HW_EXAMS_ENABLED;

export const requireEnabled = () => {
  if (!examsEnabled()) throw new HwError('FEATURE_DISABLED', 'Exam practice is not open yet. / परीक्षा अभ्यास अभी शुरू नहीं हुआ है।');
};
const notFound = () => new HwError('NOT_FOUND', 'Not found. / नहीं मिला।');

/** The refusal a learner sees, in both languages (the screen shows the half that matches its language). */
export const NOT_STARTED_TEXT: Record<NotStarted, { en: string; hi: string }> = {
  not_entitled: { en: 'This package is not part of your plan.', hi: 'यह पैकेज आपकी योजना में शामिल नहीं है।' },
  entitlement_not_begun: { en: 'Your access to this package has not begun yet.', hi: 'इस पैकेज तक आपकी पहुँच अभी शुरू नहीं हुई है।' },
  entitlement_expired: { en: 'Your access to this package has ended.', hi: 'इस पैकेज तक आपकी पहुँच समाप्त हो गई है।' },
  entitlement_refunded: { en: 'This package was refunded.', hi: 'इस पैकेज का पैसा लौटा दिया गया है।' },
  package_not_published: { en: 'This package is not open.', hi: 'यह पैकेज खुला नहीं है।' },
  set_not_published: { en: 'This test is not open.', hi: 'यह परीक्षा खुली नहीं है।' },
  attempts_exhausted: { en: 'You have used all your attempts at this test.', hi: 'आपने इस परीक्षा के सभी प्रयास कर लिए हैं।' },
  attempt_open: { en: 'Finish or give up the test you have open first.', hi: 'पहले अपनी खुली परीक्षा पूरी करें या छोड़ें।' },
};

const OPEN: ExamAttemptStatus[] = ['started', 'time_up'];

type EntRow = typeof hwExamEntitlement.$inferSelect;
export const entLike = (e: EntRow | undefined): EntitlementLike | null =>
  e ? { packageId: e.packageId, status: e.status, startsAt: e.startsAt, expiresAt: e.expiresAt, attemptsPerSet: e.attemptsPerSet } : null;

/** Applies rules.settle to the learner's open attempts, so every read sees the clock's truth. Returns how many changed. */
export async function settleOpen(d: Exec, userId: string, now: Date, onlyAttemptId?: string): Promise<number> {
  const rows = await d.select({
    id: hwExamAttempt.id, status: hwExamAttempt.status, expiresAt: hwExamAttempt.expiresAt, uploadDeadlineAt: hwExamAttempt.uploadDeadlineAt,
    // outer column written out in full: drizzle renders ${col} bare here, and a bare "id" would bind to hw_exam_page itself
    pages: sql<number>`(SELECT count(*)::int FROM hw_exam_page p WHERE p.attempt_id = "hw_exam_attempt"."id" AND p.status = 'accepted')`,
  }).from(hwExamAttempt).where(and(
    eq(hwExamAttempt.userId, userId), inArray(hwExamAttempt.status, OPEN), ...(onlyAttemptId ? [eq(hwExamAttempt.id, onlyAttemptId)] : []),
  ));
  let changed = 0;
  for (const r of rows) {
    const s = settle(now, { status: r.status, expiresAt: r.expiresAt, uploadDeadlineAt: r.uploadDeadlineAt, acceptedPages: r.pages });
    if (!s) continue;
    // only from the status we read: a concurrent finish or upload wins, and this becomes a no-op
    const res = await d.update(hwExamAttempt).set({
      status: s.status, endedAt: sql`COALESCE(${hwExamAttempt.endedAt}, ${s.endedAt})`, ...(s.status === 'abandoned' && { failureReason: s.failureReason }),
      ...(s.status === 'uploaded' && { submittedAt: s.submittedAt }),
    }).where(and(eq(hwExamAttempt.id, r.id), eq(hwExamAttempt.status, r.status))).returning({ id: hwExamAttempt.id });
    changed += res.length;
  }
  return changed;
}

// ── catalogue ────────────────────────────────────────────────────────────────

export interface CatalogueEntry {
  id: string; board: string; classLevel: number; examYear: number; title: string; blurb: string; pricePaise: number; attemptsPerSet: number;
  sets: number; subjects: string[];
  access: 'active' | 'expired' | 'refunded' | 'none'; accessEndsAt: Date | null;
}

/** Published packages, and any package the learner has access to even if it has since been retired (their past attempts live there). */
export async function catalogue(d: Exec, userId: string, now = new Date()): Promise<CatalogueEntry[]> {
  requireEnabled();
  const pkgs = await d.select().from(hwExamPackage)
    .leftJoin(hwExamEntitlement, and(eq(hwExamEntitlement.packageId, hwExamPackage.id), eq(hwExamEntitlement.userId, userId)))
    .where(sql`${hwExamPackage.status} = 'published' OR (${hwExamPackage.status} = 'retired' AND ${hwExamEntitlement.id} IS NOT NULL)`)
    .orderBy(desc(hwExamPackage.examYear), asc(hwExamPackage.classLevel), asc(hwExamPackage.title));
  if (!pkgs.length) return [];
  const sets = await d.select({ packageId: hwExamSet.packageId, subject: hwExamSet.subject }).from(hwExamSet)
    .where(and(inArray(hwExamSet.packageId, pkgs.map((p) => p.hw_exam_package.id)), eq(hwExamSet.status, 'published')));
  return pkgs.map(({ hw_exam_package: p, hw_exam_entitlement: e }) => {
    const mine = sets.filter((s) => s.packageId === p.id);
    const live = e && e.status === 'active' && e.startsAt <= now && (!e.expiresAt || e.expiresAt > now);
    return {
      id: p.id, board: p.board, classLevel: p.classLevel, examYear: p.examYear, title: p.title, blurb: p.blurb, pricePaise: p.pricePaise,
      attemptsPerSet: e?.attemptsPerSet ?? p.attemptsPerSet, sets: mine.length, subjects: [...new Set(mine.map((s) => s.subject))].sort(),
      access: !e ? 'none' : live ? 'active' : e.status === 'refunded' ? 'refunded' : 'expired', accessEndsAt: e?.expiresAt ?? null,
    };
  });
}

// ── one package ──────────────────────────────────────────────────────────────

export interface AttemptSummary {
  id: string; attemptNo: number; status: ExamAttemptStatus; startedAt: Date; expiresAt: Date; uploadDeadlineAt: Date; endedAt: Date | null;
  marksAwarded: number | null; maxMarks: number;
}
export interface LearnerSet {
  id: string; kind: string; subject: string; subjectCode: string; title: string; maxMarks: number; durationMinutes: number; graceMinutes: number;
  questions: number; allowed: number; used: number; attempts: AttemptSummary[];
  canStart: { ok: true; attemptNo: number } | { ok: false; why: NotStarted; en: string; hi: string };
}

export async function packageForLearner(d: Exec, userId: string, packageId: string, now = new Date()) {
  requireEnabled();
  await settleOpen(d, userId, now);
  const pkg = (await d.select().from(hwExamPackage).where(eq(hwExamPackage.id, packageId)).limit(1))[0];
  const ent = (await d.select().from(hwExamEntitlement).where(and(eq(hwExamEntitlement.packageId, packageId), eq(hwExamEntitlement.userId, userId))).limit(1))[0];
  if (!pkg || pkg.status === 'draft' || (pkg.status === 'retired' && !ent)) throw notFound();

  const attempts = await d.select().from(hwExamAttempt).where(eq(hwExamAttempt.userId, userId)).orderBy(asc(hwExamAttempt.attemptNo));
  const hasOpen = attempts.some((a) => OPEN.includes(a.status));
  const sets = await d.select({
    s: hwExamSet,
    questions: sql<number>`(SELECT count(DISTINCT i.number)::int FROM hw_exam_set_item i WHERE i.set_id = "hw_exam_set"."id")`,
  }).from(hwExamSet).where(and(eq(hwExamSet.packageId, packageId), inArray(hwExamSet.status, ['published', 'retired']))).orderBy(asc(hwExamSet.position));

  const out: LearnerSet[] = [];
  for (const { s, questions } of sets) {
    // a question pool is drawn from, never sat; a practice test is only its own learner's (035)
    if (!visibleTo(s, userId)) continue;
    const mine = attempts.filter((a) => a.setId === s.id);
    if (s.status === 'retired' && !mine.length) continue; // a retired test is shown only to those who sat it
    const v = startVerdict({
      now, pkg: { id: pkg.id, status: pkg.status, attemptsPerSet: pkg.attemptsPerSet }, set: s, entitlement: entLike(ent), attemptsUsed: mine.length, hasOpenAttempt: hasOpen,
    });
    out.push({
      id: s.id, kind: s.kind, subject: s.subject, subjectCode: s.subjectCode, title: s.title, maxMarks: s.maxMarks, durationMinutes: s.durationMinutes,
      graceMinutes: s.graceMinutes, questions, allowed: effectiveAttempts({ id: pkg.id, status: pkg.status, attemptsPerSet: pkg.attemptsPerSet }, entLike(ent)), used: mine.length,
      attempts: mine.map((a) => ({
        id: a.id, attemptNo: a.attemptNo, status: a.status, startedAt: a.startedAt, expiresAt: a.expiresAt, uploadDeadlineAt: a.uploadDeadlineAt,
        endedAt: a.endedAt, marksAwarded: a.marksAwarded, maxMarks: a.maxMarks,
      })),
      canStart: v.ok ? { ok: true, attemptNo: v.attemptNo } : { ok: false, why: v.why, ...NOT_STARTED_TEXT[v.why] },
    });
  }
  const open = attempts.find((a) => OPEN.includes(a.status));
  return {
    package: { id: pkg.id, title: pkg.title, blurb: pkg.blurb, board: pkg.board, classLevel: pkg.classLevel, examYear: pkg.examYear, status: pkg.status },
    access: entLike(ent) ? { status: ent!.status, expiresAt: ent!.expiresAt } : null,
    sets: out,
    /** Question pools the learner can make their own practice tests from (topics and types to choose). */
    pools: pkg.status === 'published' ? await poolsOf(d, pkg.id) : [],
    /** The learner's open attempt anywhere (one clock at a time), so the page can send them back to it. */
    openAttempt: open ? { id: open.id, setId: open.setId } : null,
  };
}

// ── starting, finishing, abandoning ──────────────────────────────────────────

/**
 * Starts the next attempt at a set. Runs under a lock on the learner's entitlement row, so two clicks (or two tabs) cannot start two attempts or
 * take the same attempt number; the database's own allowance trigger is the second line.
 */
export async function startAttempt(d: Exec, userId: string, setId: string, now = new Date()): Promise<{ attemptId: string; attemptNo: number; expiresAt: Date }> {
  requireEnabled();
  return d.transaction(async (tx) => {
    const set = (await tx.select().from(hwExamSet).where(eq(hwExamSet.id, setId)).limit(1))[0];
    if (!set || !visibleTo(set, userId)) throw notFound();
    const pkg = (await tx.select().from(hwExamPackage).where(eq(hwExamPackage.id, set.packageId)).limit(1))[0]!;
    const ent = (await tx.select().from(hwExamEntitlement)
      .where(and(eq(hwExamEntitlement.packageId, pkg.id), eq(hwExamEntitlement.userId, userId))).for('update').limit(1))[0];
    await settleOpen(tx, userId, now);
    const used = (await tx.select({ n: count() }).from(hwExamAttempt).where(and(eq(hwExamAttempt.userId, userId), eq(hwExamAttempt.setId, setId))))[0]!.n;
    const open = (await tx.select({ n: count() }).from(hwExamAttempt).where(and(eq(hwExamAttempt.userId, userId), inArray(hwExamAttempt.status, OPEN))))[0]!.n;
    const v = startVerdict({ now, pkg: { id: pkg.id, status: pkg.status, attemptsPerSet: pkg.attemptsPerSet }, set, entitlement: entLike(ent), attemptsUsed: used, hasOpenAttempt: open > 0 });
    if (!v.ok) {
      const t = NOT_STARTED_TEXT[v.why];
      throw new HwError(v.why === 'not_entitled' || v.why.startsWith('entitlement') ? 'FORBIDDEN' : 'CONFLICT', `${t.en} / ${t.hi}`, `start refused: ${v.why}`);
    }
    const clock = clockFor(now, set);
    const [a] = await tx.insert(hwExamAttempt).values({
      userId, setId, attemptNo: v.attemptNo, startedAt: now, expiresAt: clock.expiresAt, uploadDeadlineAt: clock.uploadDeadlineAt, maxMarks: set.maxMarks,
    }).returning({ id: hwExamAttempt.id });
    return { attemptId: a!.id, attemptNo: v.attemptNo, expiresAt: clock.expiresAt };
  });
}

export async function ownAttempt(d: Exec, userId: string, attemptId: string) {
  const a = (await d.select().from(hwExamAttempt).where(and(eq(hwExamAttempt.id, attemptId), eq(hwExamAttempt.userId, userId))).limit(1))[0];
  if (!a) throw notFound(); // someone else's attempt is simply not there
  return a;
}

/** "I have finished writing": the clock stops now and the upload window (which was fixed at the start) is what remains. */
export async function finishWriting(d: Exec, userId: string, attemptId: string, now = new Date()): Promise<void> {
  requireEnabled();
  await settleOpen(d, userId, now, attemptId);
  const r = await d.update(hwExamAttempt).set({ status: 'time_up', endedAt: now })
    .where(and(eq(hwExamAttempt.id, attemptId), eq(hwExamAttempt.userId, userId), eq(hwExamAttempt.status, 'started'))).returning({ id: hwExamAttempt.id });
  if (!r.length) {
    await ownAttempt(d, userId, attemptId);
    throw new HwError('CONFLICT', 'This test is no longer being written. / यह परीक्षा अब लिखी नहीं जा रही है।');
  }
}

/** Gives up an open attempt. It still counts as one of the allowed attempts: otherwise giving up would be a free look at the paper. */
export async function abandonAttempt(d: Exec, userId: string, attemptId: string, now = new Date()): Promise<void> {
  requireEnabled();
  const r = await d.update(hwExamAttempt).set({ status: 'abandoned', endedAt: sql`COALESCE(${hwExamAttempt.endedAt}, ${now})`, failureReason: 'given_up' })
    .where(and(eq(hwExamAttempt.id, attemptId), eq(hwExamAttempt.userId, userId), inArray(hwExamAttempt.status, OPEN))).returning({ id: hwExamAttempt.id });
  if (!r.length) {
    await ownAttempt(d, userId, attemptId);
    throw new HwError('CONFLICT', 'This test is already closed. / यह परीक्षा पहले ही बंद हो चुकी है।');
  }
}

// ── the paper, while the clock runs ─────────────────────────────────────────

export interface PaperQuestion {
  number: number; alt: string | null; section: string; marks: number; qtype: string; stem: string;
  options: { letter: string; text: string }[];
  /** Questions sharing a group are alternatives ("attempt either"). */
  choiceGroup: string | null;
  figures: LearnerFigure[];
}

/** What the learner may see of a question: never the marking scheme, the value points or the right option. */
export function paperQuestionOf(
  item: { number: number; section: string; marks: number; qtype: string; stem: string | null; options: unknown[] },
  bank: { stem: string; alt: string | null; options: { letter: string; text: string }[]; choiceGroup: string | null } | null,
  figures: LearnerFigure[] = [],
): PaperQuestion {
  const authoredOptions = (item.options as string[]).map((text, i) => ({ letter: 'ABCD'[i] ?? String(i + 1), text }));
  return {
    number: item.number, alt: bank?.alt ?? null, section: item.section, marks: item.marks, qtype: item.qtype,
    stem: bank ? bank.stem : item.stem ?? '', options: bank ? bank.options : authoredOptions, choiceGroup: bank?.choiceGroup ?? null, figures,
  };
}

export async function attemptView<P = never>(d: Exec, userId: string, attemptId: string, opts: { now?: Date; sign?: (key: string) => Promise<string>; booklet?: (attemptId: string) => Promise<P[]> } = {}) {
  requireEnabled();
  const now = opts.now ?? new Date();
  await settleOpen(d, userId, now, attemptId);
  const a = await ownAttempt(d, userId, attemptId);
  const set = (await d.select().from(hwExamSet).where(eq(hwExamSet.id, a.setId)).limit(1))[0]!;
  const rows = await d.select({ i: hwExamSetItem, b: hwBankQuestion }).from(hwExamSetItem)
    .leftJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId))
    .where(eq(hwExamSetItem.setId, set.id)).orderBy(asc(hwExamSetItem.position));
  const bankIds = rows.flatMap((r) => (r.b ? [r.b.id] : []));
  const figs = opts.sign && bankIds.length ? await learnerFigures(d, bankIds, opts.sign) : new Map<string, LearnerFigure[]>();
  const pages = (await d.select({ n: count() }).from(hwExamPage).where(and(eq(hwExamPage.attemptId, a.id), eq(hwExamPage.status, 'accepted'))))[0]!.n;
  return {
    attempt: {
      id: a.id, attemptNo: a.attemptNo, status: a.status, startedAt: a.startedAt, expiresAt: a.expiresAt, uploadDeadlineAt: a.uploadDeadlineAt,
      endedAt: a.endedAt, failureReason: a.failureReason, pages,
      /** When the report is promised (batch evaluation, exams/batch.ts); null = it is being marked straight away. */
      readyBy: a.status === 'uploaded' || a.status === 'evaluating' ? a.readyBy : null,
    },
    /** The server's now, so the page counts down from the server's clock rather than the device's. */
    serverNow: now,
    remainingMs: a.status === 'started' ? remainingMs(now, a.expiresAt) : 0,
    uploadRemainingMs: a.status === 'started' || a.status === 'time_up' ? Math.max(0, a.uploadDeadlineAt.getTime() - now.getTime()) : 0,
    set: { id: set.id, packageId: set.packageId, title: set.title, subject: set.subject, subjectCode: set.subjectCode, kind: set.kind, maxMarks: set.maxMarks, durationMinutes: set.durationMinutes },
    /** The photographed pages, in order (phase 4), when the caller can show them. */
    booklet: opts.booklet ? await opts.booklet(a.id) : ([] as P[]),
    paper: rows.map(({ i, b }) => paperQuestionOf(i, b && { stem: b.stem, alt: b.alt, options: b.options, choiceGroup: b.choiceGroup }, b ? figs.get(b.id) ?? [] : [])),
    /** The report (phase 6), once made; with this learner's earlier attempts at the same set. */
    // loaded on demand: the report module brings the job runner's database and AI clients, which this module otherwise never needs
    report: a.status === 'reported' ? await (await import('./report')).reportView(d, a) : null,
  };
}

// ── the printed answer sheet ─────────────────────────────────────────────────

/** A set's answer sheet: numbers, marks and boxes only, never the questions. For the super-admin's preview and for learners with access. */
export async function sheetFor(d: Exec, setId: string) {
  const set = (await d.select().from(hwExamSet).where(eq(hwExamSet.id, setId)).limit(1))[0];
  if (!set) throw notFound();
  const pkg = (await d.select({ title: hwExamPackage.title, status: hwExamPackage.status }).from(hwExamPackage).where(eq(hwExamPackage.id, set.packageId)).limit(1))[0]!;
  const items = await d.select({
    number: hwExamSetItem.number, alt: hwBankQuestion.alt, choiceGroup: hwBankQuestion.choiceGroup, marks: hwExamSetItem.marks,
    qtype: hwExamSetItem.qtype, section: hwExamSetItem.section,
  }).from(hwExamSetItem).leftJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId))
    .where(eq(hwExamSetItem.setId, setId)).orderBy(asc(hwExamSetItem.position));
  return {
    set: { id: set.id, packageId: set.packageId, title: set.title, subject: set.subject, subjectCode: set.subjectCode, maxMarks: set.maxMarks, durationMinutes: set.durationMinutes, status: set.status },
    packageTitle: pkg.title,
    packageStatus: pkg.status,
    layout: sheetLayout(set.id, items),
  };
}

/** The sheet for a learner: the set must be open and the package theirs (any access they have or had — a sheet reveals no question). */
export async function sheetForLearner(d: Exec, userId: string, setId: string) {
  requireEnabled();
  const s = await sheetFor(d, setId);
  if (s.set.status === 'draft' || s.packageStatus === 'draft') throw notFound();
  const row = (await d.select({ kind: hwExamSet.kind, ownerUserId: hwExamSet.ownerUserId }).from(hwExamSet).where(eq(hwExamSet.id, setId)).limit(1))[0];
  if (!row || !visibleTo(row, userId)) throw notFound();
  const ent = (await d.select({ id: hwExamEntitlement.id }).from(hwExamEntitlement)
    .where(and(eq(hwExamEntitlement.packageId, s.set.packageId), eq(hwExamEntitlement.userId, userId))).limit(1))[0];
  if (!ent) throw new HwError('FORBIDDEN', `${NOT_STARTED_TEXT.not_entitled.en} / ${NOT_STARTED_TEXT.not_entitled.hi}`);
  return s;
}

