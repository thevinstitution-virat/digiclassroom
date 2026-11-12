// Test fixture: a printed answer-sheet page drawn in pixels from sheet-geometry.ts, marked and written on, then "photographed" (tilted, in
// perspective, on a table). Shared by the sheet-vision and sheet-read tests.

import { A4, type SheetLayout } from '@/lib/hw/exams/sheet';
import { cornerRects, encodeStrip, pageGeometry, stripCells, type MmRect } from '@/lib/hw/exams/sheet-geometry';
import { apply, homography, type Raster } from '@/lib/hw/exams/sheet-vision';

export const PPM = 8;
type Mark = 'A' | 'B' | 'C' | 'D';

export function drawPage(layout: SheetLayout, pageNo: number, opts: { marks?: Record<number, Mark | Mark[]>; ink?: number[]; extraInk?: boolean } = {}): Raster {
  const W = Math.round(A4.widthMm * PPM), H = Math.round(A4.heightMm * PPM);
  const d = new Uint8Array(W * H).fill(250);
  const fill = (r: MmRect, v: number) => {
    for (let y = Math.round(r.y * PPM); y < Math.round((r.y + r.h) * PPM); y++) for (let x = Math.round(r.x * PPM); x < Math.round((r.x + r.w) * PPM); x++) if (x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = v;
  };
  const outline = (r: MmRect, t: number, v: number) => { fill({ ...r, h: t }, v); fill({ ...r, y: r.y + r.h - t, h: t }, v); fill({ ...r, w: t }, v); fill({ ...r, x: r.x + r.w - t, w: t }, v); };
  const ring = (cx: number, cy: number, rad: number, t: number, v: number) => {
    for (let y = Math.floor((cy - rad - t) * PPM); y <= Math.ceil((cy + rad + t) * PPM); y++) for (let x = Math.floor((cx - rad - t) * PPM); x <= Math.ceil((cx + rad + t) * PPM); x++) {
      const dist = Math.hypot(x / PPM - cx, y / PPM - cy);
      if (Math.abs(dist - rad) <= t / 2 && x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = v;
    }
  };
  for (const r of cornerRects()) fill(r, 10);
  const bits = [true, ...encodeStrip(layout.code, pageNo)!, true];
  stripCells().forEach((c, i) => { if (bits[i]) fill(c, 10); });
  const page = layout.pages.find((p) => p.page === pageNo)!;
  for (const g of pageGeometry(page)) {
    if (g.kind === 'grid') {
      outline(g.rect, 0.3, 80);
      for (const e of g.entries) {
        fill({ x: e.labelRect.x, y: e.labelRect.y + 3, w: 5, h: 3 }, 20); // the printed "Q1"
        const want = opts.marks?.[e.numbers[0]!];
        for (const b of e.bubbles) {
          const cx = b.rect.x + b.rect.w / 2, cy = b.rect.y + b.rect.h / 2;
          ring(cx, cy, b.rect.w / 2, 0.3, 60);
          fill({ x: cx - 0.6, y: cy - 0.8, w: 1.2, h: 1.6 }, 40); // the printed letter
          if (want && (Array.isArray(want) ? want : [want]).includes(b.letter)) ring(cx, cy, 3.3, 0.5, 45); // the learner's circle
        }
      }
    } else {
      outline(g.box, 0.3, 110);
      fill({ x: g.gutter.x, y: g.gutter.y + 1, w: 10, h: 5 }, 20); // the printed "Q9"
      const write = g.kind === 'answer' ? g.numbers.some((n) => opts.ink?.includes(n)) : opts.extraInk;
      if (write) for (let line = 0; line < 4; line++) for (let k = 0; k < 9; k++) fill({ x: g.box.x + 6 + k * 14, y: g.box.y + 8 + line * 9, w: 9, h: 0.5 }, 35);
    }
  }
  return { width: W, height: H, channels: 1, data: d };
}

/** The page as a phone would see it: on a table, tilted, in perspective, `width` x `height` pixels, grey. */
export function photograph(page: Raster, opts: { width?: number; height?: number; tilt?: number; skew?: number } = {}): Raster {
  const W = opts.width ?? 1400, H = opts.height ?? 1900, tilt = opts.tilt ?? 0.04, skew = opts.skew ?? 0.03;
  // where the page's corners land in the photo
  const corners: [number, number][] = [[W * 0.1 + W * skew, H * 0.08], [W * 0.9, H * 0.08 + H * tilt], [W * 0.1, H * 0.92 - H * tilt * 0.5], [W * 0.9 - W * skew, H * 0.92]];
  const toPage = homography(corners, [[0, 0], [page.width, 0], [0, page.height], [page.width, page.height]]);
  const d = new Uint8Array(W * H).fill(115);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [u, v] = apply(toPage, x + 0.5, y + 0.5);
    const iu = Math.floor(u), iv = Math.floor(v);
    if (iu >= 0 && iv >= 0 && iu < page.width && iv < page.height) d[y * W + x] = page.data[iv * page.width + iu]! * (0.85 + 0.15 * (x / W)); // light from one side
  }
  return { width: W, height: H, channels: 1, data: d };
}

export const toRgb = (g: Raster): Raster => {
  const out = new Uint8Array(g.width * g.height * 3);
  for (let i = 0; i < g.width * g.height; i++) out[i * 3] = out[i * 3 + 1] = out[i * 3 + 2] = g.data[i]!;
  return { width: g.width, height: g.height, channels: 3, data: out };
};
