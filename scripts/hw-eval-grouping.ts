// Phase 1d, task 4: grouping effect. Reads the finished runs of `chainB` (label "phase1d t4 grouping gN (<profile>)": 3 groupings x 2
// runs per profile on one dataset) and reports, per profile, how many answers' marks moved across groupings by more than they vary
// inside one grouping, how much and in which direction, against the one-answer-per-call profile as the noise reference.
// Files only; no model is called. The rule is documented in lib/hw/eval/grouping.ts and was fixed before the runs.
//
//   npm run hw:eval:grouping -- --runs-root ../../hw-evals/cost1d/runs --dataset smallrun-b@v1 --reference M1-strict [--profiles M0-guarded,M0-strict,M1-strict] [--json out.json]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const runsRoot = arg('runs-root', '../../hw-evals/cost1d/runs')!;
  const datasetRef = arg('dataset', 'smallrun-b@v1')!;
  const reference = arg('reference', 'M1-strict')!;
  const profiles = (arg('profiles', 'M0-guarded,M0-strict,M1-strict')!).split(',');
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { readRows, latestRows } = await import('@/lib/hw/eval/runner');
  const { groupingMovement, summariseMovement, groupingVerdict } = await import('@/lib/hw/eval/grouping');
  const ds = loadDataset(arg('datasets-root', '../../hw-evals/datasets')!, datasetRef);

  type Rec = { status: string; dataset: { ref: string }; meta: { label?: string } };
  const runs = readdirSync(runsRoot).filter((d) => existsSync(join(runsRoot, d, 'run.json'))).map((d) => ({
    d, rec: JSON.parse(readFileSync(join(runsRoot, d, 'run.json'), 'utf8')) as Rec, rows: latestRows(readRows(join(runsRoot, d, 'items.jsonl'))),
  })).filter((r) => r.rec.dataset.ref === datasetRef);

  const summaries: Record<string, ReturnType<typeof summariseMovement> & { incomplete: number; answers: unknown[] }> = {};
  for (const p of profiles) {
    const byG = [1, 2, 3].map((g) => runs.filter((r) => r.rec.meta.label === `phase1d t4 grouping g${g} (${p})`).flatMap((r) => r.rows));
    if (byG.some((g) => !g.length)) { console.log(`\n### ${p}: runs for ${byG.map((g, i) => (g.length ? '' : `grouping ${i + 1} `)).join('')}missing`); continue; }
    const m = groupingMovement(byG, ds.items);
    const sum = summariseMovement(m.answers);
    summaries[p] = { ...sum, incomplete: m.incomplete, answers: m.answers };
    console.log(`\n### ${p} (3 groupings x 2 runs, ${ds.items.length} answers; ${m.incomplete} left out because a run has no mark for them)`);
    console.log(`- answers whose marks moved across groupings by more than within one grouping: ${sum.moved} of ${sum.n} (${sum.n ? ((100 * sum.moved) / sum.n).toFixed(1) : 'n/a'}%)`);
    console.log(`- size of the move: ${Object.entries(sum.sizes).map(([k, v]) => `${k}: ${v}`).join('; ') || 'none'}`);
    console.log(`- direction: the higher-marked grouping was nearer the expected mark in ${sum.highNearer}, the lower in ${sum.lowNearer}; groupings disagreed about giving exactly the expected mark in ${sum.splitOnExpected}`);
  }
  if (summaries[reference]) {
    for (const p of profiles.filter((x) => x !== reference && summaries[x])) {
      const v = groupingVerdict(summaries[p], summaries[reference]);
      console.log(`\n${p} against the noise reference ${reference}: ${summaries[p].moved}/${summaries[p].n} moved against ${summaries[reference].moved}/${summaries[reference].n}; one-sided Fisher p = ${v.p.toFixed(3)}; grouping-sensitive by the pre-registered rule (more than the reference and p <= 0.10): ${v.sensitive ? 'YES' : 'no'}`);
    }
  }
  const out = arg('json');
  if (out) writeFileSync(out, JSON.stringify(summaries, null, 2));
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
