// A learner's own practice test, drawn from a question pool (migration 035; docs/hw-eval/exam-packages.md, section 13).
//
// The super admin keeps a pool for a chapter (a set of kind 'pool': board-paper questions with their topics, keys checked by a teacher before
// the pool is published). A learner who may use the package picks topics, question types and how many, and gets a PRACTICE set of their own:
// the questions copied out of the pool, numbered in the board's order (objective questions first, then by marks), with its own printed answer
// sheet and its own clock. From there it is an ordinary set: start, write, photograph, hand in, marking.
//
// The draw is pure (drawPractice) and the database side is thin. The pool itself is never attempted, and a practice set only by its own
// learner (both also refused by migration 035's trigger).

import { randomInt } from 'node:crypto';
import { and, asc, count, eq, gte, max } from 'drizzle-orm';
import { hwExamEntitlement, hwExamPackage, hwExamSet, hwExamSetItem } from '@/db/hw-exams-schema';
import { HwError } from '@/lib/hw/errors';
import type { Exec } from '@/lib/hw/db';
import { entLike, NOT_STARTED_TEXT, requireEnabled } from './learner';
import { startVerdict } from './rules';

export const PRACTICE = {
  /** The most questions one practice test may have. */
  maxQuestions: 30,
  /** Practice tests one learner may make in a day, across all pools. */
  perDay: 15,
  /** Writing time: the board's pace (180 minutes for 80 marks), at least ten minutes. */
  minutesPerMark: 2.25,
  minMinutes: 10,
} as const;

/** The board's order of question types, and how a learner sees each. */
export const QTYPE_ORDER = ['mcq', 'assertion_reason', 'very_short', 'short', 'case_based', 'long'] as const;
export const QTYPE_LABEL: Record<string, { en: string; hi: string }> = {
  mcq: { en: 'Multiple choice', hi: 'बहुविकल्पी' },
  assertion_reason: { en: 'Assertion and reason', hi: 'अभिकथन और कारण' },
  very_short: { en: 'Very short answer', hi: 'अति लघु उत्तरीय' },
  short: { en: 'Short answer', hi: 'लघु उत्तरीय' },
  case_based: { en: 'Case-based', hi: 'केस-आधारित' },
  long: { en: 'Long answer', hi: 'दीर्घ उत्तरीय' },
};

export interface PoolItem { id: string; position: number; qtype: string; marks: number; topic: string; chapter: string }

/**
 * The questions for one practice test: those of the chosen topics and types, spread across the chosen topics as evenly as the pool allows,
 * then put in the board's order. `rand(n)` gives an integer in [0, n). Fewer than asked when the pool has fewer.
 */
export function drawPractice<T extends PoolItem>(items: T[], pick: { topics: string[]; types: string[]; count: number }, rand: (n: number) => number): T[] {
  const fit = items.filter((i) => (!pick.topics.length || pick.topics.includes(i.topic)) && (!pick.types.length || pick.types.includes(i.qtype)));
  const byTopic = new Map<string, T[]>();
  for (const i of fit) byTopic.set(i.topic, [...(byTopic.get(i.topic) ?? []), i]);
  // shuffle each topic's questions, then take from the topics in turn
  for (const list of byTopic.values()) for (let k = list.length - 1; k > 0; k--) { const j = rand(k + 1); [list[k], list[j]] = [list[j]!, list[k]!]; }
  const topics = [...byTopic.keys()];
  for (let k = topics.length - 1; k > 0; k--) { const j = rand(k + 1); [topics[k], topics[j]] = [topics[j]!, topics[k]!]; }
  const chosen: T[] = [];
  const want = Math.min(Math.max(0, Math.floor(pick.count)), fit.length);
  while (chosen.length < want) for (const t of topics) { const next = byTopic.get(t)!.shift(); if (next && chosen.length < want) chosen.push(next); }
  const rank = (q: string) => { const i = (QTYPE_ORDER as readonly string[]).indexOf(q); return i < 0 ? QTYPE_ORDER.length : i; };
  return chosen.sort((a, b) => rank(a.qtype) - rank(b.qtype) || a.marks - b.marks || a.position - b.position);
}

export const practiceMinutes = (marks: number) => Math.max(PRACTICE.minMinutes, Math.ceil(marks * PRACTICE.minutesPerMark));

export interface PoolSummary {
  id: string; title: string; chapters: string[]; questions: number;
  topics: { topic: string; questions: number }[];
  types: { qtype: string; label: { en: string; hi: string }; marks: number[]; questions: number }[];
}

/** The published pools of a package, as a learner chooses from them: topics and types with how many questions each has. */
export async function poolsOf(d: Exec, packageId: string): Promise<PoolSummary[]> {
  const pools = await d.select().from(hwExamSet).where(and(eq(hwExamSet.packageId, packageId), eq(hwExamSet.kind, 'pool'), eq(hwExamSet.status, 'published'))).orderBy(asc(hwExamSet.position));
  const out: PoolSummary[] = [];
  for (const p of pools) {
    const items = await d.select({ qtype: hwExamSetItem.qtype, marks: hwExamSetItem.marks, topic: hwExamSetItem.topic, chapter: hwExamSetItem.chapter }).from(hwExamSetItem).where(eq(hwExamSetItem.setId, p.id));
    const topics = new Map<string, number>();
    const types = new Map<string, { marks: Set<number>; n: number }>();
    for (const i of items) {
      topics.set(i.topic, (topics.get(i.topic) ?? 0) + 1);
      const t = types.get(i.qtype) ?? { marks: new Set<number>(), n: 0 };
      t.marks.add(Number(i.marks)); t.n++; types.set(i.qtype, t);
    }
    out.push({
      id: p.id, title: p.title, chapters: [...new Set(items.map((i) => i.chapter).filter(Boolean))], questions: items.length,
      topics: [...topics].map(([topic, questions]) => ({ topic, questions })),
      types: [...types].sort((a, b) => QTYPE_ORDER.indexOf(a[0] as never) - QTYPE_ORDER.indexOf(b[0] as never))
        .map(([qtype, t]) => ({ qtype, label: QTYPE_LABEL[qtype] ?? { en: qtype, hi: qtype }, marks: [...t.marks].sort((a, b) => a - b), questions: t.n })),
    });
  }
  return out;
}

const refuse = (en: string, hi: string) => new HwError('BAD_REQUEST', `${en} / ${hi}`);

/** Makes the learner's practice test from a pool and publishes it, ready to start. Under a lock on the package, so positions never clash. */
export async function buildPractice(d: Exec, userId: string, input: { poolSetId: string; topics: string[]; types: string[]; count: number }, now = new Date(), rand: (n: number) => number = (n) => randomInt(n)): Promise<{ setId: string; questions: number; maxMarks: number; durationMinutes: number }> {
  requireEnabled();
  return d.transaction(async (tx) => {
    const pool = (await tx.select().from(hwExamSet).where(eq(hwExamSet.id, input.poolSetId)).limit(1))[0];
    if (!pool || pool.kind !== 'pool' || pool.status !== 'published') throw new HwError('NOT_FOUND', 'Not found. / नहीं मिला।');
    const pkg = (await tx.select().from(hwExamPackage).where(eq(hwExamPackage.id, pool.packageId)).for('update').limit(1))[0]!;
    const ent = (await tx.select().from(hwExamEntitlement).where(and(eq(hwExamEntitlement.packageId, pkg.id), eq(hwExamEntitlement.userId, userId))).limit(1))[0];
    // the same right to use the package as starting any of its tests
    const v = startVerdict({ now, pkg: { id: pkg.id, status: pkg.status, attemptsPerSet: pkg.attemptsPerSet }, set: pool, entitlement: entLike(ent), attemptsUsed: 0, hasOpenAttempt: false });
    if (!v.ok) { const t = NOT_STARTED_TEXT[v.why]; throw new HwError('FORBIDDEN', `${t.en} / ${t.hi}`); }
    const count0 = Math.floor(input.count);
    if (!(count0 >= 1 && count0 <= PRACTICE.maxQuestions)) throw refuse(`Choose between 1 and ${PRACTICE.maxQuestions} questions.`, `1 से ${PRACTICE.maxQuestions} प्रश्न चुनें।`);
    const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
    const made = (await tx.select({ n: count() }).from(hwExamSet).where(and(eq(hwExamSet.ownerUserId, userId), gte(hwExamSet.createdAt, today))))[0]!.n;
    if (made >= PRACTICE.perDay) throw refuse(`You have made ${made} practice tests today; try again tomorrow.`, `आज आप ${made} अभ्यास परीक्षाएँ बना चुके हैं; कल फिर कोशिश करें।`);

    const items = await tx.select().from(hwExamSetItem).where(eq(hwExamSetItem.setId, pool.id)).orderBy(asc(hwExamSetItem.position));
    const chosen = drawPractice(items.map((i) => ({ ...i, marks: Number(i.marks) })), { topics: input.topics, types: input.types, count: count0 }, rand);
    if (!chosen.length) throw refuse('No questions match what you chose; pick more topics or types.', 'आपके चुनाव से कोई प्रश्न नहीं मिला; और विषय या प्रकार चुनें।');
    const maxMarks = Math.round(chosen.reduce((s, i) => s + i.marks, 0) * 2) / 2;
    const durationMinutes = practiceMinutes(maxMarks);
    const position = ((await tx.select({ m: max(hwExamSet.position) }).from(hwExamSet).where(eq(hwExamSet.packageId, pkg.id)))[0]?.m ?? -1) + 1;
    const chapters = [...new Set(chosen.map((i) => i.chapter).filter(Boolean))];
    const [set] = await tx.insert(hwExamSet).values({
      packageId: pkg.id, position, kind: 'practice', ownerUserId: userId, poolSetId: pool.id, subject: pool.subject, subjectCode: pool.subjectCode,
      title: `${pool.title}: ${chosen.length} question${chosen.length === 1 ? '' : 's'}`.slice(0, 200), maxMarks, durationMinutes, medium: pool.medium,
      syllabusScope: chapters, status: 'draft',
    }).returning({ id: hwExamSet.id });
    await tx.insert(hwExamSetItem).values(chosen.map((i, k) => ({
      setId: set!.id, position: k, number: k + 1, section: i.section, marks: i.marks, qtype: i.qtype, chapter: i.chapter, topic: i.topic,
      bankQuestionId: i.bankQuestionId, stem: i.stem, options: i.options, correctOption: i.correctOption, acceptedAnswers: i.acceptedAnswers,
      parts: i.parts, schemeText: i.schemeText, diagramParts: i.diagramParts,
    })));
    await tx.update(hwExamSet).set({ status: 'published' }).where(eq(hwExamSet.id, set!.id));
    return { setId: set!.id, questions: chosen.length, maxMarks, durationMinutes };
  });
}

/** Whether a learner may see a set at all: never a pool, and a practice set only if it is theirs. */
export const visibleTo = (s: { kind: string; ownerUserId: string | null }, userId: string) => s.kind !== 'pool' && (s.kind !== 'practice' || s.ownerUserId === userId);
