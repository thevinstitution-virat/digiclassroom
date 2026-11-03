// Phase 1d: the marks of finished strict-marking runs under each partial-credit rule, recomputed from the stored verdicts.
// No model is called and nothing is spent.
//
//   npm run hw:eval:rules -- --runs-root ../../hw-evals/cost1d/runs --datasets-root ../../hw-evals/datasets \
//        [--run run_a,run_b | --label "phase1d" ] [--dataset heldout-1d@v1] [--json out.json]
//
// Runs are grouped by profile and dataset (repeats and several run folders are pooled). For each group and each rule:
// detection (mark-removing variants other than near misses), false credit, false deductions on paraphrase and spelling items,
// agreement with the expected marks on near-miss items, and what the grader decided for wrong-fact variants (the credit a
// "half" or "full" rule would leak).

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const runsRoot = arg('runs-root', '../../hw-evals/cost1d/runs')!;
  const datasetsRoot = arg('datasets-root', '../../hw-evals/datasets')!;
  const label = arg('label', '')!;
  const only = arg('run')?.split(',').map((x) => x.trim());
  const wantDataset = arg('dataset');
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { readRows, latestRows } = await import('@/lib/hw/eval/runner');
  const { PARTIAL_RULES, ruleTable, verdictsOnTarget, sumCounts } = await import('@/lib/hw/eval/partial-credit-report');
  const { pct } = await import('@/lib/hw/eval/marking-report');
  const classesFile = arg('classes', '../../docs/hw-eval/wrong-fact-classes-1d.json')!;
  const classes = existsSync(classesFile) ? (JSON.parse(readFileSync(classesFile, 'utf8')) as { reversed: string[]; replaced: string[]; smoke: { reversed: string[]; replaced: string[] } }) : null;

  type Rec = { mode: string; status: string; repeat: number; dataset: { ref: string }; meta: { label?: string; profiles?: string } };
  const runs = readdirSync(runsRoot).filter((d) => existsSync(join(runsRoot, d, 'run.json'))).filter((d) => !only || only.includes(d)).map((d) => {
    const rec = JSON.parse(readFileSync(join(runsRoot, d, 'run.json'), 'utf8')) as Rec;
    return { d, rec, rows: latestRows(readRows(join(runsRoot, d, 'items.jsonl'))) };
  }).filter((r) => r.rec.mode === 'mark' && (!wantDataset || r.rec.dataset.ref === wantDataset) && (r.rec.meta.label ?? '').includes(label) && ['completed', 'budget_reached'].includes(r.rec.status));
  if (!runs.length) throw new Error('no completed mark-mode run matches');

  const groups = new Map<string, typeof runs>();
  for (const r of runs) groups.set(`${r.rec.meta.profiles}|${r.rec.dataset.ref}`, [...(groups.get(`${r.rec.meta.profiles}|${r.rec.dataset.ref}`) ?? []), r]);
  const json: unknown[] = [];
  for (const [key, rs] of [...groups].sort()) {
    const [profile, ref] = key.split('|');
    const ds = loadDataset(datasetsRoot, ref);
    const rows = rs.flatMap((r) => r.rows).filter((r) => r.status === 'ok');
    // A repeat number may recur across run folders; keep them apart.
    const keyed = rs.flatMap((r, i) => r.rows.map((x) => ({ ...x, repeat: x.repeat + i * 1000 }))).filter((r) => r.status === 'ok');
    console.log(`\n### ${profile} on ${ref}: ${rs.length} run folder(s), ${rows.length} marked answers, ${rows.filter((r) => r.mark?.points.some((p) => p.fact)).length} with stored verdicts`);
    console.log('| Rule | Detection | False credit (marks given back / removed) | False deductions, paraphrase and spelling (answers) | Near-miss: the point has its expected marks | Near-miss: the total is the expected total | Injections resisted | Exact total |\n|---|---|---|---|---|---|---|---|');
    const tables = PARTIAL_RULES.map((rule) => ruleTable(keyed, ds.items, rule));
    for (const t of tables) {
      console.log(`| ${t.rule} | ${pct(t.detection, 1)} | ${t.falseCredit.given.toFixed(1)} / ${t.falseCredit.removed.toFixed(1)} (${t.falseCredit.removed ? ((100 * t.falseCredit.given) / t.falseCredit.removed).toFixed(1) : 'n/a'}%) | ${pct(t.falseDeductions.answers, 1)} | ${pct(t.nearMissPoint, 1)} | ${pct(t.nearMissTotal, 1)} | ${pct(t.injection, 1)} | ${pct(t.exactTotal, 1)} |`);
    }
    const w = verdictsOnTarget(keyed, ds.items, 'wrong_fact');
    const n = sumCounts(w);
    console.log(`- wrong-fact variants, verdict on the changed point (${n} judgements): different_fact ${w.different_fact}, right_idea_wrong_detail ${w.right_idea_wrong_detail} (${n ? ((100 * w.right_idea_wrong_detail) / n).toFixed(1) : 'n/a'}%), same_fact ${w.same_fact}, absent ${w.absent}${w.none ? `, no stored verdict ${w.none}` : ''}`);
    // The leak that matters: a REVERSED fact (the variant says the opposite) marked right_idea_wrong_detail, which half or full would pay for.
    const cls = classes ? (ref.startsWith('smallrun') ? classes.smoke : classes) : null;
    if (cls) {
      for (const [name, ids] of [['reversed', cls.reversed], ['replaced', cls.replaced]] as const) {
        const c = verdictsOnTarget(keyed, ds.items, 'wrong_fact', new Set(ids));
        const k = sumCounts(c);
        if (k) console.log(`  - ${name} (${ids.filter((x: string) => ds.items.some((i: { id: string }) => i.id === x)).length} variants, ${k} judgements): different_fact ${c.different_fact}, right_idea_wrong_detail ${c.right_idea_wrong_detail} (${((100 * c.right_idea_wrong_detail) / k).toFixed(1)}%), same_fact ${c.same_fact}, absent ${c.absent}`);
      }
    }
    const nm = verdictsOnTarget(keyed, ds.items, 'near_miss');
    if (sumCounts(nm)) console.log(`- near-miss variants, verdict on the changed point (${sumCounts(nm)} judgements): right_idea_wrong_detail ${nm.right_idea_wrong_detail}, different_fact ${nm.different_fact}, same_fact ${nm.same_fact}, absent ${nm.absent}${nm.none ? `, no stored verdict ${nm.none}` : ''}`);
    json.push({ profile, dataset: ref, runs: rs.map((r) => r.d), answers: rows.length, tables, wrongFact: w, nearMiss: nm });
  }
  const out = arg('json');
  if (out) writeFileSync(out, JSON.stringify(json, null, 2));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
