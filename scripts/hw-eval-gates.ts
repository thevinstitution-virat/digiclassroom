// Gate results into the control room (roadmap 5.3 and 5.5). One command:
//
//   import: read the report.json that `npm run hw:eval:report` wrote and store its runs and gate rows, unchanged, in the database. The
//           screens then show exactly these numbers. A report cannot know two things, so they are given here:
//             --scheme-source board_scheme_key|passage_key|textbook_key|teacher_rubric   what the dataset's questions' marking schemes were
//                             (the older names textbook, board_paper and custom still work)
//             --prompt-version / --code-marking             the marking prompt and the code-marking flag the runs stand for
//           and one is read from the runs themselves (--runs-root): the marking setup, as a fingerprint. A run that used strict marking, or
//           marked key points only, is not the product's marking: it is stored, and cannot be promoted.
//     npm run hw:eval:gates -- import --report hw-evals/reports/heldout-1d-v1/report.json --scheme-source custom \
//          [--runs-root hw-evals/runs] [--prompt-version grade.v1] [--code-marking] [--imported-by <name>]
//
//   import-regression: store the regression gate's own result (regression.json), unchanged, for the Runs & gates tab.
//     npm run hw:eval:gates -- import-regression --file hw-evals/runs/<candidateRunId>/regression.json [--dataset regression@v1]
//
// Needs DATABASE_URL. Importing changes no one's eligibility except in one direction: a group that is eligible for exactly the setup
// a new, failing result measured is demoted. Promotion is a person's decision, on the control-room screen.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { userInfo } from 'node:os';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 ? process.argv[i + 1] : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function importReport() {
  const file = arg('report');
  const source = arg('scheme-source');
  if (!file) throw new Error('--report <report.json> is required');
  const ALIAS: Record<string, string> = { textbook: 'textbook_key', board_paper: 'board_scheme_key', custom: 'teacher_rubric' };
  const scheme = source ? (ALIAS[source] ?? source) : undefined;
  if (!scheme || !['board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric'].includes(scheme)) throw new Error('--scheme-source board_scheme_key|passage_key|textbook_key|teacher_rubric is required: a report cannot know it');
  const text = readFileSync(file, 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const report = JSON.parse(text) as import('@/lib/hw/eligibility/gate-import').ReportJson;
  const { partsFromRunConfig } = await import('@/lib/hw/eligibility/fingerprint');
  const { resultsFromReport } = await import('@/lib/hw/eligibility/gate-import');
  const { importGateReport } = await import('@/lib/hw/eligibility/gate-store');

  // The marking setup the runs stand for: read from the first mark or e2e run's recorded configuration.
  const runsRoot = arg('runs-root', 'hw-evals/runs')!;
  let parts: import('@/lib/hw/eligibility/fingerprint').FingerprintParts | null = null;
  let why = 'no mark run with a recorded configuration was found';
  for (const r of report.runs.filter((x) => x.mode === 'mark' || x.mode === 'e2e')) {
    const f = join(runsRoot, r.runId, 'run.json');
    if (!existsSync(f)) { why = `run ${r.runId} has no run.json under ${runsRoot}`; continue; }
    const rec = JSON.parse(readFileSync(f, 'utf8')) as { meta?: { config?: import('@/lib/hw/eligibility/fingerprint').RunConfigLike } };
    const p = partsFromRunConfig(rec.meta?.config ?? {}, { promptVersion: arg('prompt-version', 'grade.v1')!, codeMarking: flag('code-marking') });
    if ('parts' in p) { parts = p.parts; break; }
    why = `run ${r.runId}: ${p.notProduction}`;
  }
  if (!parts) console.warn(`! no production fingerprint: ${why}. The results are stored for reading but cannot be promoted.`);

  const results = resultsFromReport(report, { schemeSource: scheme as import('@/lib/hw/eligibility/group').GroupSchemeSource, parts });
  const out = await importGateReport(report, results, { importedBy: arg('imported-by') ?? `cli:${userInfo().username}`, reportSha256: sha });
  console.log(`report ${sha.slice(0, 12)}: ${out.runsAdded} run(s) added, ${out.resultsAdded} gate result(s) added, ${out.resultsAlreadyThere} already there.`);
  for (const r of results) console.log(`  ${r.groupKey}: ${r.verdict}`);
  if (out.recorded.length) console.log(`registry: recorded ${out.recorded.join(', ')}`);
  if (out.demoted.length) console.log(`registry: DEMOTED ${out.demoted.join(', ')} (a failing result for the same marking setup)`);
  process.exit(0);
}

async function importRegressionFile() {
  const file = arg('file');
  if (!file) throw new Error('--file <regression.json> is required (the file `npm run hw:eval:regression` writes next to the candidate run)');
  const text = readFileSync(file, 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const { importRegression } = await import('@/lib/hw/eligibility/gate-store');
  const out = await importRegression(JSON.parse(text), { importedBy: arg('imported-by') ?? `cli:${userInfo().username}`, sourceSha256: sha, dataset: arg('dataset') });
  console.log(out.added ? `regression result ${sha.slice(0, 12)} stored` : `regression result ${sha.slice(0, 12)} was already stored`);
  process.exit(0);
}

const cmd = process.argv[2];
(cmd === 'import' ? importReport() : cmd === 'import-regression' ? importRegressionFile() : Promise.reject(new Error('usage: hw-eval-gates.ts import --report <report.json> --scheme-source <…> | import-regression --file <regression.json> [--dataset name@vN]')))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
