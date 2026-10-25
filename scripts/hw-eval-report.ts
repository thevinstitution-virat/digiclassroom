// Virat Evaluator — report from one or more runs on the same dataset version.
//
//   npm run hw:eval:report -w apps/api -- --dataset demo@v2 --runs run_a,run_b [--out hw-evals/reports/demo-v2] \
//     [--title "…"] [--reference export.json] [--datasets-root …] [--runs-root …]
//
// Writes report.md, report.html, groups.csv and public-summary.md. The teacher baseline comes
// from the dataset version's reference/raters.json; key audits and support from --reference
// (the evaluation page's export) and the key run, when given.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
function need(name: string): string {
  const v = arg(name);
  if (!v) { console.error(`--${name} is required`); process.exit(2); }
  return v;
}

async function main() {
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { latestRows, readRows } = await import('@/lib/hw/eval/runner');
  const { buildReport, renderCsv, renderHtml, renderMarkdown, renderPublicSummary } = await import('@/lib/hw/eval/report');
  type RunRecord = import('@/lib/hw/eval/runner').RunRecord;

  const ref = need('dataset');
  const ds = loadDataset(arg('datasets-root', 'hw-evals/datasets')!, ref);
  const runsRoot = arg('runs-root', 'hw-evals/runs')!;
  const runs = need('runs').split(',').map((id) => id.trim()).filter(Boolean).map((id) => {
    const record = JSON.parse(readFileSync(join(runsRoot, id, 'run.json'), 'utf8')) as RunRecord;
    if (record.dataset.manifestSha256 !== ds.manifestSha256) throw new Error(`run ${id} is on another dataset version (${record.dataset.ref})`);
    return { record, rows: latestRows(readRows(join(runsRoot, id, 'items.jsonl'))) };
  });
  const ratersFile = join(ds.dir, 'reference', 'raters.json');
  const reference = arg('reference') ? JSON.parse(readFileSync(arg('reference')!, 'utf8')) : null;
  const keySupport: Record<string, 'supported' | 'partial'> = {};
  for (const { record, rows } of runs) {
    if (record.mode !== 'key') continue;
    for (const r of rows) {
      const it = ds.items.find((x) => x.id === r.itemId);
      if (it?.key && r.key?.status === 'grounded') keySupport[it.key.keyId] = r.key.partial ? 'partial' : 'supported';
    }
  }
  const model = buildReport({
    title: arg('title', `Virat Evaluator report: ${ref}`)!, datasetRef: ref, manifestSha256: ds.manifestSha256, items: ds.items, runs,
    raters: existsSync(ratersFile) ? JSON.parse(readFileSync(ratersFile, 'utf8')) : undefined,
    keyAudits: reference?.keyAudits, keySupport: Object.keys(keySupport).length ? keySupport : undefined,
  });
  const out = arg('out', join('hw-evals', 'reports', `${ds.name}-${ds.version}`))!;
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'report.md'), renderMarkdown(model));
  writeFileSync(join(out, 'report.html'), renderHtml(model));
  writeFileSync(join(out, 'groups.csv'), renderCsv(model));
  writeFileSync(join(out, 'public-summary.md'), renderPublicSummary(model));
  const verdicts = model.gates.reduce<Record<string, number>>((m, g) => ({ ...m, [g.verdict]: (m[g.verdict] ?? 0) + 1 }), {});
  console.log(`report for ${ref} from ${runs.length} run(s): ${out}`);
  console.log(`gates: ${Object.entries(verdicts).map(([k, v]) => `${k} ${v}`).join(', ') || 'not evaluated (no marking run)'}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
