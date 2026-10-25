// The writing pad's stroke format, version 1. Shared by the browser (encode before upload)
// and the server (validate on upload, decode for replay later). Pure: no DOM, no Node APIs.
//
// Wire shape:
//   { v: 1, w, h, strokes: [{ t0, tool, pts: [[x, y, p, dt], ...] }] }
// - w, h: pad size in CSS pixels at capture time (integers).
// - t0:   ms from the start of the session to the stroke's first point.
// - tool: the pointer type that drew it.
// - pts:  integers. The first point is absolute; every later point is a delta from the
//         previous one (x, y, dt). p is pressure 0..1000, always absolute (it is noisy, deltas
//         would not compress better). dt is ms since the previous point (0 for the first).
//
// Erased strokes are removed from the list, not stored as eraser strokes; how much was
// erased is recorded in ink_stats instead.

export const STROKE_FORMAT_VERSION = 1;

export type InkTool = 'pen' | 'touch' | 'mouse';

/** A point as the pad records it: absolute position, pressure 0..1, time since stroke start. */
export interface InkPoint {
  x: number;
  y: number;
  p: number;
  t: number;
}

export interface InkStroke {
  t0: number;
  tool: InkTool;
  points: InkPoint[];
}

export interface InkDocument {
  w: number;
  h: number;
  strokes: InkStroke[];
}

export interface EncodedStrokeV1 {
  t0: number;
  tool: InkTool;
  pts: [number, number, number, number][];
}

export interface EncodedInkV1 {
  v: 1;
  w: number;
  h: number;
  strokes: EncodedStrokeV1[];
}

export const INK_LIMITS = {
  maxSide: 20_000,
  maxStrokes: 5_000,
  maxPointsPerStroke: 20_000,
  maxPointsTotal: 500_000,
} as const;

const TOOLS: readonly InkTool[] = ['pen', 'touch', 'mouse'];

export function encodeInk(doc: InkDocument): EncodedInkV1 {
  return {
    v: 1,
    w: Math.round(doc.w),
    h: Math.round(doc.h),
    strokes: doc.strokes.map((s) => {
      let px = 0;
      let py = 0;
      let pt = 0;
      const pts = s.points.map((pt0, i): [number, number, number, number] => {
        const x = Math.round(pt0.x);
        const y = Math.round(pt0.y);
        const t = Math.round(pt0.t);
        const p = Math.round(Math.min(1, Math.max(0, pt0.p)) * 1000);
        const out: [number, number, number, number] = i === 0 ? [x, y, p, 0] : [x - px, y - py, p, t - pt];
        px = x;
        py = y;
        pt = t;
        return out;
      });
      return { t0: Math.round(s.t0), tool: s.tool, pts };
    }),
  };
}

export function decodeInk(enc: EncodedInkV1): InkDocument {
  return {
    w: enc.w,
    h: enc.h,
    strokes: enc.strokes.map((s) => {
      let x = 0;
      let y = 0;
      let t = 0;
      const points = s.pts.map(([a, b, p, dt], i) => {
        if (i === 0) {
          x = a;
          y = b;
          t = 0;
        } else {
          x += a;
          y += b;
          t += dt;
        }
        return { x, y, p: p / 1000, t };
      });
      return { t0: s.t0, tool: s.tool, points };
    }),
  };
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/**
 * Validate untrusted input (the upload) and return it typed, or the first problem found.
 * Checks shape, integer-ness, limits, monotonic time and that every decoded point lies on
 * the pad (with a small margin for strokes that run off the edge).
 */
export function validateEncodedInk(input: unknown): { ok: true; ink: EncodedInkV1 } | { ok: false; problem: string } {
  const fail = (problem: string) => ({ ok: false as const, problem });
  if (typeof input !== 'object' || input === null) return fail('not an object');
  const o = input as Record<string, unknown>;
  if (o.v !== STROKE_FORMAT_VERSION) return fail(`unsupported version ${String(o.v)}`);
  if (!isInt(o.w) || !isInt(o.h) || o.w < 1 || o.h < 1 || o.w > INK_LIMITS.maxSide || o.h > INK_LIMITS.maxSide) {
    return fail('pad size out of range');
  }
  if (!Array.isArray(o.strokes)) return fail('strokes is not an array');
  if (o.strokes.length > INK_LIMITS.maxStrokes) return fail('too many strokes');

  const margin = 64;
  let total = 0;
  for (let si = 0; si < o.strokes.length; si++) {
    const s = o.strokes[si] as Record<string, unknown>;
    if (typeof s !== 'object' || s === null) return fail(`stroke ${si} is not an object`);
    if (!isInt(s.t0) || s.t0 < 0) return fail(`stroke ${si} has a bad t0`);
    if (!TOOLS.includes(s.tool as InkTool)) return fail(`stroke ${si} has an unknown tool`);
    if (!Array.isArray(s.pts) || s.pts.length === 0) return fail(`stroke ${si} has no points`);
    if (s.pts.length > INK_LIMITS.maxPointsPerStroke) return fail(`stroke ${si} has too many points`);
    total += s.pts.length;
    if (total > INK_LIMITS.maxPointsTotal) return fail('too many points');

    let x = 0;
    let y = 0;
    for (let pi = 0; pi < s.pts.length; pi++) {
      const pt = s.pts[pi];
      if (!Array.isArray(pt) || pt.length !== 4 || !pt.every(isInt)) return fail(`stroke ${si} point ${pi} is malformed`);
      const [a, b, p, dt] = pt as number[];
      if (p < 0 || p > 1000) return fail(`stroke ${si} point ${pi} pressure out of range`);
      if (pi === 0 ? dt !== 0 : dt < 0) return fail(`stroke ${si} point ${pi} goes back in time`);
      x = pi === 0 ? a : x + a;
      y = pi === 0 ? b : y + b;
      if (x < -margin || y < -margin || x > (o.w as number) + margin || y > (o.h as number) + margin) {
        return fail(`stroke ${si} point ${pi} is off the pad`);
      }
    }
  }
  return { ok: true, ink: input as EncodedInkV1 };
}

/** Cheap facts about the ink, stored in hw_answer.ink_stats. */
export function inkSummary(enc: EncodedInkV1): { strokes: number; points: number; durationMs: number; tools: InkTool[] } {
  let points = 0;
  let end = 0;
  const tools = new Set<InkTool>();
  for (const s of enc.strokes) {
    points += s.pts.length;
    tools.add(s.tool);
    let t = 0;
    for (const p of s.pts) t += p[3];
    end = Math.max(end, s.t0 + t);
  }
  const start = enc.strokes.length ? Math.min(...enc.strokes.map((s) => s.t0)) : 0;
  return { strokes: enc.strokes.length, points, durationMs: Math.max(0, end - start), tools: [...tools] };
}
