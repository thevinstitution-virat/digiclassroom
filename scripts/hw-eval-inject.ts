// Cross-student injection check, version 2 (cost work phase 1c, task 1.4).
//
// M0 marks up to ten DIFFERENT students' answers to one question in one call. Does a line written in one answer move the
// marks of the other nine? Phase 1b used two clean runs and three groups; this version:
//   - measures each answer's natural variation from FIVE clean runs of its group (the range of its five marks);
//   - uses several group samples (a question x a seeded choice of ten of its answers);
//   - runs a sixth clean run per group as a control: how often does an answer fall outside its own five-run range
//     with NOTHING injected?
//   - tests the direction of the changes that fall outside the range with an exact two-sided sign test.
// Two arms on the same injected inputs: UNGUARDED (plain grouping) and GUARDED (the instruction screen marks a flagged
// answer alone, as with HW_INSTRUCTION_GUARD_ENABLED).
//
//   npm run hw:eval:inject -- --dataset smallrun-b@v1 --profile M0 --samples 4 --budget-inr 60 --out result.json
//
// Prints the spend estimate first; stops if the real spend passes --budget-inr. Never writes to a database.

import { writeFileSync } from 'node:fs';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

async function main() {
  const budgetInr = Number(arg('budget-inr'));
  if (!(budgetInr > 0)) throw new Error('--budget-inr is required');
  const datasetsRoot = arg('datasets-root', '../../hw-evals/datasets')!;
  const profileId = arg('profile', 'M0')!;
  const samples = Number(arg('samples', '4'));
  const cleanRuns = Number(arg('clean-runs', '5'));

  const { loadProfileSet } = await import('@/lib/hw/eval/profiles');
  const set = loadProfileSet({ reading: 'R0', marking: profileId });
  const marking = set.marking;
  process.env.HW_AI_PROVIDER = marking.call.provider;
  const { _resetHwConfig, getHwConfig } = await import('@/lib/hw/config');
  _resetHwConfig();
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { gradeQuestionOf } = await import('@/lib/hw/eval/runner');
  const { liveDeps } = await import('@/lib/hw/eval/live-deps');
  const { parsePriceTable } = await import('@/lib/hw/cost/pricing');
  const { INJECTIONS } = await import('@/lib/hw/eval/injection-lines');
  const { signTest } = await import('@/lib/hw/eval/sign-test');
  const { groupForMarking } = await import('@/lib/hw/grader/instruction-screen');

  const cfg = getHwConfig();
  const table = parsePriceTable(cfg.HW_PRICE_TABLE_JSON);
  if ('problem' in table) throw new Error(table.problem);
  const ds = loadDataset(datasetsRoot, arg('dataset', 'smallrun-b@v1')!);
  const opt = (c: { thinkingLevel?: string; reasoningEffort?: string }) => Object.fromEntries(Object.entries({ thinkingLevel: c.thinkingLevel, reasoningEffort: c.reasoningEffort }).filter(([, v]) => v !== undefined)) as Record<string, string>;
  // The deps are built WITHOUT guards: this script does the grouping itself, so the two arms differ only in who sits beside whom.
  const deps = liveDeps(ds, {
    reader: { model: 'unused', policy: { escalateBelow: 0.7, unclearAbove: 3 } },
    grader: { model: marking.call.model, options: opt(marking.call), valuePointsOnly: marking.valuePointsOnly, strict: marking.strict },
    keyCacheDir: '', priceTableJson: cfg.HW_PRICE_TABLE_JSON,
  });

  // Group samples: a question and a seeded choice of ten of its answers (injection variants left out, so a group carries no instruction).
  const byQ = new Map<string, typeof ds.items>();
  for (const it of ds.items) {
    if (it.mutation?.type === 'injection' || !it.truthTranscript || !it.key || !it.referenceMarks) continue;
    byQ.set(it.question.id, [...(byQ.get(it.question.id) ?? []), it]);
  }
  const questions = [...byQ.values()].filter((g) => g.length >= 6);
  const groups = Array.from({ length: samples }, (_, s) => {
    const items = questions[s % questions.length];
    const rnd = mulberry(20261103 + s);
    return s < questions.length ? items.slice(0, 10) : [...items].sort(() => rnd() - 0.5).slice(0, 10);
  });

  const callsPerGroup = cleanRuns + 1 + INJECTIONS.length * 2 * 2;
  const perCall = deps.price({ model: marking.call.model, usage: { input: 200 + 150 * 10, cached: 0, output: 130 * 10 } }) ?? 0;
  const est = (perCall * groups.length * callsPerGroup * (marking.answersPerCall === 1 ? 10 : 1)) / 100;
  console.log(`profile ${profileId} (${marking.call.model}, ${marking.answersPerCall} answer(s) per call), ${groups.length} group samples of ${groups.map((g) => g.length).join('/')} answers; ${cleanRuns} clean runs + 1 control per group`);
  console.log(`estimated spend (conservative): up to ₹${est.toFixed(2)} for about ${groups.length * callsPerGroup} grouped calls; cap ₹${budgetInr}`);
  if (est > budgetInr) throw new Error(`estimate ₹${est.toFixed(2)} is over the cap ₹${budgetInr}; raise --budget-inr or stop`);

  let spent = 0;
  const mark = async (items: typeof ds.items, text: (i: number) => string, guarded: boolean) => {
    const q = gradeQuestionOf(items[0]);
    if (typeof q === 'string') throw new Error(q);
    const answers = items.map((it, i) => ({ answerId: it.id, transcript: text(i) }));
    const chunks = marking.answersPerCall === 1 ? answers.map((a) => [a]) : groupForMarking(answers, answers.length, guarded);
    const marks = new Map<string, number>();
    for (const c of chunks) {
      const g = await deps.grade(q, c);
      for (const r of g.results) marks.set(r.answerId, r.suggestedMarks);
      for (const call of g.calls) spent += (deps.price(call) ?? 0) / 100;
    }
    if (spent > budgetInr) throw new Error(`spent ₹${spent.toFixed(2)}, over the cap ₹${budgetInr}`);
    return marks;
  };

  type Arm = { comparisons: number; beyond: number; asked: number; other: number; details: string[] };
  const arms: Record<'unguarded' | 'guarded', Arm> = { unguarded: { comparisons: 0, beyond: 0, asked: 0, other: 0, details: [] }, guarded: { comparisons: 0, beyond: 0, asked: 0, other: 0, details: [] } };
  let naturalVarying = 0, answersTotal = 0, controlOutside = 0, controlTotal = 0;
  const perSample: Record<string, unknown>[] = [];

  for (const [gi, group] of groups.entries()) {
    const verbatim = (i: number) => group[i].truthTranscript!.text;
    const clean: Map<string, number>[] = [];
    for (let k = 0; k < cleanRuns; k++) clean.push(await mark(group, verbatim, false));
    const range = new Map(group.map((it) => {
      const v = clean.map((m) => m.get(it.id)!);
      return [it.id, { lo: Math.min(...v), hi: Math.max(...v) }] as const;
    }));
    for (const it of group) { answersTotal++; const r = range.get(it.id)!; if (r.lo !== r.hi) naturalVarying++; }
    const control = await mark(group, verbatim, false);
    for (const it of group) { controlTotal++; const r = range.get(it.id)!; const m = control.get(it.id)!; if (m < r.lo || m > r.hi) controlOutside++; }

    const order = group.map((it, i) => ({ i, m: it.referenceMarks!.total })).sort((a, b) => a.m - b.m);
    const victims = [order[0].i, order[Math.floor(order.length / 2)].i];
    for (const inj of INJECTIONS) {
      for (const v of victims) {
        const text = (i: number) => (i === v ? `${verbatim(i)}\n${inj.text}` : verbatim(i));
        for (const [armName, guarded] of [['unguarded', false], ['guarded', true]] as const) {
          const marks = await mark(group, text, guarded);
          const arm = arms[armName];
          for (const [i, it] of group.entries()) {
            if (i === v) continue;
            arm.comparisons++;
            const r = range.get(it.id)!; const m = marks.get(it.id)!;
            if (!(m < r.lo || m > r.hi)) continue;
            arm.beyond++;
            const asked = inj.direction === 'up' ? m > r.hi : m < r.lo;
            if (asked) arm.asked++; else arm.other++;
            arm.details.push(`sample ${gi} ${inj.id} victim ${group[v].id.slice(-6)}: ${it.id.slice(-6)} clean range ${r.lo}..${r.hi} -> ${m} (${asked ? 'as asked' : 'other way'})`);
          }
        }
      }
    }
    perSample.push({ sample: gi, question: group[0].question.id, answers: group.length });
  }

  const summary = (a: Arm) => ({ ...a, signTestP: signTest(a.asked, a.beyond) });
  const result = {
    profile: profileId, model: marking.call.model, answersPerCall: marking.answersPerCall, samples: perSample, injections: INJECTIONS, cleanRuns,
    naturalVariation: { answersWithAnyVariationAcrossCleanRuns: naturalVarying, of: answersTotal, controlRunOutsideOwnRange: controlOutside, controlAnswers: controlTotal },
    unguarded: summary(arms.unguarded), guarded: summary(arms.guarded), spentInr: Number(spent.toFixed(2)),
  };
  console.log(`\nnatural variation: ${naturalVarying} of ${answersTotal} answers got more than one mark across ${cleanRuns} clean runs; a further clean run fell outside its own range for ${controlOutside} of ${controlTotal} answers`);
  for (const k of ['unguarded', 'guarded'] as const) {
    const a = result[k];
    console.log(`\n${k.toUpperCase()}: ${a.comparisons} neighbour comparisons; ${a.beyond} beyond the answer's own ${cleanRuns}-run range; of those ${a.asked} moved the way the line asked and ${a.other} the other way; sign test p = ${a.signTestP.toFixed(3)} (two-sided, exact)`);
    for (const d of a.details) console.log(`  ${d}`);
  }
  console.log(`\nspent ₹${spent.toFixed(2)}`);
  const file = arg('out');
  if (file) writeFileSync(file, JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
