// Exam packages, phase 4: measuring a photographed page in the browser (pure arithmetic on pixels).

import { GLARE_LUMA, measurePage, measureSize } from '@/lib/hw/exams/page-measure';
import { pageVerdict } from '@/lib/hw/exams/rules';

/** An RGBA picture from a grey level per pixel. */
const picture = (w: number, h: number, grey: (x: number, y: number) => number) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const g = grey(x, y); data[i] = data[i + 1] = data[i + 2] = g; data[i + 3] = 255; }
  return { data, width: w, height: h };
};
// "handwriting": dark strokes every few pixels on light paper
const page = (paper = 215, ink = 40) => picture(200, 260, (x, y) => (y % 9 < 2 && x % 23 < 17 ? ink : paper));
// the same page blurred: every pixel the average of an 9x9 box
const blurred = () => {
  const p = page();
  const w = p.width, h = p.height, src = Uint8ClampedArray.from(p.data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < h && xx >= 0 && xx < w) { s += src[(yy * w + xx) * 4]!; n++; } }
    const i = (y * w + x) * 4; p.data[i] = p.data[i + 1] = p.data[i + 2] = Math.round(s / n);
  }
  return p;
};
const verdictOf = (m: ReturnType<typeof measurePage>) => pageVerdict({ widthPx: 1600, heightPx: 2000, bytes: 900_000, ...m });

describe('measurePage', () => {
  it('a sharp, evenly lit page passes', () => {
    const m = measurePage(page());
    expect(m.sharpness).toBe(1);
    expect(m.brightness).toBeGreaterThan(0.6);
    expect(m.glare).toBe(0);
    expect(verdictOf(m)).toEqual({ ok: true });
  });
  it('the same page blurred is refused as blurred', () => {
    const m = measurePage(blurred());
    expect(m.sharpness).toBeLessThan(0.25);
    expect(verdictOf(m)).toEqual({ ok: false, why: 'too_blurred' });
  });
  it('a blank sheet has no detail at all', () => {
    expect(measurePage(picture(100, 100, () => 210)).sharpness).toBe(0);
  });
  it('a dark photo is refused as too dark', () => {
    expect(verdictOf(measurePage(page(30, 5)))).toEqual({ ok: false, why: 'too_dark' });
  });
  it('a blown-out patch counts as glare', () => {
    const m = measurePage(picture(100, 100, (x, y) => (x < 30 && y < 50 ? 255 : y % 7 < 2 ? 40 : 200)));
    expect(m.glare).toBeCloseTo(0.15, 2);
    expect(verdictOf(m)).toEqual({ ok: false, why: 'glare' });
    expect(GLARE_LUMA).toBe(250);
  });
  it('an empty picture measures nothing', () => {
    expect(measurePage({ data: new Uint8ClampedArray(0), width: 0, height: 0 })).toEqual({ brightness: 0, glare: 0, sharpness: 0 });
  });
});

describe('measureSize', () => {
  it('scales the long side to 800 and never enlarges', () => {
    expect(measureSize(4000, 3000)).toEqual({ width: 800, height: 600 });
    expect(measureSize(3000, 4000)).toEqual({ width: 600, height: 800 });
    expect(measureSize(640, 480)).toEqual({ width: 640, height: 480 });
  });
});
