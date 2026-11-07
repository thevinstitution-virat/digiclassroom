// Self-practice for independent learners (docs/hw-eval/self-practice.md): the practice space, each learner's trial, and the per-learner
// budget. The rules are in rules.ts; this file is the database side.

import { eq, sql } from 'drizzle-orm';
import { hwPracticeTrial, hwTenantQuota } from '@/db/hw-schema';
import { organization } from '@/db/schema';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { db, num, type Exec } from '../db';
import {
  PRACTICE_ORG_ID, PRACTICE_TEXT, refusalText, stateAfterSpend, trialSummary, trialVerdict,
  type PracticeLang, type TrialRow,
} from './rules';

export const practiceEnabled = (): boolean => getHwConfig().HW_SELF_PRACTICE_ENABLED;

/** Both languages in one line, for errors raised where the learner's language is not known. */
const both = (why: 'budget' | 'time' | 'no_trial'): string => `${refusalText(why, 'en')} / ${refusalText(why, 'hi')}`;

/**
 * The practice institution and its monthly ceiling (classes and sections are made per learner when a question is started: attempt.ts). Safe to call repeatedly. The institution shows up in
 * the super admin's institution list like any other.
 */
export async function ensurePracticeSpace(x: Exec): Promise<void> {
  await x.insert(organization).values({
    id: PRACTICE_ORG_ID, name: 'Virat Gyankosh Practice', slug: PRACTICE_ORG_ID, createdAt: new Date(),
    settings: { system: true, purpose: 'independent-learner self-practice' },
  }).onConflictDoNothing();
  // The ceiling over all learners. Created once, from the setting; changing it afterwards is done on the Tenants tab like any institution.
  await x.insert(hwTenantQuota).values({
    organizationId: PRACTICE_ORG_ID, enabled: true, monthlyBudgetPaise: getHwConfig().HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE,
  }).onConflictDoNothing();
}

const rowOf = (r: typeof hwPracticeTrial.$inferSelect): TrialRow => ({
  endsAt: r.endsAt, budgetPaise: r.budgetPaise, spentPaise: num(r.spentPaise), state: r.state,
});

export async function getTrial(x: Exec, userId: string): Promise<TrialRow | null> {
  const [r] = await x.select().from(hwPracticeTrial).where(eq(hwPracticeTrial.userId, userId)).limit(1);
  return r ? rowOf(r) : null;
}

/**
 * What the InkBuddy tab needs to decide what to show: is self-practice on, may this person use it (no institution, or already has a
 * trial), and where the trial stands. The refusal text is given in both languages; the screen picks one.
 */
export async function practiceOverview(userId: string, now = new Date()) {
  const cfg = getHwConfig();
  if (!cfg.HW_SELF_PRACTICE_ENABLED) return { enabled: false as const };
  const t = await getTrial(db, userId);
  const [m] = (await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM member WHERE user_id = ${userId}`)).rows;
  const v = trialVerdict(t, now, cfg.HW_SELF_PRACTICE_STEP_RESERVE_PAISE);
  return {
    enabled: true as const,
    /** Someone who belongs to an institution and has no trial is not who this is for. */
    eligible: t !== null || (m?.n ?? 0) === 0,
    started: t !== null,
    active: v.ok,
    trialDays: cfg.HW_SELF_PRACTICE_TRIAL_DAYS,
    daysLeft: v.ok ? v.daysLeft : 0,
    allowanceLeftPct: t && t.budgetPaise > 0 ? Math.round((100 * Math.max(0, t.budgetPaise - t.spentPaise)) / t.budgetPaise) : t ? 0 : 100,
    message: v.ok || !t ? null : { en: refusalText(v.why, 'en'), hi: refusalText(v.why, 'hi') },
  };
}

/** The learner's trial, as the screens show it. */
export async function trialStatus(userId: string, lang: PracticeLang = 'en', now = new Date()) {
  const t = await getTrial(db, userId);
  return { enabled: practiceEnabled(), ...trialSummary(t, now, getHwConfig().HW_SELF_PRACTICE_STEP_RESERVE_PAISE, lang) };
}

/**
 * Start the learner's one trial (or return the one they have). Only someone who belongs to no institution may start one; the caller
 * is responsible for knowing the person is a learner and not staff.
 */
export async function startTrial(userId: string, now = new Date()): Promise<{ started: boolean; endsAt: Date }> {
  const cfg = getHwConfig();
  if (!cfg.HW_SELF_PRACTICE_ENABLED) throw new HwError('FEATURE_DISABLED', `${PRACTICE_TEXT.off.en} / ${PRACTICE_TEXT.off.hi}`);
  return db.transaction(async (tx) => {
    const existing = await getTrial(tx, userId);
    if (existing) return { started: false, endsAt: existing.endsAt };
    const [m] = await tx.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM member WHERE user_id = ${userId}`).then((r) => r.rows);
    if ((m?.n ?? 0) > 0) throw new HwError('FORBIDDEN', 'Self-practice is for learners who are not part of an institution.');
    await ensurePracticeSpace(tx);
    const endsAt = new Date(now.getTime() + cfg.HW_SELF_PRACTICE_TRIAL_DAYS * 86_400_000);
    await tx.insert(hwPracticeTrial).values({
      userId, startedAt: now, endsAt, budgetPaise: cfg.HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE,
    });
    return { started: true, endsAt };
  });
}

/** True when the user has a trial row (of any state) and is in no institution: the people the practice space belongs to. */
export async function isPracticeLearner(x: Exec, userId: string): Promise<boolean> {
  if (!practiceEnabled()) return false;
  return (await getTrial(x, userId)) !== null;
}

/** For an action the learner starts (handing in work): refuse with a plain message when the trial cannot pay for a step. */
export async function requireUsableTrial(x: Exec, userId: string, now = new Date()): Promise<void> {
  const v = trialVerdict(await getTrial(x, userId), now, getHwConfig().HW_SELF_PRACTICE_STEP_RESERVE_PAISE);
  if (!v.ok) throw new HwError('QUOTA_EXCEEDED', both(v.why));
}

/**
 * For the reading and marking jobs: of these answers, the ones whose learner's trial can not pay for a step, with the message to show.
 * Nothing is refused outside the practice space.
 */
export async function practiceRefusals(x: Exec, orgId: string, answerIds: string[], now = new Date()): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (orgId !== PRACTICE_ORG_ID || !answerIds.length) return out;
  const rows = await x.execute<{ answer_id: string; student_id: string }>(sql`
    SELECT a.id AS answer_id, s.student_id FROM hw_answer a JOIN hw_submission s ON s.id = a.submission_id
     WHERE a.id IN (${sql.join(answerIds.map((i) => sql`${i}`), sql`, `)}) AND a.organization_id = ${orgId}`);
  const reserve = getHwConfig().HW_SELF_PRACTICE_STEP_RESERVE_PAISE;
  const verdicts = new Map<string, ReturnType<typeof trialVerdict>>();
  for (const r of rows.rows) {
    if (!verdicts.has(r.student_id)) verdicts.set(r.student_id, trialVerdict(await getTrial(x, r.student_id), now, reserve));
    const v = verdicts.get(r.student_id)!;
    if (!v.ok) out.set(r.answer_id, both(v.why));
  }
  return out;
}

/**
 * Add a job's cost to the learner whose work it is. A grade job covers the answers of one question; in the practice space every attempt has
 * its own question, so that is one learner. Were there several, the cost is shared equally.
 */
export async function chargePracticeJob(x: Exec, jobId: string, paise: number, now = new Date()): Promise<void> {
  if (!(paise > 0)) return;
  const rows = await x.execute<{ student_id: string }>(sql`
    SELECT s.student_id FROM hw_ai_job j JOIN hw_submission s ON s.id = j.submission_id WHERE j.id = ${jobId}
    UNION
    SELECT s.student_id FROM hw_ai_job j JOIN hw_answer a ON a.question_id = j.question_id JOIN hw_submission s ON s.id = a.submission_id
     WHERE j.id = ${jobId} AND j.submission_id IS NULL`);
  const students = [...new Set(rows.rows.map((r) => r.student_id))];
  if (!students.length) return;
  const share = paise / students.length;
  for (const userId of students) {
    const [t] = await x.update(hwPracticeTrial)
      .set({ spentPaise: sql`${hwPracticeTrial.spentPaise} + ${share}`, updatedAt: now })
      .where(eq(hwPracticeTrial.userId, userId)).returning();
    if (!t) continue;
    const next = stateAfterSpend({ budgetPaise: t.budgetPaise, spentPaise: num(t.spentPaise), endsAt: t.endsAt, state: t.state }, now);
    if (next !== t.state) await x.update(hwPracticeTrial).set({ state: next }).where(eq(hwPracticeTrial.userId, userId));
  }
}
