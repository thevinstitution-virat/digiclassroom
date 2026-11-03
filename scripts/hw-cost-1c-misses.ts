// Phase 1c, task 2 (report only): every `wrong_fact` item that any marking profile credited in phase 1b, with
// the question, the key point, the model answer, the mutated sentence, the expected marks and what each profile's
// grader said (verdict, marks, quoted evidence) over its five runs.
//
//   npm run hw:cost:1c -- misses --dataset smallrun-b@v1 --runs-root ../../hw-evals/cost1b/runs --label "phase1b smoke"
//
// Reads files only.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const sentences = (t: string) => t.split(/(?<=[.!?।])\s+|\n+/).map((s) => s.trim()).filter(Boolean);

async function main() {
  const runsRoot = arg('runs-root', '../../hw-evals/cost1b/runs')!;
  const label = arg('label', 'phase1b smoke')!;
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { readRows, latestRows } = await import('@/lib/hw/eval/runner');
  const ds = loadDataset(arg('datasets-root', '../../hw-evals/datasets')!, arg('dataset', 'smallrun-b@v1')!);
  const byId = new Map(ds.items.map((i) => [i.id, i]));

  const profiles = new Map<string, import('@/lib/hw/eval/runner').ItemRow[]>();
  for (const d of readdirSync(runsRoot)) {
    const f = join(runsRoot, d, 'run.json');
    if (!existsSync(f)) continue;
    const rec = JSON.parse(readFileSync(f, 'utf8')) as { mode: string; status: string; dataset: { ref: string }; meta: { label?: string; profiles?: string } };
    if (rec.mode !== 'mark' || rec.status !== 'completed' || rec.dataset.ref !== arg('dataset', 'smallrun-b@v1') || !(rec.meta.label ?? '').includes(label)) continue;
    const p = (rec.meta.profiles ?? '').split(',').find((x) => x.startsWith('M')) ?? '?';
    profiles.set(p, [...(profiles.get(p) ?? []), ...latestRows(readRows(join(runsRoot, d, 'items.jsonl')))]);
  }
  const names = ['M0', 'M0-single', 'M1', 'M1-medium'].filter((p) => profiles.has(p));

  const wrong = ds.items.filter((i) => i.mutation?.type === 'wrong_fact');
  console.log(`${wrong.length} wrong_fact items; profiles ${names.join(', ')}\n`);
  let shown = 0;
  for (const it of wrong) {
    const parent = byId.get(it.mutation!.parentItem!)!;
    // The points whose expected marks are below their worth: the ones the mutation broke.
    const broken = it.key!.points.filter((kp) => (it.referenceMarks!.byPoint[kp.id] ?? kp.marks) < kp.marks);
    const missedBy = new Map<string, { point: string; runs: number; credited: number; rows: { marks: number; verdict: string; quote: string }[] }[]>();
    let any = false;
    for (const p of names) {
      const rows = profiles.get(p)!.filter((r) => r.itemId === it.id && r.mark);
      for (const kp of broken) {
        const exp = it.referenceMarks!.byPoint[kp.id] ?? 0;
        const got = rows.map((r) => r.mark!.points.find((x) => x.pointId === kp.id)!).filter(Boolean);
        const credited = got.filter((g) => g.marks > exp).length;
        if (credited) any = true;
        missedBy.set(p, [...(missedBy.get(p) ?? []), { point: kp.id, runs: got.length, credited, rows: got.map((g) => ({ marks: g.marks, verdict: g.verdict, quote: g.quote })) }]);
      }
    }
    if (!any) continue;
    shown++;
    const ps = new Set(sentences(parent.truthTranscript!.text));
    const mutated = sentences(it.truthTranscript!.text).filter((s) => !ps.has(s));
    console.log(`### Item ${shown}: ${it.id.slice(-8)} (${it.questionType}, ${it.question.marks} marks, ${it.language})`);
    console.log(`- Question: ${it.question.text}`);
    if (it.question.passageText) console.log(`- Passage: ${it.question.passageText.replace(/\n/g, ' ')}`);
    console.log(`- Model answer: ${(it.key!.referenceAnswer ?? '').replace(/\n/g, ' ')}`);
    for (const kp of broken) console.log(`- Key point ${kp.id} (${kp.marks} mark${kp.marks === 1 ? '' : 's'}): ${kp.text}${kp.acceptedAlternatives?.length ? ` [also accept: ${kp.acceptedAlternatives.join('; ')}]` : ''}  → expected ${it.referenceMarks!.byPoint[kp.id]}`);
    console.log(`- Original answer: ${parent.truthTranscript!.text.replace(/\n/g, ' ')}`);
    console.log(`- Mutated sentence(s): ${mutated.join(' ⏎ ') || '(none found by sentence diff)'}`);
    console.log(`- Full mutated answer: ${it.truthTranscript!.text.replace(/\n/g, ' ')}`);
    for (const p of names) {
      for (const m of missedBy.get(p) ?? []) {
        const marksSeen = m.rows.map((r) => r.marks).join('/');
        const q = [...new Set(m.rows.filter((r) => r.marks > 0).map((r) => r.quote))].slice(0, 2).map((x) => `"${x}"`).join(' | ');
        console.log(`  - ${p.padEnd(10)} point ${m.point}: credited in ${m.credited} of ${m.runs} runs (marks per run ${marksSeen}); evidence quoted: ${q || '(none)'}`);
      }
    }
    console.log('');
  }
  console.log(`${shown} of ${wrong.length} wrong_fact items were credited by at least one profile.`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
