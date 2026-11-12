// Exam packages: the printed answer sheet read by code — page identity strip, geometry, corners, straightening, the letter grid, inked boxes.

import { sheetLayout, A4, SHEET } from '@/lib/hw/exams/sheet';
import { decodeStrip, encodeStrip, pageGeometry } from '@/lib/hw/exams/sheet-geometry';
import { boxHasWriting, findCorners, readGrid, readStrip, rectify } from '@/lib/hw/exams/sheet-vision';
import { drawPage, photograph } from '@/test-support/hw/sheet-photo';

const setId = '06cf23e9-b3be-42de-851b-a884acc746d8';
const items = [
  ...Array.from({ length: 8 }, (_, i) => ({ number: i + 1, alt: null, choiceGroup: null, marks: 1, qtype: 'mcq', section: 'A' })),
  { number: 9, alt: null, choiceGroup: null, marks: 2, qtype: 'short', section: 'B' },
  { number: 10, alt: null, choiceGroup: null, marks: 3, qtype: 'short', section: 'B' },
  { number: 11, alt: null, choiceGroup: null, marks: 3, qtype: 'short', section: 'B' },
];
const layout = sheetLayout(setId, items);
const P = 6; // straightened at 6 px/mm in tests (8 in the product), to keep them quick

describe('the identity strip', () => {
  it('spells the sheet code and page, and reads back', () => {
    for (const [code, page] of [['06CF23', 1], ['FFFFFF', 63], ['000000', 1], ['A1B2C3', 17]] as const) {
      expect(decodeStrip(encodeStrip(code, page)!)).toEqual({ code, page });
    }
  });
  it('a single misread square, or an empty strip, does not check out', () => {
    const bits = encodeStrip('06CF23', 2)!;
    for (let i = 0; i < bits.length; i++) {
      const flipped = bits.map((b, k) => (k === i ? !b : b));
      expect(decodeStrip(flipped)).not.toEqual({ code: '06CF23', page: 2 });
    }
    expect(decodeStrip(Array(36).fill(false))).toBeNull();
  });
  it('a code that is not six hex characters, or a page out of range, is not encoded', () => {
    expect(encodeStrip('06CF2', 1)).toBeNull();
    expect(encodeStrip('06CF2G', 1)).toBeNull();
    expect(encodeStrip('06CF23', 64)).toBeNull();
  });
});

describe('pageGeometry', () => {
  it('places the grid and the boxes inside the page, in order, without overlapping', () => {
    for (const p of layout.pages) {
      const g = pageGeometry(p);
      let bottom = 0;
      for (const b of g) {
        expect(b.rect.y).toBeGreaterThanOrEqual(bottom);
        expect(b.rect.x).toBe(SHEET.marginMm);
        expect(b.rect.y + b.rect.h).toBeLessThanOrEqual(A4.heightMm - SHEET.marginMm - SHEET.footerMm + 1e-9);
        bottom = b.rect.y + b.rect.h;
        if (b.kind === 'grid') for (const e of b.entries) for (const bb of e.bubbles) {
          expect(bb.rect.x).toBeGreaterThan(b.rect.x);
          expect(bb.rect.x + bb.rect.w).toBeLessThan(b.rect.x + b.rect.w);
          expect(bb.rect.y + bb.rect.h).toBeLessThan(b.rect.y + b.rect.h);
        }
        else expect(b.box.x).toBe(SHEET.marginMm + SHEET.gutterMm);
      }
    }
  });
});

describe('reading a photographed sheet page by code', () => {
  const page1 = drawPage(layout, 1, { marks: { 1: 'B', 2: 'A', 3: 'D', 5: ['A', 'C'] }, ink: [10] });

  it('finds the corners, straightens the page and reads which page it is', () => {
    const photo = photograph(page1);
    const c = findCorners(photo);
    expect('points' in c).toBe(true);
    const flat = rectify(photo, (c as { points: never }).points, P);
    expect(readStrip(flat, P)).toEqual({ code: '06CF23', page: 1 });
  });

  it('reads each grid row: one letter, none, or several (for a person)', () => {
    const photo = photograph(page1, { tilt: -0.03, skew: -0.02 });
    const flat = rectify(photo, (findCorners(photo) as { points: never }).points, P);
    const grid = pageGeometry(layout.pages[0]!).find((g) => g.kind === 'grid')!;
    const rows = readGrid(flat, grid as never, P).map((r) => [r.numbers[0], r.letter, r.state]);
    expect(rows).toEqual([[1, 'B', 'marked'], [2, 'A', 'marked'], [3, 'D', 'marked'], [4, null, 'blank'], [5, null, 'several'], [6, null, 'blank'], [7, null, 'blank'], [8, null, 'blank']]);
  });

  it('tells a box with writing from an empty one', () => {
    const photo = photograph(page1);
    const flat = rectify(photo, (findCorners(photo) as { points: never }).points, P);
    const boxes = pageGeometry(layout.pages[0]!).flatMap((g) => (g.kind === 'answer' ? [[g.numbers[0], boxHasWriting(flat, g.box, P)]] : []));
    expect(boxes).toEqual([[9, false], [10, true]]);
  });

  it('a photo without the four corner squares is not guessed at', () => {
    const plain = { width: 1000, height: 1400, channels: 1 as const, data: new Uint8Array(1000 * 1400).fill(240) };
    expect(findCorners(plain)).toEqual({ reason: expect.stringContaining('corner-like marks') });
  });
});
