#!/usr/bin/env node
/**
 * lint-enriched-md.mjs — mechanical validator for enriched textbook markdown.
 *
 *   node lint-enriched-md.mjs <file.md> [...more files]
 *
 * Exit 0 = clean. Exit 1 = errors. Exit 2 = usage problem.
 *
 * Checks form only. It cannot tell you whether the transcription matches the
 * printed page — that is references/validation-checklist.md.
 *
 * If this passes a file you know is broken, the linter is wrong. Fix it.
 * See references/processing-prompts.md #6 for how to prove each check fails.
 */

import { readFileSync, existsSync } from 'node:fs';

const SCHEMA_VERSION = 2;

const REQUIRED_KEYS = [
  'schema_version', 'work_key', 'isbn', 'book_title', 'subject',
  'class_level', 'board', 'medium', 'publisher', 'edition', 'print_year',
  'chapter_number', 'chapter_title', 'chapter_pages', 'total_chapter_pages',
  'book_pack', 'processed_by', 'processed_date', 'validation_status',
];

const BLOCK_TYPES = [
  'FIGURE', 'TABLE', 'GRAPH', 'CASE STUDY', 'DIALOGUE', 'GLOSSARY TERM',
  'FEATURE BOX', 'QR CODE', 'DISCUSSION_PROMPT', 'ACTIVITY',
];

const AUTHORED_FIELDS = ['Prose summary', 'Curriculum relevance', 'Key insight', 'Summary'];

const BANNED = /\b(likely|probably|possibly|appears to|seems to|suggests|indicates|severe|dramatic|extreme|significant|sharp|steep|massive)\b/i;

const TRANSCRIPTION_FIELDS =
  /^(Description|Visual description|Data transcription|Key insight|Curriculum relevance|Prose summary|Summary):/;

function lint(path) {
  const src = readFileSync(path, 'utf8');
  const lines = src.split(/\r?\n/);
  const errors = [];
  const warnings = [];
  const E = (n, m) => errors.push(`  ERROR L${n}: ${m}`);
  const W = (n, m) => warnings.push(`  WARN  L${n}: ${m}`);

  if (src.charCodeAt(0) === 0xfeff) E(1, 'file starts with a UTF-8 BOM — save without BOM');
  if (/\r\n/.test(src)) W(1, 'CRLF line endings — prefer LF');

  // ---- E12: escaping ----------------------------------------------------
  lines.forEach((l, i) => {
    const m = l.match(/\\[[\]_*#\-`]/);
    if (m) E(i + 1, `escaped markdown "${m[0]}" — emit raw (E12): ${l.trim().slice(0, 60)}`);
  });

  // ---- frontmatter ------------------------------------------------------
  if (!/^---$/.test(lines[0] ?? '')) {
    E(1, 'file must open with a bare `---` on line 1 (E12)');
  }
  const fmEnd = lines.findIndex((l, i) => i > 0 && /^---$/.test(l));
  if (fmEnd < 1) E(1, 'frontmatter is not closed by a `---` line');
  const fm = fmEnd > 0 ? lines.slice(1, fmEnd).join('\n') : '';

  for (const k of REQUIRED_KEYS) {
    if (!new RegExp(`^${k}\\s*:`, 'm').test(fm)) E(1, `frontmatter missing required key: ${k}`);
  }

  const get = (k) => (fm.match(new RegExp(`^${k}\\s*:\\s*(.+)$`, 'm')) || [])[1]?.trim().replace(/^["']|["']$/g, '');

  const sv = get('schema_version');
  if (sv && Number(sv) !== SCHEMA_VERSION) E(1, `schema_version is ${sv}, expected ${SCHEMA_VERSION}`);

  const wk = get('work_key');
  if (wk && !/^\d{13}-[a-z0-9-]+$/.test(wk))
    E(1, `work_key "${wk}" malformed — expected 13 ISBN digits, hyphen, lowercase edition slug`);

  const isbn = get('isbn');
  if (isbn && (isbn.replace(/[^0-9Xx]/g, '').length !== 13))
    E(1, `isbn "${isbn}" is not a 13-digit ISBN`);

  const status = get('validation_status');
  if (status && !['PENDING', 'APPROVED', 'NEEDS_REVISION'].includes(status))
    E(1, `validation_status "${status}" must be PENDING, APPROVED or NEEDS_REVISION`);
  if (status && status !== 'APPROVED')
    W(1, `validation_status is ${status} — must be APPROVED before ingestion`);

  const bookPack = get('book_pack');
  if (bookPack && existsSync('book-packs') && !existsSync(`book-packs/${bookPack}.md`))
    W(1, `book_pack "${bookPack}" not found in book-packs/ (E15)`);

  // E13: notes must stay short
  const notes = get('notes') ?? '';
  const notesBlock = (fm.match(/^notes\s*:\s*([\s\S]*?)(?=^\w|$)/m) || [])[1] ?? notes;
  if (notesBlock.split(/\s+/).filter(Boolean).length > 60)
    E(1, 'notes: exceeds ~60 words — metadata only, 1-2 sentences (E13)');

  // ---- E11: dashes in page references -----------------------------------
  lines.forEach((l, i) => {
    if (/Page\s*\d+\s*[–—]/.test(l))
      E(i + 1, 'en/em-dash in a block page range — ASCII hyphen only (E11)');
    if (/^chapter_pages\s*:\s*\d+\s*[–—]/.test(l))
      E(i + 1, 'en/em-dash in chapter_pages — ASCII hyphen only (E11)');
  });

  // ---- page markers -----------------------------------------------------
  const pages = [];
  lines.forEach((l, i) => {
    const m = l.match(/^<!--\s*PAGE\s+(\d+)\s*-->$/);
    if (m) pages.push({ n: Number(m[1]), line: i + 1 });
    else if (/^<!--\s*PAGE\b/.test(l)) E(i + 1, `malformed PAGE marker: ${l.trim()}`);
  });

  if (!pages.length) {
    E(1, 'no <!-- PAGE N --> markers — every citation in the app depends on these');
  } else {
    pages.forEach((p, i) => {
      if (i && p.n !== pages[i - 1].n + 1)
        E(p.line, `PAGE ${p.n} follows PAGE ${pages[i - 1].n} — gap or out of sequence`);
    });
    const cp = (get('chapter_pages') || '').match(/^(\d+)\s*-\s*(\d+)$/);
    if (cp) {
      const [, s, e] = cp.map(Number);
      if (pages[0].n !== s) E(pages[0].line, `first PAGE marker is ${pages[0].n}, chapter_pages says ${s}`);
      if (pages.at(-1).n !== e) E(pages.at(-1).line, `last PAGE marker is ${pages.at(-1).n}, chapter_pages says ${e}`);
      if (pages.length !== e - s + 1)
        E(1, `${pages.length} PAGE markers for pages ${s}-${e} — expected ${e - s + 1}`);
      const tcp = Number(get('total_chapter_pages'));
      if (tcp && tcp !== e - s + 1) E(1, `total_chapter_pages ${tcp} disagrees with chapter_pages ${s}-${e}`);
    }
  }

  // ---- blocks: open/close balance, page tags ----------------------------
  const stack = [];
  lines.forEach((l, i) => {
    const close = l.match(/^\[\/([A-Z_ ]+)\]\s*$/);
    if (close) {
      const t = close[1].trim();
      if (!stack.length) E(i + 1, `[/${t}] closes nothing`);
      else if (stack.at(-1).t !== t) E(i + 1, `[/${t}] does not match open [${stack.at(-1).t}] from L${stack.at(-1).line}`);
      else stack.pop();
      return;
    }
    const open = l.match(/^\[([A-Z_][A-Z_ ]*?)(?:\s+[\d.]+)?\s*(\||\])/);
    if (!open) return;
    const t = open[1].trim();
    if (!BLOCK_TYPES.includes(t)) { W(i + 1, `unrecognised block type "${t}" — add it to block-types.md or the book pack`); return; }
    if (stack.length) E(i + 1, `[${t}] opened while [${stack.at(-1).t}] from L${stack.at(-1).line} is still open`);
    if (!/\|\s*Page\s*\d+/.test(l))
      E(i + 1, `[${t}] has no "| Page N |" tag — the block tag is what gets cited, not the surrounding marker`);
    stack.push({ t, line: i + 1 });
  });
  stack.forEach((b) => E(b.line, `[${b.t}] is never closed — the chunker cannot find its boundary`));

  // ---- E14: provenance on authored fields --------------------------------
  lines.forEach((l, i) => {
    const f = AUTHORED_FIELDS.find((k) => l.startsWith(`${k}:`));
    if (f && !/\[provenance:\s*authored\]/.test(l))
      E(i + 1, `"${f}:" is authored, not printed — must open with [provenance: authored] (E14)`);
  });

  // ---- E10 / F9 / F10: banned words in transcription ---------------------
  lines.forEach((l, i) => {
    if (!TRANSCRIPTION_FIELDS.test(l)) return;
    const m = l.match(BANNED);
    if (m) E(i + 1, `speculative or characterising word "${m[0]}" in a transcription field (E10, F9, F10)`);
  });

  // ---- leftovers and source corruption -----------------------------------
  lines.forEach((l, i) => {
    if (/\b(TODO|FIXME|XXX)\b|\[INSERT/i.test(l)) E(i + 1, 'placeholder text left in file');
    if (/8LI7XSV|MPPEKI|]SJ:/.test(l)) E(i + 1, 'OCR font-corruption artefact — reprocess this page (E1)');
    if (/\[UNCLEAR/i.test(l)) W(i + 1, 'unresolved [UNCLEAR] marker — validator must confirm or resolve');
  });

  // ---- skipped content must be marked, not deleted -----------------------
  lines.forEach((l, i) => {
    if (/^<!--\s*SKIP FOR EMBEDDING/.test(l) && !/Reason:/.test(l))
      E(i + 1, 'SKIP marker without a Reason: — silent skips are indistinguishable from omissions (E4)');
  });

  return { errors, warnings };
}

// ---- run ------------------------------------------------------------------
const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node lint-enriched-md.mjs <file.md> [...]');
  process.exit(2);
}

let failed = 0;
for (const f of files) {
  if (!existsSync(f)) { console.error(`${f}: not found`); failed++; continue; }
  const { errors, warnings } = lint(f);
  console.log(`\n${f}`);
  warnings.forEach((w) => console.log(w));
  errors.forEach((e) => console.log(e));
  console.log(`  ${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length) failed++;
}
console.log('');
process.exit(failed ? 1 : 0);
