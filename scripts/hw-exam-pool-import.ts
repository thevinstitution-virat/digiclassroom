// Question-pool importer (migrations 035 and 037; docs/hw-eval/exam-packages.md section 13, docs/hw-eval/board-bank-roadmap.md phase 2). Reads a pool
// file (exam-pool/1 or exam-pool/2, kept out of git with the other board material) and creates a DRAFT "chapter practice" package holding a DRAFT
// pool set with every question, its topic and its key. Learners see nothing until a teacher has checked the keys in the super admin builder (each
// key the assistant wrote says "KEY TO CHECK" in its scheme text) and the pool and the package are published there.
//
// exam-pool/2 adds, per question: the NCERT section that teaches it (`ncert`), how often the 2026 papers asked it (`asked`), the internal-choice
// group of its alternatives (`choiceGroup`), its pictures (`figures`, image files beside the pool file) and drawing parts (`"drawing": true`,
// never marked by the AI; a question that is ONLY a drawing is left out). Pictures are stored once, named by their content (hw-exams/figures/<sha-256>.<ext>). A question whose picture file is
// missing is LEFT OUT and listed (a learner must never get "in the given figure" without the figure); import it later with the picture.
//
//   npm run hw:exam:pool -w apps/api -- check  <pool.json> [--figures <dir>]                    (no database: checks every question and picture)
//   npm run hw:exam:pool -w apps/api -- import <pool.json> --year 2027 --slug cbse-x-science-chapter-practice --by "name" [--figures <dir>]
//   npm run hw:exam:pool -w apps/api -- apply-checks <pool.json> --year 2027 --slug cbse-x-science-chapter-practice   (an imported draft pool)
//
// An assistant key may carry `autoCheck` (cbse-science-qbank verify_keys.py: a model checked it against the NCERT chapter text, and code checked
// its quotes are really in the book). Its verdict goes into the scheme text as "AI check (...)", and a key the model confirmed is marked checked
// by "Auto-check: <model> (<date>)", so a teacher only has to look at the disputed and unsure ones (and can take any auto check back).
//
// `--figures` is the folder the pool's image paths are relative to (default: the folder above the pool file's folder, as in cbse-science-qbank).
// `import` writes in one transaction and refuses when the package already has a pool of the same title (a pool is replaced on purpose, by
// deleting the draft in the builder first). Pictures are uploaded before the transaction; an unused picture object is harmless.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { authoredProblems } from '@/lib/hw/exams/build-rules';
import type { AuthoredInput } from '@/lib/hw/exams/builder';
import type { ItemFigure } from '@/db/hw-exams-schema';
import { sniffImage } from '@/lib/hw/bank/figures';
import { examFigureKey } from '@/lib/hw/storage/keys';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--') ? process.argv[i + 1] : undefined;
};

const part = z.object({
  label: z.string(), marks: z.number().positive(), drawing: z.boolean().optional(),
  points: z.array(z.tuple([z.string().min(1), z.number().positive()])).min(1),
});
const item = z.object({
  id: z.string(), qtype: z.enum(['mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based']), marks: z.number().positive(), topic: z.string().min(1),
  sources: z.array(z.string()).min(1), key: z.enum(['official', 'assistant']), needsCheck: z.boolean(), stem: z.string().min(1),
  options: z.array(z.string()).length(4).optional(), correctOption: z.enum(['A', 'B', 'C', 'D']).optional(), official: z.string().optional(), note: z.string().optional(),
  parts: z.array(part).optional(),
  // exam-pool/2
  asked: z.number().int().positive().optional(),
  ncert: z.object({ section: z.string().min(1), title: z.string().min(1), pages: z.string().regex(/^\d+(-\d+)?$/) }).optional(),
  choiceGroup: z.string().min(1).max(100).nullable().optional(),
  figures: z.array(z.object({ image: z.string().nullable().optional(), description: z.string().min(1), labels: z.array(z.string()).default([]) })).optional(),
  // the second check of an assistant key by a model against the NCERT chapter text (cbse-science-qbank verify_keys.py)
  autoCheck: z.object({
    model: z.string().min(1), at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(['approved', 'disputed', 'needs_person']), why: z.string(),
  }).optional(),
});
const pool = z.object({
  format: z.enum(['exam-pool/1', 'exam-pool/2']), title: z.string().min(1), board: z.string(), classLevel: z.number().int(), subject: z.string(), subjectCode: z.string(),
  chapter: z.string().min(1), chapterNo: z.number().int().optional(), book: z.string().optional(), topics: z.array(z.string()).min(1),
  ar_options: z.array(z.string()).length(4), items: z.array(item).min(1),
});
export type Pool = z.infer<typeof pool>;
type Item = Pool['items'][number];

/** A picture as stored: its object key, content type and bytes. */
export interface StoredFigure { key: string; mime: string; bytes: Uint8Array; description: string; labels: string[] }

/** Reads and checks a question's pictures. Missing or unusable pictures are named, never guessed. */
export function figuresOf(q: Item, base: string): { figures: StoredFigure[]; problems: string[] } {
  const figures: StoredFigure[] = [];
  const problems: string[] = [];
  for (const f of q.figures ?? []) {
    if (!f.image) { problems.push(`no picture for "${f.description.slice(0, 60)}"`); continue; }
    const path = resolve(base, f.image);
    if (!path.startsWith(resolve(base))) { problems.push(`picture path ${f.image} leaves the figures folder`); continue; }
    if (!existsSync(path)) { problems.push(`picture ${f.image} is missing`); continue; }
    const bytes = new Uint8Array(readFileSync(path));
    const info = sniffImage(bytes);
    if ('problem' in info) { problems.push(`picture ${f.image}: ${info.problem}`); continue; }
    const sha = createHash('sha256').update(bytes).digest('hex');
    figures.push({ key: examFigureKey(sha, info.ext), mime: info.mime, bytes, description: f.description, labels: f.labels });
  }
  return { figures, problems };
}

const AI_CHECK = /^AI check \(/;
const AI_SAYS = { approved: 'confirmed from the textbook', disputed: 'DISPUTED', needs_person: 'a person must check' } as const;

/** The scheme-text line that records a model's second check of an assistant key (none for an official key or an unchecked one). */
export function aiCheckLine(q: Item): string | null {
  if (q.key !== 'assistant' || !q.autoCheck) return null;
  const a = q.autoCheck;
  return `AI check (${a.model}, ${a.at}): ${AI_SAYS[a.status]}. ${a.why.replace(/\s+/g, ' ').trim()}`.slice(0, 1200);
}

/** The scheme text with its AI-check line put in (or replaced): always the second line, so "KEY TO CHECK" stays first. */
export function withAiCheck(schemeText: string, line: string | null): string {
  const lines = schemeText.split('\n').filter((l) => !AI_CHECK.test(l));
  if (line) lines.splice(1, 0, line);
  return lines.join('\n');
}

/** Who the check stamps when the model confirmed the key: the builder shows it, and a teacher can take it back. */
export const autoCheckedBy = (q: Item) => (q.key === 'assistant' && q.autoCheck?.status === 'approved' ? `Auto-check: ${q.autoCheck.model} (${q.autoCheck.at})` : null);

/** One pool question as the builder takes it; the key's origin is said in its scheme text. */
export function authoredOf(p: Pool, q: Item, figures: ItemFigure[] = []): AuthoredInput {
  const choice = q.qtype === 'mcq' || q.qtype === 'assertion_reason';
  const where = `NCERT Class X Science${p.chapterNo ? `, chapter ${p.chapterNo} (${p.chapter})` : `, ${p.chapter}`}`;
  const from = q.key !== 'official' ? `KEY TO CHECK: written by the assistant from ${where}; a teacher must confirm it`
    // the Exemplar's answers are NCERT's own, printed in the book; only the board's keys are a CBSE marking scheme
    : (q.sources[0] ?? '').startsWith('NCERT Exemplar') ? `NCERT Exemplar's own answer: ${(q.official ?? q.sources[0]!).replace(/^NCERT Exemplar answers?:\s*/, '')}`
    : `CBSE marking scheme: ${q.official ?? q.sources[0]}`;
  const keyText = choice
    ? `Answer: (${q.correctOption})`
    : (q.parts ?? []).map((pt) => `${pt.label ? `(${pt.label}) ` : ''}${pt.drawing ? '[drawing, not marked by the AI] ' : ''}${pt.points.map(([t, m]) => `${t} [${m}]`).join('; ')}`).join('\n');
  const parts = choice ? [] : (q.parts ?? []).map((pt, k) => ({
    label: pt.label, marks: pt.marks, answer_kind: pt.drawing ? 'diagram' : 'text',
    value_points: pt.points.map(([text, marks], j) => ({ id: `p${k + 1}v${j + 1}`, text, marks, quote: '' })),
  }));
  return {
    qtype: q.qtype, marks: q.marks, chapter: p.chapter, topic: q.topic, section: 'B', stem: q.stem,
    ...(choice ? { options: q.qtype === 'assertion_reason' ? p.ar_options : q.options, correctOption: q.correctOption } : {}),
    parts,
    diagramParts: (q.parts ?? []).filter((pt) => pt.drawing).map((pt) => pt.label),
    schemeText: withAiCheck(`${from}\nSource: ${q.sources.join(', ')}${q.ncert ? `\nTaught in: NCERT ${q.ncert.section} ${q.ncert.title}, pages ${q.ncert.pages}` : ''}${q.note ? `\nNote: ${q.note}` : ''}\n${keyText}`, aiCheckLine(q)),
    ...(q.ncert ? { ncert: { book: p.book, chapterNo: p.chapterNo, ...q.ncert } } : {}),
    sources: q.sources,
    choiceGroup: q.choiceGroup ?? null,
    figures,
  };
}

/** Everything wrong with the file, and the questions left out for a missing picture (with why). */
export function check(p: Pool, base: string): { problems: string[]; leftOut: { id: string; why: string[] }[]; pictures: Map<string, StoredFigure[]> } {
  const problems: string[] = [];
  const leftOut: { id: string; why: string[] }[] = [];
  const pictures = new Map<string, StoredFigure[]>();
  const ids = new Set<string>();
  for (const q of p.items) {
    if (ids.has(q.id)) problems.push(`${q.id}: the id is used twice`);
    ids.add(q.id);
    if (!p.topics.includes(q.topic)) problems.push(`${q.id}: topic "${q.topic}" is not in the pool's topic list`);
    if ((q.qtype === 'mcq' || q.qtype === 'assertion_reason') && !q.correctOption) problems.push(`${q.id}: no right option`);
    if (q.qtype === 'mcq' && !q.options) problems.push(`${q.id}: no options`);
    if (q.key === 'official' && !q.official) problems.push(`${q.id}: an official key must quote the scheme`);
    for (const m of authoredProblems(authoredOf(p, q) as never)) problems.push(`${q.id}: ${m}`);
    const f = figuresOf(q, base);
    // a question that is only a drawing has nothing the AI may mark: a learner would write it and get no marks back
    if (q.parts?.length && q.parts.every((pt) => pt.drawing)) f.problems.push('every part is a drawing, which the AI does not mark');
    if (f.problems.length) leftOut.push({ id: q.id, why: f.problems });
    else pictures.set(q.id, f.figures);
  }
  return { problems, leftOut, pictures };
}

/**
 * `apply-checks`: puts the pool file's AI checks on a pool already imported (matched by title, its questions by their first printed source).
 * Writes the AI-check line into each assistant key's scheme text and stamps the keys the model confirmed as checked "Auto-check: <model> (<date>)".
 * A teacher's own check is never touched; an auto-check stamp the model no longer gives is taken back. The question's content is not changed, so this
 * does not go through updateItem (which would clear every check). Only a DRAFT pool can be changed (the 034 guard refuses the rest).
 */
async function applyChecks(p: Pool, year: number, slug: string) {
  const { db } = await import('@/db');
  const { and, eq } = await import('drizzle-orm');
  const { hwExamPackage, hwExamSet, hwExamSetItem } = await import('@/db/hw-exams-schema');
  const byRef = new Map(p.items.filter((q) => q.key === 'assistant').map((q) => [q.sources[0]!, q]));
  const n = { lines: 0, stamped: 0, unstamped: 0, teacher: 0, unmatched: 0, differs: [] as string[] };
  const keyOf = (option: string | null | undefined, parts: unknown) => JSON.stringify([option ?? null,
    ((parts ?? []) as { label?: string; value_points?: { text: string; marks: number }[] }[]).map((pt) => [pt.label ?? '', (pt.value_points ?? []).map((v) => [v.text, Number(v.marks)])])]);
  await db.transaction(async (tx) => {
    const pkg = (await tx.select().from(hwExamPackage).where(and(eq(hwExamPackage.board, p.board), eq(hwExamPackage.classLevel, p.classLevel), eq(hwExamPackage.examYear, year), eq(hwExamPackage.slug, slug))).limit(1))[0];
    if (!pkg) throw new Error(`no package ${p.board} class ${p.classLevel} ${year} "${slug}"`);
    const set = (await tx.select().from(hwExamSet).where(and(eq(hwExamSet.packageId, pkg.id), eq(hwExamSet.kind, 'pool'), eq(hwExamSet.title, p.title))).limit(1))[0];
    if (!set) throw new Error(`the package has no pool called "${p.title}"`);
    if (set.status !== 'draft') throw new Error(`the pool "${p.title}" is ${set.status}; only a draft pool can take the AI checks`);
    const rows = await tx.select({
      id: hwExamSetItem.id, sources: hwExamSetItem.sources, schemeText: hwExamSetItem.schemeText, keyCheckedBy: hwExamSetItem.keyCheckedBy,
      correctOption: hwExamSetItem.correctOption, parts: hwExamSetItem.parts,
    }).from(hwExamSetItem).where(eq(hwExamSetItem.setId, set.id));
    for (const r of rows) {
      if (!(r.schemeText ?? '').startsWith('KEY TO CHECK')) continue;
      const q = (r.sources ?? []).map((s) => byRef.get(s)).find(Boolean);
      if (!q) { n.unmatched++; continue; }
      // the verdict is for the key in the pool file: a key that differs in the database (edited there, or loaded from an older file) keeps none
      const fileKey = authoredOf(p, q);
      if (keyOf(r.correctOption, r.parts) !== keyOf(fileKey.correctOption, fileKey.parts)) {
        n.differs.push(q.sources[0]!);
        if ((r.keyCheckedBy ?? '').startsWith('Auto-check:')) await tx.update(hwExamSetItem).set({ keyCheckedBy: null, keyCheckedAt: null }).where(eq(hwExamSetItem.id, r.id));
        continue;
      }
      const schemeText = withAiCheck(r.schemeText ?? '', aiCheckLine(q));
      const auto = autoCheckedBy(q);
      const byAuto = (r.keyCheckedBy ?? '').startsWith('Auto-check:');
      const patch: Partial<typeof hwExamSetItem.$inferInsert> = {};
      if (schemeText !== r.schemeText) { patch.schemeText = schemeText; n.lines++; }
      if (r.keyCheckedBy && !byAuto) n.teacher++;
      else if (auto && r.keyCheckedBy !== auto) { patch.keyCheckedBy = auto; patch.keyCheckedAt = new Date(); n.stamped++; }
      else if (!auto && byAuto) { patch.keyCheckedBy = null; patch.keyCheckedAt = null; n.unstamped++; }
      if (Object.keys(patch).length) await tx.update(hwExamSetItem).set(patch).where(eq(hwExamSetItem.id, r.id));
    }
  });
  console.log(`${p.title}: ${n.lines} AI-check lines written, ${n.stamped} keys stamped as auto-checked, ${n.unstamped} auto stamps taken back, `
    + `${n.teacher} already checked by a teacher (left alone), ${n.unmatched} assistant keys not found in the pool file`
    + (n.differs.length ? `\n  left alone, the key in the database differs from the pool file (update it there, or check it by hand): ${n.differs.join(', ')}` : ''));
}

async function main() {
  const [cmd, path] = process.argv.slice(2);
  if (!cmd || !path || !['check', 'import', 'apply-checks'].includes(cmd)) throw new Error('usage: check|import|apply-checks <pool.json> [--figures <dir>] [--year 2027 --slug ... --by name]');
  const p = pool.parse(JSON.parse(readFileSync(path, 'utf8')));
  const base = resolve(arg('figures') ?? join(dirname(resolve(path)), '..'));
  const { problems, leftOut, pictures } = check(p, base);
  const kept = p.items.filter((q) => pictures.has(q.id));
  const byType = new Map<string, number>();
  for (const q of kept) byType.set(q.qtype, (byType.get(q.qtype) ?? 0) + 1);
  const marks = kept.reduce((s, q) => s + q.marks, 0);
  const pics = new Map([...pictures.values()].flat().map((f) => [f.key, f]));
  console.log(`${p.title}: ${kept.length} of ${p.items.length} questions, ${marks} marks; ${[...byType].map(([k, n]) => `${k} ${n}`).join(', ')}; `
    + `${kept.filter((q) => q.needsCheck).length} keys to check, ${kept.filter((q) => q.key === 'official').length} official; ${pics.size} pictures`);
  if (leftOut.length) console.log(`left out (missing pictures, or only a drawing):\n${leftOut.map((l) => `  - ${l.id}: ${l.why.join('; ')}`).join('\n')}`);
  if (problems.length) { console.error(problems.map((x) => `  - ${x}`).join('\n')); process.exit(1); }
  const ai = p.items.filter((q) => q.key === 'assistant' && q.autoCheck);
  if (ai.length) console.log(`AI checks: ${['approved', 'disputed', 'needs_person'].map((s) => `${ai.filter((q) => q.autoCheck!.status === s).length} ${s}`).join(', ')} of ${p.items.filter((q) => q.key === 'assistant').length} assistant keys`);
  if (cmd === 'check') return;
  const year = Number(arg('year') ?? 2027);
  const slug = arg('slug') ?? 'chapter-practice';
  if (cmd === 'apply-checks') { await applyChecks(p, year, slug); process.exit(0); }
  if (!kept.length) throw new Error('nothing to import');

  const by = arg('by') ?? 'pool-importer';
  const { examPageStore } = await import('@/lib/hw/storage/exam-pages');
  const store = examPageStore();
  for (const f of pics.values()) await store.put(f.key, f.bytes, f.mime);
  const { db } = await import('@/db');
  const { and, eq } = await import('drizzle-orm');
  const { hwExamPackage, hwExamSet } = await import('@/db/hw-exams-schema');
  const b = await import('@/lib/hw/exams/builder');
  const out = await db.transaction(async (tx) => {
    const pkg = (await tx.select().from(hwExamPackage).where(and(eq(hwExamPackage.board, p.board), eq(hwExamPackage.classLevel, p.classLevel), eq(hwExamPackage.examYear, year), eq(hwExamPackage.slug, slug))).limit(1))[0];
    const pkgId = pkg?.id ?? (await b.createPackage(tx, by, {
      board: p.board, classLevel: p.classLevel, examYear: year, slug, title: `${p.board} Class ${p.classLevel} ${p.subject} ${year}: chapter practice`,
      blurb: 'Board-exam questions, chapter by chapter. Make your own practice test: choose topics, question types and how many questions.',
    })).id;
    const dup = (await tx.select({ id: hwExamSet.id }).from(hwExamSet).where(and(eq(hwExamSet.packageId, pkgId), eq(hwExamSet.kind, 'pool'), eq(hwExamSet.title, p.title))).limit(1))[0];
    if (dup) throw new Error(`the package already has a pool called "${p.title}" (${dup.id}); delete that draft in the builder first`);
    const set = await b.addSet(tx, pkgId, { kind: 'pool', subject: p.subject, subjectCode: p.subjectCode, title: p.title, maxMarks: marks, durationMinutes: 60, syllabusScope: [p.chapter] });
    for (const q of kept) {
      const figures = pictures.get(q.id)!.map((f) => ({ key: f.key, description: f.description, labels: f.labels }));
      const { id } = await b.addAuthoredItem(tx, set.id, authoredOf(p, q, figures));
      const auto = autoCheckedBy(q);
      if (auto) await b.checkItemKey(tx, id, auto, true);
    }
    return { packageId: pkgId, poolId: set.id, created: !pkg };
  });
  console.log(`${out.created ? 'created' : 'reused'} package ${out.packageId}; draft pool ${out.poolId} with ${kept.length} questions. Check the keys in the builder, then publish the pool and the package.`);
  process.exit(0);
}

if (process.argv[1] && /hw-exam-pool-import/.test(process.argv[1])) main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
