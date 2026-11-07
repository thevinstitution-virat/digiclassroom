// Board-paper bank, phase 2 (docs/hw-eval/board-paper-importer.md): a person checks the imported questions, and the check is recorded.
//
//   npm run hw:paper:review -w apps/api -- sheet  <bank.json> [--kind sqp|past_paper] --out <file.html>   make the check sheet (reads the database)
//   npm run hw:paper:review -w apps/api -- status <bank.json> [--kind sqp|past_paper]                      where the check stands
//   npm run hw:paper:review -w apps/api -- plan   <verdicts.json>                                          what recording the verdicts would do (writes nothing)
//   npm run hw:paper:review -w apps/api -- apply  <verdicts.json> [--by "name"]                            record them
//   npm run hw:paper:review -w apps/api -- publish   <bank.json> [--kind ...] [--by "name"]               the owner's go-live: a fully checked paper is offered to learners
//   npm run hw:paper:review -w apps/api -- unpublish <bank.json> [--kind ...] [--by "name"]               take it back (questions go back to "checked")
//
// The sheet is one HTML file a teacher opens in a browser; it writes the verdicts file. `apply` is all or nothing, binds every verdict to the exact
// content the teacher saw, and turns a row into "checked" only when every item flagged on it was confirmed. It never changes a row's content.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { validateBank } from '@/lib/hw/bank/validate';
import { expandBank } from '@/lib/hw/bank/expand';
import { parseVerdictFile, renderReviewPlan, renderReviewStatus } from '@/lib/hw/bank/review';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
}

function fail(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

const USAGE = 'usage: hw-paper-review <sheet|status|publish|unpublish> <bank.json> [--kind sqp|past_paper] [--out file.html] [--by name]  |  <plan|apply> <verdicts.json> [--by name]';

function identityFromBank(path: string) {
  const parsed = parseBankFile(readFileSync(path, 'utf8'));
  if (!parsed.ok) fail(`The file is not a bank file:\n${parsed.problems.map((p) => `  - ${p}`).join('\n')}`);
  const problems = validateBank(parsed.bank);
  if (problems.length) fail(`The file does not add up (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  const kindArg = arg('kind');
  if (kindArg && kindArg !== 'sqp' && kindArg !== 'past_paper') fail('--kind is sqp or past_paper', 2);
  return expandBank(parsed.bank, { kind: kindArg as 'sqp' | 'past_paper' | undefined });
}

async function main() {
  const [cmd, path] = process.argv.slice(2);
  if (!['sheet', 'status', 'plan', 'apply', 'publish', 'unpublish'].includes(cmd ?? '') || !path || path.startsWith('--')) fail(USAGE, 2);

  // Everything that does not need the database is checked before it is opened.
  let verdictFile: ReturnType<typeof parseVerdictFile> | null = null;
  let paper: ReturnType<typeof identityFromBank> | null = null;
  let out = '';
  if (cmd === 'plan' || cmd === 'apply') {
    verdictFile = parseVerdictFile(readFileSync(path, 'utf8'));
    if (!verdictFile.ok) fail(`The file is not a verdicts file:\n${verdictFile.problems.map((p) => `  - ${p}`).join('\n')}`);
  } else {
    paper = identityFromBank(path);
    if (cmd === 'sheet') {
      const o = arg('out');
      if (!o) fail('sheet needs --out <file.html> (under hw-evals/: the sheet holds the board\'s paper text and must stay out of git)', 2);
      out = resolve(o);
      if (!out.split(sep).includes('hw-evals') && process.argv.indexOf('--anywhere') < 0) fail('The sheet holds the board\'s paper text: write it under a hw-evals/ folder (git ignores it), or pass --anywhere if you know where it is going.', 2);
    }
  }

  const { db } = await import('@/db');
  try {
    const rs = await import('@/lib/hw/bank/review-store');
    if (cmd === 'sheet' && paper) {
      const { renderReviewSheet } = await import('@/lib/hw/bank/review-sheet');
      // The attached pictures go into the sheet, so a person sees each beside its words.
      const { getHwObject } = await import('@/lib/hw/storage/r2');
      const { sniffImage } = await import('@/lib/hw/bank/figures');
      const readImage = async (key: string) => {
        const bytes = await getHwObject(key);
        const info = sniffImage(bytes);
        return 'problem' in info ? null : `data:${info.mime};base64,${Buffer.from(bytes).toString('base64')}`;
      };
      const data = await rs.loadSheetData(db, rs.identityOfExpanded(paper), { readImage });
      writeFileSync(out, renderReviewSheet(data), 'utf8');
      const draft = data.rows.filter((r) => r.status === 'draft');
      console.log(`Sheet written: ${out}\n${data.rows.length} questions, ${draft.length} to check, ${draft.filter((r) => r.needsCheck.length).length} with something to look at.`);
      return;
    }
    if ((cmd === 'publish' || cmd === 'unpublish') && paper) {
      const by = arg('by') ?? process.env.HW_IMPORT_BY ?? process.env.USERNAME ?? process.env.USER ?? 'owner';
      try {
        const r = await rs.setPublished(db, rs.identityOfExpanded(paper), cmd === 'publish', { actor: by });
        console.log(cmd === 'publish' ? `Published: ${r.rows} questions are now offered to learners (written ones once the AI check for board papers is eligible).` : `Unpublished: ${r.rows} questions are back to "checked"; learners are not offered this paper.`);
      } catch (e) {
        if (e instanceof rs.PublishRefusedError || e instanceof rs.PaperNotFoundError) fail(e.message);
        throw e;
      }
      return;
    }
    if (cmd === 'status' && paper) {
      console.log(renderReviewStatus(await rs.paperReviewStatus(db, rs.identityOfExpanded(paper))));
      return;
    }
    if (!verdictFile || !verdictFile.ok) return;
    const file = verdictFile.file;
    if (cmd === 'plan') {
      const plan = await rs.reviewDryRun(db, file);
      console.log(renderReviewPlan(plan, file.reviewer));
      if (plan.problems.length) process.exitCode = 1;
      return;
    }
    const by = arg('by') ?? process.env.HW_IMPORT_BY ?? process.env.USERNAME ?? process.env.USER ?? 'reviewer';
    try {
      const r = await rs.applyReview(db, file, { recordedBy: by });
      console.log(renderReviewPlan(r.plan, file.reviewer));
      console.log(r.written ? 'Recorded.' : 'Nothing to record: the bank already has exactly this.');
    } catch (e) {
      if (e instanceof rs.ReviewRefusedError) fail(`${renderReviewPlan(e.plan, file.reviewer)}\n${e.message}`);
      if (e instanceof rs.PaperNotFoundError) fail(e.message);
      throw e;
    }
  } finally {
    await (await import('@/lib/db/connection')).closePool();
  }
}

main().then(() => process.exit(process.exitCode ?? 0), (e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
