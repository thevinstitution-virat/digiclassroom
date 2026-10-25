// Virat Evaluator — mutation datasets (source B), in three steps:
//
//   generate  questions -> grounded keys -> correct answer + variants, into a DRAFT folder,
//             with a review sample for a person to check
//     npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local scripts/hw-eval-mutate.ts generate \
//       --questions q.json --draft hw-evals/drafts/<name> --budget-inr 100 \
//       --mutator-model <id> [--mutator-provider openrouter] --grader-model <id> [--unit-deduction 0.5]
//   freeze    reviewed draft -> immutable dataset version
//     … hw-eval-mutate.ts freeze --draft <dir> --reviews reviews.json --dataset <name@vN> [--datasets-root hw-evals/datasets] [--upload]
//   sheets    dataset -> printable copy sheets (HTML; print to PDF from a browser)
//     … hw-eval-mutate.ts sheets --dataset <name@vN> --out sheets.html [--datasets-root …]
//
// questions.json: [{ questionText, questionType, marks, classLevel, subject, medium, board?, passageText?, officialRef? }]
// reviews.json:   [{ itemId, verdict: "approved" | "rejected", note? }]
//
// The key service decides grounding; a question without a grounded, fully supported key gets
// no variants (reported). The mutator must be another model family than the grader.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
function need(name: string): string {
  const v = arg(name);
  if (!v) { console.error(`--${name} is required`); process.exit(2); }
  return v;
}
const csv = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;

async function generate() {
  const { _resetHwConfig, getHwConfig } = await import('@/lib/hw/config');
  _resetHwConfig();
  const { buildKey, defaultKeyDeps, fileKeyCache, keySettingsFromEnv } = await import('@/lib/hw/keys');
  const { generateMutations, DEFAULT_WORD_LIMITS } = await import('@/lib/hw/eval/mutations');
  const { newItemId, parseManifest } = await import('@/lib/hw/eval/dataset');
  const { reviewSample } = await import('@/lib/hw/eval/review');
  const { Budget } = await import('@/lib/hw/eval/runner');
  const { canonicalJson, sha256 } = await import('@/lib/hw/keys/cache');
  const { generateWith } = await import('@/lib/hw/ai');
  const { estimateCost, parsePriceTable } = await import('@/lib/hw/cost/pricing');
  type EvalItem = import('@/lib/hw/eval/dataset').EvalItem;

  const draft = need('draft');
  if (existsSync(join(draft, 'items.jsonl'))) throw new Error(`draft ${draft} already exists; use a new folder`);
  const budgetInr = Number(need('budget-inr'));
  if (!(budgetInr > 0)) throw new Error('--budget-inr must be a positive number');
  const cfg = getHwConfig();
  const table = parsePriceTable(cfg.HW_PRICE_TABLE_JSON);
  if ('problem' in table) throw new Error(`${table.problem}: the budget cannot be enforced`);
  const priceOf = (model: string, usage: { input: number; cached: number; output: number }, costUsd?: number) => {
    if (costUsd !== undefined) return costUsd * table.inr_per_usd * 100;
    const c = estimateCost(table, model, usage, { batch: false });
    return c.problem ? null : c.paise;
  };
  const mutator = { provider: (arg('mutator-provider', 'openrouter') as 'gemini' | 'openrouter'), model: need('mutator-model') };
  const settings = {
    mutator, graderModel: need('grader-model'), unitDeduction: Number(arg('unit-deduction', '0.5')),
    formulaTakesLaterSteps: !flag('formula-step-only'), wordLimits: DEFAULT_WORD_LIMITS, seed: 20261026,
  };
  const keySettings = keySettingsFromEnv();
  const keyDeps = defaultKeyDeps({ cache: fileKeyCache(join(draft, '..', '..', 'key-cache')) });
  const questions = JSON.parse(readFileSync(need('questions'), 'utf8')) as (import('@/lib/hw/keys').KeyRequest & { board?: string })[];

  // Projected per question: key writer + verifier, then ~14 mutator calls.
  const projectOne = () => {
    const parts = [
      priceOf(keySettings.writer.model, { input: 5000, cached: 0, output: 900 }),
      priceOf(keySettings.verifier.model, { input: 4000, cached: 0, output: 400 }),
      priceOf(mutator.model, { input: 14 * 1500, cached: 0, output: 14 * 500 }),
    ];
    if (parts.some((p) => p === null)) throw new Error('a model has no price in HW_PRICE_TABLE_JSON: the budget cannot be enforced');
    return (parts as number[]).reduce((a, b) => a + b, 0);
  };
  const budget = new Budget(budgetInr * 100);
  const items: EvalItem[] = [];
  const report: { question: string; status: string; detail?: string; variants?: number; skipped?: unknown }[] = [];
  let tokensIn = 0; let tokensOut = 0; let unpriced = 0;
  const spend = (calls: { model: string; usage: { input: number; cached: number; output: number }; costUsd?: number }[]) => {
    let p = 0;
    for (const c of calls) {
      tokensIn += c.usage.input; tokensOut += c.usage.output;
      const x = priceOf(c.model, c.usage, c.costUsd);
      if (x === null) unpriced++; else p += x;
    }
    return p;
  };

  for (const q of questions) {
    const projected = projectOne();
    if (!budget.reserve(projected)) { report.push({ question: q.questionText, status: 'not_started', detail: 'budget reached' }); continue; }
    let spent = 0;
    try {
      const key = await buildKey(q, keyDeps, keySettings);
      spent += spend(key.calls);
      if (key.status !== 'grounded') { report.push({ question: q.questionText, status: key.status, detail: `${key.reason}: ${key.detail}` }); continue; }
      if (key.partial) { report.push({ question: q.questionText, status: 'partial_key', detail: 'a point is only partly supported; no variants from partial keys' }); continue; }
      const m = await generateMutations({
        questionText: q.questionText, marks: q.marks, medium: q.medium, classLevel: q.classLevel, subject: q.subject, questionType: q.questionType, key: key.key,
      }, settings, generateWith);
      spent += spend(m.calls);
      const questionId = `q_${sha256(canonicalJson(q)).slice(0, 16)}`;
      const ids = m.variants.map(() => newItemId());
      const parentId = ids[m.variants.findIndex((v) => v.type === 'original')];
      m.variants.forEach((v, i) => items.push({
        id: ids[i], source: 'B', subject: q.subject, class: q.classLevel, board: q.board ?? 'CBSE', medium: q.medium, language: v.language,
        questionType: q.questionType, mode: 'typed',
        question: { id: questionId, text: q.questionText, marks: q.marks, passageText: q.passageText },
        media: {},
        truthTranscript: { text: v.text, how: 'known_text' },
        key: {
          source: key.source, keyId: key.cacheKey ?? key.configHash, referenceAnswer: key.key.referenceAnswer,
          points: key.key.valuePoints.map((p) => ({ id: p.id, marks: p.marks, cites: p.cites, text: p.text, kind: p.kind, acceptedAlternatives: p.acceptedAlternatives })),
        },
        referenceMarks: { byPoint: v.expectedByPoint, total: v.expectedTotal, how: 'by_construction' },
        mutation: { type: v.type, target: v.target, rule: v.rule, parentItem: v.type === 'original' ? null : parentId },
        handwritingBand: 'unknown', device: 'unknown',
        consent: { ref: null, deidentified: true },
      }));
      report.push({ question: q.questionText, status: 'ok', variants: m.variants.length, skipped: m.skipped });
    } catch (e) {
      report.push({ question: q.questionText, status: 'failed', detail: e instanceof Error ? e.message : String(e) });
    } finally {
      budget.settle(projected, spent);
    }
  }

  const check = parseManifest(items.map((x) => JSON.stringify(x)).join('\n'));
  if ('problems' in check) throw new Error(`generated items failed validation:\n  ${check.problems.join('\n  ')}`);
  mkdirSync(draft, { recursive: true });
  writeFileSync(join(draft, 'items.jsonl'), items.map((x) => JSON.stringify(x)).join('\n') + '\n', { flag: 'wx' });
  const sample = reviewSample(items);
  const rows = ['itemId,rule,target,expectedTotal,expectedByPoint,parentItem,text'];
  for (const [, ids] of sample) for (const id of ids) {
    const it = items.find((x) => x.id === id)!;
    rows.push([it.id, it.mutation!.type, it.mutation!.target, it.referenceMarks!.total, JSON.stringify(it.referenceMarks!.byPoint), it.mutation!.parentItem, it.truthTranscript!.text].map(csv).join(','));
  }
  writeFileSync(join(draft, 'review-sample.csv'), rows.join('\n') + '\n');
  writeFileSync(join(draft, 'generation.json'), JSON.stringify({
    settings, keys: { writer: keySettings.writer, verifier: keySettings.verifier, rMin: keySettings.rMin }, questions: questions.length, items: items.length,
    tokensIn, tokensOut, costPaise: budget.spent, unpricedCalls: unpriced, budgetReached: budget.reached, report,
    sample: Object.fromEntries(sample),
  }, null, 2));
  console.log(`draft ${draft}: ${items.length} items from ${report.filter((r) => r.status === 'ok').length}/${questions.length} questions; ₹${(budget.spent / 100).toFixed(2)} spent; tokens in ${tokensIn} out ${tokensOut}${unpriced ? `; ${unpriced} calls unpriced` : ''}`);
  for (const r of report.filter((x) => x.status !== 'ok')) console.log(`  ${r.status}: ${r.question.slice(0, 60)} — ${r.detail}`);
  console.log(`review ${[...sample.values()].reduce((s, x) => s + x.length, 0)} sampled items in ${join(draft, 'review-sample.csv')}, then freeze`);
}

async function freeze() {
  const { freezeDecision, reviewSample } = await import('@/lib/hw/eval/review');
  const { parseManifest, writeDatasetVersion } = await import('@/lib/hw/eval/dataset');
  const draft = need('draft');
  const parsed = parseManifest(readFileSync(join(draft, 'items.jsonl'), 'utf8'));
  if ('problems' in parsed) throw new Error(`draft is invalid:\n  ${parsed.problems.join('\n  ')}`);
  const reviews = JSON.parse(readFileSync(need('reviews'), 'utf8'));
  const d = freezeDecision(parsed.items, reviews, reviewSample(parsed.items));
  if (!d.ok) throw new Error(`not frozen:\n  ${d.problems.join('\n  ')}`);
  const ref = need('dataset');
  const dir = writeDatasetVersion(arg('datasets-root', 'hw-evals/datasets')!, ref, d.keep);
  console.log(`dataset ${ref}: ${d.keep.length} items written to ${dir} (${d.rejected.length} rejected items dropped)`);
  if (flag('upload')) {
    const { uploadDatasetVersion } = await import('@/lib/hw/eval/r2');
    const keys = await uploadDatasetVersion(ref, dir);
    console.log(`uploaded ${keys.length} files under hw-assignments/evals/datasets/`);
  }
}

async function sheets() {
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { copySheetsHtml } = await import('@/lib/hw/eval/copy-sheets');
  const ref = need('dataset');
  const ds = loadDataset(arg('datasets-root', 'hw-evals/datasets')!, ref);
  const out = need('out');
  writeFileSync(out, copySheetsHtml(ds.items, { title: ref }));
  console.log(`copy sheets for ${ds.items.length} items: ${out} (open in a browser and print to PDF, A4)`);
}

const cmd = process.argv[2];
const run = cmd === 'generate' ? generate : cmd === 'freeze' ? freeze : cmd === 'sheets' ? sheets : null;
if (!run) {
  console.error('usage: hw-eval-mutate.ts generate|freeze|sheets …');
  process.exit(2);
}
run().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
