// How the instruction screen does on the evaluation datasets (phase 1c, task 1.1): hits on the injection items,
// false positives on every other answer, and on the injection lines the cross-student check uses.
//
//   npm run hw:eval:screen -- [--datasets-root ../../hw-evals/datasets]
//
// Reads files only; no provider is called.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const root = arg('datasets-root', '../../hw-evals/datasets')!;
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const { screenInstructions } = await import('@/lib/hw/grader/instruction-screen');
  const { INJECTIONS } = await import('@/lib/hw/eval/injection-lines');

  const injected: { text: string; hits: string[]; where: string }[] = [];
  const clean: { text: string; hits: string[]; where: string }[] = [];
  const seen = new Set<string>();
  for (const name of readdirSync(root)) {
    for (const version of readdirSync(join(root, name))) {
      if (!existsSync(join(root, name, version, 'manifest.jsonl'))) continue;
      const ds = loadDataset(root, `${name}@${version}`);
      for (const it of ds.items) {
        const text = it.truthTranscript?.text;
        if (!text) continue;
        const r = screenInstructions(text);
        const row = { text, hits: r.hits.map((h) => h.id), where: `${name}@${version} ${it.id.slice(-6)}` };
        if (it.mutation?.type === 'injection') injected.push(row);
        else { const k = text.trim(); if (seen.has(k)) continue; seen.add(k); clean.push(row); }
      }
    }
  }
  // The injection items repeat across dataset versions; count each distinct text once.
  const injUnique = [...new Map(injected.map((r) => [r.text, r])).values()];
  const injHit = injUnique.filter((r) => r.hits.length);
  console.log(`injection items: ${injHit.length} of ${injUnique.length} distinct texts flagged (${injected.length} items across dataset versions, ${injected.filter((r) => r.hits.length).length} flagged)`);
  for (const r of injUnique) console.log(`  ${r.hits.length ? 'FLAGGED' : 'MISSED '} [${r.hits.join(', ')}] ${r.text.split('\n').slice(-1)[0].slice(0, 140)}`);
  const fp = clean.filter((r) => r.hits.length);
  console.log(`\nclean answers: ${fp.length} false positives of ${clean.length} distinct texts`);
  for (const r of fp) console.log(`  FALSE POSITIVE [${r.hits.join(', ')}] ${r.where}: ${r.text.slice(0, 160)}`);
  console.log('\ncross-student check lines:');
  for (const i of INJECTIONS) console.log(`  ${screenInstructions(i.text).flagged ? 'FLAGGED' : 'MISSED '} ${i.id}: ${screenInstructions(i.text).hits.map((h) => h.id).join(', ')}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
