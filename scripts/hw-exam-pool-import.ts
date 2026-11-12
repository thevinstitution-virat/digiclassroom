// Question-pool importer (migration 035; docs/hw-eval/exam-packages.md, section 13). Reads a pool file (exam-pool/1, kept out of git with the
// other board material, e.g. hw-evals/chapter-pools/*.json) and creates a DRAFT "chapter practice" package holding a DRAFT pool set with every
// question, its topic and its key. Learners see nothing until a teacher has checked the keys in the super admin builder (each key the
// assistant wrote says "KEY TO CHECK" in its scheme text) and the pool and the package are published there.
//
//   npm run hw:exam:pool -w apps/api -- check  <pool.json>                       (no database: counts and checks every question)
//   npm run hw:exam:pool -w apps/api -- import <pool.json> --year 2027 --slug cbse-x-science-chapter-practice --by "name"
//
// `import` writes in one transaction and refuses when the package already has a pool of the same title (a pool is replaced on purpose, by
// deleting the draft in the builder first).

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { authoredProblems } from '@/lib/hw/exams/build-rules';
import type { AuthoredInput } from '@/lib/hw/exams/builder';

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('--') ? process.argv[i + 1] : undefined;
};

const item = z.object({
  id: z.string(), qtype: z.enum(['mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based']), marks: z.number().positive(), topic: z.string().min(1),
  sources: z.array(z.string()).min(1), key: z.enum(['official', 'assistant']), needsCheck: z.boolean(), stem: z.string().min(1),
  options: z.array(z.string()).length(4).optional(), correctOption: z.enum(['A', 'B', 'C', 'D']).optional(), official: z.string().optional(), note: z.string().optional(),
  parts: z.array(z.object({ label: z.string(), marks: z.number().positive(), points: z.array(z.tuple([z.string().min(1), z.number().positive()])).min(1) })).optional(),
});
const pool = z.object({
  format: z.literal('exam-pool/1'), title: z.string().min(1), board: z.string(), classLevel: z.number().int(), subject: z.string(), subjectCode: z.string(),
  chapter: z.string().min(1), topics: z.array(z.string()).min(1), ar_options: z.array(z.string()).length(4), items: z.array(item).min(1),
});
type Pool = z.infer<typeof pool>;

/** One pool question as the builder takes it; the key's origin is said in its scheme text. */
export function authoredOf(p: Pool, q: Pool['items'][number]): AuthoredInput {
  const choice = q.qtype === 'mcq' || q.qtype === 'assertion_reason';
  const from = q.key === 'official' ? `CBSE marking scheme: ${q.official ?? q.sources[0]}` : 'KEY TO CHECK: written by the assistant from NCERT Class X Science, chapter 1; a teacher must confirm it';
  const keyText = choice ? `Answer: (${q.correctOption})` : (q.parts ?? []).map((pt) => `${pt.label ? `(${pt.label}) ` : ''}${pt.points.map(([t, m]) => `${t} [${m}]`).join('; ')}`).join('\n');
  return {
    qtype: q.qtype, marks: q.marks, chapter: p.chapter, topic: q.topic, section: 'B', stem: q.stem,
    ...(choice ? { options: q.qtype === 'assertion_reason' ? p.ar_options : q.options, correctOption: q.correctOption } : {}),
    parts: choice ? [] : (q.parts ?? []).map((pt, k) => ({
      label: pt.label, marks: pt.marks, answer_kind: 'text',
      value_points: pt.points.map(([text, marks], j) => ({ id: `p${k + 1}v${j + 1}`, text, marks, quote: '' })),
    })),
    schemeText: `${from}\nSource: ${q.sources.join(', ')}${q.note ? `\nNote: ${q.note}` : ''}\n${keyText}`,
  };
}

function check(p: Pool): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const q of p.items) {
    if (ids.has(q.id)) problems.push(`${q.id}: the id is used twice`);
    ids.add(q.id);
    if (!p.topics.includes(q.topic)) problems.push(`${q.id}: topic "${q.topic}" is not in the pool's topic list`);
    if ((q.qtype === 'mcq' || q.qtype === 'assertion_reason') && !q.correctOption) problems.push(`${q.id}: no right option`);
    if (q.qtype === 'mcq' && !q.options) problems.push(`${q.id}: no options`);
    if (q.key === 'official' && !q.official) problems.push(`${q.id}: an official key must quote the scheme`);
    for (const m of authoredProblems(authoredOf(p, q) as never)) problems.push(`${q.id}: ${m}`);
  }
  return problems;
}

async function main() {
  const [cmd, path] = process.argv.slice(2);
  if (!cmd || !path || !['check', 'import'].includes(cmd)) throw new Error('usage: check|import <pool.json> [--year 2027 --slug ... --by name]');
  const p = pool.parse(JSON.parse(readFileSync(path, 'utf8')));
  const problems = check(p);
  const byType = new Map<string, number>();
  for (const q of p.items) byType.set(q.qtype, (byType.get(q.qtype) ?? 0) + 1);
  const marks = p.items.reduce((s, q) => s + q.marks, 0);
  console.log(`${p.title}: ${p.items.length} questions, ${marks} marks; ${[...byType].map(([k, n]) => `${k} ${n}`).join(', ')}; ${p.items.filter((q) => q.needsCheck).length} keys to check, ${p.items.filter((q) => q.key === 'official').length} official`);
  if (problems.length) { console.error(problems.map((x) => `  - ${x}`).join('\n')); process.exit(1); }
  if (cmd === 'check') return;

  const year = Number(arg('year') ?? 2027);
  const slug = arg('slug') ?? 'chapter-practice';
  const by = arg('by') ?? 'pool-importer';
  const { db } = await import('@/db');
  const { and, eq } = await import('drizzle-orm');
  const { hwExamPackage, hwExamSet } = await import('@/db/hw-exams-schema');
  const b = await import('@/lib/hw/exams/builder');
  const out = await db.transaction(async (tx) => {
    let pkg = (await tx.select().from(hwExamPackage).where(and(eq(hwExamPackage.board, p.board), eq(hwExamPackage.classLevel, p.classLevel), eq(hwExamPackage.examYear, year), eq(hwExamPackage.slug, slug))).limit(1))[0];
    const pkgId = pkg?.id ?? (await b.createPackage(tx, by, {
      board: p.board, classLevel: p.classLevel, examYear: year, slug, title: `${p.board} Class ${p.classLevel} ${p.subject} ${year}: chapter practice`,
      blurb: 'Board-exam questions, chapter by chapter. Make your own practice test: choose topics, question types and how many questions.',
    })).id;
    const dup = (await tx.select({ id: hwExamSet.id }).from(hwExamSet).where(and(eq(hwExamSet.packageId, pkgId), eq(hwExamSet.kind, 'pool'), eq(hwExamSet.title, p.title))).limit(1))[0];
    if (dup) throw new Error(`the package already has a pool called "${p.title}" (${dup.id}); delete that draft in the builder first`);
    const set = await b.addSet(tx, pkgId, { kind: 'pool', subject: p.subject, subjectCode: p.subjectCode, title: p.title, maxMarks: marks, durationMinutes: 60, syllabusScope: [p.chapter] });
    for (const q of p.items) await b.addAuthoredItem(tx, set.id, authoredOf(p, q));
    return { packageId: pkgId, poolId: set.id, created: !pkg };
  });
  console.log(`${out.created ? 'created' : 'reused'} package ${out.packageId}; draft pool ${out.poolId} with ${p.items.length} questions. Check the keys in the builder, then publish the pool and the package.`);
  process.exit(0);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
