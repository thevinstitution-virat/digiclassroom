// The printed answer sheet for one set (owner's decision, 11 Nov 2026): A4, unruled so diagrams and tables can be drawn freely, every question's
// number pre-printed in a wide left margin with space sized to its marks, and every page carrying the sheet code and its page number in large
// print. A photographed page then says by itself which questions it holds, so matching pages to questions is certain for everything written in
// its own box; the reader's answer-key matching (mapping.ts) is only needed for extra pages, plain paper, or an answer written out of place.
//
// Pure layout here (millimetres); the print screen draws it. The sheet shows question numbers and marks only — never the questions — so a learner
// can print it before starting without seeing the paper.

export const A4 = { widthMm: 210, heightMm: 297 } as const;
export const SHEET = {
  marginMm: 12,
  headerMm: 18,
  /** Name, attempt and date boxes on the first page only. */
  firstPageExtraMm: 16,
  footerMm: 10,
  /** The left margin where the question number is printed; nothing is written there. */
  gutterMm: 24,
  gapMm: 3,
  gridRowMm: 9,
  gridPerRow: 4,
  extraPages: 2,
  maxBlockMm: 220,
} as const;

/** The writing space for a written answer: generous enough for a diagram or a table, never more than most of a page. */
export const answerHeightMm = (marks: number) => Math.min(SHEET.maxBlockMm, Math.round(20 + 28 * marks));

export interface SheetItem { number: number; alt: string | null; choiceGroup: string | null; marks: number; qtype: string; section: string }

export type SheetBlock =
  | { kind: 'grid'; heightMm: number; entries: { label: string; numbers: number[] }[] }
  | { kind: 'answer'; heightMm: number; label: string; numbers: number[]; alternatives: string[]; marks: number; section: string }
  | { kind: 'extra'; heightMm: number };

export interface SheetPage { page: number; label: string; blocks: SheetBlock[]; /** the question numbers whose own box is on this page */ numbers: number[] }
export interface SheetLayout { code: string; pages: SheetPage[]; totalPages: number }

const CHOICE = new Set(['mcq', 'assertion_reason']);

/** The short code printed on every page: the start of the set's id, upper case, readable in a photograph. */
export const sheetCode = (setId: string) => setId.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
export const pageLabel = (code: string, page: number) => `${code}-${page}`;

/** One unit per question as the candidate answers it: an internal choice ("Q12 (A) or (B)") is one unit, answered once. */
function units(items: SheetItem[]) {
  const out: { key: string; numbers: number[]; alts: string[]; marks: number; choice: boolean; section: string }[] = [];
  const byKey = new Map<string, (typeof out)[number]>();
  for (const it of items) {
    const key = it.choiceGroup ? `g:${it.choiceGroup}` : `n:${it.number}`;
    let u = byKey.get(key);
    if (!u) { u = { key, numbers: [], alts: [], marks: 0, choice: CHOICE.has(it.qtype), section: it.section }; byKey.set(key, u); out.push(u); }
    if (!u.numbers.includes(it.number)) u.numbers.push(it.number);
    if (it.alt && !u.alts.includes(it.alt)) u.alts.push(it.alt);
    u.marks = Math.max(u.marks, it.marks);
    u.choice = u.choice && CHOICE.has(it.qtype);
  }
  return out;
}
const labelOf = (numbers: number[]) => numbers.map((n) => `Q${n}`).join(' / ');

export function sheetLayout(setId: string, items: SheetItem[]): SheetLayout {
  const code = sheetCode(setId);
  const us = units(items);
  const usable = (page: number) => A4.heightMm - 2 * SHEET.marginMm - SHEET.headerMm - SHEET.footerMm - (page === 1 ? SHEET.firstPageExtraMm : 0);

  // the multiple choice answers go into one grid, placed where the first of them comes in the paper
  const gridUnits = us.filter((u) => u.choice);
  const blocks: SheetBlock[] = [];
  let gridPlaced = false;
  for (const u of us) {
    if (u.choice) {
      if (gridPlaced) continue;
      gridPlaced = true;
      const entries = gridUnits.map((g) => ({ label: labelOf(g.numbers), numbers: g.numbers }));
      // a grid taller than a page is split into page-sized grids below
      blocks.push({ kind: 'grid', heightMm: 8 + Math.ceil(entries.length / SHEET.gridPerRow) * SHEET.gridRowMm, entries });
      continue;
    }
    blocks.push({ kind: 'answer', heightMm: answerHeightMm(u.marks), label: labelOf(u.numbers), numbers: u.numbers, alternatives: u.alts, marks: u.marks, section: u.section });
  }

  const pages: SheetPage[] = [];
  let cur: SheetPage = { page: 1, label: pageLabel(code, 1), blocks: [], numbers: [] };
  let left = usable(1);
  const newPage = () => { pages.push(cur); cur = { page: cur.page + 1, label: pageLabel(code, cur.page + 1), blocks: [], numbers: [] }; left = usable(cur.page); };
  const place = (b: SheetBlock) => {
    if (b.heightMm > left && cur.blocks.length) newPage();
    cur.blocks.push(b);
    if (b.kind !== 'extra') for (const n of b.kind === 'grid' ? b.entries.flatMap((e) => e.numbers) : b.numbers) if (!cur.numbers.includes(n)) cur.numbers.push(n);
    left -= b.heightMm + SHEET.gapMm;
  };
  for (const b of blocks) {
    if (b.kind === 'grid') {
      // split a long grid so no part is taller than the room on a fresh page
      const rowsPerPage = Math.max(1, Math.floor((usable(2) - 8) / SHEET.gridRowMm));
      for (let i = 0; i < b.entries.length; i += rowsPerPage * SHEET.gridPerRow) {
        const entries = b.entries.slice(i, i + rowsPerPage * SHEET.gridPerRow);
        place({ kind: 'grid', heightMm: 8 + Math.ceil(entries.length / SHEET.gridPerRow) * SHEET.gridRowMm, entries });
      }
    } else place(b);
  }
  for (let i = 0; i < SHEET.extraPages; i++) {
    newPage();
    cur.blocks.push({ kind: 'extra', heightMm: usable(cur.page) });
  }
  pages.push(cur);
  return { code, pages, totalPages: pages.length };
}
