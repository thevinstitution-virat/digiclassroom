// Where everything on a printed answer-sheet page is, in millimetres from the page's top-left corner. One function, used both by the print
// screen (AnswerSheet.tsx draws every block at these positions) and by the code that reads a photographed page (sheet-vision.ts), so a box or a
// letter bubble on paper and in the reading code can never drift apart.
//
// Also the page-identity strip: a row of small squares between the two top corner marks that spells the sheet code and page number in bits,
// so code (not a model) can tell which sheet page a photo shows.

import { A4, SHEET, type SheetBlock, type SheetPage } from './sheet';

export interface MmRect { x: number; y: number; w: number; h: number }

export const MARKS = {
  /** Corner squares: 6 mm, 4 mm in from each edge. */
  cornerMm: 6,
  cornerInsetMm: 4,
  /** Identity strip: guard, 36 bits, guard. */
  stripX: 30,
  stripY: 5,
  stripPitch: 3,
  stripCell: 2.4,
  stripBits: 36,
  /** Grid block: padding and title height, and the bubbles' size and spacing. */
  gridPadTop: 2,
  gridPadX: 3,
  gridTitle: 4,
  gridLabel: 14,
  gridGap: 1.6,
  bubble: 5.5,
} as const;

/** Centres of the four corner squares, in page order TL, TR, BL, BR. */
export function cornerCentres(): [number, number][] {
  const c = MARKS.cornerInsetMm + MARKS.cornerMm / 2;
  return [[c, c], [A4.widthMm - c, c], [c, A4.heightMm - c], [A4.widthMm - c, A4.heightMm - c]];
}
export function cornerRects(): MmRect[] {
  return cornerCentres().map(([x, y]) => ({ x: x - MARKS.cornerMm / 2, y: y - MARKS.cornerMm / 2, w: MARKS.cornerMm, h: MARKS.cornerMm }));
}

/** The strip's cells (guard, bits, guard), left to right. */
export function stripCells(): MmRect[] {
  return Array.from({ length: MARKS.stripBits + 2 }, (_, i) => ({ x: MARKS.stripX + i * MARKS.stripPitch, y: MARKS.stripY, w: MARKS.stripCell, h: MARKS.stripCell }));
}

const HEX = '0123456789ABCDEF';
/** The 36 bits for a sheet code (six hex characters: a set id's start) and a page (1-63): 24 + 6 bits, and a 6-bit check. Null if not encodable. */
export function encodeStrip(code: string, page: number): boolean[] | null {
  if (!/^[0-9A-F]{6}$/.test(code) || !Number.isInteger(page) || page < 1 || page > 63) return null;
  const bits: number[] = [];
  for (const ch of code) { const v = HEX.indexOf(ch); for (let b = 3; b >= 0; b--) bits.push((v >> b) & 1); }
  for (let b = 5; b >= 0; b--) bits.push((page >> b) & 1);
  let sum = 0;
  for (let i = 0; i < 30; i += 6) sum += parseInt(bits.slice(i, i + 6).join(''), 2);
  const check = (sum + 0x15) % 64; // offset so an all-blank strip never checks out
  for (let b = 5; b >= 0; b--) bits.push((check >> b) & 1);
  return bits.map((b) => b === 1);
}
export function decodeStrip(bits: boolean[]): { code: string; page: number } | null {
  if (bits.length !== MARKS.stripBits) return null;
  const n = bits.map((b) => (b ? 1 : 0));
  const val = (from: number, len: number) => parseInt(n.slice(from, from + len).join(''), 2);
  let sum = 0;
  for (let i = 0; i < 30; i += 6) sum += val(i, 6);
  if ((sum + 0x15) % 64 !== val(30, 6)) return null;
  const code = Array.from({ length: 6 }, (_, i) => HEX[val(i * 4, 4)]).join('');
  const page = val(24, 6);
  return page >= 1 ? { code, page } : null;
}

export type BlockGeometry =
  | { kind: 'grid'; rect: MmRect; title: MmRect; entries: { label: string; numbers: number[]; labelRect: MmRect; bubbles: { letter: 'A' | 'B' | 'C' | 'D'; rect: MmRect }[] }[] }
  | { kind: 'answer' | 'extra'; rect: MmRect; gutter: MmRect; box: MmRect; numbers: number[] };

/** Every block of one sheet page, placed. `firstPageExtra` is the name/attempt/date row printed on page 1 for a candidate. */
export function pageGeometry(page: Pick<SheetPage, 'page' | 'blocks'>, firstPageExtra = true): BlockGeometry[] {
  let y = SHEET.marginMm + SHEET.headerMm + (page.page === 1 && firstPageExtra ? SHEET.firstPageExtraMm : 0);
  const x = SHEET.marginMm;
  const width = A4.widthMm - 2 * SHEET.marginMm;
  const out: BlockGeometry[] = [];
  for (const b of page.blocks as SheetBlock[]) {
    const rect = { x, y, w: width, h: b.heightMm };
    if (b.kind === 'grid') {
      const colW = (width - 2 * MARKS.gridPadX) / SHEET.gridPerRow;
      const top = y + MARKS.gridPadTop + MARKS.gridTitle;
      const entries = b.entries.map((e, i) => {
        const cx = x + MARKS.gridPadX + (i % SHEET.gridPerRow) * colW;
        const cy = top + Math.floor(i / SHEET.gridPerRow) * SHEET.gridRowMm;
        const by = cy + (SHEET.gridRowMm - MARKS.bubble) / 2;
        return {
          label: e.label, numbers: e.numbers,
          labelRect: { x: cx, y: cy, w: MARKS.gridLabel, h: SHEET.gridRowMm },
          bubbles: (['A', 'B', 'C', 'D'] as const).map((letter, k) => ({
            letter, rect: { x: cx + MARKS.gridLabel + MARKS.gridGap + k * (MARKS.bubble + MARKS.gridGap), y: by, w: MARKS.bubble, h: MARKS.bubble },
          })),
        };
      });
      out.push({ kind: 'grid', rect, title: { x: x + MARKS.gridPadX, y: y + MARKS.gridPadTop, w: width - 2 * MARKS.gridPadX, h: MARKS.gridTitle }, entries });
    } else {
      out.push({
        kind: b.kind, rect, numbers: b.kind === 'answer' ? b.numbers : [],
        gutter: { x, y, w: SHEET.gutterMm, h: b.heightMm },
        box: { x: x + SHEET.gutterMm, y, w: width - SHEET.gutterMm, h: b.heightMm },
      });
    }
    y += b.heightMm + SHEET.gapMm;
  }
  return out;
}
