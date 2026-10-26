// Answer keys — calibrate R_min, the minimum dense cosine score of the top passage
// (docs/hw-eval/stage1-design.md §2.3 step 4). Read-only: Qdrant `scroll`/`query` and
// SELECTs inside READ ONLY transactions. Costs one embedding per question.
//
// Usage (from the repo root, with QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION_NAME,
// TRIO_CONTENT_DATABASE_URL and OPENAI_API_KEY in the env file):
//   npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local \
//     scripts/hw-key-calibrate.ts (--labels labels.json | --proxy) [--target 0.95] [--min-support 30] [--out report.json]
//
// --labels: hand-labelled pairs, the design's method. JSON array of
//   { question, classLevel, subject, medium, relevantChapter? , relevantChunkIds?: string[], answerable: boolean }
//   A top passage is correct if it is one of relevantChunkIds, or (failing those) in relevantChapter.
//   answerable=false items have no relevant passage in the book: any passage above R_min is wrong.
// --proxy: labels taken from the books themselves, until the hand labels exist. Each exercise
//   question in the book's practice rows is labelled with its own chapter (positive); each is
//   also searched against every book of an UNRELATED subject (negative: nothing there should
//   pass). Books of related subjects (Social Science / Geography) share content and are not
//   used as negatives; the report lists those pairs.
//   Proxy labels are an approximation and the report says so; the value goes in the config
//   hash either way.
//
// R_min = the smallest threshold whose precision (correct / passed) is at least --target, with
// at least --min-support questions passing; the Wilson 95% lower bound is reported beside it.

import { writeFileSync } from 'node:fs';
import { QdrantClient } from '@qdrant/js-client-rest';
import { _resetHwConfig, getHwConfig } from '@/lib/hw/config';
import { getContentPool } from '@/lib/db/content-connection';
import { gyankoshRetriever } from '@/lib/hw/keys/retriever';
import { trioReader } from '@/lib/hw/keys/trio';
import { exerciseQuestions } from '@/lib/hw/keys/exercise-match';
import { normaliseMedium, qdrantFilter, relatedSubjects, scopeOf } from '@/lib/hw/keys/scope';
import type { Medium } from '@/lib/hw/keys/types';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

interface Item {
  question: string;
  classLevel: string;
  subject: string;
  medium: Medium;
  relevantChapter?: string;
  relevantChunkIds?: string[];
  answerable: boolean;
  origin: string;
}

interface Scored extends Item { topScore: number; topChapter: string | null; topId: string; correct: boolean }

/** "Chapter 8: Building Blocks…" and "Chapter 8 - Building blocks…" compare equal. */
function chapterKey(ch: string | null | undefined): string {
  if (!ch) return '';
  const m = /chapter\s+(\d+)/i.exec(ch);
  return m ? `ch${m[1]}` : ch.trim().toLowerCase();
}

function wilsonLower(k: number, n: number, z = 1.96): number {
  if (!n) return NaN;
  const p = k / n;
  return (p + (z * z) / (2 * n) - z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / (1 + (z * z) / n);
}

/** Books in the index, with the scope a question about each would carry. */
async function booksInIndex(): Promise<{ contentItemId: string; title: string; classLevel: string; subject: string; medium: Medium }[]> {
  const c = getHwConfig();
  const client = new QdrantClient({ url: c.QDRANT_URL!, apiKey: c.QDRANT_API_KEY, checkCompatibility: false });
  const seen = new Map<string, { title: string; classLevel: string; medium: string; subjects: Map<string, number> }>();
  let offset: string | number | undefined;
  do {
    const r = await client.scroll(c.QDRANT_COLLECTION_NAME!, {
      limit: 500, offset, with_vector: false,
      with_payload: ['content_item_id', 'book_title', 'class', 'subject', 'medium'],
      filter: { must: [{ is_empty: { key: 'organization_id' } }, { key: 'retrieval_class', match: { value: 'reference' } }] },
    });
    for (const p of r.points) {
      const pl = p.payload as Record<string, string>;
      const b = seen.get(pl.content_item_id) ?? { title: pl.book_title, classLevel: pl.class, medium: pl.medium, subjects: new Map() };
      b.subjects.set(pl.subject, (b.subjects.get(pl.subject) ?? 0) + 1);
      seen.set(pl.content_item_id, b);
    }
    offset = (r.next_page_offset ?? undefined) as string | number | undefined;
  } while (offset !== undefined);
  return [...seen].map(([id, b]) => ({
    contentItemId: id, title: b.title, classLevel: b.classLevel, medium: normaliseMedium(b.medium),
    // A whole-book subject (e.g. "Social Science") covers its parts; otherwise the most common one.
    subject: b.subjects.has('Social Science') ? 'Social Science' : [...b.subjects].sort((x, y) => y[1] - x[1])[0][0],
  }));
}

/** Book pairs left out of the negatives because their subjects are related (listed in the report). */
const relatedSkipped = new Set<string>();

async function proxyItems(): Promise<Item[]> {
  const books = await booksInIndex();
  const trio = trioReader();
  const rows = await trio.practiceRows(books.map((b) => b.contentItemId));
  const items: Item[] = [];
  for (const r of rows) {
    if (/^\[GLOSSARY/i.test(r.text) || !r.chapter) continue;
    const book = books.find((b) => b.contentItemId === r.contentItemId)!;
    for (const q of exerciseQuestions(r.text)) {
      if (q.split(/\s+/).length < 4) continue;
      items.push({ question: q, classLevel: book.classLevel, subject: book.subject, medium: book.medium, relevantChapter: r.chapter, answerable: true, origin: `${book.title} / ${r.chapter}` });
      // Negatives: the same question against books of UNRELATED subjects only. A related book
      // (Class 9 Social Science vs Class 11 Geography) really does contain relevant passages, so
      // labelling it "nothing should pass" was wrong; production never searches across them anyway,
      // because retrieval is scoped to the question's own class, subject and medium.
      for (const other of books) {
        if (other.contentItemId === book.contentItemId) continue;
        if (relatedSubjects(book.subject, other.subject)) { relatedSkipped.add(`${book.title} ~ ${other.title}`); continue; }
        items.push({ question: q, classLevel: other.classLevel, subject: other.subject, medium: other.medium, answerable: false, origin: `${book.title} question vs ${other.title}` });
      }
    }
  }
  return items;
}

async function main() {
  _resetHwConfig();
  const target = Number(arg('target', '0.95'));
  const minSupport = Number(arg('min-support', '30'));
  const labelsPath = arg('labels');
  if (!labelsPath && !flag('proxy')) throw new Error('pass --labels <file> or --proxy');
  const items: Item[] = labelsPath
    ? (JSON.parse((await import('node:fs')).readFileSync(labelsPath, 'utf8')) as Omit<Item, 'origin'>[]).map((x, i) => ({ ...x, medium: normaliseMedium(x.medium), origin: `label ${i + 1}` }))
    : await proxyItems();
  const cfg = getHwConfig();
  const retriever = gyankoshRetriever();
  const vectors = new Map<string, number[]>();
  let embedTokens = 0;
  const scored: Scored[] = [];
  const skipped: { origin: string; reason: string }[] = [];

  for (const it of items) {
    if (!vectors.has(it.question)) {
      const e = await retriever.embed(it.question);
      embedTokens += e.call.usage.input;
      vectors.set(it.question, e.vector);
    }
    const vec = vectors.get(it.question)!;
    const scope = scopeOf({ questionText: it.question, questionType: 'short', marks: 1, classLevel: it.classLevel, subject: it.subject, medium: it.medium });
    const hits = await retriever.search(vec, qdrantFilter(scope), 1);
    if (!hits.length) { skipped.push({ origin: it.origin, reason: 'no book in scope' }); continue; }
    const top = hits[0];
    const correct = it.answerable && (it.relevantChunkIds?.length ? it.relevantChunkIds.includes(top.id) : chapterKey(top.chapter) === chapterKey(it.relevantChapter));
    scored.push({ ...it, topScore: top.score, topChapter: top.chapter, topId: top.id, correct });
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  const rows: { t: number; passed: number; correct: number; precision: number; wilsonLower: number; positivesPassed: number; positives: number; negativesPassed: number }[] = [];
  const positives = scored.filter((s) => s.answerable).length;
  for (let t = 0.15; t <= 0.85 + 1e-9; t += 0.01) {
    const passed = scored.filter((s) => s.topScore >= t);
    const correct = passed.filter((s) => s.correct).length;
    rows.push({
      t: Math.round(t * 100) / 100, passed: passed.length, correct,
      precision: passed.length ? correct / passed.length : NaN, wilsonLower: wilsonLower(correct, passed.length),
      positivesPassed: passed.filter((s) => s.answerable).length, positives,
      negativesPassed: passed.filter((s) => !s.answerable).length,
    });
  }
  const chosen = rows.find((r) => r.passed >= minSupport && r.precision >= target) ?? null;

  const report = {
    method: labelsPath ? `hand labels (${labelsPath})` : 'proxy labels: exercise question -> own chapter (positive); question vs books of unrelated subjects (negative)',
    relatedPairsNotUsedAsNegatives: [...relatedSkipped].sort(),
    collection: cfg.QDRANT_COLLECTION_NAME, embedModel: cfg.HW_KEY_EMBED_MODEL, target, minSupport,
    items: scored.length, positives, negatives: scored.length - positives, skipped: skipped.length,
    embedTokens, distinctQuestions: vectors.size,
    rMin: chosen?.t ?? null,
    atRMin: chosen,
    note: chosen ? undefined : 'no threshold reached the target precision with enough support: keys stay uncalibrated (HW_KEY_R_MIN unset)',
    table: rows.filter((r, i) => i % 5 === 0 || r === chosen),
    scored: scored.map((s) => ({ origin: s.origin, answerable: s.answerable, topScore: Number(s.topScore.toFixed(4)), topChapter: s.topChapter, correct: s.correct })),
    skippedItems: skipped,
  };
  const out = arg('out', 'hw-key-calibration.json')!;
  writeFileSync(out, JSON.stringify(report, null, 2));

  console.log(`\n${report.method}`);
  console.log(`questions ${vectors.size}, scored ${scored.length} (positives ${positives}, negatives ${scored.length - positives}), skipped ${skipped.length}, embedding tokens ${embedTokens}`);
  console.log('   t  passed  precision  wilsonLB  pos.passed/pos  neg.passed');
  for (const r of report.table) {
    console.log(`${r.t.toFixed(2)}  ${String(r.passed).padStart(6)}  ${r.precision.toFixed(3).padStart(9)}  ${r.wilsonLower.toFixed(3).padStart(8)}  ${String(r.positivesPassed).padStart(6)}/${r.positives}  ${String(r.negativesPassed).padStart(10)}${r === chosen ? '  <- R_min' : ''}`);
  }
  console.log(chosen ? `\nR_min = ${chosen.t} (precision ${chosen.precision.toFixed(3)}, Wilson LB ${chosen.wilsonLower.toFixed(3)}, ${chosen.passed} passing)` : `\n${report.note}`);
  console.log(`report: ${out}`);
  await getContentPool().end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
