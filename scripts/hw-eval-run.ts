// Virat Evaluator — eval runner (docs/hw-eval/stage1-design.md §7).
//
//   npm run hw:eval -- --dataset <name@vN> (--config <file.json> | --profile R1,E-gemini,M1,K1) --mode read|key|mark|e2e \
//     --budget-inr <cap> [--repeat 5] [--resume <runId>] [--compare <runId>] [--concurrency 2] \
//     [--datasets-root hw-evals/datasets] [--runs-root hw-evals/runs] [--max-tasks N] [--upload] \
//     [--read-group N] [--force-escalation] [--split-image-tokens] [--only-language en|hi|mixed] [--log-requests <file.json>] [--label "…"] [--print-estimate]
//
// --profile takes profile ids from lib/hw/eval/profiles.ts (one per stage at most); a combination
// that breaks the family rules is refused. --read-group N reads N answers per call (production reads
// a whole submission per call). --force-escalation sends every answer to tier 2, to measure that
// step on its own. --log-requests keeps the first request sent for each step (images replaced by
// their size), so the parameters actually sent can be checked.
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

const CALL_OPTIONS = ['thinkingLevel', 'reasoningEffort', 'mediaResolution'] as const;
const optionsOf = (c: { thinkingLevel?: string; reasoningEffort?: string; mediaResolution?: string }) =>
  Object.fromEntries(CALL_OPTIONS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])) as Record<string, string>;

const Usage = z.object({ input: z.number().nonnegative(), output: z.number().nonnegative() });
const Config = z.object({
  provider: z.enum(['gemini', 'openrouter']),
  thinkingLevel: z.enum(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']).default('MINIMAL'),
  mediaResolution: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'),
  reader: z.object({ model: z.string().min(1), escalateModel: z.string().min(1).optional(), escalateBelow: z.number().min(0).max(1).default(0.7), unclearAbove: z.number().min(0).default(3) }),
  grader: z.object({ model: z.string().min(1), chunkSize: z.number().int().min(1).max(50).default(10) }),
  estimates: z.object({ read: Usage.optional(), gradePerAnswer: Usage.optional() }).default({}),
}).strict();

const runOptionsSeed = () => Number(arg('seed', '20261026'));

async function main() {
  const mode = need('mode') as 'read' | 'key' | 'mark' | 'e2e';
  if (!['read', 'key', 'mark', 'e2e'].includes(mode)) throw new Error(`unknown mode ${mode}`);
  const budgetInr = Number(need('budget-inr'));
  if (!(budgetInr > 0)) throw new Error('--budget-inr must be a positive number');
  const profileArg = arg('profile');
  if (!profileArg === !arg('config')) throw new Error('give exactly one of --config <file> and --profile <ids>');
  const { loadProfileSet, PROFILES } = await import('@/lib/hw/eval/profiles');
  let profileSet: ReturnType<typeof loadProfileSet> | null = null;
  let config: z.infer<typeof Config>;
  let tier1Options: Record<string, string> | undefined;
  let tier2Options: Record<string, string> | undefined;
  let gradeOptions: Record<string, string> | undefined;
  let batchPricing = { tier1: false, tier2: false, grade: false, keys: false };
  let onlyLanguage: 'en' | undefined;
  let valuePointsOnly = false;
  let strictMarking = false;
  let strictVersion: 1 | 2 = 1;
  let guards = false;
  if (profileArg) {
    const ids = profileArg.split(',').map((x) => x.trim()).filter(Boolean);
    const stageOf = (id: string) => PROFILES.find((p) => p.id === id)?.stage;
    const pick = (stage: string) => ids.filter((id) => stageOf(id) === stage);
    for (const id of ids) if (!stageOf(id)) throw new Error(`unknown profile "${id}" (known: ${PROFILES.map((p) => p.id).join(', ')})`);
    for (const st of ['reading', 'escalation', 'marking', 'keys']) if (pick(st).length > 1) throw new Error(`at most one ${st} profile per run, got ${pick(st).join(', ')}`);
    profileSet = loadProfileSet({ reading: pick('reading')[0] ?? 'R0', escalation: pick('escalation')[0], marking: pick('marking')[0] ?? 'M0', keys: pick('keys')[0] });
    const rd = profileSet.reading;
    const esc = profileSet.escalation;
    if (esc && 'vendor' in esc.call) throw new Error(`profile ${esc.id} cannot be run: ${esc.notRunnable}`);
    config = Config.parse({
      provider: rd.call.provider, thinkingLevel: rd.call.thinkingLevel ?? 'MINIMAL', mediaResolution: rd.call.mediaResolution ?? 'LOW',
      reader: { model: rd.call.model, ...(esc && !('vendor' in esc.call) ? { escalateModel: esc.call.model } : {}) },
      grader: { model: profileSet.marking.call.model, chunkSize: profileSet.marking.answersPerCall },
    });
    tier1Options = optionsOf(rd.call);
    tier2Options = esc && !('vendor' in esc.call) ? optionsOf(esc.call) : undefined;
    gradeOptions = optionsOf(profileSet.marking.call);
    batchPricing = { tier1: rd.batch, tier2: esc?.batch ?? false, grade: profileSet.marking.batch, keys: profileSet.keys?.batch ?? false };
    onlyLanguage = rd.onlyLanguage;
    valuePointsOnly = profileSet.marking.valuePointsOnly;
    strictMarking = Boolean(profileSet.marking.strict);
    strictVersion = profileSet.marking.strictVersion ?? 1;
    guards = Boolean(profileSet.marking.guards);
    // The guards also apply inside the library (evidence failures lower confidence): switch them on before the config is read.
    if (guards) process.env.HW_INSTRUCTION_GUARD_ENABLED = 'true';
  } else {
    config = Config.parse(JSON.parse(readFileSync(need('config'), 'utf8')));
  }
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
  const loaded = loadDataset(datasetsRoot, need('dataset'));
  // Consent gate (roadmap 3.1): a dataset version that holds an item of a person whose consent was withdrawn is not run; the next
  // version (hw-eval-consent exclude) is. --withdrawn takes the list exported by hw-eval-consent withdrawn; --consent-unchecked says
  // out loud that consent was not checked, and is recorded in the run.
  const { consentProblems } = await import('@/lib/hw/eval/consent-rules');
  const withdrawnFile = arg('withdrawn');
  const withdrawn = withdrawnFile ? new Set<string>((JSON.parse(readFileSync(withdrawnFile, 'utf8')) as { refs: string[] }).refs) : null;
  const consentIssues = consentProblems(loaded.items, withdrawn, { unchecked: flag('consent-unchecked') });
  if (consentIssues.length) throw new Error(`consent: ${consentIssues.join(' ')}`);
  const consentMeta = { checkedAgainstWithdrawnList: Boolean(withdrawn), unchecked: !withdrawn && loaded.items.some((i) => i.consent.ref) };
  // --only-language en|hi|mixed keeps one language (to price a language on its own); a profile such as R-luna can also require it.
  const langFilter = arg('only-language') ?? onlyLanguage;
  if (langFilter && !['en', 'hi', 'mixed'].includes(langFilter)) throw new Error('--only-language must be en, hi or mixed');
  const ds = langFilter ? { ...loaded, items: loaded.items.filter((i) => i.language === langFilter) } : loaded;
  if (langFilter) console.log(`only ${langFilter} items (${ds.items.length} of ${loaded.items.length})`);
  let keys = mode === 'key' ? keySettingsFromEnv() : undefined;
  if (keys && profileSet?.keys) {
    const k = profileSet.keys;
    keys = { ...keys, writer: { provider: k.writer.provider, model: k.writer.model, options: optionsOf(k.writer) }, verifier: { provider: k.verifier.provider, model: k.verifier.model, options: optionsOf(k.verifier) } };
  }
  const table = parsePriceTable(cfg.HW_PRICE_TABLE_JSON);
  if ('problem' in table) throw new Error(`${table.problem}: the budget cannot be enforced`);

  const effective = {
    provider: cfg.HW_AI_PROVIDER, thinkingLevel: cfg.HW_THINKING_LEVEL, mediaResolution: cfg.HW_READ_MEDIA_RESOLUTION,
    reader: config.reader, grader: config.grader, prompts: { read: READ_PROMPT_VERSION, grade: GRADE_PROMPT_VERSION },
    ...(profileSet ? { profiles: { ids: profileArg, tier1Options, tier2Options, gradeOptions, batchPricing, valuePointsOnly, onlyLanguage: onlyLanguage ?? null, strictMarking, ...(strictMarking && strictVersion === 2 ? { strictVersion } : {}), guards, keyWriter: profileSet.keys?.writer ?? null, keyVerifier: profileSet.keys?.verifier ?? null } } : {}),
    forceEscalation: flag('force-escalation'), readGroup: Number(arg('read-group', '1')), languageFilter: langFilter ?? null,
    keyConfigHash: keys ? keyConfigHash(keys, `${cfg.QDRANT_COLLECTION_NAME}|${cfg.HW_KEY_EMBED_MODEL}`) : null,
  };
  const configHash = sha256(canonicalJson(effective));
  let gitCommit = 'unknown';
  let gitDirty = true;
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    gitDirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;
  } catch { /* recorded as unknown */ }

  // What is actually sent: the first request of each step, with images replaced by their size.
  const logFile = arg('log-requests');
  const seen = new Map<string, unknown>();
  if (logFile) {
    const { setRequestObserver } = await import('@/lib/hw/ai/observe');
    setRequestObserver((r) => { const k = `${r.step ?? 'unlabelled'} (${r.provider}, ${r.path})`; if (!seen.has(k)) seen.set(k, r.body); });
  }
  const runId = arg('resume') ?? `run_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${randomBytes(4).toString('hex')}`;
  const est = (u: { input: number; output: number } | undefined, d: { input: number; output: number }) => ({ input: (u ?? d).input, cached: 0, output: (u ?? d).output });
  const deps = liveDeps(ds, {
    reader: {
      model: config.reader.model, escalateModel: config.reader.escalateModel, policy: { escalateBelow: config.reader.escalateBelow, unclearAbove: config.reader.unclearAbove },
      tier1Options, tier2Options, forceEscalation: flag('force-escalation'), batchPricing: { tier1: batchPricing.tier1, tier2: batchPricing.tier2 },
    },
    grader: { model: config.grader.model, options: gradeOptions, valuePointsOnly, batchPricing: batchPricing.grade, strict: strictMarking, strictVersion, guards },
    keyBatchPricing: batchPricing.keys,
    splitImageTokens: flag('split-image-tokens'),
    keys,
    keyCacheDir: keyCacheDirFor(runsRoot),
    priceTableJson: cfg.HW_PRICE_TABLE_JSON,
  });
  const runOptions = {
    runId, runsRoot, mode, repeat, budgetPaise: budgetInr * 100, concurrency: Number(arg('concurrency', '2')),
    gradeChunkSize: config.grader.chunkSize, readGroup: Number(arg('read-group', '1')), seed: Number(arg('seed', '20261026')), fixedGrouping: flag('fixed-grouping'),
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
      inrPerUsd: table.inr_per_usd, label: arg('label') ?? null, profiles: profileArg ?? null, seed: runOptionsSeed(), fixedGrouping: flag('fixed-grouping'), consent: consentMeta,
    },
  };
  {
    // The spend this run could reach, printed before any call is made (the budget cap still decides).
    const { planTasks } = await import('@/lib/hw/eval/runner');
    const plan = planTasks(ds, runOptions, new Set(), deps.price);
    const tasks = runOptions.maxTasks !== undefined ? plan.tasks.slice(0, runOptions.maxTasks) : plan.tasks;
    const projected = tasks.reduce((s, t) => s + t.projected, 0) / 100;
    console.log(`estimated spend (conservative reservations): up to ₹${projected.toFixed(2)} for ${tasks.length} tasks on ${ds.items.length} items; cap ₹${budgetInr}`);
    if (flag('print-estimate')) return;
  }
  const record = await runEval(ds, deps, runOptions);
  if (deps.stats?.retries) {
    console.log(`provider calls retried after a transient error: ${deps.stats.retries}`);
    record.meta = { ...record.meta, retries: deps.stats.retries };
    writeFileSync(join(runsRoot, runId, 'run.json'), JSON.stringify(record, null, 2));
  }

  const dir = join(runsRoot, runId);
  const rows = latestRows(readRows(join(dir, 'items.jsonl')));
  if (logFile) writeFileSync(logFile, JSON.stringify(Object.fromEntries(seen), null, 2));
  {
    const { stepTable, stepTableMarkdown } = await import('@/lib/hw/eval/cost-table');
    const answers = mode === 'key' ? rows.filter((r) => r.calls?.length).length : rows.filter((r) => r.status === 'ok').length;
    if (answers) {
      const steps = stepTable(rows, answers);
      writeFileSync(join(dir, 'cost-steps.json'), JSON.stringify({ answers, label: arg('label') ?? null, steps }, null, 2));
      console.log(`\ncost by step (${answers} ${mode === 'key' ? 'keys' : 'answers'})${arg('label') ? ` — ${arg('label')}` : ''}:\n${stepTableMarkdown(steps)}`);
    }
  }
  const summary = summariseRun(mode, rows, ds.items);
  writeFileSync(join(dir, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\nrun ${runId}: ${record.status}  (${mode} on ${record.dataset.ref}, ×${repeat})`);
  console.log(`rows: ${Object.entries(record.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`tokens in ${record.tokens.input} (cached ${record.tokens.cached}) out ${record.tokens.output}; cost ₹${(record.costPaise / 100).toFixed(2)} of ₹${budgetInr}`);
  if (record.meta.unpricedCalls) console.log(`WARNING: ${record.meta.unpricedCalls} calls could not be priced (${(record.meta.unpricedModels as string[]).join(', ')})`);
  if (summary.reading) console.log(`reading: CER ${summary.reading.cerCp.toFixed(4)} (graphemes ${summary.reading.cerG.toFixed(4)}; line breaks as spaces ${summary.reading.cerFlat.toFixed(4)}), WER ${summary.reading.wer.toFixed(4)}, invented ${summary.reading.inventedRate.toFixed(4)}, catastrophic ${summary.reading.catastrophicRate.toFixed(3)}, n=${summary.reading.n}${summary.reading.insufficient ? ' (insufficient data)' : ''}`);
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
