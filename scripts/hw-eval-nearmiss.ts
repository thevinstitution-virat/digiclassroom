// Phase 1d, task 2.1: heldout-1d@v1 = every item of heldout-1c@v1 (unchanged) + near-miss variants (the right idea with exactly
// one wrong detail), written by a model from a family different from both graders.
//
//   npm run hw:eval:nearmiss -- --base heldout-1c@v1 --dataset heldout-1d@v1 --draft ../../hw-evals/heldout-1d/draft \
//        --budget-inr 10 [--per-question 2] [--mutator-model anthropic/claude-haiku-5.5] [--print-estimate]
//
// Selection rule (fixed before any marking result of this phase existed): for every question of the base set, the first N
// (default 2) key points of kind key_point, in key order, each get one near miss. Nothing is chosen by looking at a grader.
// The set is labelled NOT PERSON-CHECKED. The draft folder keeps each near miss's before/after segment and the change made.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const { _resetHwConfig, getHwConfig } = await import('@/lib/hw/config');
  _resetHwConfig();
  const { loadDataset, newItemId, writeDatasetVersion } = await import('@/lib/hw/eval/dataset');
  const { nearMissesFor, NEAR_MISS_PROMPT_VERSION } = await import('@/lib/hw/eval/near-miss');
  const { DEFAULT_MUTATION_MODEL, PROFILES } = await import('@/lib/hw/eval/profiles');
  const { Budget } = await import('@/lib/hw/eval/runner');
  const { generateWith } = await import('@/lib/hw/ai');
  const { estimateCost, parsePriceTable } = await import('@/lib/hw/cost/pricing');

  const base = loadDataset(arg('datasets-root', '../../hw-evals/datasets')!, arg('base', 'heldout-1c@v1')!);
  const target = arg('dataset', 'heldout-1d@v1')!;
  const draft = arg('draft', '../../hw-evals/heldout-1d/draft')!;
  const perQuestion = Number(arg('per-question', '2'));
  const mutator = { provider: 'openrouter' as const, model: arg('mutator-model', DEFAULT_MUTATION_MODEL)! };
  const graderModels = [...new Set(PROFILES.filter((p) => p.stage === 'marking').map((p) => (p as { call: { model: string } }).call.model))];
  const table = parsePriceTable(getHwConfig().HW_PRICE_TABLE_JSON);
  if ('problem' in table) throw new Error(`${table.problem}: the budget cannot be enforced`);
  const priceOf = (model: string, usage: { input: number; cached: number; output: number }, costUsd?: number) => {
    if (costUsd !== undefined) return costUsd * table.inr_per_usd * 100;
    const c = estimateCost(table, model, usage, { batch: false });
    return c.problem ? null : c.paise;
  };

  const originals = base.items.filter((i) => i.mutation?.type === 'original');
  const projectOne = priceOf(mutator.model, { input: (1 + perQuestion) * 1800, cached: 0, output: (1 + perQuestion) * 450 });
  if (projectOne === null) throw new Error(`no price for ${mutator.model}: the budget cannot be enforced`);
  const budgetInr = Number(arg('budget-inr', '10'));
  console.log(`estimated spend: up to ₹${((projectOne * originals.length) / 100).toFixed(2)} for ${originals.length} questions x (1 split + ${perQuestion} rewrites) on ${mutator.model}; cap ₹${budgetInr}; graders to stay clear of: ${graderModels.join(', ')}`);
  if (flag('print-estimate')) return;

  const budget = new Budget(budgetInr * 100);
  const added = [];
  const report: { question: string; made: number; skipped: unknown[] }[] = [];
  let spentPaise = 0;
  for (const o of originals) {
    if (!budget.reserve(projectOne)) { report.push({ question: o.question.id, made: 0, skipped: [{ reason: 'budget reached' }] }); continue; }
    let spent = 0;
    try {
      const r = await nearMissesFor(o, newItemId, { mutator, graderModels, perQuestion }, generateWith);
      spent = r.calls.reduce((s, c) => s + (priceOf(c.model, c.usage, c.costUsd) ?? 0), 0);
      added.push(...r.drafts);
      report.push({ question: o.question.id, made: r.drafts.length, skipped: r.skipped });
    } catch (e) {
      report.push({ question: o.question.id, made: 0, skipped: [{ reason: e instanceof Error ? e.message : String(e) }] });
    } finally {
      budget.settle(projectOne, spent);
      spentPaise += spent;
    }
  }

  mkdirSync(draft, { recursive: true });
  if (existsSync(join(draft, 'near-miss.json'))) throw new Error(`${draft}/near-miss.json already exists; use a new folder`);
  writeFileSync(join(draft, 'near-miss.json'), JSON.stringify({
    base: base.name + '@' + base.version, promptVersion: NEAR_MISS_PROMPT_VERSION, mutator, perQuestion,
    nearMisses: added.map((d) => ({ id: d.item.id, question: d.item.question.id, target: d.item.mutation!.target, kind: d.kind, changed: d.changed, before: d.before, after: d.after })),
    report, costPaise: spentPaise,
  }, null, 2), { flag: 'wx' });

  const dir = writeDatasetVersion(arg('datasets-root', '../../hw-evals/datasets')!, target, [...base.items, ...added.map((d) => d.item)]);
  writeFileSync(join(dir, 'NOT_PERSON_CHECKED.txt'), `Every item of ${base.name}@${base.version} unchanged, plus ${added.length} near-miss variants (the right idea with exactly one wrong detail) written by ${mutator.model} (${NEAR_MISS_PROMPT_VERSION}). The variants and their expected marks have NOT been checked by a person.\n`);
  const hi = added.filter((d) => d.item.language === 'hi').length;
  console.log(`${added.length} near misses (${hi} in Hindi) added to ${base.items.length} items -> ${target} at ${dir}; ₹${(spentPaise / 100).toFixed(2)} spent`);
  for (const r of report.filter((x) => x.skipped.length)) console.log(`  ${r.question}: ${JSON.stringify(r.skipped)}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
