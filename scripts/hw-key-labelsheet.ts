// R_min labelling sheet (roadmap Phase 2.2). Two modes, no model calls, no database access:
//
//   export:  npx tsx scripts/hw-key-labelsheet.ts export --passages passages.jsonl --out hw-evals/rmin-labelling [--seed 20261104]
//   import:  npx tsx scripts/hw-key-labelsheet.ts import --sheet filled.csv --key hw-evals/rmin-labelling/key.json --out labels.json
//
// passages.jsonl: one JSON object per line from the shared library (passage_id, chapter_no, retrieval_class, block_type,
// section_title, page_start, page_end, text), read-only.
//
// The sheet holds 60 questions, shuffled: 40 exercise questions from the book (stratified over its chapters) and 20 written for
// topics that are NOT in the book. For each question the three best passages by a plain word-overlap score (BM25; not the dense
// retriever, so the labelling does not depend on the model it will judge) are shown as A, B and C. The person labels which of
// them answer the question: "A", "A,C", "none", or "elsewhere:5" (the book answers it in chapter 5, but not in A to C). The
// person is not told which questions are on-book. The answer key (which are on-book, and the chapter) goes to key.json, not into the sheet.
//
// import turns the filled sheet into the JSON that scripts/hw-key-calibrate.ts takes with --labels.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 1 ? process.argv[i + 1] : fallback;
}

interface Passage { passage_id: string; chapter_no: number; retrieval_class: string; block_type: string | null; section_title: string | null; page_start: number | null; page_end: number | null; text: string }
interface Question { id: string; text: string; onBook: boolean; chapter: number | null; sourcePassageId: string | null }

const CLASS_LEVEL = 'Class 9';
const SUBJECT = 'Science';
const MEDIUM = 'English';

// Written for this sheet: topics of Class 9 to 10 Social Science, Mathematics and English, none of them in a Science book.
const OFF_BOOK = [
  'What were the main causes of the French Revolution?',
  'Describe the climate of India during the monsoon season.',
  'What is a democracy? State two of its features.',
  'Explain the poverty line and how it is estimated in India.',
  'State the Pythagoras theorem and give one example.',
  'Why did the Russian Revolution of 1917 take place?',
  'How is a noun different from a pronoun? Give examples.',
  'What is the role of the Election Commission of India?',
  'Name the main features of the drainage system of India.',
  'Write a short note on the Industrial Revolution in England.',
  'State the Basic Proportionality Theorem.',
  'How did the nationalist movement grow in Indo-China?',
  'What is globalisation and how has it affected small producers?',
  'Explain mean, median and mode with an example.',
  'What does the Preamble of the Indian Constitution say about justice?',
  'How are trade unions useful for workers?',
  'Describe the structure of government in a federal system.',
  'What was the Non-Cooperation Movement and why was it started?',
  'Find the roots of the quadratic equation x squared minus 5x plus 6 equals 0.',
  'What is unemployment and what are its types in rural India?',
];

// ── a small seeded generator, so the sheet can be rebuilt exactly ────────────
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ── BM25 over the reference passages ─────────────────────────────────────────
const STOP = new Set('a an the of in on at to for and or is are was were be been being it its this that these those with as by from what which who whom how why when where do does did can could should would will shall may might not no yes also than then there their them they he she we you your our i if but so such into about over under between each any all some one two three give state write explain describe name define list'.split(' '));
const tok = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)).filter((w) => w.length > 1 && !STOP.has(w));

class Bm25 {
  private tf: Map<string, number>[] = [];
  private len: number[] = [];
  private df = new Map<string, number>();
  private avg = 0;
  constructor(private docs: Passage[]) {
    for (const d of docs) {
      const t = tok(`${d.section_title ?? ''} ${d.text}`);
      const m = new Map<string, number>();
      for (const w of t) m.set(w, (m.get(w) ?? 0) + 1);
      this.tf.push(m);
      this.len.push(t.length);
      for (const w of m.keys()) this.df.set(w, (this.df.get(w) ?? 0) + 1);
    }
    this.avg = this.len.reduce((a, b) => a + b, 0) / Math.max(1, this.len.length);
  }
  top(query: string, k: number): Passage[] {
    const q = [...new Set(tok(query))];
    const N = this.docs.length;
    const scored = this.docs.map((d, i) => {
      let s = 0;
      for (const w of q) {
        const f = this.tf[i].get(w) ?? 0;
        if (!f) continue;
        const idf = Math.log(1 + (N - (this.df.get(w) ?? 0) + 0.5) / ((this.df.get(w) ?? 0) + 0.5));
        s += idf * ((f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (this.len[i] / this.avg))));
      }
      return { d, s };
    }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
    return scored.slice(0, k).map((x) => x.d);
  }
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n).trimEnd()} …`);
const pages = (p: Passage) => (p.page_start ? (p.page_end && p.page_end !== p.page_start ? `pp. ${p.page_start}-${p.page_end}` : `p. ${p.page_start}`) : '');

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function exportSheet() {
  const file = arg('passages');
  const out = arg('out', 'hw-evals/rmin-labelling')!;
  const seed = Number(arg('seed', '20261104'));
  if (!file) throw new Error('--passages is required');
  const all = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Passage);
  const reference = all.filter((p) => p.retrieval_class === 'reference' && p.text.trim().length >= 80);
  const practice = all.filter((p) => p.retrieval_class === 'practice' && /\?/.test(p.text) && p.text.length >= 35 && p.text.length <= 320 && !/\b(fig\.?|figure|diagram|table|graph|activity)\b/i.test(p.text) && p.text.split('?').length <= 3);
  const r = rng(seed);

  // 40 on-book: 4 chapters get 4, the rest 3 (the chapters that have the most candidates first)
  const chapters = [...new Set(practice.map((p) => p.chapter_no))].sort((a, b) => a - b);
  const byChapter = new Map(chapters.map((c) => [c, shuffle(practice.filter((p) => p.chapter_no === c), r)]));
  const order = [...chapters].sort((a, b) => (byChapter.get(b)!.length - byChapter.get(a)!.length) || (a - b));
  const picked: Passage[] = [];
  const want = 40;
  for (let round = 0; picked.length < want && round < 6; round++) {
    for (const c of order) {
      if (picked.length >= want) break;
      const next = byChapter.get(c)![round];
      if (next) picked.push(next);
    }
  }
  if (picked.length < want) throw new Error(`only ${picked.length} usable exercise questions found`);

  const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
  const questions: Question[] = [
    ...picked.map((p): Question => ({ id: '', text: clean(p.text), onBook: true, chapter: p.chapter_no, sourcePassageId: p.passage_id })),
    ...OFF_BOOK.map((t): Question => ({ id: '', text: t, onBook: false, chapter: null, sourcePassageId: null })),
  ];
  const shuffled = shuffle(questions, r).map((q, i) => ({ ...q, id: `Q${String(i + 1).padStart(2, '0')}` }));

  const bm = new Bm25(reference);
  const sheet = shuffled.map((q) => {
    const own = q.sourcePassageId;
    const cands = bm.top(q.text, 3 + (own ? 1 : 0)).filter((p) => p.passage_id !== own).slice(0, 3);
    return { q, cands };
  });

  mkdirSync(out, { recursive: true });
  // CSV (to fill in on a computer)
  const head = ['id', 'class', 'subject', 'medium', 'question', 'A_passage_id', 'A_chapter', 'A_pages', 'A_text', 'B_passage_id', 'B_chapter', 'B_pages', 'B_text', 'C_passage_id', 'C_chapter', 'C_pages', 'C_text', 'LABEL', 'notes'];
  const rows = sheet.map(({ q, cands }) => [q.id, CLASS_LEVEL, SUBJECT, MEDIUM, q.text, ...(['A', 'B', 'C'] as const).flatMap((_, i) => { const p = cands[i]; return p ? [p.passage_id, p.chapter_no, pages(p), clean(p.text)] : ['', '', '', '']; }), '', '']);
  writeFileSync(join(out, 'labelling-sheet.csv'), `﻿${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`);
  // answer key, kept apart from the sheet
  writeFileSync(join(out, 'key.json'), JSON.stringify(sheet.map(({ q, cands }) => ({ id: q.id, question: q.text, onBook: q.onBook, ownChapter: q.chapter, candidates: cands.map((p) => ({ passageId: p.passage_id, chapter: p.chapter_no })) })), null, 2));

  // printable (A4) sheet
  const blocks = sheet.map(({ q, cands }) => `
<section class="q">
  <div class="qh"><span class="id">${q.id}</span> ${esc(q.text)}</div>
  ${(['A', 'B', 'C'] as const).map((L, i) => { const p = cands[i]; return p ? `<div class="c"><b>${L}</b> <span class="meta">Chapter ${p.chapter_no}${pages(p) ? `, ${pages(p)}` : ''}${p.section_title ? `, ${esc(clip(p.section_title, 50))}` : ''}</span><br>${esc(clip(clean(p.text), 620))}</div>` : `<div class="c"><b>${L}</b> <span class="meta">(no passage)</span></div>`; }).join('')}
  <div class="lab">Passages that answer the question: <span class="cb"></span>A <span class="cb"></span>B <span class="cb"></span>C <span class="cb"></span>none of them <span class="cb"></span>the book answers it elsewhere: chapter ______ &nbsp; Note: ______________________</div>
</section>`).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>R_min labelling sheet</title>
<style>
@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:9.3pt;line-height:1.32;color:#111;margin:0}
h1{font-size:14pt;margin:0 0 2mm}.intro{border:1.2px solid #333;padding:2.5mm;margin-bottom:4mm}.intro p{margin:0 0 1.4mm}.intro ol{margin:1mm 0 1mm 5mm;padding:0}
.q{break-inside:avoid;border-top:1.5px solid #333;padding:2mm 0 2.5mm}.qh{font-size:10.2pt;font-weight:600;margin-bottom:1.2mm}.id{display:inline-block;background:#222;color:#fff;padding:0 1.8mm;border-radius:2px;margin-right:1.5mm}
.c{margin:0 0 1.3mm 3mm;padding-left:2mm;border-left:2px solid #aaa}.meta{color:#555;font-size:8.2pt}.lab{margin-top:1.3mm;font-size:9pt}
.cb{display:inline-block;width:3.3mm;height:3.3mm;border:1.2px solid #111;vertical-align:-0.5mm;margin:0 1mm 0 2.5mm}
</style></head><body>
<h1>Which passages answer the question? (60 questions)</h1>
<div class="intro">
<p><b>What this is for.</b> A program that finds textbook passages for a question must know how sure it has to be before it is trusted. To set that, we need people's judgement of which passages really answer which question. This is about <b>one book: NCERT Science, Class IX (English)</b>. Some questions are not about this book at all; that is on purpose.</p>
<p><b>What to do, for each question:</b></p>
<ol>
<li>Read the question and the three passages A, B, C (shortened; "…" means the passage goes on).</li>
<li>Tick every passage that contains what a student needs to answer the question. A passage that only mentions a word from the question does not count.</li>
<li>If none of them does, tick <b>none of them</b>. If you know the book answers the question somewhere else, also tick <b>elsewhere</b> and write the chapter number.</li>
<li>Judge only from the passage and the question, not from what you know from other books.</li>
</ol>
<p>Work alone. About 40 minutes. <b>If you fill the CSV file instead of this page</b>, write the label in the LABEL column: <code>A</code>, <code>A,C</code>, <code>none</code>, or <code>elsewhere:5</code> (chapter 5).</p>
</div>
${blocks}
</body></html>`;
  writeFileSync(join(out, 'labelling-sheet.html'), html);
  const onBook = sheet.filter((s) => s.q.onBook).length;
  const withCands = sheet.filter((s) => s.cands.length === 3).length;
  console.log(`wrote ${sheet.length} questions (${onBook} on-book, ${sheet.length - onBook} off-book); ${withCands} have three candidate passages; chapters used: ${[...new Set(picked.map((p) => p.chapter_no))].sort((a, b) => a - b).join(',')}`);
  console.log(`files: ${join(out, 'labelling-sheet.csv')}, ${join(out, 'labelling-sheet.html')} (print to PDF), ${join(out, 'key.json')} (do not give to the labeller)`);
}

function importSheet() {
  const sheet = arg('sheet');
  const keyFile = arg('key');
  const out = arg('out', 'labels.json')!;
  if (!sheet || !keyFile) throw new Error('--sheet and --key are required');
  const rows = parseCsv(readFileSync(sheet, 'utf8'));
  const header = rows[0];
  const col = (n: string) => header.indexOf(n);
  const need = ['id', 'question', 'LABEL', 'A_passage_id', 'B_passage_id', 'C_passage_id'].filter((n) => col(n) < 0);
  if (need.length) throw new Error(`the sheet lacks columns: ${need.join(', ')}`);
  const labels: Record<string, unknown>[] = [];
  const problems: string[] = [];
  let blank = 0;
  for (const r of rows.slice(1)) {
    const id = r[col('id')];
    const raw = (r[col('LABEL')] ?? '').trim();
    if (!raw) { blank++; continue; }
    const base = { question: r[col('question')], classLevel: r[col('class')] || CLASS_LEVEL, subject: r[col('subject')] || SUBJECT, medium: r[col('medium')] || MEDIUM, origin: `labelsheet:${id}` };
    const low = raw.toLowerCase().replace(/\s+/g, '');
    if (low === 'none') { labels.push({ ...base, answerable: false }); continue; }
    const el = /^elsewhere:(\d+)$/.exec(low);
    if (el) { labels.push({ ...base, answerable: true, relevantChapter: `Chapter ${el[1]}` }); continue; }
    const letters = low.split(/[,;+]/).filter(Boolean);
    if (!letters.length || letters.some((l) => !['a', 'b', 'c'].includes(l))) { problems.push(`${id}: cannot read the label "${raw}"`); continue; }
    const ids = letters.map((l) => r[col(`${l.toUpperCase()}_passage_id`)]).filter(Boolean);
    if (!ids.length) { problems.push(`${id}: label "${raw}" names a passage that is empty`); continue; }
    labels.push({ ...base, answerable: true, relevantChunkIds: ids });
  }
  writeFileSync(out, JSON.stringify(labels, null, 2));
  const key = JSON.parse(readFileSync(keyFile, 'utf8')) as { id: string; onBook: boolean }[];
  console.log(`${labels.length} labelled (${labels.filter((l) => l.answerable).length} answerable, ${labels.filter((l) => !l.answerable).length} not), ${blank} still blank, ${problems.length} unreadable`);
  const disagree = key.filter((k) => { const l = labels.find((x) => (x.origin as string) === `labelsheet:${k.id}`); return l && Boolean(l.answerable) !== k.onBook; });
  console.log(`labels that disagree with how the question was chosen (on-book or not): ${disagree.length}${disagree.length ? ` (${disagree.map((d) => d.id).join(', ')}); check them` : ''}`);
  for (const p of problems) console.log(`  ! ${p}`);
  console.log(`wrote ${out}; run: npx tsx --tsconfig apps/api/tsconfig.json --env-file=apps/api/.env.local scripts/hw-key-calibrate.ts --labels ${out}`);
}

const mode = process.argv[2];
if (mode === 'export') exportSheet();
else if (mode === 'import') importSheet();
else { console.error('usage: hw-key-labelsheet.ts export|import ...'); process.exit(1); }
