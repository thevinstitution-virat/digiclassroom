// Board-paper bank importer (docs/hw-eval/board-paper-importer.md). Phase 1: reads a structured paper file, checks it, and stores it as DRAFT
// questions. Nothing it writes can reach a learner: only a person's check turns a draft into something the answer-key service may use.
//
//   npm run hw:paper:import -w apps/api -- validate <bank.json>
//   npm run hw:paper:import -w apps/api -- plan     <bank.json> [--kind sqp|past_paper]     (reads the database, writes nothing)
//   npm run hw:paper:import -w apps/api -- import   <bank.json> [--kind sqp|past_paper] [--by "name"] [--revise]
//
// `validate` needs no database. `import` refuses (and writes nothing) when a row a person has checked would change; --revise sends such rows back
// to draft with a new version, which is the only way a checked row's content can change.

import { readFileSync } from 'node:fs';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { validateBank } from '@/lib/hw/bank/validate';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';
import { renderPlan } from '@/lib/hw/bank/plan';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

async function main() {
  const [cmd, path] = process.argv.slice(2);
  if (!['validate', 'plan', 'import'].includes(cmd ?? '') || !path || path.startsWith('--')) fail('usage: hw-paper-import <validate|plan|import> <bank.json> [--kind sqp|past_paper] [--by name] [--revise]', 2);
  const text = readFileSync(path, 'utf8');
  const parsed = parseBankFile(text);
  if (!parsed.ok) fail(`The file is not a bank file:\n${parsed.problems.map((p) => `  - ${p}`).join('\n')}`);
  const problems = validateBank(parsed.bank);
  if (problems.length) fail(`The file does not add up (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);

  const kindArg = arg('kind');
  if (kindArg && kindArg !== 'sqp' && kindArg !== 'past_paper') fail('--kind is sqp or past_paper', 2);
  const paper = expandBank(parsed.bank, { kind: kindArg as 'sqp' | 'past_paper' | undefined });
  const sourceSha256 = sha256(text);
  const needs = paper.questions.filter((q) => q.needsCheck.length).length;
  console.log(`OK: ${parsed.bank.questions.length} questions, ${paper.questions.length} rows to attempt (${paper.questions.filter((q) => q.variant).length} for visually impaired students), ${paper.maxMarks} marks.`);
  console.log(`${needs} rows have something a person must look at before they can be checked.`);
  if (cmd === 'validate') return;

  const { db } = await import('@/db');
  try {
    if (cmd === 'plan') {
      const { dryRun } = await import('@/lib/hw/bank/store');
      console.log(renderPlan(paper, await dryRun(db, paper, sourceSha256, { revise: flag('revise') })));
      return;
    }
    const by = arg('by') ?? process.env.HW_IMPORT_BY ?? process.env.USERNAME ?? process.env.USER ?? 'importer';
    const { importDraft, ImportConflictError } = await import('@/lib/hw/bank/store');
    try {
      const r = await importDraft(db, paper, { actor: by, sourceSha256, revise: flag('revise') });
      console.log(renderPlan(paper, r.plan));
      console.log(r.written ? `Written as draft (paper ${r.paperId}).` : 'Nothing to write: the bank already has exactly this.');
    } catch (e) {
      if (e instanceof ImportConflictError) fail(`${renderPlan(paper, e.plan)}\n${e.message}`);
      throw e;
    }
  } finally {
    await (await import('@/lib/db/connection')).closePool();
  }
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
