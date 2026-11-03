// Monthly AI cost per student, teacher and guardian, from MEASURED per-step costs.
//
//   npm run hw:cost:project -- collect [--runs-root ../../hw-evals/cost1/runs] [--out ../../docs/hw-eval/cost1/unit-costs.json] [--price-table ../../docs/hw-eval/price-table.json] [--no-cache]
//       reads finished eval runs and writes the unit costs (₹ per answer / per key) they measured. With --price-table the
//       measured tokens are re-priced at that table's rates (e.g. the gemini-3.6-flash rates from 1 Jan 2027).
//
//   npm run hw:cost:project -- project [--units ../../docs/hw-eval/cost1/unit-costs.json] [--flags none|all]
//       [--combos headline|all] [--csv out.csv] [--assignments 8] [--questions 10] [--pen 0.4] [--paper 0.5] [--typed 0.1]
//       [--hindi 0.3] [--esc-en 0.15] [--esc-hi 0.2] [--one-mark 0.3] [--exact-match 0.5] [--duplicates 0.1]
//       [--key-reuse 0.7] [--class-size 40] [--keyed 1] [--students-per-teacher 120] [--children 1] [--pages 1]
//       prints the projection; every assumption is a parameter (defaults in lib/hw/eval/cost-project.ts).
//
// (from apps/api). Reads files only; no provider is called.

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const num = (name: string, d: number) => (arg(name) === undefined ? d : Number(arg(name)));

const inr = (n: number, d = 2) => `₹${n.toFixed(d)}`;

async function main() {
  const sub = process.argv[2];
  const lib = await import('@/lib/hw/eval/cost-project');

  if (sub === 'collect') {
    const { readRows, latestRows } = await import('@/lib/hw/eval/runner');
    const runsRoots = arg('runs-root', '../../hw-evals/cost1/runs')!.split(',');
    const out = arg('out', '../../docs/hw-eval/cost1/unit-costs.json')!;
    const runs = runsRoots.flatMap((runsRoot) => readdirSync(runsRoot).filter((d) => existsSync(join(runsRoot, d, 'run.json'))).map((d) => {
      const rec = JSON.parse(readFileSync(join(runsRoot, d, 'run.json'), 'utf8')) as { mode: 'read' | 'key' | 'mark' | 'e2e'; status: string; dataset: { ref: string }; meta: { label?: string | null; profiles?: string | null; config?: { forceEscalation?: boolean; readGroup?: number; languageFilter?: string | null } } };
      return {
        runId: d, label: rec.meta.label ?? null, mode: rec.mode, dataset: rec.dataset.ref, profiles: rec.meta.profiles ?? null, status: rec.status,
        forceEscalation: Boolean(rec.meta.config?.forceEscalation), readGroup: rec.meta.config?.readGroup ?? 1, languageFilter: rec.meta.config?.languageFilter ?? null,
        rows: latestRows(readRows(join(runsRoot, d, 'items.jsonl'))),
      };
    }));
    const tableFile = arg('price-table');
    // --no-cache prices every prompt token as uncached: repeating identical requests (repeat runs) hits the provider's cache, which real, different answers do not.
    const noCache = process.argv.includes('--no-cache');
    if (tableFile) {
      const { estimateCost, parsePriceTable } = await import('@/lib/hw/cost/pricing');
      const raw = JSON.parse(readFileSync(tableFile, 'utf8')) as Record<string, unknown>;
      delete raw._comment;
      const table = parsePriceTable(JSON.stringify(raw));
      if ('problem' in table) throw new Error(table.problem);
      for (const r of runs) for (const row of r.rows) for (const c of row.calls ?? []) {
        const usage = noCache ? { ...c.usage, cached: 0, cacheWrite: 0 } : c.usage;
        c.tableStandardPaise = estimateCost(table, c.model, usage, { batch: false }).paise;
        c.tableBatchPaise = estimateCost(table, c.model, usage, { batch: true }).paise;
      }
      console.log(`re-priced at ${tableFile} (₹${table.inr_per_usd}/$)`);
    }
    const units = lib.collectUnitCosts(runs, 'Costs are the price table\'s rates (docs/hw-eval/price-table.json, ₹88/$) applied to tokens measured in these runs; the key embedding is not included (see notes in the report).');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(units, null, 2));
    console.log(`wrote ${out}`);
    console.log(`reading: ${Object.entries(units.reading).map(([k, v]) => `${k}[${Object.keys(v).join(',')}]`).join(' ')}`);
    console.log(`escalation: ${Object.entries(units.escalation).map(([k, v]) => `${k}[${'perPage' in v ? 'per page' : Object.keys(v).join(',')}]`).join(' ')}`);
    console.log(`marking: ${Object.keys(units.marking).join(' ')}   keys: ${Object.keys(units.keys).join(' ')}`);
    return;
  }

  if (sub === 'project') {
    const units = JSON.parse(readFileSync(arg('units', '../../docs/hw-eval/cost1/unit-costs.json')!, 'utf8')) as import('@/lib/hw/eval/cost-project').UnitCosts;
    // Sarvam is priced per page by the published price, not measured.
    units.escalation['E-sarvam'] = { perPage: 0.5 };
    const D = lib.DEFAULTS;
    const a = {
      ...D,
      assignmentsPerMonth: num('assignments', D.assignmentsPerMonth), questionsPerAssignment: num('questions', D.questionsPerAssignment),
      penShare: num('pen', D.penShare), paperShare: num('paper', D.paperShare), typedShare: num('typed', D.typedShare),
      hindiShare: num('hindi', D.hindiShare), escalationEn: num('esc-en', D.escalationEn), escalationHi: num('esc-hi', D.escalationHi),
      oneMarkShare: num('one-mark', D.oneMarkShare), exactMatchShareOfOneMark: num('exact-match', D.exactMatchShareOfOneMark),
      duplicateRate: num('duplicates', D.duplicateRate), keyReuseRate: num('key-reuse', D.keyReuseRate),
      studentsPerClass: num('class-size', D.studentsPerClass), keyedShare: num('keyed', D.keyedShare),
      studentsPerTeacher: num('students-per-teacher', D.studentsPerTeacher), childrenPerGuardian: num('children', D.childrenPerGuardian),
      pagesPerAnswer: num('pages', D.pagesPerAnswer),
    };
    console.log('Assumptions:', JSON.stringify(a));
    const today = lib.project(units, { reading: 'R0', escalation: 'E0', marking: 'M0', keys: 'K0' }, lib.NO_FLAGS, a);
    const flagsOnly = lib.project(units, { reading: 'R0', escalation: 'E0', marking: 'M0', keys: 'K0' }, lib.ALL_FLAGS, a);
    const row = (label: string, p: import('@/lib/hw/eval/cost-project').Projection) =>
      `| ${label} | ${inr(p.perStudent.reading, 2)} | ${inr(p.perStudent.escalation, 2)} | ${inr(p.perStudent.marking, 2)} | ${inr(p.perStudent.keys, 2)} | **${inr(p.perStudent.total, 2)}** | ${inr(p.perTeacher, 0)} | ${inr(p.perGuardian, 2)} | ${(100 * (1 - p.perStudent.total / today.perStudent.total)).toFixed(0)}% |`;
    const head = '| Configuration | Reading | Escalation | Marking | Keys | Per student / month | Per teacher / month | Per guardian / month | Saved vs today |\n|---|---|---|---|---|---|---|---|---|';
    const t = { reading: 'R0', escalation: 'E0', marking: 'M0', keys: 'K0' };
    const lines = [
      head,
      row("today's settings (R0, E0, M0, K0), standard rates, no flags", today),
      row('  + batch only: what HW_BATCH_ENABLED=true already does on Gemini direct', lib.project(units, t, { ...lib.NO_FLAGS, batch: true }, a)),
      row('  + shared keys only', lib.project(units, t, { ...lib.NO_FLAGS, sharedKeys: true }, a)),
      row('  + code marking only', lib.project(units, t, { ...lib.NO_FLAGS, codeMarking: true }, a)),
      row('  + identical answers marked once only', lib.project(units, t, { ...lib.NO_FLAGS, dedupe: true }, a)),
      row("Task 2 flags alone, all together, on today's models", flagsOnly),
    ];

    const flags = arg('flags', 'all') === 'none' ? lib.NO_FLAGS : lib.ALL_FLAGS;
    const combos: import('@/lib/hw/eval/cost-project').Combo[] = arg('combos', 'headline') === 'all' ? lib.allCombos() : [
      { reading: 'R1', escalation: 'E0', marking: 'M0', keys: 'K0' },
      { reading: 'R1', escalation: 'E-gemini', marking: 'M0', keys: 'K0' },
      { reading: 'R1', escalation: 'E-gemini', marking: 'M1', keys: 'K0' },
      { reading: 'R1', escalation: 'E-gemini', marking: 'M1', keys: 'K1' },
      { reading: 'R1', escalation: 'E-gemini', marking: 'M2', keys: 'K1' },
      { reading: 'R2', escalation: 'E-gemini', marking: 'M1', keys: 'K1' },
      { reading: 'R-luna', escalation: 'E-gemini', marking: 'M1', keys: 'K1' },
      { reading: 'R-luna', escalation: 'E-sarvam', marking: 'M1', keys: 'K1' },
      { reading: 'R1', escalation: 'E-sarvam', marking: 'M1', keys: 'K1' },
    ];
    // --custom "R0+E0+M0-single+K0;R-luna+E0+M1+K0": extra combinations, reading+escalation+marking+keys.
    for (const spec of (arg('custom') ?? '').split(';').filter(Boolean)) {
      const [reading, escalation, marking, keysId] = spec.split('+');
      combos.push({ reading, escalation, marking, keys: keysId });
    }
    const rows: { c: import('@/lib/hw/eval/cost-project').Combo; p: import('@/lib/hw/eval/cost-project').Projection }[] = [];
    for (const c of combos) {
      try { rows.push({ c, p: lib.project(units, c, flags, a) }); } catch (e) { console.error(`skipped ${JSON.stringify(c)}: ${(e as Error).message}`); }
    }
    rows.sort((x, y) => x.p.perStudent.total - y.p.perStudent.total);
    for (const { c, p } of rows) lines.push(row(`${c.reading} + ${c.escalation} + ${c.marking} + ${c.keys}${flags === lib.ALL_FLAGS ? ' + flags' : ''}`, p));
    console.log(`\n${lines.join('\n')}`);
    const notes = [...new Set(rows.flatMap((r) => r.p.notes))];
    if (notes.length) console.log(`\nNotes:\n${notes.map((n) => `- ${n}`).join('\n')}`);
    const csv = arg('csv');
    if (csv) {
      writeFileSync(csv, ['reading,escalation,marking,keys,flags,reading_inr,escalation_inr,marking_inr,keys_inr,per_student,per_teacher,per_guardian',
        ...rows.map(({ c, p }) => [c.reading, c.escalation, c.marking, c.keys, flags === lib.ALL_FLAGS ? 'all' : 'none', ...[p.perStudent.reading, p.perStudent.escalation, p.perStudent.marking, p.perStudent.keys, p.perStudent.total, p.perTeacher, p.perGuardian].map((n) => n.toFixed(4))].join(','))].join('\n'));
      console.log(`wrote ${csv}`);
    }
    return;
  }
  throw new Error('usage: hw-cost-project collect|project');
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
