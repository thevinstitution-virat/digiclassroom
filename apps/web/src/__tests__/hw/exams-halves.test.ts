// Exam packages: reading a booklet page as two overlapping halves (pure). docs/hw-eval/real-handwriting-read-1.md says why.

import { HALVES, halfRects, mergeHalves, seamOverlap } from '@/lib/hw/exams/halves';
import type { PageRead } from '@/lib/hw/exams/page-reader';

const seg = (over: Partial<PageRead['segments'][number]> = {}): PageRead['segments'][number] =>
  ({ box: [], numbersSeen: [], alternative: null, text: '', confidence: 0.95, unclearCount: 0, ...over });
const read = (over: Partial<PageRead> = {}): PageRead => ({ sheet: null, grid: [], segments: [], ...over });
const n = (number: number, confidence = 0.95) => [{ number, confidence }];

describe('halfRects', () => {
  it('cuts across the page into two overlapping halves, whatever its shape', () => {
    const [top, bottom] = halfRects(1700, 2400)!;
    expect(top).toEqual({ left: 0, top: 0, width: 1700, height: 1296 });
    expect(bottom).toEqual({ left: 0, top: 1104, width: 1700, height: 1296 });
    expect(top.height - bottom.top).toBe(Math.round(2400 * HALVES.overlap)); // the shared band
    expect(halfRects(2338, 1654)).not.toBeNull(); // a landscape scan is still cut top/bottom
  });
  it('a small page is read whole', () => {
    expect(halfRects(1000, 1199)).toBeNull();
    expect(halfRects(0, 3000)).toBeNull();
  });
});

describe('seamOverlap', () => {
  const w = (t: string) => t.toLowerCase().split(/\s+/);
  it('finds the longest run of words both halves read', () => {
    expect(seamOverlap(['a', 'grass', 'by', 'the', 'deer'], ['by', 'the', 'deer', 'which'])).toEqual({ topStart: 2, bottomCount: 3 });
    expect(seamOverlap(['x', 'present', 'in', 'humans'], ['present', 'in', 'humans', 'or', '46'])).toEqual({ topStart: 1, bottomCount: 3 });
  });
  it('allows a small reading difference inside the run, never at its ends', () => {
    expect(seamOverlap(w('of chromosomes from both the parents'), w('of chromosomes form both the parents ii'))).toEqual({ topStart: 0, bottomCount: 6 });
    expect(seamOverlap(['the', 'end'], ['an', 'end'])).toBeNull();
  });
  it('each half may read the seam its own way, and the runs differ in length (real page 23)', () => {
    const top = w('sin i sin r constant this constant is known as refractive index of medium 1 w r t the second medium');
    const bottom = w('this constant is known as refractive index of medium [?] with respect to medium [?] iii table aspect');
    // the bottom's run ends at its last "medium" before "[?] iii": its first 14 words
    expect(seamOverlap(top, bottom)).toEqual({ topStart: 5, bottomCount: 14 });
  });
  it('a seam in blank space has no overlap', () => {
    expect(seamOverlap(['answer', 'one'], ['q', '2', 'answer', 'two'])).toBeNull();
    expect(seamOverlap(['single'], ['single'])).toBeNull(); // one word is not enough to call it the same writing
  });
});

describe('mergeHalves', () => {
  it('an answer running across the seam stays one answer, the repeat read once', () => {
    const r = mergeHalves(
      read({ segments: [seg({ numbersSeen: n(30), text: '(a) There are total 23 pairs of chromosomes\npresent in humans' })] }),
      read({ segments: [seg({ text: 'present in humans or 46 chromosomes\nare present.', confidence: 0.75 }), seg({ numbersSeen: n(31), text: 'Adrenaline' })] }),
    );
    expect(r.segments).toEqual([
      seg({ numbersSeen: n(30), text: '(a) There are total 23 pairs of chromosomes\npresent in humans\nor 46 chromosomes\nare present.', confidence: 0.75 }),
      seg({ numbersSeen: n(31), text: 'Adrenaline' }),
    ]);
  });

  it('short answers read whole by both halves are kept once, each with its own number', () => {
    const r = mergeHalves(
      read({ segments: [seg({ numbersSeen: n(5), text: '(B) 5' }), seg({ numbersSeen: n(6), text: '(B) Al2O3 and MgO' })] }),
      read({ segments: [seg({ numbersSeen: n(6, 0.75), text: '(B) Al₂O₃ and MgO' }), seg({ numbersSeen: n(7), text: '(D) 1:8' })] }),
    );
    expect(r.segments.map((s) => [s.numbersSeen.map((x) => x.number), s.text])).toEqual([[[5], '(B) 5'], [[6], '(B) Al2O3 and MgO'], [[7], '(D) 1:8']]);
    expect(r.segments[1]!.numbersSeen).toEqual(n(6, 0.95)); // the surer read of the number is kept
  });

  it('a number only the bottom half saw is kept, so placement can use it (or send it to a person if they disagree)', () => {
    const r = mergeHalves(
      read({ segments: [seg({ text: 'Lamp A power 50W' })] }),
      read({ segments: [seg({ numbersSeen: n(22), text: 'Lamp A power 50W\nvolt 220V' })] }),
    );
    expect(r.segments).toEqual([seg({ numbersSeen: n(22), text: 'Lamp A power 50W\nvolt 220V' })]);
  });

  it('no overlap: the halves follow one another', () => {
    const r = mergeHalves(read({ segments: [seg({ text: 'first answer here' })] }), read({ segments: [seg({ text: 'second answer there' })] }));
    expect(r.segments.map((s) => s.text)).toEqual(['first answer here', 'second answer there']);
  });

  it('sheet code from the top; grid rows joined, and a row the two halves read differently loses its letter', () => {
    const r = mergeHalves(
      read({ sheet: { code: 'C3F245', page: 1 }, grid: [{ number: 1, letter: 'B' }, { number: 2, letter: 'C' }] }),
      read({ sheet: { code: 'C3F245', page: 9 }, grid: [{ number: 2, letter: 'D' }, { number: 3, letter: 'A' }] }),
    );
    expect(r.sheet).toEqual({ code: 'C3F245', page: 1 });
    expect(r.grid).toEqual([{ number: 1, letter: 'B' }, { number: 2, letter: null }, { number: 3, letter: 'A' }]);
    expect(mergeHalves(read(), read({ sheet: { code: 'C3F245', page: 2 } })).sheet).toEqual({ code: 'C3F245', page: 2 });
  });

  it('unreadable words are counted again after joining', () => {
    const r = mergeHalves(read({ segments: [seg({ text: 'the [?] cell divides', unclearCount: 1 })] }), read({ segments: [seg({ text: 'cell divides into [?] two', unclearCount: 1 })] }));
    expect(r.segments).toEqual([seg({ text: 'the [?] cell divides\ninto [?] two', unclearCount: 2 })]);
  });
});
