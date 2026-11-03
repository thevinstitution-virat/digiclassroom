// Phase 1b report tables from finished eval runs (counts beside percentages).
//
//   npm run hw:cost:1b -- marking --runs-root ../../hw-evals/cost1b/runs --dataset smallrun-b@v1 --label "phase1b smoke"
//   npm run hw:cost:1b -- reading --runs-root ../../hw-evals/cost1b/runs --dataset smallrun-a@v2 --label "phase1b reading"
//
// Groups the runs whose label contains --label by profile (marking) or by profile and language (reading).
// Reads files only; no provider is called.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const sub = process.argv[2];
  const runsRoot = arg('runs-root', '../../hw-evals/cost1b/runs')!;
  const label = arg('label', '')!;
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { readRows, latestRows } = await import('@/lib/hw/eval/runner');
  const { summariseRun } = await import('@/lib/hw/eval/summary');
  const { stepTable } = await import('@/lib/hw/eval/cost-table');
  const { markingCounts, confidentlyWrong, falseDeductions, evidenceRemovals, pct } = await import('@/lib/hw/eval/marking-report');
  const { estimateCost, parsePriceTable } = await import('@/lib/hw/cost/pricing');
  const rawTable = JSON.parse(readFileSync(arg('price-table', '../../docs/hw-eval/price-table.json')!, 'utf8')) as Record<string, unknown>;
  delete rawTable._comment;
  const parsed = parsePriceTable(JSON.stringify(rawTable));
  if ('problem' in parsed) throw new Error(parsed.problem);
  const table = parsed;
  const ds = loadDataset(arg('datasets-root', '../../hw-evals/datasets')!, arg('dataset')!);

  const runs = readdirSync(runsRoot).filter((d) => existsSync(join(runsRoot, d, 'run.json'))).map((d) => {
    const rec = JSON.parse(readFileSync(join(runsRoot, d, 'run.json'), 'utf8')) as { mode: string; status: string; repeat: number; dataset: { ref: string }; costPaise: number; meta: { label?: string; profiles?: string; retries?: number; config?: { languageFilter?: string | null } } };
    return { d, rec, rows: latestRows(readRows(join(runsRoot, d, 'items.jsonl'))) };
  }).filter((r) => r.rec.dataset.ref === arg('dataset') && (r.rec.meta.label ?? '').includes(label) && r.rec.status === 'completed');

  if (sub === 'marking') {
    const groups = new Map<string, typeof runs>();
    for (const r of runs) groups.set(r.rec.meta.profiles ?? '?', [...(groups.get(r.rec.meta.profiles ?? '?') ?? []), r]);
    for (const [profile, rs] of groups) {
      const rows = rs.flatMap((r) => r.rows);
      const c = markingCounts(rows, ds.items);
      const sum = summariseRun('mark', rows, ds.items);
      const steps = stepTable(rows, rows.filter((r) => r.status === 'ok').length);
      const g = steps.find((s) => s.step === 'grade');
      console.log(`\n### ${profile}  (${rs.length} run(s) x ${rs[0].rec.repeat}, ${rows.filter((r) => r.status === 'ok').length} marked answers, ${rs[0].rec.meta.retries ?? 0} retried calls)`);
      console.log(`- mutation detection: ${pct(c.detection, 1)}; per rule: ${Object.entries(c.byRule).map(([k, v]) => `${k} ${pct(v)}`).join(', ') || 'none'}`);
      console.log(`- false credit: ${c.falseCredit.given.toFixed(1)} marks given back of ${c.falseCredit.removed.toFixed(1)} removed (${c.falseCredit.removed ? ((100 * c.falseCredit.given) / c.falseCredit.removed).toFixed(1) : 'n/a'}%)`);
      console.log(`- injection resistance: ${pct(c.injection, 1)} (a success is an injected variant marked above its original)`);
      console.log(`- agreement with expected marks: exact total ${pct(c.exactTotal, 1)}; QWK ${sum.marking?.qwkByMax.map((q) => `${q.maxMarks}-mark ${q.qwk.toFixed(3)} (n=${q.n})`).join(', ')}; large errors ${sum.marking ? (sum.marking.largeErrorRate * 100).toFixed(1) : '?'}%`);
      // The spread between runs of the SAME profile: how many of the 14 mark-removing variants each of the five runs detected.
      const perRun = [...new Set(rows.map((r) => r.repeat))].sort((a, b) => a - b).map((rep) => markingCounts(rows.filter((r) => r.repeat === rep), ds.items).detection);
      console.log(`- detection in each run: ${perRun.map((c) => `${c.k}/${c.n}`).join(', ')}`);
      const fd = falseDeductions(rows, ds.items, ['paraphrase', 'spelling', 'hindi_spelling_variant']);
      const ev = evidenceRemovals(rows);
      console.log(`- false deductions on paraphrase and spelling items: ${pct(fd.answers, 1)} of answers lost marks; ${pct(fd.points, 1)} of their points`);
      console.log(`- points removed by the evidence rule (quote not in the answer's own text): ${ev.k} over ${ev.n} marked answers`);
      console.log(`- repeatability across runs: all identical for ${pct(c.identicalAcrossRuns, 1)} of answers; ICC ${sum.repeatability?.icc.toFixed(3) ?? 'n/a'}`);
      if (g) console.log(`- tokens per call: ${(g.inputTokens.total / g.calls).toFixed(0)} in, ${(g.output / g.calls).toFixed(0)} out of which reasoning ${g.thinking === null ? 'n/r' : (g.thinking / g.calls).toFixed(0)} (visible ${g.thinking === null ? 'n/r' : ((g.output - g.thinking) / g.calls).toFixed(0)}); ${g.calls} calls; ₹${g.inrPerAnswer.toFixed(4)} per answer`);
    }
    return;
  }

  if (sub === 'reading') {
    const groups = new Map<string, typeof runs>();
    for (const r of runs) {
      const k = `${r.rec.meta.profiles}|${r.rec.meta.config?.languageFilter ?? 'all'}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    console.log('| Profile | Language | Reads | CER | WER | Invented text | Confidently wrong (conf >= 0.8, CER >= 0.2) | Image tokens per answer | Cached tokens | ₹ per answer, as charged | ₹ per answer, nothing cached | Retried calls |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const [k, rs] of [...groups].sort()) {
      const [profile, lang] = k.split('|');
      const rows = rs.flatMap((r) => r.rows);
      const sum = summariseRun('read', rows, ds.items);
      const cw = confidentlyWrong(rows);
      const t1 = stepTable(rows, rows.filter((r) => r.status === 'ok').length).find((s) => s.step === 'read_tier1');
      const n = rows.filter((r) => r.status === 'ok').length;
      const cachedTokens = t1?.cached ?? 0;
      // Repeating identical requests lets the provider serve part of the prompt from its cache; different students' answers would not. Price the same tokens as uncached.
      const uncachedInr = rows.flatMap((r) => r.calls ?? []).filter((c) => c.step === 'read_tier1').reduce((s2, c) => s2 + estimateCost(table, c.model, { ...c.usage, cached: 0 }, { batch: Boolean(c.batchPricing) }).paise, 0) / 100 / n;
      console.log(`| ${profile} | ${lang} | ${n} | ${sum.reading ? (sum.reading.cerCp * 100).toFixed(2) : '?'}% | ${sum.reading ? (sum.reading.wer * 100).toFixed(2) : '?'}% | ${sum.reading ? (sum.reading.inventedRate * 100).toFixed(2) : '?'}% | ${pct(cw)} | ${t1?.inputTokens.image === null || !t1 ? 'n/r' : (t1.inputTokens.image / n).toFixed(0)} | ${cachedTokens} | ${t1 ? t1.inrPerAnswer.toFixed(4) : '?'} | ${uncachedInr.toFixed(4)} | ${rs.reduce((s, r) => s + (r.rec.meta.retries ?? 0), 0)} |`);
    }
    return;
  }
  throw new Error('usage: hw-cost-1b-report marking|reading');
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
