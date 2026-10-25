// Virat Evaluator — eval runner (docs/hw-eval/stage1-design.md §7).
//
//   npm run hw:eval -- --dataset <name@vN> --config <file.json> --mode read|key|mark|e2e \
//     --budget-inr <cap> [--repeat 5] [--resume <runId>] [--compare <runId>] [--concurrency 2] \
//     [--datasets-root hw-evals/datasets] [--runs-root hw-evals/runs] [--max-tasks N] [--upload]
//
// (from apps/api; or from the repo root:
//   npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local scripts/hw-eval-run.ts …)
//
// Config file (everything that defines the system under test; hashed into the run):
//   {
//     "provider": "gemini" | "openrouter",
//     "thinkingLevel": "MINIMAL", "mediaResolution": "LOW",
//     "reader": { "model": "…", "escalateModel": "…", "escalateBelow": 0.7, "unclearAbove": 3 },
//     "grader": { "model": "…", "chunkSize": 10 },
//     "estimates": { "read": {"input": 2700, "output": 900}, "gradePerAnswer": {"input": 700, "output": 350} }   (optional)
//   }
// Key mode reads the key settings from HW_KEY_* (HW_KEY_R_MIN must be calibrated).
//
// Never touches a database. Run files go to <runs-root>/<runId>/ (run.json, items.jsonl,
// summary.json); --upload copies them to R2 under hw-assignments/evals/runs/<runId>/.

import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

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

const Usage = z.object({ input: z.number().nonnegative(), output: z.number().nonnegative() });
const Config = z.object({
  provider: z.enum(['gemini', 'openrouter']),
  thinkingLevel: z.enum(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).default('MINIMAL'),
  mediaResolution: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  reader: z.object({ model: z.string().min(1), escalateModel: z.string().min(1).optional(), escalateBelow: z.number().min(0).max(1).default(0.7), unclearAbove: z.number().min(0).default(3) }),
  grader: z.object({ model: z.string().min(1), chunkSize: z.number().int().min(1).max(50).default(10) }),
  estimates: z.object({ read: Usage.optional(), gradePerAnswer: Usage.optional() }).default({}),
}).strict();

async function main() {
  const mode = need('mode') as 'read' | 'key' | 'mark' | 'e2e';
  if (!['read', 'key', 'mark', 'e2e'].includes(mode)) throw new Error(`unknown mode ${mode}`);
  const budgetInr = Number(need('budget-inr'));
  if (!(budgetInr > 0)) throw new Error('--budget-inr must be a positive number');
  const config = Config.parse(JSON.parse(readFileSync(need('config'), 'utf8')));
  const repeat = Number(arg('repeat', '1'));
  const datasetsRoot = arg('datasets-root', 'hw-evals/datasets')!;
  const runsRoot = arg('runs-root', 'hw-evals/runs')!;

  // The configuration under test is applied to the feature's settings before anything loads them.
  process.env.HW_AI_PROVIDER = config.provider;
  process.env.HW_THINKING_LEVEL = config.thinkingLevel;
  process.env.HW_READ_MEDIA_RESOLUTION = config.mediaResolution;

  const { _resetHwConfig, getHwConfig } = await import('@/lib/hw/config');
  _resetHwConfig();
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { runEval, readRows, latestRows } = await import('@/lib/hw/eval/runner');
  const { liveDeps, keyCacheDirFor } = await import('@/lib/hw/eval/live-deps');
  const { summariseRun, compareSummaries, changedItems } = await import('@/lib/hw/eval/summary');
  const { canonicalJson, sha256 } = await import('@/lib/hw/keys/cache');
  const { keyConfigHash, keySettingsFromEnv } = await import('@/lib/hw/keys');
  const { READ_PROMPT_VERSION } = await import('@/lib/hw/prompts/read.v1');
  const { GRADE_PROMPT_VERSION } = await import('@/lib/hw/prompts/grade.v1');
  const { parsePriceTable } = await import('@/lib/hw/cost/pricing');

  const cfg = getHwConfig();
  const ds = loadDataset(datasetsRoot, need('dataset'));
  const keys = mode === 'key' ? keySettingsFromEnv() : undefined;
  const table = parsePriceTable(cfg.HW_PRICE_TABLE_JSON);
  if ('problem' in table) throw new Error(`${table.problem}: the budget cannot be enforced`);

  const effective = {
    provider: cfg.HW_AI_PROVIDER, thinkingLevel: cfg.HW_THINKING_LEVEL, mediaResolution: cfg.HW_READ_MEDIA_RESOLUTION,
    reader: config.reader, grader: config.grader, prompts: { read: READ_PROMPT_VERSION, grade: GRADE_PROMPT_VERSION },
    keyConfigHash: keys ? keyConfigHash(keys, `${cfg.QDRANT_COLLECTION_NAME}|${cfg.HW_KEY_EMBED_MODEL}`) : null,
  };
  const configHash = sha256(canonicalJson(effective));
  let gitCommit = 'unknown';
  let gitDirty = true;
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    gitDirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
  } catch { /* recorded as unknown */ }

  const runId = arg('resume') ?? `run_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${randomBytes(4).toString('hex')}`;
  const est = (u: { input: number; output: number } | undefined, d: { input: number; output: number }) => ({ input: (u ?? d).input, cached: 0, output: (u ?? d).output });
  const record = await runEval(ds, liveDeps(ds, {
    reader: { model: config.reader.model, escalateModel: config.reader.escalateModel, policy: { escalateBelow: config.reader.escalateBelow, unclearAbove: config.reader.unclearAbove } },
    grader: { model: config.grader.model },
    keys,
    keyCacheDir: keyCacheDirFor(runsRoot),
    priceTableJson: cfg.HW_PRICE_TABLE_JSON,
  }), {
    runId, runsRoot, mode, repeat, budgetPaise: budgetInr * 100, concurrency: Number(arg('concurrency', '2')),
    gradeChunkSize: config.grader.chunkSize, seed: 20261026,
    maxTasks: arg('max-tasks') ? Number(arg('max-tasks')) : undefined,
    estimates: {
      // Reading may escalate, so its estimate covers more than one tier-1 call.
      read: { model: config.reader.escalateModel ?? config.reader.model, usage: est(config.estimates.read, { input: 2700, output: 900 }) },
      grade: { model: config.grader.model, usage: est(config.estimates.gradePerAnswer, { input: 700, output: 350 }) },
      key: keys ? [
        { model: keys.writer.model, usage: { input: 5000, cached: 0, output: 900 } },
        { model: keys.verifier.model, usage: { input: 4000, cached: 0, output: 400 } },
      ] : [],
    },
    meta: {
      configHash, config: effective, gitCommit, gitDirty, node: process.version, unicode: process.versions.unicode, icu: process.versions.icu,
      inrPerUsd: table.inr_per_usd,
    },
  });

  const dir = join(runsRoot, runId);
  const rows = latestRows(readRows(join(dir, 'items.jsonl')));
  const summary = summariseRun(mode, rows, ds.items);
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\nrun ${runId}: ${record.status}  (${mode} on ${record.dataset.ref}, ×${repeat})`);
  console.log(`rows: ${Object.entries(record.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`tokens in ${record.tokens.input} (cached ${record.tokens.cached}) out ${record.tokens.output}; cost ₹${(record.costPaise / 100).toFixed(2)} of ₹${budgetInr}`);
  if (record.meta.unpricedCalls) console.log(`WARNING: ${record.meta.unpricedCalls} calls could not be priced (${(record.meta.unpricedModels as string[]).join(', ')})`);
  if (summary.reading) console.log(`reading: CER ${summary.reading.cerCp.toFixed(4)} (graphemes ${summary.reading.cerG.toFixed(4)}), WER ${summary.reading.wer.toFixed(4)}, invented ${summary.reading.inventedRate.toFixed(4)}, catastrophic ${summary.reading.catastrophicRate.toFixed(3)}, n=${summary.reading.n}${summary.reading.insufficient ? ' (insufficient data)' : ''}`);
  if (summary.marking) {
    for (const g of summary.marking.qwkByMax) console.log(`marking M=${g.maxMarks}: QWK ${g.qwk.toFixed(3)} [${g.ci.lower.toFixed(3)}, ${g.ci.upper.toFixed(3)}], n=${g.n}`);
    console.log(`marking: normalised MAE ${summary.marking.normalisedMae.toFixed(3)}, exact ${summary.marking.exact.toFixed(3)}, bias ${summary.marking.bias.toFixed(3)}, large errors ${summary.marking.largeErrorRate.toFixed(3)}${summary.marking.insufficient ? ' (insufficient data)' : ''}`);
  }
  if (summary.mutations) console.log(`mutations: detection ${summary.mutations.detection.toFixed(3)}, false credit ${summary.mutations.falseCredit.toFixed(3)}, invariance ${summary.mutations.invariance.toFixed(3)}, injection ${summary.mutations.injection.toFixed(3)}`);
  if (summary.readingEffect) console.log(`reading-error effect on MAE: ${summary.readingEffect.estimate.toFixed(3)} [${summary.readingEffect.lower.toFixed(3)}, ${summary.readingEffect.upper.toFixed(3)}]`);
  if (summary.repeatability) console.log(`repeatability: all identical ${summary.repeatability.allIdentical.toFixed(3)}, ICC ${summary.repeatability.icc.toFixed(3)}, spread ${summary.repeatability.meanSpread.toFixed(3)}`);
  if (summary.keys) console.log(`keys: ${summary.keys.grounded}/${summary.keys.questions} grounded, invalid ${summary.keys.invalid}, partial ${summary.keys.partial}, no_grounding ${JSON.stringify(summary.keys.noGrounding)}`);

  const baseline = arg('compare');
  if (baseline) {
    const bdir = join(runsRoot, baseline);
    if (!existsSync(join(bdir, 'run.json'))) throw new Error(`baseline run ${baseline} not found in ${runsRoot}`);
    const brun = JSON.parse(readFileSync(join(bdir, 'run.json'), 'utf8')) as { mode: string; dataset: { manifestSha256: string } };
    if (brun.mode !== mode || brun.dataset.manifestSha256 !== ds.manifestSha256) throw new Error('compare needs the same mode and the same dataset version');
    const brows = latestRows(readRows(join(bdir, 'items.jsonl')));
    const deltas = compareSummaries(summariseRun(mode, brows, ds.items), summary);
    const changed = changedItems(brows, rows);
    writeFileSync(join(dir, `compare-${baseline}.json`), JSON.stringify({ baseline, candidate: runId, deltas, changed }, null, 2));
    console.log(`\ncompared with ${baseline}:`);
    for (const d of deltas) {
      const worse = d.worseWhen === 'higher' ? d.delta > 0 : d.delta < 0;
      console.log(`  ${d.metric.padEnd(30)} ${d.baseline.toFixed(4)} -> ${d.candidate.toFixed(4)}  (${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(4)})${worse && d.delta !== 0 ? '  worse' : ''}`);
    }
    console.log(`  ${changed.length} items changed total`);
  }

  if (flag('upload')) {
    const { uploadRun } = await import('@/lib/hw/eval/r2');
    const keysUp = await uploadRun(runId, dir);
    console.log(`uploaded ${keysUp.length} files under hw-assignments/evals/runs/${runId}/`);
  }
  if (record.status === 'budget_reached') console.log(`\nbudget reached: resume with --resume ${runId} and a higher --budget-inr`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
