// Phase 1d, task 2.2: the person-check sheet for a dataset. One row per item: the question, the key point, the variant text, the
// rule it tests, the expected marks under each partial-credit rule, and blank columns for the checker. Written as a CSV (UTF-8 with a
// byte-order mark, so Excel shows Devanagari) and as a printable HTML page (A4 landscape). The review tools of the evaluator
// (review.ts) only sample a draft for a freeze, so this exports the whole set; the itemId column and the approved/rejected
// verdict are the shape `hw-eval-mutate.ts freeze --reviews` reads.
//
//   npm run hw:eval:sheet -- --dataset heldout-1d@v1 --out ../../docs/hw-eval/person-check/heldout-1d-v1 [--datasets-root ../../hw-evals/datasets]
//
// Then, for the PDF (Devanagari needs a font the machine has; Edge uses Nirmala UI):
//   msedge --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=<out>/person-check-sheet.pdf file:///<out>/person-check-sheet.html

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}
const csv = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
const esc = (x: unknown) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
const num = (n: number) => String(Math.round(n * 100) / 100);

async function main() {
  const { loadDataset } = await import('@/lib/hw/eval/dataset');
  const ds = loadDataset(arg('datasets-root', '../../hw-evals/datasets')!, arg('dataset')!);
  const out = arg('out')!;
  mkdirSync(out, { recursive: true });

  const order: Record<string, number> = { original: 0, near_miss: 99 };
  type Row = { itemId: string; questionId: string; n: number; question: string; passage: string; medium: string; keyPoints: string; keyPoint: string; variant: string; rule: string; tests: string; zero: string; half: string; full: string; marks: number };
  const rows: Row[] = [];
  const qIds = [...new Set(ds.items.map((i) => i.question.id))];
  for (const qid of qIds) {
    const items = ds.items.filter((i) => i.question.id === qid).sort((a, b) => (order[a.mutation!.type] ?? 50) - (order[b.mutation!.type] ?? 50) || a.mutation!.type.localeCompare(b.mutation!.type) || String(a.mutation!.target).localeCompare(String(b.mutation!.target)));
    items.forEach((it, i) => {
      const key = it.key!;
      const t = it.mutation!.target ? key.points.find((p) => p.id === it.mutation!.target) : undefined;
      const by = it.referenceMarks?.byRule;
      const total = (rule: 'zero' | 'half' | 'full') => (by?.[rule]?.total ?? it.referenceMarks!.total);
      rows.push({
        itemId: it.id, questionId: qid, n: i + 1, question: it.question.text, passage: it.question.passageText ?? '', medium: it.medium,
        keyPoints: key.points.map((p) => `${p.id} (${num(p.marks)}): ${p.text}`).join(' | '),
        keyPoint: t ? `${t.id} (${num(t.marks)}): ${t.text}` : 'all key points',
        variant: it.truthTranscript!.text, rule: it.mutation!.rule, tests: it.mutation!.type,
        zero: num(total('zero')), half: num(total('half')), full: num(total('full')), marks: it.question.marks,
      });
    });
  }

  const head = ['itemId', 'question', 'passage', 'key point tested', 'variant text', 'what it tests', 'rule behind the expected marks', 'out of', 'expected marks: zero rule', 'expected marks: half rule', 'expected marks: full rule', 'CHECKER verdict (approved = the expected marks are right / rejected = wrong)', 'CHECKER: marks you would give', 'CHECKER comment'];
  const lines = [head.map(csv).join(',')];
  for (const r of rows) lines.push([r.itemId, r.question, r.passage, r.keyPoint, r.variant, r.tests, r.rule, r.marks, r.zero, r.half, r.full, '', '', ''].map(csv).join(','));
  writeFileSync(join(out, 'person-check-sheet.csv'), '﻿' + lines.join('\r\n') + '\r\n', 'utf8');

  const html: string[] = [`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Person-check sheet: ${esc(ds.name)}@${esc(ds.version)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: "Nirmala UI", "Segoe UI", "Noto Sans Devanagari", Arial, sans-serif; font-size: 9pt; color: #111; }
h1 { font-size: 14pt; margin: 0 0 4px; } h2 { font-size: 10.5pt; margin: 14px 0 3px; page-break-after: avoid; }
.note { font-size: 8.5pt; margin: 0 0 6px; } .q { background: #f1f1f1; padding: 4px 6px; margin: 10px 0 4px; page-break-after: avoid; }
.q p { margin: 2px 0; } table { border-collapse: collapse; width: 100%; table-layout: fixed; }
th, td { border: 0.6pt solid #666; padding: 2px 4px; vertical-align: top; word-wrap: break-word; }
th { background: #e4e4e4; font-size: 8pt; } tr { page-break-inside: avoid; } .num { text-align: center; }
.blank { height: 22px; } .near td { background: #fffbe6; }
</style></head><body>
<h1>Person-check sheet: ${esc(ds.name)}@${esc(ds.version)} (${ds.items.length} items, ${qIds.length} questions)</h1>
<p class="note">These answers and their expected marks were written by a program, not by students or teachers. For each row, read the variant against the key point and say whether the expected marks are right: write <b>approved</b> or <b>rejected</b>, the marks you would give, and a comment if you like. The three "expected" columns differ only for the yellow rows (one detail wrong in an otherwise right idea): <b>zero</b> = no marks for that point, <b>half</b> = half the point's marks (rounded down to a half mark), <b>full</b> = the point's full marks. Your answer for those rows is the marks you would give.</p>`];
  for (const qid of qIds) {
    const qr = rows.filter((r) => r.questionId === qid);
    html.push(`<div class="q"><p><b>Question (${esc(qr[0].medium)}, ${qr[0].marks} marks):</b> ${esc(qr[0].question)}</p>${qr[0].passage ? `<p><b>Passage:</b> ${esc(qr[0].passage)}</p>` : ''}<p><b>Key points:</b> ${esc(qr[0].keyPoints)}</p></div>`);
    html.push('<table><colgroup><col style="width:3%"><col style="width:17%"><col style="width:33%"><col style="width:13%"><col style="width:4.5%"><col style="width:4.5%"><col style="width:4.5%"><col style="width:9%"><col style="width:5%"><col style="width:6.5%"></colgroup>');
    html.push('<tr><th>#</th><th>Key point tested</th><th>Variant text</th><th>Rule it tests</th><th>zero</th><th>half</th><th>full</th><th>Checker: approved / rejected</th><th>Marks you would give</th><th>Comment</th></tr>');
    for (const r of qr) {
      html.push(`<tr class="${r.tests === 'near_miss' ? 'near' : ''}"><td class="num">${r.n}</td><td>${esc(r.keyPoint)}</td><td>${esc(r.variant)}</td><td>${esc(r.rule)}</td><td class="num">${r.zero}</td><td class="num">${r.half}</td><td class="num">${r.full}</td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>`);
    }
    html.push('</table>');
  }
  html.push('</body></html>');
  writeFileSync(join(out, 'person-check-sheet.html'), html.join('\n'), 'utf8');
  console.log(`${rows.length} rows over ${qIds.length} questions -> ${join(out, 'person-check-sheet.csv')} and .html`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
