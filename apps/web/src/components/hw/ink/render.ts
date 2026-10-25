// Drawing strokes, shared by the pad on screen and the export sent to the reader, so what
// the AI reads is exactly what the student saw.

import { getStroke } from 'perfect-freehand'
import type { InkDocument, InkStroke } from '@/lib/hw/ink/stroke-format'
import { encodeGreyPng } from './png-encode'

export const PEN_SIZE = 3.2

export function strokeOutline(s: InkStroke, size = PEN_SIZE): number[][] {
  const pressureFromDevice = s.tool === 'pen' && s.points.some((p) => p.p !== 0.5)
  return getStroke(
    s.points.map((p) => [p.x, p.y, p.p]),
    { size, thinning: 0.55, smoothing: 0.5, streamline: 0.45, simulatePressure: !pressureFromDevice, last: true },
  )
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

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: InkStroke[], colour = '#111'): void {
  ctx.fillStyle = colour
  for (const s of strokes) ctx.fill(outlinePath(strokeOutline(s)))
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
