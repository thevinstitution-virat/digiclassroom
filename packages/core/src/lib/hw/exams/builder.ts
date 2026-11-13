// Exam packages, phase 2: the super-admin builder's database side. A package holds sets; a set holds items, each a published board-paper row or
// an authored question. Everything is editable while draft; publishing runs the checks in build-rules.ts under a row lock, and from then on
// migration 034 freezes what a learner's attempt depends on (marks, duration, questions, allowance). The database's own refusals come back here
// as HwError CONFLICTs with a readable message, so no caller ever sees a raw constraint name.

import { and, asc, eq, inArray, isNull, max, sql } from 'drizzle-orm';
import { hwBankPaper, hwBankQuestion } from '@/db/hw-bank-schema';
import { hwExamEntitlement, hwExamPackage, hwExamSet, hwExamSetItem, type ExamSetKind, type ItemFigure, type ItemNcertRef } from '@/db/hw-exams-schema';
import { assertHwKey } from '@/lib/hw/storage/keys';
import { HwError } from '@/lib/hw/errors';
import { offerCheck } from '@/lib/hw/practice/paper';
import type { Exec } from '@/lib/hw/db';
import { attainableMarks, authoredProblems, describeSetProblem, packageProblems, setProblems, type ItemFacts, type SetProblem } from './build-rules';
import { blueprintChapters, blueprintCheck, blueprintFor, type Blueprint, type BlueprintItem } from './blueprint';

// ── errors ───────────────────────────────────────────────────────────────────

const pgCode = (e: unknown): string | undefined => {
  const x = e as { code?: string; cause?: { code?: string } } | undefined;
  return x?.code ?? x?.cause?.code;
};
const pgMessage = (e: unknown): string => {
  const x = e as { message?: string; cause?: { message?: string } } | undefined;
  return x?.cause?.message ?? x?.message ?? String(e);
};

/** Runs a write and turns the migration's refusals into a CONFLICT the super-admin can read. */
async function guarded<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const code = pgCode(e);
    const msg = pgMessage(e);
    if (code === '23001') throw new HwError('CONFLICT', capitalise(msg.replace(/^.*?: /, '')), `${what}: ${msg}`); // the 034 guard triggers
    if (code === '23505') throw new HwError('CONFLICT', `${what}: that already exists (${constraintHint(msg)}).`, msg);
    if (code === '23514') throw new HwError('BAD_REQUEST', `${what}: the values break a rule (${constraintHint(msg)}).`, msg);
    if (code === '23503') throw new HwError('CONFLICT', `${what}: something still depends on it, or it points at something missing.`, msg);
    throw e;
  }
}
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const CONSTRAINT_WORDS: Record<string, string> = {
  hw_exam_package_identity: 'a package with this board, class, exam year and slug',
  hw_exam_set_order: 'a set in that place',
  hw_exam_set_item_order: 'a question in that place',
  hw_exam_entitlement_one: 'this learner already has this package',
  hw_exam_set_paper_shape: 'a board set must name its paper, and a mock must not',
  hw_exam_set_scope: 'a half-syllabus mock must list its chapters',
  hw_exam_set_item_authored_shape: 'a written question needs its parts and scheme; a multiple choice needs four options and the right one',
  hw_exam_set_item_source: 'a question is a board-paper row or an authored one, not both',
};
const constraintHint = (msg: string) => {
  const name = /constraint "([^"]+)"/.exec(msg)?.[1];
  return (name && CONSTRAINT_WORDS[name]) ?? 'a database rule';
};

const notFound = (what: string) => new HwError('NOT_FOUND', `${what} not found.`);

// ── packages ─────────────────────────────────────────────────────────────────

export interface PackageInput {
  board: string;
  classLevel: number;
  examYear: number;
  slug: string;
  title: string;
  blurb?: string;
  attemptsPerSet?: number;
  pricePaise?: number;
}

export async function createPackage(d: Exec, actor: string, input: PackageInput): Promise<{ id: string }> {
  return guarded('Creating the package', async () => {
    const [r] = await d.insert(hwExamPackage).values({ ...input, blurb: input.blurb ?? '', createdBy: actor }).returning({ id: hwExamPackage.id });
    return r!;
  });
}

export async function updatePackage(d: Exec, packageId: string, patch: Partial<PackageInput>): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await guarded('Changing the package', async () => {
    const r = await d.update(hwExamPackage).set(patch).where(eq(hwExamPackage.id, packageId)).returning({ id: hwExamPackage.id });
    if (!r.length) throw notFound('Package');
  });
}

export interface PackageSummary {
  id: string; board: string; classLevel: number; examYear: number; slug: string; title: string; status: string;
  attemptsPerSet: number; pricePaise: number; sets: number; publishedSets: number;
}

export async function listPackages(d: Exec): Promise<PackageSummary[]> {
  const rows = await d.select({
    id: hwExamPackage.id, board: hwExamPackage.board, classLevel: hwExamPackage.classLevel, examYear: hwExamPackage.examYear, slug: hwExamPackage.slug,
    title: hwExamPackage.title, status: hwExamPackage.status, attemptsPerSet: hwExamPackage.attemptsPerSet, pricePaise: hwExamPackage.pricePaise,
    // outer columns written out in full: drizzle renders ${col} bare here, and Postgres would bind a bare "id" to the subquery's own table
    sets: sql<number>`(SELECT count(*)::int FROM hw_exam_set s WHERE s.package_id = "hw_exam_package"."id")`,
    publishedSets: sql<number>`(SELECT count(*)::int FROM hw_exam_set s WHERE s.package_id = "hw_exam_package"."id" AND s.status = 'published')`,
  }).from(hwExamPackage).orderBy(asc(hwExamPackage.examYear), asc(hwExamPackage.classLevel), asc(hwExamPackage.title));
  return rows;
}

export interface SetSummary {
  id: string; position: number; kind: ExamSetKind; subject: string; subjectCode: string; title: string; status: string;
  maxMarks: number; durationMinutes: number; items: number; attainable: number; problems: string[];
}

export async function getPackage(d: Exec, packageId: string) {
  const pkg = (await d.select().from(hwExamPackage).where(eq(hwExamPackage.id, packageId)).limit(1))[0];
  if (!pkg) throw notFound('Package');
  // learners' own practice sets are theirs, not part of the package the super admin builds
  const sets = await d.select().from(hwExamSet).where(and(eq(hwExamSet.packageId, packageId), isNull(hwExamSet.ownerUserId))).orderBy(asc(hwExamSet.position));
  const facts = await itemFactsBySet(d, sets.map((s) => s.id));
  const summaries: SetSummary[] = [];
  for (const s of sets) {
    const items = facts.get(s.id) ?? [];
    summaries.push({
      id: s.id, position: s.position, kind: s.kind, subject: s.subject, subjectCode: s.subjectCode, title: s.title, status: s.status,
      maxMarks: s.maxMarks, durationMinutes: s.durationMinutes, items: items.length, attainable: attainableMarks(items),
      problems: s.status === 'draft' ? [...setProblems(s, items), ...(await offerProblems(d, s.id)), ...(await blueprintFindings(d, pkg, s)).problems].map(describeSetProblem) : [],
    });
  }
  return { package: pkg, sets: summaries };
}

export async function publishPackage(d: Exec, packageId: string): Promise<{ published: boolean; problems: string[] }> {
  return d.transaction(async (tx) => {
    const pkg = (await tx.select().from(hwExamPackage).where(eq(hwExamPackage.id, packageId)).for('update').limit(1))[0];
    if (!pkg) throw notFound('Package');
    if (pkg.status === 'published') return { published: true, problems: [] };
    const sets = await tx.select({ status: hwExamSet.status }).from(hwExamSet).where(eq(hwExamSet.packageId, packageId));
    const problems = packageProblems(sets);
    if (problems.length) return { published: false, problems: ['Publish at least one set first.'] };
    await guarded('Publishing the package', () =>
      tx.update(hwExamPackage).set({ status: 'published', publishedAt: pkg.publishedAt ?? new Date() }).where(eq(hwExamPackage.id, packageId)));
    return { published: true, problems: [] };
  });
}

/** Retire (hide from new buyers and new attempts) or bring back. A published thing never goes back to draft: migration 034 refuses it. */
export async function setPackageOpen(d: Exec, packageId: string, open: boolean): Promise<void> {
  await guarded(open ? 'Reopening the package' : 'Retiring the package', async () => {
    const r = await d.update(hwExamPackage).set({ status: open ? 'published' : 'retired' })
      .where(and(eq(hwExamPackage.id, packageId), sql`${hwExamPackage.status} <> 'draft'`)).returning({ id: hwExamPackage.id });
    if (!r.length) throw new HwError('CONFLICT', 'Only a published or retired package can be retired or reopened.');
  });
}

// ── sets ─────────────────────────────────────────────────────────────────────

export interface SetInput {
  /** 'pool' (035): the questions learners draw their own practice tests from; it is never attempted itself. */
  kind: 'mock_half' | 'mock_full' | 'pool';
  subject: string;
  subjectCode: string;
  title: string;
  maxMarks: number;
  durationMinutes: number;
  graceMinutes?: number;
  medium?: 'en' | 'hi';
  syllabusScope?: string[];
}

async function nextPosition(d: Exec, packageId: string): Promise<number> {
  const r = await d.select({ m: max(hwExamSet.position) }).from(hwExamSet).where(eq(hwExamSet.packageId, packageId));
  return (r[0]?.m ?? -1) + 1;
}

/** An in-house mock: an empty draft set the super-admin fills with items. */
export async function addSet(d: Exec, packageId: string, input: SetInput): Promise<{ id: string }> {
  return guarded('Adding the set', async () => {
    const position = await nextPosition(d, packageId);
    const [r] = await d.insert(hwExamSet).values({ ...input, packageId, position }).returning({ id: hwExamSet.id });
    return r!;
  });
}

/** "3 Hours", "3 hrs", "2½ hours", "90 minutes" → minutes; null when the paper does not say. */
export function durationFromPaper(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace('½', '.5');
  const h = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/.exec(t);
  const m = /(\d+)\s*(?:minutes?|mins?)/.exec(t);
  const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return total > 0 ? Math.round(total) : null;
}

/**
 * A board paper as a set: every published row of the paper (internal-choice alternatives included, the visually-impaired variants left out),
 * in the paper's order, with the paper's own marks and time. The set is a draft until published like any other.
 */
export async function setFromPaper(d: Exec, packageId: string, paperId: string, opts: { title?: string; durationMinutes?: number } = {}): Promise<{ id: string; items: number }> {
  return d.transaction(async (tx) => {
    const paper = (await tx.select().from(hwBankPaper).where(eq(hwBankPaper.id, paperId)).limit(1))[0];
    if (!paper) throw notFound('Board paper');
    if (paper.status !== 'published') throw new HwError('CONFLICT', 'Only a published board paper can become a set.');
    const durationMinutes = opts.durationMinutes ?? durationFromPaper(paper.duration);
    if (!durationMinutes) throw new HwError('BAD_REQUEST', `The paper does not say how long it is ("${paper.duration ?? ''}"); give the duration.`);
    const rows = await tx.select().from(hwBankQuestion)
      .where(and(eq(hwBankQuestion.paperId, paperId), eq(hwBankQuestion.status, 'published'), isNull(hwBankQuestion.variant)))
      .orderBy(asc(hwBankQuestion.number), sql`${hwBankQuestion.alt} NULLS FIRST`);
    if (!rows.length) throw new HwError('CONFLICT', 'The paper has no published questions.');
    return guarded('Making a set from the paper', async () => {
      const position = await nextPosition(tx, packageId);
      const [s] = await tx.insert(hwExamSet).values({
        packageId, position, kind: paper.kind === 'sqp' ? 'sqp' : 'pyq', subject: paper.subject, subjectCode: paper.subjectCode,
        title: opts.title ?? paper.title, paperId, maxMarks: paper.maxMarks, durationMinutes,
      }).returning({ id: hwExamSet.id });
      await tx.insert(hwExamSetItem).values(rows.map((r, i) => ({
        setId: s!.id, position: i, number: r.number, section: r.section, marks: r.marks, qtype: r.qtype, bankQuestionId: r.id,
      })));
      return { id: s!.id, items: rows.length };
    });
  });
}

export async function updateSet(d: Exec, setId: string, patch: Partial<Omit<SetInput, 'kind'>>): Promise<void> {
  if (Object.keys(patch).length === 0) return;
  await guarded('Changing the set', async () => {
    const r = await d.update(hwExamSet).set(patch).where(eq(hwExamSet.id, setId)).returning({ id: hwExamSet.id });
    if (!r.length) throw notFound('Set');
  });
}

/** Item facts for the publish rules, with each bank row's status as it is now. */
async function itemFactsBySet(d: Exec, setIds: string[]): Promise<Map<string, ItemFacts[]>> {
  const out = new Map<string, ItemFacts[]>();
  if (!setIds.length) return out;
  const rows = await d.select({
    id: hwExamSetItem.id, setId: hwExamSetItem.setId, number: hwExamSetItem.number, marks: hwExamSetItem.marks,
    choiceGroup: hwBankQuestion.choiceGroup, bankStatus: hwBankQuestion.status, bankId: hwExamSetItem.bankQuestionId,
  }).from(hwExamSetItem).leftJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId))
    .where(inArray(hwExamSetItem.setId, setIds)).orderBy(asc(hwExamSetItem.position));
  for (const r of rows) {
    const list = out.get(r.setId) ?? [];
    list.push({ id: r.id, number: r.number, marks: r.marks, choiceGroup: r.choiceGroup ?? null, bankStatus: r.bankId ? (r.bankStatus ?? 'missing') : null });
    out.set(r.setId, list);
  }
  return out;
}

type PackageKey = { board: string; classLevel: number; examYear: number };
type SetKey = { id: string; kind: string; subjectCode: string; syllabusScope: string[] };

/** The board's blueprint for a set, and what it says about the set (blueprint.ts). No blueprint for the paper: nothing to say. */
async function blueprintFindings(d: Exec, pkg: PackageKey, set: SetKey): Promise<{ blueprint: Blueprint | null; problems: SetProblem[]; warnings: string[] }> {
  const blueprint = blueprintFor({ ...pkg, subjectCode: set.subjectCode });
  if (!blueprint) return { blueprint, problems: [], warnings: [] };
  const rows = await d.select({
    number: hwExamSetItem.number, marks: hwExamSetItem.marks, chapter: hwExamSetItem.chapter, bankId: hwExamSetItem.bankQuestionId,
    stem: hwExamSetItem.stem, options: hwExamSetItem.options, schemeText: hwExamSetItem.schemeText, parts: hwExamSetItem.parts,
    alt: hwBankQuestion.alt, choiceGroup: hwBankQuestion.choiceGroup,
  }).from(hwExamSetItem).leftJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId))
    .where(eq(hwExamSetItem.setId, set.id)).orderBy(asc(hwExamSetItem.position));
  const items: BlueprintItem[] = rows.map((r) => ({
    number: r.number, marks: r.marks, choiceGroup: r.choiceGroup ?? null, alt: r.alt ?? null, chapter: r.chapter,
    authoredText: r.bankId ? null : [r.stem ?? '', ...(r.options ?? []), r.schemeText, JSON.stringify(r.parts ?? [])].join(' '),
  }));
  return { blueprint, ...blueprintCheck(blueprint, set, items) };
}

async function packageKey(d: Exec, packageId: string): Promise<PackageKey> {
  const pkg = (await d.select({ board: hwExamPackage.board, classLevel: hwExamPackage.classLevel, examYear: hwExamPackage.examYear })
    .from(hwExamPackage).where(eq(hwExamPackage.id, packageId)).limit(1))[0];
  if (!pkg) throw notFound('Package');
  return pkg;
}

/** A key the assistant wrote says so in its scheme text (the pool importer writes "KEY TO CHECK: ..."); a teacher must check it before learners see it. */
export const keyNeedsCheck = (schemeText: string | null | undefined) => (schemeText ?? '').startsWith('KEY TO CHECK');

/** The publish problem for keys the assistant wrote and no teacher has checked yet (none when every such key is checked). */
export function uncheckedKeysProblem(items: { schemeText: string | null; keyCheckedBy: string | null }[]): string[] {
  const n = items.filter((i) => keyNeedsCheck(i.schemeText) && !i.keyCheckedBy).length;
  return n ? [`${n} key${n === 1 ? '' : 's'} written by the assistant ${n === 1 ? 'is' : 'are'} not checked by a teacher yet. Open each question's key and mark it checked.`] : [];
}

/**
 * A teacher marks an assistant-written key as checked (or takes the check back). Only on a draft set (the 034 guard refuses the rest); only for a key
 * that needs it. The check is named and timed; changing the question's content later clears it (updateItem).
 */
export async function checkItemKey(d: Exec, itemId: string, by: string, checked: boolean, now = new Date()): Promise<void> {
  const item = (await d.select({ schemeText: hwExamSetItem.schemeText }).from(hwExamSetItem).where(eq(hwExamSetItem.id, itemId)).limit(1))[0];
  if (!item) throw notFound('Question');
  if (!keyNeedsCheck(item.schemeText)) throw new HwError('BAD_REQUEST', 'This key is not one the assistant wrote; there is nothing to check.');
  const name = by.trim();
  if (checked && !name) throw new HwError('BAD_REQUEST', 'A check needs the name of the teacher who checked it.');
  await guarded(checked ? 'Marking the key checked' : 'Taking back the key check', () => d.update(hwExamSetItem)
    .set(checked ? { keyCheckedBy: name, keyCheckedAt: now } : { keyCheckedBy: null, keyCheckedAt: null }).where(eq(hwExamSetItem.id, itemId)));
}

export async function getSet(d: Exec, setId: string, sign?: (key: string) => Promise<string>) {
  const set = (await d.select().from(hwExamSet).where(eq(hwExamSet.id, setId)).limit(1))[0];
  if (!set) throw notFound('Set');
  const items = await d.select({
    id: hwExamSetItem.id, position: hwExamSetItem.position, number: hwExamSetItem.number, section: hwExamSetItem.section, marks: hwExamSetItem.marks,
    qtype: hwExamSetItem.qtype, chapter: hwExamSetItem.chapter, topic: hwExamSetItem.topic, bankQuestionId: hwExamSetItem.bankQuestionId,
    stem: sql<string>`COALESCE(${hwExamSetItem.stem}, ${hwBankQuestion.stem})`, alt: hwBankQuestion.alt,
    choiceGroup: sql<string | null>`COALESCE(${hwBankQuestion.choiceGroup}, ${hwExamSetItem.choiceGroup})`,
    // what a teacher checks in the key panel (037): the right option or value points, the scheme text, where it is taught and printed, its pictures
    options: hwExamSetItem.options, correctOption: hwExamSetItem.correctOption, parts: hwExamSetItem.parts, schemeText: hwExamSetItem.schemeText,
    diagramParts: hwExamSetItem.diagramParts, ncert: hwExamSetItem.ncert, sources: hwExamSetItem.sources, figures: hwExamSetItem.figures,
    keyCheckedBy: hwExamSetItem.keyCheckedBy, keyCheckedAt: hwExamSetItem.keyCheckedAt,
  }).from(hwExamSetItem).leftJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId))
    .where(eq(hwExamSetItem.setId, setId)).orderBy(asc(hwExamSetItem.position));
  const shown = await Promise.all(items.map(async (it) => ({
    ...it,
    keyToCheck: keyNeedsCheck(it.schemeText),
    figures: await Promise.all((it.figures ?? []).map(async (f) => ({ ...f, url: sign ? await sign(f.key) : null }))),
  })));
  const facts = (await itemFactsBySet(d, [setId])).get(setId) ?? [];
  const bp = await blueprintFindings(d, await packageKey(d, set.packageId), set);
  const problems: SetProblem[] = set.status === 'draft' ? [...setProblems(set, facts), ...(await offerProblems(d, setId)), ...bp.problems] : [];
  const unchecked = set.status === 'draft' ? uncheckedKeysProblem(shown) : [];
  return {
    set, items: shown, attainable: attainableMarks(facts), problems: [...problems.map(describeSetProblem), ...unchecked],
    // Advice from the board's blueprint that does not stop publishing, and the curriculum's chapter names to pick from.
    warnings: set.status === 'draft' ? bp.warnings : [],
    blueprint: bp.blueprint && { session: bp.blueprint.session, source: bp.blueprint.source, chapters: blueprintChapters(bp.blueprint) },
  };
}

export async function publishSet(d: Exec, setId: string): Promise<{ published: boolean; problems: string[] }> {
  return d.transaction(async (tx) => {
    const set = (await tx.select().from(hwExamSet).where(eq(hwExamSet.id, setId)).for('update').limit(1))[0];
    if (!set) throw notFound('Set');
    if (set.status === 'published') return { published: true, problems: [] };
    if (set.status === 'retired') throw new HwError('CONFLICT', 'A retired set is reopened, not published again.');
    const facts = (await itemFactsBySet(tx, [setId])).get(setId) ?? [];
    const problems = [...setProblems(set, facts), ...(await offerProblems(tx, setId)), ...(await blueprintFindings(tx, await packageKey(tx, set.packageId), set)).problems];
    const keys = await tx.select({ schemeText: hwExamSetItem.schemeText, keyCheckedBy: hwExamSetItem.keyCheckedBy }).from(hwExamSetItem).where(eq(hwExamSetItem.setId, setId));
    const unchecked = uncheckedKeysProblem(keys);
    if (problems.length || unchecked.length) return { published: false, problems: [...problems.map(describeSetProblem), ...unchecked] };
    await guarded('Publishing the set', () => tx.update(hwExamSet).set({ status: 'published' }).where(eq(hwExamSet.id, setId)));
    return { published: true, problems: [] };
  });
}

export async function setSetOpen(d: Exec, setId: string, open: boolean): Promise<void> {
  await guarded(open ? 'Reopening the set' : 'Retiring the set', async () => {
    const r = await d.update(hwExamSet).set({ status: open ? 'published' : 'retired' })
      .where(and(eq(hwExamSet.id, setId), sql`${hwExamSet.status} <> 'draft'`)).returning({ id: hwExamSet.id });
    if (!r.length) throw new HwError('CONFLICT', 'Only a published or retired set can be retired or reopened.');
  });
}

/** A draft set nobody has attempted can be deleted; anything else is retired instead (the database refuses the rest). */
export async function deleteSet(d: Exec, setId: string): Promise<void> {
  await guarded('Deleting the set', async () => {
    const r = await d.delete(hwExamSet).where(and(eq(hwExamSet.id, setId), eq(hwExamSet.status, 'draft'))).returning({ id: hwExamSet.id });
    if (!r.length) throw new HwError('CONFLICT', 'Only a draft set can be deleted; retire a published one.');
  });
}

/**
 * The board-paper rows of a set that InkBuddy would not offer a learner as they stand — a figure with no picture, nothing markable — with
 * the reason. Such a set is not published: the learner could not see or answer the question, or it could not be marked.
 */
async function offerProblems(d: Exec, setId: string): Promise<SetProblem[]> {
  const rows = await d.select({ number: hwExamSetItem.number, rowId: hwExamSetItem.bankQuestionId, status: hwBankQuestion.status })
    .from(hwExamSetItem).innerJoin(hwBankQuestion, eq(hwBankQuestion.id, hwExamSetItem.bankQuestionId)).where(eq(hwExamSetItem.setId, setId));
  const out: SetProblem[] = [];
  for (const r of rows) {
    if (r.status !== 'published') continue; // already reported as not published
    const c = await offerCheck(d, r.rowId!, 'teacher');
    if (!c.ok) out.push({ code: 'bank_row_not_offered', number: r.number, why: c.why });
  }
  return out;
}

// ── items ────────────────────────────────────────────────────────────────────

async function nextItemSlot(d: Exec, setId: string): Promise<{ position: number; number: number }> {
  const r = await d.select({ p: max(hwExamSetItem.position), n: max(hwExamSetItem.number) }).from(hwExamSetItem).where(eq(hwExamSetItem.setId, setId));
  return { position: (r[0]?.p ?? -1) + 1, number: (r[0]?.n ?? 0) + 1 };
}

/** A published board-paper row into a mock. Its marks, type and section come from the bank row; only the number and chapter are the set's. */
export async function addBankItem(d: Exec, setId: string, rowId: string, opts: { number?: number; chapter?: string } = {}): Promise<{ id: string }> {
  const row = (await d.select().from(hwBankQuestion).where(eq(hwBankQuestion.id, rowId)).limit(1))[0];
  if (!row) throw notFound('Board-paper question');
  if (row.status !== 'published') throw new HwError('CONFLICT', `That board-paper question is ${row.status}; only a published one can go in a set.`);
  return guarded('Adding the question', async () => {
    const slot = await nextItemSlot(d, setId);
    const [r] = await d.insert(hwExamSetItem).values({
      setId, position: slot.position, number: opts.number ?? slot.number, section: row.section, marks: row.marks, qtype: row.qtype,
      chapter: opts.chapter ?? '', bankQuestionId: row.id,
    }).returning({ id: hwExamSetItem.id });
    return r!;
  });
}

export interface AuthoredInput {
  number?: number;
  section?: string;
  marks: number;
  qtype: 'mcq' | 'assertion_reason' | 'very_short' | 'short' | 'long' | 'case_based';
  chapter?: string;
  /** The topic within the chapter (035), for learners choosing what to practise from a pool. */
  topic?: string;
  stem: string;
  options?: string[];
  correctOption?: 'A' | 'B' | 'C' | 'D' | null;
  acceptedAnswers?: string[];
  /** The bank's part shape: label, marks, answer_kind, value_points [{ id, text, marks, quote }]. */
  parts?: Record<string, unknown>[];
  schemeText?: string;
  diagramParts?: string[];
  /** 037: where it is taught, where it was printed, its internal-choice group and its own pictures. */
  ncert?: ItemNcertRef;
  sources?: string[];
  choiceGroup?: string | null;
  figures?: ItemFigure[];
}

const refuseAuthored = (q: Parameters<typeof authoredProblems>[0]) => {
  const problems = authoredProblems(q);
  if (problems.length) throw new HwError('BAD_REQUEST', problems.join(' '));
};

export async function addAuthoredItem(d: Exec, setId: string, input: AuthoredInput): Promise<{ id: string }> {
  refuseAuthored(input);
  return guarded('Adding the question', async () => {
    const slot = await nextItemSlot(d, setId);
    const [r] = await d.insert(hwExamSetItem).values({
      setId, position: slot.position, number: input.number ?? slot.number, section: input.section ?? '', marks: input.marks, qtype: input.qtype,
      chapter: input.chapter ?? '', topic: input.topic ?? '', stem: input.stem, options: input.options ?? [], correctOption: input.correctOption ?? null,
      acceptedAnswers: input.acceptedAnswers ?? [], parts: input.parts ?? [], schemeText: input.schemeText ?? '', diagramParts: input.diagramParts ?? [],
      ncert: input.ncert ?? {}, sources: input.sources ?? [], choiceGroup: input.choiceGroup ?? null,
      figures: (input.figures ?? []).map((f) => ({ key: assertHwKey(f.key), description: f.description, labels: f.labels ?? [] })),
    }).returning({ id: hwExamSetItem.id });
    return r!;
  });
}

/** Number, section and chapter can be changed on any draft item; the content only on an authored one (a bank row's content is the bank's). */
export async function updateItem(d: Exec, itemId: string, patch: Partial<AuthoredInput>): Promise<void> {
  const item = (await d.select().from(hwExamSetItem).where(eq(hwExamSetItem.id, itemId)).limit(1))[0];
  if (!item) throw notFound('Question');
  const { number, section, chapter, topic, ncert, sources, choiceGroup, ...content } = patch;
  if (item.bankQuestionId && Object.keys(content).length) throw new HwError('BAD_REQUEST', 'A board-paper question is changed in the bank, not here.');
  if (Object.keys(content).length) {
    refuseAuthored({
      qtype: content.qtype ?? item.qtype, marks: content.marks ?? item.marks, options: content.options ?? item.options,
      correctOption: content.correctOption !== undefined ? content.correctOption : item.correctOption,
      parts: (content.parts ?? item.parts) as Parameters<typeof authoredProblems>[0]['parts'],
    });
  }
  if (content.figures) content.figures = content.figures.map((f) => ({ key: assertHwKey(f.key), description: f.description, labels: f.labels ?? [] }));
  const set = {
    // the teacher checked the old content; changed content must be checked again
    ...(Object.keys(content).length && { keyCheckedBy: null, keyCheckedAt: null }),
    ...(number !== undefined && { number }), ...(section !== undefined && { section }), ...(chapter !== undefined && { chapter }), ...(topic !== undefined && { topic }),
    ...(ncert !== undefined && { ncert }), ...(sources !== undefined && { sources }), ...(choiceGroup !== undefined && { choiceGroup }), ...content,
  };
  if (!Object.keys(set).length) return;
  await guarded('Changing the question', () => d.update(hwExamSetItem).set(set).where(eq(hwExamSetItem.id, itemId)));
}

export async function removeItem(d: Exec, itemId: string): Promise<void> {
  await guarded('Removing the question', async () => {
    const r = await d.delete(hwExamSetItem).where(eq(hwExamSetItem.id, itemId)).returning({ id: hwExamSetItem.id });
    if (!r.length) throw notFound('Question');
  });
}

/** Puts the items in the given order. Every item of the set must be named exactly once. */
export async function reorderItems(d: Exec, setId: string, orderedIds: string[]): Promise<void> {
  await d.transaction(async (tx) => {
    await tx.select({ id: hwExamSet.id }).from(hwExamSet).where(eq(hwExamSet.id, setId)).for('update');
    const have = await tx.select({ id: hwExamSetItem.id }).from(hwExamSetItem).where(eq(hwExamSetItem.setId, setId));
    const ids = new Set(have.map((h) => h.id));
    if (orderedIds.length !== ids.size || new Set(orderedIds).size !== orderedIds.length || orderedIds.some((i) => !ids.has(i))) {
      throw new HwError('BAD_REQUEST', 'Name every question of the set exactly once.');
    }
    await guarded('Reordering', async () => {
      // two steps, so UNIQUE (set_id, position) never sees two rows on one position
      await tx.update(hwExamSetItem).set({ position: sql`${hwExamSetItem.position} + 100000` }).where(eq(hwExamSetItem.setId, setId));
      for (const [i, itemId] of orderedIds.entries()) await tx.update(hwExamSetItem).set({ position: i }).where(eq(hwExamSetItem.id, itemId));
    });
  });
}

// ── entitlements (grants; purchase comes with payments, phase 3) ─────────────

export async function grantEntitlement(d: Exec, actor: string, input: { userId: string; packageId: string; attemptsPerSet?: number | null; expiresAt?: Date | null; source?: 'grant' | 'trial' }): Promise<{ id: string }> {
  return guarded('Granting the package', async () => {
    const [r] = await d.insert(hwExamEntitlement).values({
      userId: input.userId, packageId: input.packageId, source: input.source ?? 'grant', grantedBy: actor,
      attemptsPerSet: input.attemptsPerSet ?? null, expiresAt: input.expiresAt ?? null,
    }).onConflictDoUpdate({
      target: [hwExamEntitlement.userId, hwExamEntitlement.packageId],
      set: { status: 'active', attemptsPerSet: input.attemptsPerSet ?? null, expiresAt: input.expiresAt ?? null, grantedBy: actor },
    }).returning({ id: hwExamEntitlement.id });
    return r!;
  });
}
