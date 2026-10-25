// Virat Evaluator — regression gate. Required before merging any change to reader or grader
// prompts, models, routes or key generation (docs/hw-eval/regression.md).
//
//   npm run hw:eval:regression -w apps/api -- --dataset regression@v1 --config candidate.json \
//     --baseline <runId> --budget-inr 300 [--mode e2e] [--from-r2] [--datasets-root …] [--runs-root …]
//
// Runs the candidate configuration on the frozen regression set (scripts/hw-eval-run.ts),
// compares it with the baseline run, and exits 1 if any headline metric is worse than the
// tolerance (QWK −0.02, normalised MAE +0.05, CER +1 point, injection < 100%).
// --from-r2 first downloads the dataset version and the baseline run from
// hw-assignments/evals/ (for CI); nothing is ever uploaded unless --upload is passed.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
function need(name: string): string {
  const v = arg(name);
  if (!v) { console.error(`--${name} is required`); process.exit(2); }
  return v;
}

async function download(prefix: string, toDir: string): Promise<number> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const { r2Client } = await import('@/lib/services/r2');
  const { getHwObject } = await import('@/lib/hw/storage/r2');
  let token: string | undefined;
  let n = 0;
  do {
    const r = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: prefix, ContinuationToken: token }));
    for (const o of r.Contents ?? []) {
      const rel = o.Key!.slice(prefix.length);
      if (!rel || rel.includes('..')) continue;
      const to = join(toDir, rel);
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, await getHwObject(o.Key!));
      n++;
    }
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return n;
}

async function main() {
  const { parseDatasetRef, EVAL_PREFIX } = await import('@/lib/hw/eval/dataset');
  const { regressionChecks, regressionPasses } = await import('@/lib/hw/eval/regression');
  const ref = need('dataset');
  const { name, version } = parseDatasetRef(ref);
  const baseline = need('baseline');
  const datasetsRoot = arg('datasets-root', 'hw-evals/datasets')!;
  const runsRoot = arg('runs-root', 'hw-evals/runs')!;
  const mode = arg('mode', 'e2e')!;

  if (process.argv.includes('--from-r2')) {
    const dsDir = join(datasetsRoot, name, version);
    if (!existsSync(join(dsDir, 'manifest.jsonl'))) console.log(`downloaded ${await download(`${EVAL_PREFIX}datasets/${name}/${version}/`, dsDir)} dataset files`);
    const bDir = join(runsRoot, baseline);
    if (!existsSync(join(bDir, 'summary.json'))) console.log(`downloaded ${await download(`${EVAL_PREFIX}runs/${baseline}/`, bDir)} baseline run files`);
  }
  const bRun = JSON.parse(readFileSync(join(runsRoot, baseline, 'run.json'), 'utf8')) as { mode: string; dataset: { ref: string } };
  if (bRun.mode !== mode || bRun.dataset.ref !== ref) throw new Error(`baseline ${baseline} is ${bRun.mode} on ${bRun.dataset.ref}, not ${mode} on ${ref}`);

  const runId = `run_regr_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${randomBytes(3).toString('hex')}`;
  // Paths from this script's own folder, so it works from the repo root and from apps/api (npm -w).
  // The child inherits this process's environment, so the env file loaded here applies to it too.
  const scriptDir = dirname(resolve(process.argv[1]));
  const args = ['tsx', '--tsconfig', arg('tsconfig', join(scriptDir, '..', 'apps', 'api', 'tsconfig.json'))!, join(scriptDir, 'hw-eval-run.ts'),
    '--dataset', ref, '--config', need('config'), '--mode', mode, '--budget-inr', need('budget-inr'), '--resume', runId, '--compare', baseline,
    '--datasets-root', datasetsRoot, '--runs-root', runsRoot, ...(process.argv.includes('--upload') ? ['--upload'] : [])];
  const r = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`the candidate run failed (exit ${r.status})`);
  const run = JSON.parse(readFileSync(join(runsRoot, runId, 'run.json'), 'utf8')) as { status: string };
  if (run.status !== 'completed') throw new Error(`the candidate run is ${run.status}; a partial run cannot pass the gate`);

  const checks = regressionChecks(
    JSON.parse(readFileSync(join(runsRoot, baseline, 'summary.json'), 'utf8')),
    JSON.parse(readFileSync(join(runsRoot, runId, 'summary.json'), 'utf8')),
  );
  const ok = regressionPasses(checks);
  writeFileSync(join(runsRoot, runId, 'regression.json'), JSON.stringify({ baseline, candidate: runId, ok, checks }, null, 2));
  console.log(`\nregression gate: ${ok ? 'PASS' : 'FAIL'} (candidate ${runId} vs baseline ${baseline})`);
  for (const c of checks) console.log(`  ${c.ok ? '✓' : '✗'} ${c.metric.padEnd(22)} ${c.baseline.toFixed(4)} -> ${Number.isFinite(c.candidate) ? c.candidate.toFixed(4) : 'not measured'} (${c.limit})`);
  if (!checks.length) console.log('  no headline metrics in the baseline: nothing to compare (fails)');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
