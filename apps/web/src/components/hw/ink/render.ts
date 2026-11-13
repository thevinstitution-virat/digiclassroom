// Drawing strokes, shared by the pad on screen and the export sent to the reader, so what
// the AI reads is exactly what the student saw.

import { getStroke } from 'perfect-freehand'
import type { InkDocument, InkStroke } from '@/lib/hw/ink/stroke-format'
import { encodeGreyPng } from './png-encode'

export const PEN_SIZE = 3.2

/** Line width on the pad for a stroke: a 0.5 mm pen (the default), a 0.7 mm pen, or a pencil. */
export function strokeSize(s: Pick<InkStroke, 'ink' | 'tip'>): number {
  if (s.ink === 'pencil') return 2.6
  return s.tip === 7 ? 4.4 : PEN_SIZE
}

export function strokeOutline(s: InkStroke, size = strokeSize(s)): number[][] {
  const pressureFromDevice = s.tool === 'pen' && s.points.some((p) => p.p !== 0.5)
  // a ruled line or a strike-through is drawn straight and even, like a pen along a ruler
  const straight = Boolean(s.line)
  return getStroke(
    s.points.map((p) => [p.x, p.y, straight ? 0.5 : p.p]),
    { size, thinning: straight ? 0 : 0.55, smoothing: straight ? 0 : 0.5, streamline: straight ? 0 : 0.45, simulatePressure: !straight && !pressureFromDevice, last: true },
  )
}

/** The colour a stroke is shown in on the pad: the pen's ink, or pencil grey. The reader's image is always black on white. */
export function inkColour(s: Pick<InkStroke, 'ink'>, dark: boolean): string {
  if (s.ink === 'blue') return dark ? '#93c5fd' : '#1d4ed8'
  if (s.ink === 'pencil') return dark ? '#a8a29e' : '#57534e'
  return dark ? '#e2e8f0' : '#111827'
}

export function outlinePath(outline: number[][]): Path2D {
  const path = new Path2D()
  if (!outline.length) return path
  path.moveTo(outline[0][0], outline[0][1])
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i - 1]
    const [x1, y1] = outline[i]
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  path.closePath()
  return path
}

/**
 * A finished stroke's shape, worked out once. A stroke is never changed after the pen lifts (erasing and undo replace the list, not the
 * strokes), so its outline is cached by the stroke object itself: redrawing the page, and the export for the reader, no longer recompute
 * every stroke (that recomputation, on every frame, was what made a long answer lag behind the pen). Never call this for the stroke still
 * under the pen; it grows.
 */
const shapes = new WeakMap<InkStroke, Path2D>()
export function strokePath(s: InkStroke): Path2D {
  let p = shapes.get(s)
  if (!p) { p = outlinePath(strokeOutline(s)); shapes.set(s, p) }
  return p
}

/** Finished strokes only (see strokePath). One colour for all (the reader's image), or each stroke's own ink. */
export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: InkStroke[], colour: string | ((s: InkStroke) => string) = '#111'): void {
  if (typeof colour === 'string') ctx.fillStyle = colour
  for (const s of strokes) {
    if (typeof colour !== 'string') ctx.fillStyle = colour(s)
    ctx.fill(strokePath(s))
  }
}

export interface Bounds { x: number; y: number; w: number; h: number }

export function inkBounds(doc: InkDocument): Bounds | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const s of doc.strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/**
 * The render for the reader: black ink on white, cropped to the writing plus a margin,
 * at most `maxWidth` pixels wide, greyscale PNG. Lines and background are not drawn.
 */
export async function renderForReader(doc: InkDocument, maxWidth: number, margin = 16): Promise<{ png: Uint8Array; width: number; height: number }> {
  const b = inkBounds(doc)
  if (!b) throw new Error('nothing written')
  const srcW = b.w + margin * 2 + PEN_SIZE * 2
  const srcH = b.h + margin * 2 + PEN_SIZE * 2
  // Never upscale tiny writing beyond 2x; never exceed maxWidth.
  const scale = Math.min(maxWidth / srcW, 2)
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas unavailable')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.setTransform(scale, 0, 0, scale, (margin + PEN_SIZE - b.x) * scale, (margin + PEN_SIZE - b.y) * scale)
  drawStrokes(ctx, doc.strokes, '#000')

  const rgba = ctx.getImageData(0, 0, width, height).data
  const grey = new Uint8Array(width * height)
  for (let i = 0, j = 0; i < grey.length; i++, j += 4) {
    grey[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000
  }
  return { png: await encodeGreyPng(grey, width, height), width, height }
}
