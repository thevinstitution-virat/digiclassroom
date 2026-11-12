// Reading a photographed printed answer-sheet page with code, not a model (docs/hw-eval/real-handwriting-read-1.md): find the four corner
// squares, straighten the photo onto the page's millimetre grid, read the identity strip (which sheet, which page), read the multiple-choice grid
// from the ink around each letter, and say which answer boxes have writing in them. The reader model then only transcribes the boxes that do,
// each cut out on its own. Pure: works on raw pixel arrays (crop.ts decodes and encodes with sharp).
//
// Anything this code cannot settle (no corners, a strip that does not check out, two letters marked) is said plainly; the caller then falls back
// to reading the whole page, or sends the question to a person. Nothing is guessed.

import { A4 } from './sheet';
import { cornerCentres, decodeStrip, MARKS, stripCells, type MmRect } from './sheet-geometry';

export interface Raster { width: number; height: number; channels: 1 | 3; data: Uint8Array }

export const VISION = {
  /** Corner search works on a copy this many pixels on its long side. */
  searchLongSide: 1600,
  /** Straightened page resolution, pixels per millimetre (8 ~ 200 dpi, what a 2400 px photo of A4 holds). */
  pxPerMm: 8,
  /** A pixel is ink when darker than this share of the paper's brightness nearby. */
  inkShare: 0.6,
  /** A letter is marked when its ink is this much above the row's usual level, and this many times it. */
  markAbove: 0.06,
  markTimes: 1.35,
  /** A box has writing when this share of its inside is ink, and at least this many pixels. */
  boxInkShare: 0.002,
  boxInkPixels: 150,
  /** Margin inside a box's printed border that is not counted (the border itself, a shaky cut). */
  boxInsetMm: 2.5,
} as const;

export function toGrey(img: Raster): Raster {
  if (img.channels === 1) return img;
  const out = new Uint8Array(img.width * img.height);
  for (let i = 0, j = 0; i < out.length; i++, j += 3) out[i] = (img.data[j]! * 299 + img.data[j + 1]! * 587 + img.data[j + 2]! * 114) / 1000;
  return { width: img.width, height: img.height, channels: 1, data: out };
}

/** Nearest-neighbour shrink, for the corner search only. */
export function shrink(g: Raster, longSide: number): { img: Raster; scale: number } {
  const s = Math.min(1, longSide / Math.max(g.width, g.height));
  if (s === 1) return { img: g, scale: 1 };
  const w = Math.max(1, Math.round(g.width * s)), h = Math.max(1, Math.round(g.height * s));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(g.height - 1, Math.floor(y / s));
    for (let x = 0; x < w; x++) out[y * w + x] = g.data[sy * g.width + Math.min(g.width - 1, Math.floor(x / s))]!;
  }
  return { img: { width: w, height: h, channels: 1, data: out }, scale: s };
}

type Pt = [number, number];

/**
 * The four corner squares' centres in the image (TL, TR, BL, BR), or null. Dark solid squares are found as connected areas darker than their
 * surroundings, square, mostly filled and among the largest such marks (the identity strip's squares are much smaller); the one nearest each
 * corner of the photo is taken, and the four must make a page-shaped quadrilateral.
 */
export function findCorners(grey: Raster): { points: [Pt, Pt, Pt, Pt] } | { reason: string } {
  const { img, scale } = shrink(grey, VISION.searchLongSide);
  const W = img.width, H = img.height, d = img.data;
  const win = Math.max(9, Math.round(Math.min(W, H) / 12)) | 1;
  const half = win >> 1;
  const ii = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) { row += d[y * W + x]!; ii[(y + 1) * (W + 1) + x + 1] = ii[y * (W + 1) + x + 1]! + row; }
  }
  const mean = (x: number, y: number) => {
    const x0 = Math.max(0, x - half), y0 = Math.max(0, y - half), x1 = Math.min(W, x + half + 1), y1 = Math.min(H, y + half + 1);
    return (ii[y1 * (W + 1) + x1]! - ii[y0 * (W + 1) + x1]! - ii[y1 * (W + 1) + x0]! + ii[y0 * (W + 1) + x0]!) / ((x1 - x0) * (y1 - y0));
  };
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = d[y * W + x]!; const m = mean(x, y); if (p < m - 25 && p < 0.75 * m) mask[y * W + x] = 1; }

  const side = Math.min(W, H);
  const sMin = side * 0.012, sMax = side * 0.07;
  const seen = new Uint8Array(W * H);
  const stack = new Int32Array(W * H);
  const cands: { cx: number; cy: number; area: number }[] = [];
  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0; stack[sp++] = start; seen[start] = 1;
    let area = 0, sx = 0, sy = 0, minX = W, maxX = 0, minY = H, maxY = 0;
    while (sp) {
      const i = stack[--sp]!; const x = i % W, y = (i - x) / W;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0 && mask[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (x < W - 1 && mask[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (y > 0 && mask[i - W] && !seen[i - W]) { seen[i - W] = 1; stack[sp++] = i - W; }
      if (y < H - 1 && mask[i + W] && !seen[i + W]) { seen[i + W] = 1; stack[sp++] = i + W; }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (bw < sMin || bh < sMin || bw > sMax || bh > sMax) continue;
    if (bw / bh < 0.6 || bw / bh > 1.67 || area / (bw * bh) < 0.75) continue;
    cands.push({ cx: sx / area, cy: sy / area, area });
  }
  if (cands.length < 4) return { reason: `found ${cands.length} corner-like marks, need 4` };
  const biggest = Math.max(...cands.map((c) => c.area));
  const big = cands.filter((c) => c.area >= 0.4 * biggest);
  const corners: Pt[] = [[0, 0], [W, 0], [0, H], [W, H]];
  const pick = corners.map(([X, Y]) => big.reduce((b, c) => (Math.hypot(c.cx - X, c.cy - Y) < Math.hypot(b.cx - X, b.cy - Y) ? c : b)));
  if (new Set(pick).size !== 4) return { reason: 'the same mark is nearest to two corners' };
  const [tl, tr, bl, br] = pick.map((c) => [c.cx, c.cy] as Pt) as [Pt, Pt, Pt, Pt];
  if (!(tl[0] < tr[0] && bl[0] < br[0] && tl[1] < bl[1] && tr[1] < br[1])) return { reason: 'the corner marks are not in page order' };
  const top = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), bottom = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const left = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]), right = Math.hypot(br[0] - tr[0], br[1] - tr[1]);
  const ratio = (left + right) / (top + bottom);
  const want = (A4.heightMm - 2 * (MARKS.cornerInsetMm + MARKS.cornerMm / 2)) / (A4.widthMm - 2 * (MARKS.cornerInsetMm + MARKS.cornerMm / 2));
  if (Math.abs(top - bottom) / Math.max(top, bottom) > 0.3 || ratio < want * 0.75 || ratio > want * 1.3) return { reason: 'the corner marks do not make a page shape' };
  if (Math.min(top, bottom) < 0.4 * W && Math.min(left, right) < 0.4 * H) return { reason: 'the page is too small in the photo' };
  const up = (p: Pt): Pt => [p[0] / scale, p[1] / scale];
  return { points: [up(tl), up(tr), up(bl), up(br)] };
}

/** The 3x3 homography taking `from[i]` to `to[i]` (four point pairs). */
export function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]!, [u, v] = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[piv]![c]!)) piv = r;
    [A[c], A[piv]] = [A[piv]!, A[c]!];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r]![c]! / A[c]![c]!;
      const row = A[r]!, pivRow = A[c]!;
      for (let k = c; k < 9; k++) row[k] = row[k]! - f * pivRow[k]!;
    }
  }
  return [...Array.from({ length: 8 }, (_, i) => A[i]![8]! / A[i]![i]!), 1];
}
export const apply = (h: number[], x: number, y: number): Pt => {
  const w = h[6]! * x + h[7]! * y + h[8]!;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
};

/** The photo straightened onto the page: an A4 image at `pxPerMm`, each pixel sampled (bilinear) from where the page grid says it is. */
export function rectify(img: Raster, corners: [Pt, Pt, Pt, Pt], pxPerMm: number = VISION.pxPerMm): Raster {
  const h = homography(cornerCentres(), corners);
  const W = Math.round(A4.widthMm * pxPerMm), H = Math.round(A4.heightMm * pxPerMm), ch = img.channels;
  const out = new Uint8Array(W * H * ch);
  const iw = img.width, ih = img.height, src = img.data;
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const [sx, sy] = apply(h, (u + 0.5) / pxPerMm, (v + 0.5) / pxPerMm);
      const x0 = Math.floor(sx - 0.5), y0 = Math.floor(sy - 0.5), fx = sx - 0.5 - x0, fy = sy - 0.5 - y0;
      const o = (v * W + u) * ch;
      const xa = Math.min(iw - 1, Math.max(0, x0)), xb = Math.min(iw - 1, Math.max(0, x0 + 1));
      const ya = Math.min(ih - 1, Math.max(0, y0)), yb = Math.min(ih - 1, Math.max(0, y0 + 1));
      const i00 = (ya * iw + xa) * ch, i10 = (ya * iw + xb) * ch, i01 = (yb * iw + xa) * ch, i11 = (yb * iw + xb) * ch;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      for (let c = 0; c < ch; c++) out[o + c] = Math.round(src[i00 + c]! * w00 + src[i10 + c]! * w10 + src[i01 + c]! * w01 + src[i11 + c]! * w11);
    }
  }
  return { width: W, height: H, channels: ch, data: out };
}

const px = (mm: number, ppm: number) => Math.round(mm * ppm);
/** Brightness histogram (256 bins) of a region of a grey raster. */
function histogram(g: Raster, r: MmRect, ppm: number): { bins: Uint32Array; n: number } {
  const x0 = Math.max(0, px(r.x, ppm)), y0 = Math.max(0, px(r.y, ppm));
  const x1 = Math.min(g.width, px(r.x + r.w, ppm)), y1 = Math.min(g.height, px(r.y + r.h, ppm));
  const bins = new Uint32Array(256);
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { bins[g.data[y * g.width + x]!]!++; n++; }
  return { bins, n };
}
function percentile(h: { bins: Uint32Array; n: number }, p: number): number {
  if (!h.n) return 255;
  const want = p * h.n;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += h.bins[v]!; if (acc >= want) return v; }
  return 255;
}
const meanOf = (h: { bins: Uint32Array; n: number }) => { let s = 0; for (let v = 0; v < 256; v++) s += v * h.bins[v]!; return h.n ? s / h.n : 255; };
const shrinkRect = (r: MmRect, by: number): MmRect => ({ x: r.x + by, y: r.y + by, w: Math.max(0, r.w - 2 * by), h: Math.max(0, r.h - 2 * by) });

/** The sheet code and page the identity strip spells, on a straightened page; null when it does not check out. */
export function readStrip(page: Raster, ppm: number = VISION.pxPerMm): { code: string; page: number } | null {
  const g = toGrey(page);
  const means = stripCells().map((c) => meanOf(histogram(g, shrinkRect(c, c.w * 0.25), ppm)));
  const lo = Math.min(...means), hi = Math.max(...means);
  if (hi - lo < 50) return null;
  const cut = (lo + hi) / 2;
  const on = means.map((m) => m < cut);
  if (!on[0] || !on[on.length - 1]) return null;
  return decodeStrip(on.slice(1, -1));
}

/** Share of a region's pixels that are ink: darker than `inkShare` of the paper's brightness there. */
export function inkShare(page: Raster, r: MmRect, ppm: number = VISION.pxPerMm, paperFrom?: MmRect): { share: number; pixels: number } {
  const g = toGrey(page);
  const h = histogram(g, r, ppm);
  const paper = percentile(paperFrom ? histogram(g, paperFrom, ppm) : h, 0.9);
  let n = 0;
  const cut = VISION.inkShare * paper;
  for (let v = 0; v < 256 && v < cut; v++) n += h.bins[v]!;
  return { share: h.n ? n / h.n : 0, pixels: n };
}

export type GridMark = { numbers: number[]; letter: 'A' | 'B' | 'C' | 'D' | null; state: 'marked' | 'blank' | 'several'; ink: number[] };

/** The letter marked in each row of a grid block: the one whose surroundings carry clearly more ink than the row's others. */
export function readGrid(page: Raster, grid: { rect: MmRect; entries: { numbers: number[]; bubbles: { letter: 'A' | 'B' | 'C' | 'D'; rect: MmRect }[] }[] }, ppm: number = VISION.pxPerMm): GridMark[] {
  const pad = (MARKS.gridGap - 0.2) / 2 + 0.6; // each window reaches just short of the next bubble's
  return grid.entries.map((e) => {
    const ink = e.bubbles.map((b) => inkShare(page, { x: b.rect.x - pad, y: b.rect.y - pad, w: b.rect.w + 2 * pad, h: b.rect.h + 2 * pad }, ppm, grid.rect).share);
    // the row's usual level: its two least-inked letters (so even two marked letters both stand out)
    const sorted = [...ink].sort((a, b) => a - b);
    const usual = (sorted[0]! + sorted[1]!) / 2;
    const marked = ink.map((x, i) => ({ x, i })).filter(({ x }) => x >= usual + VISION.markAbove && x >= usual * VISION.markTimes);
    if (marked.length === 1) return { numbers: e.numbers, letter: e.bubbles[marked[0]!.i]!.letter, state: 'marked', ink };
    return { numbers: e.numbers, letter: null, state: marked.length ? 'several' : 'blank', ink };
  });
}

/** Whether an answer box has writing in it (its printed border and a margin inside it are not counted). */
export function boxHasWriting(page: Raster, box: MmRect, ppm: number = VISION.pxPerMm): boolean {
  const { share, pixels } = inkShare(page, shrinkRect(box, VISION.boxInsetMm), ppm, box);
  return share >= VISION.boxInkShare && pixels >= VISION.boxInkPixels;
}

/** A rectangle of a straightened page, with a margin, as its own raster (for reading). */
export function cropMm(page: Raster, r: MmRect, padMm = 1.5, ppm: number = VISION.pxPerMm): Raster {
  const x0 = Math.max(0, px(r.x - padMm, ppm)), y0 = Math.max(0, px(r.y - padMm, ppm));
  const x1 = Math.min(page.width, px(r.x + r.w + padMm, ppm)), y1 = Math.min(page.height, px(r.y + r.h + padMm, ppm));
  const w = x1 - x0, h = y1 - y0, ch = page.channels;
  const out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) out.set(page.data.subarray(((y0 + y) * page.width + x0) * ch, ((y0 + y) * page.width + x1) * ch), y * w * ch);
  return { width: w, height: h, channels: ch, data: out };
}
