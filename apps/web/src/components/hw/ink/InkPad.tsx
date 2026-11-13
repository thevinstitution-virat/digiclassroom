// The writing pad. Pointer Events with coalesced points and pressure, perfect-freehand
// strokes, ruled lines from answer_lines, auto-growing height, and pen-only palm rejection:
// while a stylus is in use, touch pointers never draw, and two fingers scroll the page.
//
// Coordinates are kept in the pad's own space (doc.w wide), so rotating the tablet only
// rescales the view; nothing already written moves.
//
// Two layers, so the ink keeps up with the pen however long the answer (13 Nov 2026: the pad used to redraw and recompute every stroke on
// every frame, and a long answer lagged): the PAGE layer holds the ruled lines and every finished stroke and is redrawn only when the
// strokes change; the PEN layer on top draws only the stroke being written, in a low-latency canvas, with the pen's predicted points so
// the ink sits under the nib.
//
// The exam-hall kit (Phase 3 of docs/hw-eval/inkbuddy-teacher-roadmap.md; owner's decisions of 13 Nov 2026): only what a CBSE candidate
// may use in the hall. A ball pen in blue or black, 0.5 or 0.7 mm; a pencil for diagrams; a ruler for straight lines; a pen mistake is
// struck through with one line, never erased; the eraser rubs out pencil only. Undo takes back a slip only: the last stroke within
// INK_DRY_MS of writing it (the ink is still wet), or a pencil stroke. The page is an answer book: a red margin and page breaks, and the
// pad can fill the screen.

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, Maximize2, Minimize2, Pencil, PenLine, Plus, Redo2, Ruler, Strikethrough, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { InkDocument, InkKind, InkPoint, InkStroke, InkTip, InkTool } from '@/lib/hw/ink/stroke-format'
import { drawStrokes, inkColour, outlinePath, strokeOutline } from './render'
import { useHwT } from '../strings'

export const LINE_HEIGHT = 44
const TOP_PAD = 24
const ERASE_RADIUS = 14
/** A page of the answer book, in ruled lines: a page break is drawn after every this many lines. */
export const PAGE_LINES = 20
/** The red margin of the answer book, from the left edge, in pad units. */
const MARGIN_X = 52
/** How long after a stroke undo can still take it back (a slip); after that the ink is dry. */
export const INK_DRY_MS = 10_000

export interface InkStats {
  erasedStrokes: number
  undos: number
  /** Pointer types seen; `untrusted` counts synthetic events, which never draw. */
  tools: InkTool[]
  untrusted: number
  /** Exam-hall kit use: strikes through mistakes, ruler lines, pencil strokes. */
  strikes?: number
  rulerLines?: number
  pencilStrokes?: number
}

interface InkPadProps {
  value: InkDocument | null
  lines: number
  onChange: (doc: InkDocument, stats: InkStats) => void
  disabled?: boolean
}

type Tool = 'pen' | 'pencil' | 'strike' | 'eraser'

export function newDoc(width: number, lines: number): InkDocument {
  return { w: Math.round(width), h: TOP_PAD + lines * LINE_HEIGHT + LINE_HEIGHT, strokes: [] }
}

const remembered = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = window.localStorage.getItem(key)
    return allowed.includes(v as T) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
const remember = (key: string, v: string) => { try { window.localStorage.setItem(key, v) } catch { /* not remembered */ } }

/** May undo take this stroke back? Pencil always (it can be rubbed out anyway); pen only while the ink is wet. */
export function undoable(s: InkStroke, nowSessionMs: number): boolean {
  if (s.ink === 'pencil') return true
  const end = s.t0 + (s.points[s.points.length - 1]?.t ?? 0)
  return nowSessionMs - end < INK_DRY_MS
}

/** A straight stroke from its first point to `to`, with points every few units so it draws evenly. */
export function straightPoints(from: InkPoint, to: InkPoint): InkPoint[] {
  const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 6))
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n, p: 0.5, t: Math.round(from.t + ((to.t - from.t) * i) / n),
  }))
}

// Memoised: the answer screen re-renders every second (visible time); the pad must not.
export const InkPad = memo(function InkPad({ value, lines, onChange, disabled }: InkPadProps) {
  const { t } = useHwT()
  const shellRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  /** The page: ruled lines and finished strokes. */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** The pen: only the stroke being written. Takes the pointer events. */
  const penRef = useRef<HTMLCanvasElement>(null)
  const penCtx = useRef<CanvasRenderingContext2D | null>(null)
  /** Where the pen is predicted to be next (drawn, never stored). */
  const predicted = useRef<InkPoint[]>([])
  const [cssWidth, setCssWidth] = useState(0)
  const [doc, setDoc] = useState<InkDocument | null>(value)
  const [tool, setTool] = useState<Tool>('pen')
  const [ink, setInk] = useState<Exclude<InkKind, 'pencil'>>('black')
  const [tip, setTip] = useState<InkTip>(5)
  const [ruler, setRuler] = useState(false)
  const [full, setFull] = useState(false)
  const [penOnly, setPenOnly] = useState(false)
  const [redo, setRedo] = useState<InkStroke[]>([])
  const [, setTick] = useState(0) // re-checks whether undo is still allowed as the ink dries

  const live = useRef<{ id: number; stroke: InkStroke; start: number; first: InkPoint } | null>(null)
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const sessionStart = useRef(performance.now())
  const stats = useRef<InkStats>({ erasedStrokes: 0, undos: 0, tools: [], untrusted: 0, strikes: 0, rulerLines: 0, pencilStrokes: 0 })
  const raf = useRef<number | null>(null)

  useEffect(() => {
    setPenOnly(remembered('hw-pen-only', ['1', '0'], '0') === '1')
    setInk(remembered('hw-pen-ink', ['black', 'blue'] as const, 'black'))
    setTip(remembered('hw-pen-tip', ['5', '7'] as const, '5') === '7' ? 7 : 5)
  }, [])

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

  // Full screen: Escape leaves it, and the page behind does not scroll meanwhile.
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [full])

  const scale = doc && cssWidth ? cssWidth / doc.w : 1

  /** Size a layer to the page; true when its pixels were reset. */
  const fit = (c: HTMLCanvasElement, w: number, h: number, dpr: number): boolean => {
    if (c.width === Math.round(w * dpr) && c.height === Math.round(h * dpr)) return false
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    return true
  }
  const isDark = () => document.documentElement.classList.contains('dark')

  // The pen layer: every frame while writing, the one stroke under the pen and nothing else.
  const paintPen = useCallback(() => {
    raf.current = null
    const c = penRef.current
    if (!c || !doc) return
    const dpr = window.devicePixelRatio || 1
    fit(c, Math.round(doc.w * scale), Math.round(doc.h * scale), dpr)
    // Low latency where the browser offers it: the pen layer goes straight to the screen. Asked for once, when the context is made.
    const ctx = penCtx.current ?? (penCtx.current = c.getContext('2d', { desynchronized: true }) as CanvasRenderingContext2D | null)
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    const l = live.current
    if (!l) return
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    ctx.fillStyle = inkColour(l.stroke, isDark())
    const stroke = predicted.current.length && !l.stroke.line ? { ...l.stroke, points: [...l.stroke.points, ...predicted.current] } : l.stroke
    ctx.fill(outlinePath(strokeOutline(stroke)))
  }, [doc, scale])

  const schedule = useCallback(() => {
    if (raf.current === null) raf.current = requestAnimationFrame(paintPen)
  }, [paintPen])
  // Cancel a pending frame on unmount AND forget it: a marker left behind would stop every later frame being scheduled (React mounts
  // twice in development, which showed this at once).
  useEffect(() => () => { if (raf.current !== null) { cancelAnimationFrame(raf.current); raf.current = null } }, [])

  // The page layer: only when the finished strokes, the size or the theme change. Finished strokes come from the shape cache (render.ts).
  const [themeTick, setThemeTick] = useState(0)
  useEffect(() => {
    const mo = new MutationObserver(() => setThemeTick((n) => n + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  useEffect(() => {
    const c = canvasRef.current
    if (!c || !doc) return
    const dpr = window.devicePixelRatio || 1
    const w = Math.round(doc.w * scale)
    const h = Math.round(doc.h * scale)
    fit(c, w, h, dpr)
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const dark = isDark()
    ctx.fillStyle = dark ? '#0f172a' : '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0)
    // the ruled answer book: lines, a red margin, and a break after every PAGE_LINES lines
    ctx.lineWidth = 1 / scale
    let n = 0
    for (let y = TOP_PAD + LINE_HEIGHT; y < doc.h; y += LINE_HEIGHT) {
      n++
      const pageEnd = n % PAGE_LINES === 0
      ctx.strokeStyle = pageEnd ? (dark ? 'rgba(148,163,184,0.6)' : 'rgba(71,85,105,0.55)') : (dark ? 'rgba(148,163,184,0.25)' : 'rgba(59,130,246,0.22)')
      ctx.setLineDash(pageEnd ? [6 / scale, 5 / scale] : [])
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(doc.w, y)
      ctx.stroke()
      if (pageEnd) {
        ctx.setLineDash([])
        ctx.fillStyle = dark ? 'rgba(148,163,184,0.8)' : 'rgba(71,85,105,0.8)'
        ctx.font = `${11}px system-ui, sans-serif`
        ctx.textAlign = 'right'
        ctx.fillText(t('ink.page', { n: n / PAGE_LINES + 1 }), doc.w - 8, y + 14)
      }
    }
    ctx.setLineDash([])
    ctx.strokeStyle = dark ? 'rgba(248,113,113,0.45)' : 'rgba(239,68,68,0.55)'
    ctx.beginPath()
    ctx.moveTo(MARGIN_X, 0)
    ctx.lineTo(MARGIN_X, doc.h)
    ctx.stroke()
    drawStrokes(ctx, doc.strokes, (s) => inkColour(s, dark))
    schedule() // the pen layer follows the page's size, and is cleared once a stroke is committed
  }, [doc, scale, themeTick, schedule, t])

  const commit = useCallback((next: InkDocument) => {
    setDoc(next)
    onChange(next, { ...stats.current, tools: [...stats.current.tools] })
  }, [onChange])

  const toPad = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const r = (penRef.current ?? canvasRef.current)!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }

  const noteTool = (type: string) => {
    const tl = (type === 'pen' || type === 'touch' ? type : 'mouse') as InkTool
    if (!stats.current.tools.includes(tl)) stats.current.tools.push(tl)
    if (tl === 'pen' && !penOnly) {
      setPenOnly(true)
      remember('hw-pen-only', '1')
    }
  }

  // The eraser rubs out pencil only: a pen mistake is struck through, as in the exam hall.
  const eraseAt = (p: { x: number; y: number }) => {
    if (!doc) return
    const keep = doc.strokes.filter((s) => s.ink !== 'pencil' || !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < ERASE_RADIUS))
    if (keep.length !== doc.strokes.length) {
      stats.current.erasedStrokes += doc.strokes.length - keep.length
      setRedo([])
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
    const first: InkPoint = { ...p, p: e.pressure || 0.5, t: 0 }
    const line = tool === 'strike' ? 'strike' as const : ruler ? 'ruler' as const : undefined
    live.current = {
      id: e.pointerId,
      start: now,
      first,
      stroke: {
        t0: Math.round(now - sessionStart.current), tool: (e.pointerType === 'pen' || e.pointerType === 'touch' ? e.pointerType : 'mouse') as InkTool, points: [first],
        ink: tool === 'pencil' ? 'pencil' : ink, ...(tool === 'pencil' ? {} : { tip }), ...(line ? { line } : {}),
      },
    }
    schedule()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) {
      const prev = touches.current.get(e.pointerId)!
      if (touches.current.size >= 2) {
        const dy = (prev.y - e.clientY) / touches.current.size
        if (full) shellRef.current?.scrollBy(0, dy); else window.scrollBy(0, dy)
      }
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.current.size >= 2 || penOnly) return
    }
    if (!e.isTrusted) return
    if (tool === 'eraser' && e.buttons) { eraseAt(toPad(e)); return }
    const l = live.current
    if (!l || l.id !== e.pointerId) return
    if (l.stroke.line) {
      // a ruler line or a strike-through: straight from where the pen went down to where it is now
      l.stroke.points = straightPoints(l.first, { ...toPad(e), p: 0.5, t: Math.max(1, Math.round(e.timeStamp - l.start)) })
      predicted.current = []
      schedule()
      return
    }
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent]
    for (const ev of events.length ? events : [e.nativeEvent]) {
      // Event timeStamp and performance.now() share a clock; coalesced events carry their own times.
      const last = l.stroke.points[l.stroke.points.length - 1].t
      const pt: InkPoint = { ...toPad(ev), p: ev.pressure || 0.5, t: Math.max(last, Math.round(ev.timeStamp - l.start)) }
      l.stroke.points.push(pt)
    }
    // Where the pen is about to be: drawn this frame only, so the ink reaches the nib; never stored.
    const ahead = typeof e.nativeEvent.getPredictedEvents === 'function' ? e.nativeEvent.getPredictedEvents() : []
    const last = l.stroke.points[l.stroke.points.length - 1]
    predicted.current = ahead.slice(0, 2).map((ev) => ({ ...toPad(ev), p: ev.pressure || last.p, t: last.t }))
    schedule()
  }

  const finish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    touches.current.delete(e.pointerId)
    const l = live.current
    if (!l || l.id !== e.pointerId || !doc) return
    live.current = null
    predicted.current = []
    if (l.stroke.line === 'strike') stats.current.strikes = (stats.current.strikes ?? 0) + 1
    else if (l.stroke.line === 'ruler') stats.current.rulerLines = (stats.current.rulerLines ?? 0) + 1
    if (l.stroke.ink === 'pencil') stats.current.pencilStrokes = (stats.current.pencilStrokes ?? 0) + 1
    // Grow the pad when the student writes near the bottom.
    const lowest = Math.max(...l.stroke.points.map((p) => p.y))
    const h = lowest > doc.h - LINE_HEIGHT * 1.5 ? doc.h + LINE_HEIGHT * 3 : doc.h
    setRedo([])
    commit({ ...doc, h, strokes: [...doc.strokes, l.stroke] })
    // the ink dries: re-check whether undo still applies once the window has passed
    window.setTimeout(() => setTick((n) => n + 1), INK_DRY_MS + 50)
  }

  const nowSession = () => performance.now() - sessionStart.current
  const lastStroke = doc?.strokes[doc.strokes.length - 1]
  const canUndo = Boolean(lastStroke && undoable(lastStroke, nowSession()))
  const doUndo = () => {
    if (!doc || !lastStroke || !undoable(lastStroke, nowSession())) return
    stats.current.undos++
    setRedo((r) => [...r, lastStroke])
    commit({ ...doc, strokes: doc.strokes.slice(0, -1) })
  }
  const doRedo = () => {
    if (!doc || !redo.length) return
    const next = redo[redo.length - 1]
    setRedo((r) => r.slice(0, -1))
    commit({ ...doc, strokes: [...doc.strokes, next] })
  }
  const moreLines = () => doc && commit({ ...doc, h: doc.h + LINE_HEIGHT * 4 })

  const pickInk = (k: 'black' | 'blue') => { setInk(k); remember('hw-pen-ink', k); if (tool === 'pencil' || tool === 'eraser') setTool('pen') }
  const pickTip = (v: InkTip) => { setTip(v); remember('hw-pen-tip', String(v)); if (tool === 'pencil' || tool === 'eraser') setTool('pen') }
  const toolButton = (k: Tool, icon: React.ReactNode, label: string) => (
    <Button size="sm" variant={tool === k ? 'default' : 'outline'} onClick={() => setTool(k)} disabled={disabled} aria-pressed={tool === k}>
      {icon}{label}
    </Button>
  )

  return (
    <div ref={shellRef} className={cn('space-y-2', full && 'fixed inset-0 z-50 overflow-auto bg-background p-3 sm:p-6')}>
      <div className={cn('flex flex-wrap items-center gap-1.5', full && 'sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-1 backdrop-blur')} role="toolbar" aria-label={t('ink.toolbar')}>
        {toolButton('pen', <PenLine className="mr-1 h-4 w-4" aria-hidden />, t('ink.pen'))}
        {toolButton('pencil', <Pencil className="mr-1 h-4 w-4" aria-hidden />, t('ink.pencil'))}
        {toolButton('strike', <Strikethrough className="mr-1 h-4 w-4" aria-hidden />, t('ink.strike'))}
        {toolButton('eraser', <Eraser className="mr-1 h-4 w-4" aria-hidden />, t('ink.eraserPencil'))}
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        {(['black', 'blue'] as const).map((k) => (
          <button
            key={k} type="button" onClick={() => pickInk(k)} disabled={disabled} aria-pressed={ink === k && tool !== 'pencil'}
            aria-label={t(k === 'black' ? 'ink.black' : 'ink.blue')} title={t(k === 'black' ? 'ink.black' : 'ink.blue')}
            className={cn('h-7 w-7 rounded-full border-2 transition', ink === k && tool !== 'pencil' ? 'border-foreground ring-2 ring-offset-1 ring-foreground/30' : 'border-transparent')}
            style={{ background: k === 'black' ? '#111827' : '#1d4ed8' }}
          />
        ))}
        {([5, 7] as const).map((v) => (
          <Button key={v} size="sm" variant={tip === v && tool !== 'pencil' ? 'default' : 'outline'} onClick={() => pickTip(v)} disabled={disabled} aria-pressed={tip === v} aria-label={t('ink.tip', { mm: v === 5 ? '0.5' : '0.7' })}>
            {v === 5 ? '0.5' : '0.7'}
          </Button>
        ))}
        <Button size="sm" variant={ruler ? 'default' : 'outline'} onClick={() => setRuler((r) => !r)} disabled={disabled} aria-pressed={ruler}>
          <Ruler className="mr-1 h-4 w-4" aria-hidden />{t('ink.ruler')}
        </Button>
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        <Button size="sm" variant="outline" onClick={doUndo} disabled={disabled || !canUndo} aria-label={t('ink.undo')} title={t('ink.undoHint')}><Undo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={doRedo} disabled={disabled || !redo.length} aria-label={t('ink.redo')}><Redo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" onClick={moreLines} disabled={disabled}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />{t('ink.moreLines')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setFull((f) => !f)} aria-pressed={full}>
          {full ? <Minimize2 className="mr-1 h-4 w-4" aria-hidden /> : <Maximize2 className="mr-1 h-4 w-4" aria-hidden />}{t(full ? 'ink.exitFull' : 'ink.full')}
        </Button>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={penOnly}
            onChange={(e) => { setPenOnly(e.target.checked); remember('hw-pen-only', e.target.checked ? '1' : '0') }}
          />
          {t('ink.penOnly')}
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t('ink.hint')}</p>
      <div ref={wrapRef} className={cn('relative w-full overflow-hidden rounded-md border bg-white dark:bg-slate-900', disabled && 'opacity-60')}>
        <canvas ref={canvasRef} style={{ display: 'block' }} aria-hidden />
        <canvas
          ref={penRef}
          // Stylus and mouse draw; the browser never pans or zooms the pad itself.
          style={{ touchAction: 'none', display: 'block', position: 'absolute', left: 0, top: 0, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
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
})
