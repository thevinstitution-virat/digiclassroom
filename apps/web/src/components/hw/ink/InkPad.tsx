// The writing pad. Pointer Events with coalesced points and pressure, perfect-freehand
// strokes, ruled lines from answer_lines, auto-growing height, undo/redo, stroke eraser,
// clear with confirmation, and pen-only palm rejection: while a stylus is in use, touch
// pointers never draw, and two fingers scroll the page.
//
// Coordinates are kept in the pad's own space (doc.w wide), so rotating the tablet only
// rescales the view; nothing already written moves.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, PenLine, Redo2, Trash2, Undo2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InkDocument, InkPoint, InkStroke, InkTool } from '@/lib/hw/ink/stroke-format'
import { drawStrokes } from './render'
import { useHwT } from '../strings'

export const LINE_HEIGHT = 44
const TOP_PAD = 24
const ERASE_RADIUS = 14

export interface InkStats {
  erasedStrokes: number
  undos: number
  /** Pointer types seen; `untrusted` counts synthetic events, which never draw. */
  tools: InkTool[]
  untrusted: number
}

interface InkPadProps {
  value: InkDocument | null
  lines: number
  onChange: (doc: InkDocument, stats: InkStats) => void
  disabled?: boolean
}

export function newDoc(width: number, lines: number): InkDocument {
  return { w: Math.round(width), h: TOP_PAD + lines * LINE_HEIGHT + LINE_HEIGHT, strokes: [] }
}

function penOnlyDefault(): boolean {
  try {
    return window.localStorage.getItem('hw-pen-only') === '1'
  } catch {
    return false
  }
}

export function InkPad({ value, lines, onChange, disabled }: InkPadProps) {
  const { t } = useHwT()
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cssWidth, setCssWidth] = useState(0)
  const [doc, setDoc] = useState<InkDocument | null>(value)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [penOnly, setPenOnly] = useState(false)
  const [undo, setUndo] = useState<InkStroke[][]>([])
  const [redo, setRedo] = useState<InkStroke[][]>([])

  const live = useRef<{ id: number; stroke: InkStroke; start: number } | null>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const sessionStart = useRef(performance.now())
  const stats = useRef<InkStats>({ erasedStrokes: 0, undos: 0, tools: [], untrusted: 0 })
  const raf = useRef<number | null>(null)

  useEffect(() => setPenOnly(penOnlyDefault()), [])

  // Size the pad to its container; the document keeps its own width.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setCssWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!doc && cssWidth > 0) setDoc(value ?? newDoc(cssWidth, lines))
  }, [cssWidth, doc, lines, value])

  const scale = doc && cssWidth ? cssWidth / doc.w : 1

  const paint = useCallback(() => {
    raf.current = null
    const c = canvasRef.current
    if (!c || !doc) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(doc.w * scale)
    const h = Math.round(doc.h * scale)
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
      c.style.width = `${w}px`
      c.style.height = `${h}px`
    }
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dark = document.documentElement.classList.contains('dark')
    ctx.fillStyle = dark ? '#0f172a' : '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.25)' : 'rgba(59,130,246,0.22)'
    ctx.lineWidth = 1 / scale
    for (let y = TOP_PAD + LINE_HEIGHT; y < doc.h; y += LINE_HEIGHT) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(doc.w, y)
      ctx.stroke()
    }
    const strokes = live.current ? [...doc.strokes, live.current.stroke] : doc.strokes
    drawStrokes(ctx, strokes, dark ? '#e2e8f0' : '#111827')
  }, [doc, scale])

  const schedule = useCallback(() => {
    if (raf.current === null) raf.current = requestAnimationFrame(paint)
  }, [paint])

  useEffect(() => { schedule() }, [schedule])

  const commit = useCallback((next: InkDocument, pushUndo = true) => {
    if (pushUndo && doc) {
      setUndo((u) => [...u.slice(-49), doc.strokes])
      setRedo([])
    }
    setDoc(next)
    onChange(next, { ...stats.current, tools: [...stats.current.tools] })
  }, [doc, onChange])

  const toPad = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const noteTool = (type: string) => {
    const tl = (type === 'pen' || type === 'touch' ? type : 'mouse') as InkTool
    if (!stats.current.tools.includes(tl)) stats.current.tools.push(tl)
    if (tl === 'pen' && !penOnly) {
      setPenOnly(true)
      try { window.localStorage.setItem('hw-pen-only', '1') } catch { /* not remembered */ }
    }
  }

  const eraseAt = (p: { x: number; y: number }) => {
    if (!doc) return
    const keep = doc.strokes.filter((s) => !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < ERASE_RADIUS))
    if (keep.length !== doc.strokes.length) {
      stats.current.erasedStrokes += doc.strokes.length - keep.length
      commit({ ...doc, strokes: keep })
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !doc) return
    if (!e.isTrusted) { stats.current.untrusted++; return }
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      // Two fingers: scroll, and drop any stroke a finger had started.
      if (touches.current.size >= 2) { live.current = null; schedule(); return }
      if (penOnly) return
    }
    noteTool(e.pointerType)
    e.currentTarget.setPointerCapture(e.pointerId)
    const p = toPad(e)
    if (tool === 'eraser') { eraseAt(p); return }
    const now = e.timeStamp
    live.current = {
      id: e.pointerId,
      start: now,
      stroke: { t0: Math.round(now - sessionStart.current), tool: (e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse') as InkTool, points: [{ ...p, p: e.pressure || 0.5, t: 0 }] },
    }
    schedule()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      const prev = touches.current.get(e.pointerId)!
      if (touches.current.size >= 2) window.scrollBy(0, (prev.y - e.clientY) / touches.current.size)
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size >= 2 || penOnly) return
    }
    if (!e.isTrusted) return
    if (tool === 'eraser' && e.buttons) { eraseAt(toPad(e)); return }
    const l = live.current
    if (!l || l.id !== e.pointerId) return
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    for (const ev of events.length ? events : [e.nativeEvent]) {
      // Event timeStamp and performance.now() share a clock; coalesced events carry their own times.
      const last = l.stroke.points[l.stroke.points.length - 1].t
      const pt: InkPoint = { ...toPad(ev), p: ev.pressure || 0.5, t: Math.max(last, Math.round(ev.timeStamp - l.start)) }
      l.stroke.points.push(pt)
    }
    schedule()
  }

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(e.pointerId)
    const l = live.current
    if (!l || l.id !== e.pointerId || !doc) return
    live.current = null
    // Grow the pad when the student writes near the bottom.
    const lowest = Math.max(...l.stroke.points.map((p) => p.y))
    const h = lowest > doc.h - LINE_HEIGHT * 1.5 ? doc.h + LINE_HEIGHT * 3 : doc.h
    commit({ ...doc, h, strokes: [...doc.strokes, l.stroke] })
  }

  const doUndo = () => {
    if (!doc || !undo.length) return
    stats.current.undos++
    setRedo((r) => [...r, doc.strokes])
    const prev = undo[undo.length - 1]
    setUndo((u) => u.slice(0, -1))
    commit({ ...doc, strokes: prev }, false)
  }
  const doRedo = () => {
    if (!doc || !redo.length) return
    setUndo((u) => [...u, doc.strokes])
    const next = redo[redo.length - 1]
    setRedo((r) => r.slice(0, -1))
    commit({ ...doc, strokes: next }, false)
  }
  const doClear = () => {
    if (!doc || !doc.strokes.length) return
    if (!window.confirm(t('ink.clearConfirm'))) return
    stats.current.erasedStrokes += doc.strokes.length
    commit({ ...doc, strokes: [] })
  }
  const moreLines = () => doc && commit({ ...doc, h: doc.h + LINE_HEIGHT * 4 }, false)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar">
        <Button size="sm" variant={tool === 'pen' ? 'default' : 'outline'} onClick={() => setTool('pen')} disabled={disabled}>
          <PenLine className="mr-1 h-4 w-4" aria-hidden />{t('ink.pen')}
        </Button>
        <Button size="sm" variant={tool === 'eraser' ? 'default' : 'outline'} onClick={() => setTool('eraser')} disabled={disabled}>
          <Eraser className="mr-1 h-4 w-4" aria-hidden />{t('ink.eraser')}
        </Button>
        <Button size="sm" variant="outline" onClick={doUndo} disabled={disabled || !undo.length} aria-label={t('ink.undo')}><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={doRedo} disabled={disabled || !redo.length} aria-label={t('ink.redo')}><Redo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={doClear} disabled={disabled || !doc?.strokes.length}>
          <Trash2 className="mr-1 h-4 w-4" aria-hidden />{t('ink.clear')}
        </Button>
        <Button size="sm" variant="outline" onClick={moreLines} disabled={disabled}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />{t('ink.moreLines')}
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={penOnly}
            onChange={(e) => {
              setPenOnly(e.target.checked)
              try { window.localStorage.setItem('hw-pen-only', e.target.checked ? '1' : '0') } catch { /* not remembered */ }
            }}
          />
          {t('ink.penOnly')}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t('ink.hint')}</p>
      <div ref={wrapRef} className={cn('w-full overflow-hidden rounded-md border bg-white dark:bg-slate-900', disabled && 'opacity-60')}>
        <canvas
          ref={canvasRef}
          // Stylus and mouse draw; the browser never pans or zooms the pad itself.
          style={{ touchAction: 'none', display: 'block' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onPointerLeave={(e) => { if (!e.buttons) finish(e) }}
          aria-label={t('ink.hint')}
          role="img"
        />
      </div>
    </div>
  )
}
