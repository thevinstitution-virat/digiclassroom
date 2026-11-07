// Board-paper bank, phase 5: evaluating AI marking on the board's own papers (docs/hw-eval/board-paper-importer.md).
//
//   npm run hw:paper:eval -w apps/api -- questions <bank.json> [--kind sqp|past_paper] --out q.json
//       the written questions to evaluate, with their official references, for `hw-eval-mutate generate --questions q.json`. No database, no model.
//   npm run hw:paper:eval -w apps/api -- equations <bank.json> [--kind ...] --dataset eq-<paper>@v1 [--datasets-root hw-evals/datasets]
//       every distinct equation of the paper as an item to copy by hand: a new dataset version (then `hw-eval-mutate sheets` prints the copy sheets).
//   npm run hw:paper:eval -w apps/api -- equation-report --run <runId> --dataset eq-<paper>@v1 [--runs-root hw-evals/runs] [--datasets-root ...] [--out report.json]
//       how the reader did on those equations: exact, equivalent (only a way of writing: CO₂ for CO2, → for ->) or different.
//
// The keys for `generate` come from the person-checked bank (a question whose row nobody has checked gets no variants), so check the paper first.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { validateBank } from '@/lib/hw/bank/validate';
import { expandBank } from '@/lib/hw/bank/expand';
import { equationItemsOf, equationPairs, evalQuestionsOf } from '@/lib/hw/bank/eval-export';
import { summariseEquationReading } from '@/lib/hw/bank/equations';

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}
const arg = (name: string, fallback?: string): string | undefined => { const i = process.argv.indexOf(`--${name}`); return i > 1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : fallback; };
const need = (name: string): string => arg(name) ?? fail(`--${name} is required`, 2);
const USAGE = 'usage: hw-paper-eval questions <bank.json> --out q.json  |  equations <bank.json> --dataset name@vN  |  equation-report --run <runId> --dataset name@vN';

function paperOf(path: string) {
  const parsed = parseBankFile(readFileSync(path, 'utf8'));
  if (!parsed.ok) fail(`The file is not a bank file:\n${parsed.problems.map((p) => `  - ${p}`).join('\n')}`);
  const problems = validateBank(parsed.bank);
  if (problems.length) fail(`The file does not add up (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  const kind = arg('kind');
  if (kind && kind !== 'sqp' && kind !== 'past_paper') fail('--kind is sqp or past_paper', 2);
  return expandBank(parsed.bank, { kind: kind as 'sqp' | 'past_paper' | undefined });
}

async function main() {
  const [cmd, path] = process.argv.slice(2);
  if (cmd === 'questions') {
    if (!path || path.startsWith('--')) fail(USAGE, 2);
    const { questions, skipped } = evalQuestionsOf(paperOf(path));
    const out = need('out');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(questions, null, 2), { flag: 'wx' });
    console.log(`${questions.length} written questions for evaluation, ${questions.reduce((s, q) => s + q.marks, 0)} marks: ${out}`);
    const byType = new Map<string, number>();
    for (const q of questions) byType.set(q.questionType, (byType.get(q.questionType) ?? 0) + 1);
    console.log(`by type (the evaluation groups: ${[...byType.keys()].map((t) => `science|${t}|en|board_scheme_key`).join(', ')}): ${[...byType].map(([t, n]) => `${t} ${n}`).join(', ')}`);
    for (const s of skipped) console.log(`  skipped ${s.row}: ${s.why}`);
    console.log('Next: hw-eval-mutate generate --questions <this file> … (the keys are read from the checked bank; unchecked questions are reported, not guessed).');
    return;
  }
  if (cmd === 'equations') {
    if (!path || path.startsWith('--')) fail(USAGE, 2);
    const { items, rowsOf } = equationItemsOf(paperOf(path));
    if (!items.length) fail('This paper has no equations.');
    const { writeDatasetVersion, parseManifest } = await import('@/lib/hw/eval/dataset');
    const check = parseManifest(items.map((i) => JSON.stringify(i)).join('\n'));
    if ('problems' in check) fail(`the equation items are not valid:\n  ${check.problems.join('\n  ')}`);
    const ref = need('dataset');
    const dir = writeDatasetVersion(arg('datasets-root', 'hw-evals/datasets')!, ref, items);
    console.log(`dataset ${ref}: ${items.length} equations written to ${dir}`);
    for (const [text, rows] of rowsOf) console.log(`  ${rows.join(', ').padEnd(12)} ${text}`);
    console.log('Next: hw-eval-mutate sheets --dataset <this> --out sheets.html, have volunteers copy them by hand, scan them in, run the reading evaluation, then equation-report.');
    return;
  }
  if (cmd === 'equation-report') {
    const { loadDataset } = await import('@/lib/hw/eval/dataset');
    const { latestRows, readRows } = await import('@/lib/hw/eval/runner');
    const ds = loadDataset(arg('datasets-root', 'hw-evals/datasets')!, need('dataset'));
    if (!ds.items.some((i) => i.question.id.startsWith('eq_'))) fail('That dataset has no equation items (made by `equations`).');
    const rows = latestRows(readRows(join(arg('runs-root', 'hw-evals/runs')!, need('run'), 'items.jsonl')));
    const pairs = equationPairs(ds.items, rows);
    if (!pairs.length) fail('That run has no read equations: it needs a reading run (ink or photo items) over this dataset.');
    const s = summariseEquationReading(pairs);
    const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
    console.log(`${s.n} equations read: ${s.exact} exact, ${s.equivalent} the same equation written another way, ${s.different} different. Right: ${pct(s.rate)}`);
    for (const m of s.misses) console.log(`  MISS  truth ${m.truth}\n        read  ${m.read}   (off by ${(m.distance * 100).toFixed(0)}%)`);
    const out = arg('out');
    if (out) writeFileSync(out, JSON.stringify(s, null, 2));
    return;
  }
  fail(USAGE, 2);
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
