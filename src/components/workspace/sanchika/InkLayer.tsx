'use client';

/**
 * InkLayer.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Canvas-based ink overlay for Sanchika's Text editor.
 *
 * Handwriting engine (S-Note / Apple-Pencil class):
 *  • REAL hardware stylus pressure  (PointerEvent.pressure) — velocity sim is the
 *    fallback only for mouse / non-pressure input, so old behaviour is preserved.
 *  • Coalesced events  (getCoalescedEvents) — captures the full ~240 Hz pen sample
 *    rate instead of the ~60 Hz pointermove rate → smooth fast strokes.
 *  • Predicted events  (getPredictedEvents) — renders ahead of the nib on the wet
 *    layer to hide input latency (ink stays under the pen tip).
 *  • Wet/dry two-canvas architecture — committed strokes live on a STATIC "dry"
 *    canvas (redrawn only when strokes change); the in-progress stroke is rendered
 *    on a separate "wet" canvas each frame. No more O(N) full redraw per move.
 *  • Palm rejection — once a pen is used, finger/touch input is ignored (finger-
 *    only devices are unaffected because no pen event ever fires).
 *  • e.timeStamp timing (sub-ms, monotonic) instead of Date.now().
 *
 * Plus the original stroke styling:
 *  • 5 tool types: Gel Pen, Pencil, Marker (highlighter), Eraser, Select
 *  • Catmull-Rom spline smoothing + variable-width filled outline ribbons
 *  • Pencil grain texture (deterministic per stroke — no shimmer on redraw)
 *  • Per-stroke undo + SVG serialisation for persistent storage
 *
 * Mount this inside .sanchika-page  (which needs `position: relative`).
 * When `active=false` the canvases are `pointer-events: none` — text editing works.
 */

import React, {
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';

// ─── Public types ─────────────────────────────────────────────────────────────

export type PenTool = 'gel' | 'pencil' | 'marker' | 'eraser' | 'select';

interface RawPt { x: number; y: number; t: number; p?: number }  // p = hardware stylus pressure 0–1 (undefined → velocity simulation)
interface SmoothPt extends RawPt { hw: number }  // hw = half-width

/** Native PointerEvent + the high-frequency input extensions (not all in TS lib yet) */
type ExtendedPointerEvent = PointerEvent & {
  getCoalescedEvents?: () => PointerEvent[];
  getPredictedEvents?: () => PointerEvent[];
};

export interface InkStroke {
  id: string;
  tool: PenTool;
  color: string;
  opacity: number;
  size: number;           // 1–100 (replaces old TipSize enum)
  pts: RawPt[];
}

export interface InkLayerRef {
  undo: () => void;
  clear: () => void;
  getSVGString: () => string;
  loadFromSVG: (svg: string) => void;
}

export interface InkLayerProps {
  active: boolean;
  tool: PenTool;
  color: string;
  opacity: number;
  size: number;           // 1–100
  eraserMode: 'stroke' | 'area';
  eraseHighlighterOnly: boolean;
  selectionMode: 'lasso' | 'rectangle';
  includePartial: boolean;
  selectedStrokeIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  strokes: InkStroke[];
  onStrokesChange: (s: InkStroke[]) => void;
  /** Pixel dimensions of the host .sanchika-page element */
  pageW: number;
  pageH: number;
}

// ─── Migration adapter ───────────────────────────────────────────────────────
// Old strokes stored size as 'fine'|'medium'|'broad'. This maps them to numbers.

const LEGACY_SIZE_MAP: Record<string, number> = { fine: 20, medium: 40, broad: 65 };

function migrateSize(size: number | string): number {
  if (typeof size === 'number') return size;
  return LEGACY_SIZE_MAP[size as string] ?? 30;
}

// ─── Tool constants ───────────────────────────────────────────────────────────

/** Maximum base half-width per tool. Actual hw = (size/100) * MAX_BASE_HW[tool] */
const MAX_BASE_HW: Record<PenTool, number> = {
  gel:    9,
  pencil: 7.6,
  marker: 36,
  eraser: 80,
  select: 0,
};

/** [min, max] pressure multiplier (marker & eraser are constant = 1) */
const PRESSURE: Record<PenTool, [number, number]> = {
  gel:    [0.30, 2.40],
  pencil: [0.20, 2.00],
  marker: [1.00, 1.00],
  eraser: [1.00, 1.00],
  select: [1.00, 1.00],
};

const MAX_SPEED = 3.8; // px/ms → above this → minimum width

// ─── Math helpers ─────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Deterministic PRNG so textures (pencil grain) don't shimmer between redraws */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gaussian blur on raw points to reduce jitter */
function gaussSmooth(pts: RawPt[], sigma = 1.4): RawPt[] {
  if (pts.length <= 3) return pts;
  const r = Math.ceil(sigma * 3);
  const kernel: number[] = [];
  let ksum = 0;
  for (let i = -r; i <= r; i++) {
    const w = Math.exp((-i * i) / (2 * sigma * sigma));
    kernel.push(w);
    ksum += w;
  }
  return pts.map((pt, idx) => {
    let sx = 0, sy = 0, sw = 0;
    kernel.forEach((w, ki) => {
      const j = idx + ki - r;
      if (j >= 0 && j < pts.length) { sx += pts[j].x * w; sy += pts[j].y * w; sw += w; }
    });
    return { ...pt, x: sx / sw, y: sy / sw };
  });
}

/** Velocity-based pressure (0→slow/thick, 1→fast/thin) — fallback when no hardware pressure */
function velPressure(pts: RawPt[], i: number): number {
  if (i === 0 || pts.length < 2) return 0.55;
  const dx = pts[i].x - pts[i - 1].x;
  const dy = pts[i].y - pts[i - 1].y;
  const dt = Math.max(1, pts[i].t - pts[i - 1].t);
  const speed = Math.sqrt(dx * dx + dy * dy) / dt;
  return clamp(1 - speed / MAX_SPEED, 0.04, 1);
}

/** Build array of SmoothPt with half-width from real pressure (or velocity fallback) */
function makeSP(pts: RawPt[], tool: PenTool, size: number | string): SmoothPt[] {
  const numSize = migrateSize(size);
  const smoothed = gaussSmooth(pts, tool === 'pencil' ? 1.8 : 1.3);
  const base = (numSize / 100) * MAX_BASE_HW[tool];
  const [pMin, pMax] = PRESSURE[tool];
  return smoothed.map((pt, i) => {
    // Real hardware pressure wins; velocity simulation is the fallback (mouse / no-pressure input).
    const pressure = pt.p != null ? pt.p : velPressure(smoothed, i);
    const hw = base * (pMin + (pMax - pMin) * pressure);
    return { ...pt, hw };
  });
}

/**
 * Build a filled variable-width SVG outline path.
 * Walks the left offsets forward + right offsets backward → closed ribbon.
 * Each side is smoothed with Catmull-Rom curves.
 */
function outlinePath(sp: SmoothPt[]): string {
  if (sp.length === 0) return '';
  if (sp.length === 1) {
    const { x, y, hw } = sp[0];
    return `M${(x - hw).toFixed(1)},${y.toFixed(1)} a${hw.toFixed(1)},${hw.toFixed(1)} 0 1,0 ${(2 * hw).toFixed(1)},0 a${hw.toFixed(1)},${hw.toFixed(1)} 0 1,0 ${(-2 * hw).toFixed(1)},0`;
  }

  const lefts: { x: number; y: number }[] = [];
  const rights: { x: number; y: number }[] = [];

  for (let i = 0; i < sp.length; i++) {
    const prev = sp[Math.max(0, i - 1)];
    const next = sp[Math.min(sp.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const { x, y, hw } = sp[i];
    lefts.push({ x: x + nx * hw, y: y + ny * hw });
    rights.push({ x: x - nx * hw, y: y - ny * hw });
  }

  const all = [...lefts, ...rights.reverse()];
  return catmullRomPath(all) + ' Z';
}

/** Catmull-Rom SVG path from an array of {x,y} points */
function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

// ─── Math & Selection Helpers ─────────────────────────────────────────────────

function getStrokeBBox(stroke: { pts: RawPt[] }): { x: number; y: number; w: number; h: number } | null {
  if (!stroke.pts.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of stroke.pts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }
  const pad = 4;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function isAABBIntersecting(a: ReturnType<typeof getStrokeBBox>, b: ReturnType<typeof getStrokeBBox>): boolean {
  if (!a || !b) return false;
  return (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}

function isAABBInside(inner: ReturnType<typeof getStrokeBBox>, outer: ReturnType<typeof getStrokeBBox>): boolean {
  if (!inner || !outer) return false;
  return (inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h);
}

function isPointInPolygon(pt: RawPt, polygon: RawPt[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

function renderStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke) {
  const { tool, color, opacity, size, pts } = stroke;
  if (!pts.length || tool === 'select') return;

  const sp = makeSP(pts, tool, size);

  ctx.save();
  ctx.globalAlpha = opacity;

  switch (tool) {
    /* ── ERASER ─────────────────────────────────────── */
    case 'eraser': {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      const d = outlinePath(sp);
      if (d) { const path = new Path2D(d); ctx.fill(path); }
      break;
    }

    /* ── MARKER (highlighter) ────────────────────────── */
    case 'marker': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = opacity * 0.4;
      ctx.strokeStyle = color;
      const numSize = migrateSize(size);
      ctx.lineWidth = (numSize / 100) * MAX_BASE_HW.marker * 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const d = catmullRomPath(sp);
      if (d) { const path = new Path2D(d); ctx.stroke(path); }
      break;
    }

    /* ── PENCIL (textured) ───────────────────────────── */
    case 'pencil': {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      const d = outlinePath(sp);
      if (d) { const path = new Path2D(d); ctx.fill(path); }
      // Grain: scattered micro-dots for paper texture (deterministic per stroke → no shimmer on redraw)
      ctx.globalAlpha = opacity * 0.22;
      const rng = mulberry32(hashStr(stroke.id));
      sp.forEach((pt, i) => {
        if (i % 2 !== 0) return;
        for (let g = 0; g < 5; g++) {
          ctx.beginPath();
          ctx.arc(
            pt.x + (rng() - 0.5) * pt.hw * 2.4,
            pt.y + (rng() - 0.5) * pt.hw * 2.4,
            rng() * 0.7,
            0, Math.PI * 2,
          );
          ctx.fill();
        }
      });
      break;
    }

    /* ── GEL PEN (default) ───────────────────────────── */
    default: {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      const d = outlinePath(sp);
      if (d) { const path = new Path2D(d); ctx.fill(path); }
      break;
    }
  }
  ctx.restore();
}

function renderSelectionOverlay(ctx: CanvasRenderingContext2D, strokes: InkStroke[], selectedIds: Set<string>) {
  if (selectedIds.size === 0) return;
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  for (const stroke of strokes) {
    if (!selectedIds.has(stroke.id)) continue;
    const bbox = getStrokeBBox(stroke);
    if (!bbox) continue;
    ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
  }
  ctx.restore();
}

function redrawAll(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strokes: InkStroke[],
  dpr: number,
  selectedIds?: Set<string>,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.scale(dpr, dpr);
  strokes.forEach((s) => renderStroke(ctx, s));
  if (selectedIds && selectedIds.size > 0) {
    renderSelectionOverlay(ctx, strokes, selectedIds);
  }
  ctx.restore();
}

// ─── SVG serialisation ────────────────────────────────────────────────────────

function strokeToSVGEl(stroke: InkStroke): string {
  const { tool, color, opacity, size, pts } = stroke;
  if (!pts.length || tool === 'eraser' || tool === 'select') return '';

  const sp = makeSP(pts, tool, size);

  if (tool === 'marker') {
    const d = catmullRomPath(sp);
    const numSize = migrateSize(size);
    const w = (numSize / 100) * MAX_BASE_HW.marker * 2;
    return `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${opacity * 0.4}" style="mix-blend-mode:multiply"/>`;
  }

  const d = outlinePath(sp);
  return d ? `<path d="${d}" fill="${color}" opacity="${opacity}" stroke="none"/>` : '';
}

// ─── Component ────────────────────────────────────────────────────────────────

export const InkLayer = forwardRef<InkLayerRef, InkLayerProps>(
  ({ active, tool, color, opacity, size, selectionMode, includePartial, selectedStrokeIds, onSelectionChange, strokes, onStrokesChange, pageW, pageH }, ref) => {
    // Two stacked canvases: "dry" holds committed strokes, "wet" holds the in-progress stroke.
    const dryRef = useRef<HTMLCanvasElement>(null);
    const wetRef = useRef<HTMLCanvasElement>(null);
    const isDown = useRef(false);
    const activeId = useRef<number>(-1);   // pointerId of the stroke in progress
    const penSeen = useRef(false);         // once a pen is used → reject finger/touch (palm rejection)
    const live = useRef<RawPt[]>([]);
    const rafId = useRef(0);
    const strokesRef = useRef<InkStroke[]>(strokes);

    // Keep strokesRef in sync
    useEffect(() => { strokesRef.current = strokes; }, [strokes]);

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const canvasW = Math.round(pageW * dpr);
    const canvasH = Math.round(pageH * dpr);

    // Imperative API exposed to parent
    useImperativeHandle(ref, () => ({
      undo() { onStrokesChange(strokes.slice(0, -1)); },
      clear() { onStrokesChange([]); },
      getSVGString() {
        return (
          `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}">\n` +
          strokes.map(strokeToSVGEl).filter(Boolean).join('\n') +
          '\n</svg>'
        );
      },
      loadFromSVG() { /* strokes come via props — no-op */ },
    }));

    // ── DRY layer: redraw committed strokes only when they (or the selection / size) change.
    useEffect(() => {
      const c = dryRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (ctx) redrawAll(ctx, c.width, c.height, strokes, dpr, selectedStrokeIds);
    }, [strokes, dpr, selectedStrokeIds, canvasW, canvasH]);

    /** Capture a point from a (native) PointerEvent, including real stylus pressure. */
    const getPos = useCallback((e: PointerEvent): RawPt => {
      const host = wetRef.current ?? dryRef.current;
      const r = host!.getBoundingClientRect();
      let p: number | undefined;
      if (e.pointerType === 'pen') {
        p = e.pressure > 0 ? e.pressure : 0.5;            // pen with no pressure support → mid
      } else if (e.pointerType === 'touch') {
        p = e.pressure > 0 ? e.pressure : undefined;       // some touchscreens report pressure
      } else {
        p = undefined;                                     // mouse → keep velocity-simulated width
      }
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp, p };
    }, []);

    /** Render the in-progress stroke (or live selection marquee) on the WET layer. */
    const renderWet = useCallback((predicted: RawPt[]) => {
      const c = wetRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      if (tool === 'select') {
        const pts = live.current;
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        if (selectionMode === 'lasso') {
          ctx.beginPath();
          pts.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
          ctx.fill();
        } else if (pts.length > 0) {
          const s = pts[0], en = pts[pts.length - 1];
          const x = Math.min(s.x, en.x), y = Math.min(s.y, en.y);
          const w = Math.abs(en.x - s.x), h = Math.abs(en.y - s.y);
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = 'rgba(59, 130, 246, 0.05)';
          ctx.fillRect(x, y, w, h);
        }
      } else {
        // Predicted points extend the stroke under the nib to hide latency (wet only — never committed).
        const pts = predicted.length ? [...live.current, ...predicted] : live.current;
        renderStroke(ctx, { id: 'live', tool, color, opacity, size, pts });
      }
      ctx.restore();
    }, [dpr, tool, color, opacity, size, selectionMode]);

    const onDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!active) return;
      if (e.pointerType === 'pen') penSeen.current = true;
      // Palm rejection: ignore finger/touch once a pen has been used in this session.
      if (e.pointerType === 'touch' && penSeen.current) return;
      if (tool === 'select') onSelectionChange(new Set());
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      isDown.current = true;
      activeId.current = e.pointerId;
      live.current = [getPos(e.nativeEvent)];
    }, [active, getPos, tool, onSelectionChange]);

    const onMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDown.current || !active) return;
      if (e.pointerId !== activeId.current) return;   // ignore palm / second pointer
      e.preventDefault();
      const native = e.nativeEvent as ExtendedPointerEvent;
      if (native.pointerType === 'pen') penSeen.current = true;

      // Drain every coalesced sample (full pen sample rate) into the committed point buffer.
      const coalesced = native.getCoalescedEvents?.() ?? [native];
      for (const ev of coalesced) live.current.push(getPos(ev));

      // Predicted samples are rendered ahead of the nib but never stored.
      const predicted = (native.getPredictedEvents?.() ?? []).map(getPos);

      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => renderWet(predicted));
    }, [active, getPos, renderWet]);

    const onUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDown.current || !active) return;
      if (e.pointerId !== activeId.current) return;
      e.preventDefault();
      isDown.current = false;
      activeId.current = -1;
      cancelAnimationFrame(rafId.current);

      const pts = live.current;
      live.current = [];

      // Clear the wet layer — the committed result is drawn on the dry layer.
      const wc = wetRef.current;
      const wctx = wc?.getContext('2d');
      if (wc && wctx) wctx.clearRect(0, 0, wc.width, wc.height);

      if (tool === 'select') {
        if (pts.length < 2) { onSelectionChange(new Set()); return; }

        const newSelected = new Set<string>();
        let selBBox: ReturnType<typeof getStrokeBBox> = null;
        if (selectionMode === 'rectangle') {
          const start = pts[0];
          const end = pts[pts.length - 1];
          selBBox = {
            x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
            w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y),
          };
        } else {
          selBBox = getStrokeBBox({ pts }); // lasso bbox for AABB pre-filter
        }

        for (const stroke of strokesRef.current) {
          const bbox = getStrokeBBox(stroke);
          if (!bbox) continue;
          if (!isAABBIntersecting(bbox, selBBox)) continue;  // AABB pre-filter

          let isSelected = false;
          if (selectionMode === 'rectangle') {
            isSelected = includePartial ? true : isAABBInside(bbox, selBBox);
          } else {
            let insideCount = 0;
            for (const pt of stroke.pts) {
              if (isPointInPolygon(pt, pts)) {
                insideCount++;
                if (includePartial) { isSelected = true; break; }
              }
            }
            if (!includePartial && insideCount === stroke.pts.length) isSelected = true;
          }

          if (isSelected) newSelected.add(stroke.id);
        }

        onSelectionChange(newSelected);
        return;
      }

      if (pts.length < 1) return;
      const s: InkStroke = {
        id: `ink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        tool, color, opacity, size, pts,
      };

      // Bake immediately onto the dry layer so there's no 1-frame gap before React re-renders.
      const dc = dryRef.current;
      const dctx = dc?.getContext('2d');
      if (dc && dctx) { dctx.save(); dctx.scale(dpr, dpr); renderStroke(dctx, s); dctx.restore(); }

      onStrokesChange([...strokesRef.current, s]);
    }, [active, tool, color, opacity, size, onStrokesChange, selectionMode, includePartial, onSelectionChange, dpr]);

    // Custom SVG cursor for eraser
    const eraserCursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Crect x='4' y='4' width='20' height='20' rx='3' fill='white' stroke='%23374151' stroke-width='1.5'/%3E%3Cline x1='4' y1='24' x2='24' y2='4' stroke='%23d1d5db' stroke-width='1'/%3E%3C/svg%3E") 14 14, cell`;

    const layerStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      borderRadius: 'inherit',
    };

    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', borderRadius: 'inherit' }}>
        {/* DRY: committed strokes + selection overlay (never receives pointer input) */}
        <canvas
          ref={dryRef}
          width={canvasW}
          height={canvasH}
          style={{ ...layerStyle, pointerEvents: 'none' }}
        />
        {/* WET: in-progress stroke; the only surface that receives pointer input */}
        <canvas
          ref={wetRef}
          width={canvasW}
          height={canvasH}
          style={{
            ...layerStyle,
            pointerEvents: active ? 'auto' : 'none',
            touchAction: active ? 'none' : 'auto',
            cursor: active
              ? tool === 'eraser' ? eraserCursor
              : 'crosshair'
              : 'default',
          }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          onPointerCancel={onUp}
        />
      </div>
    );
  },
);

InkLayer.displayName = 'InkLayer';
