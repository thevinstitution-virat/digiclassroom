// Board-paper bank, phase 4: the pictures of a paper's figures (docs/hw-eval/board-paper-importer.md).
//
//   npm run hw:paper:figure -w apps/api -- list   <bank.json> [--kind sqp|past_paper]                         every figure, and whether its picture is attached
//   npm run hw:paper:figure -w apps/api -- attach <bank.json> <figure-id> <picture.png|.jpg|.webp> [--kind ...]   attach a picture (a crop of the board's PDF)
//
// A learner is only offered a question whose paper-side figures all have their pictures. Pictures are private objects (hw-bank/…) in R2, shown through
// short-lived links. `attach` is all or nothing and refuses a row a person has already checked (withdraw the check, attach, check again): what a person
// checked is what a learner sees. The picture's type and size are read from its bytes, not its name.

import { readFileSync } from 'node:fs';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { validateBank } from '@/lib/hw/bank/validate';
import { expandBank } from '@/lib/hw/bank/expand';

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined; };
const USAGE = 'usage: hw-paper-figure list <bank.json> [--kind sqp|past_paper]  |  attach <bank.json> <figure-id> <picture> [--kind sqp|past_paper]';

async function main() {
  const [cmd, path, figureId, picture] = process.argv.slice(2);
  if (!['list', 'attach'].includes(cmd ?? '') || !path || path.startsWith('--') || (cmd === 'attach' && (!figureId || !picture || figureId.startsWith('--') || picture.startsWith('--')))) fail(USAGE, 2);
  const parsed = parseBankFile(readFileSync(path, 'utf8'));
  if (!parsed.ok) fail(`The file is not a bank file:\n${parsed.problems.map((p) => `  - ${p}`).join('\n')}`);
  const problems = validateBank(parsed.bank);
  if (problems.length) fail(`The file does not add up (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  const kindArg = arg('kind');
  if (kindArg && kindArg !== 'sqp' && kindArg !== 'past_paper') fail('--kind is sqp or past_paper', 2);
  const paper = expandBank(parsed.bank, { kind: kindArg as 'sqp' | 'past_paper' | undefined });
  const bytes = cmd === 'attach' ? new Uint8Array(readFileSync(picture)) : null;

  const { db } = await import('@/db');
  try {
    const rs = await import('@/lib/hw/bank/review-store');
    const fg = await import('@/lib/hw/bank/figures');
    const ident = rs.identityOfExpanded(paper);
    if (cmd === 'list') {
      const states = await fg.figureStates(db, ident);
      if (!states.length) { console.log('No figures in this paper.'); return; }
      for (const f of states) console.log(`${f.hasImage ? 'picture ' : f.side === 'paper' ? 'MISSING ' : 'no need '} ${f.figureId.padEnd(16)} ${f.question.padEnd(8)} ${f.side.padEnd(6)} ${f.confidence.padEnd(6)} ${f.status}`);
      const missing = new Set(states.filter((f) => f.side === 'paper' && !f.hasImage).map((f) => f.question));
      console.log(`\n${missing.size} question${missing.size === 1 ? '' : 's'} cannot be offered to learners until their figures have pictures: ${[...missing].join(', ') || '(none)'}`);
      return;
    }
    const { putHwObject } = await import('@/lib/hw/storage/r2');
    try {
      const r = await fg.attachFigureImage(db, putHwObject, ident, figureId, bytes!);
      console.log(`Attached ${r.image.width}x${r.image.height} ${r.image.mime} (${r.image.bytes} bytes) to ${r.figureId}: ${r.rows.map((x) => x.question).join(', ')}.`);
      console.log('A person should now see the picture next to its words on the check sheet (npm run hw:paper:review -- sheet) before the row is checked.');
    } catch (e) {
      if (e instanceof fg.FigureRefusedError) fail(`Refused: ${e.message}`);
      throw e;
    }
  } finally {
    await (await import('@/lib/db/connection')).closePool();
  }
}

main().then(() => process.exit(0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
