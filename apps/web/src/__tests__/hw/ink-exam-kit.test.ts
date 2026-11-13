// The exam-hall writing kit (Phase 3 of docs/hw-eval/inkbuddy-teacher-roadmap.md; owner's decisions of 13 Nov 2026): blue or black pen,
// 0.5 or 0.7 mm, pencil for diagrams, ruler lines and strike-throughs, an eraser for pencil only, undo for a slip only. No browser.

import { decodeInk, encodeInk, validateEncodedInk, type InkStroke } from '@/lib/hw/ink/stroke-format'
import { inkColour, PEN_SIZE, strokeSize } from '@/components/hw/ink/render'
import { INK_DRY_MS, straightPoints, undoable } from '@/components/hw/ink/InkPad'

const stroke = (over: Partial<InkStroke> = {}): InkStroke => ({ t0: 1000, tool: 'pen', points: [{ x: 10, y: 10, p: 0.5, t: 0 }, { x: 40, y: 12, p: 0.6, t: 50 }], ...over })

describe('the ink format keeps what the kit adds, and old answers still read the same', () => {
  it('round-trips ink, tip and line; an old stroke has none of them', () => {
    const doc = { w: 800, h: 600, strokes: [stroke({ ink: 'blue', tip: 7 }), stroke({ ink: 'pencil' }), stroke({ ink: 'black', tip: 5, line: 'strike' }), stroke()] }
    const enc = encodeInk(doc)
    expect(validateEncodedInk(JSON.parse(JSON.stringify(enc)))).toMatchObject({ ok: true })
    const back = decodeInk(enc).strokes
    expect(back.map((s) => [s.ink, s.tip, s.line])).toEqual([['blue', 7, undefined], ['pencil', undefined, undefined], ['black', 5, 'strike'], [undefined, undefined, undefined]])
    expect(Object.keys(enc.strokes[3])).toEqual(['t0', 'tool', 'pts'])
  })

  it('refuses anything else: other colours, tips or line kinds', () => {
    const bad = (s: Record<string, unknown>) => validateEncodedInk({ v: 1, w: 100, h: 100, strokes: [{ t0: 0, tool: 'pen', pts: [[1, 1, 500, 0]], ...s }] })
    expect(bad({ ink: 'red' })).toMatchObject({ ok: false, problem: expect.stringMatching(/unknown ink/) })
    expect(bad({ tip: 10 })).toMatchObject({ ok: false, problem: expect.stringMatching(/unknown tip/) })
    expect(bad({ line: 'highlight' })).toMatchObject({ ok: false, problem: expect.stringMatching(/unknown line/) })
    expect(bad({ ink: 'blue', tip: 7, line: 'ruler' })).toMatchObject({ ok: true })
  })
})

describe('pens and pencil on the pad', () => {
  it('a 0.7 mm pen is broader than 0.5 mm; pencil is finer; old strokes stay the old width', () => {
    expect(strokeSize({})).toBe(PEN_SIZE)
    expect(strokeSize({ tip: 5 })).toBe(PEN_SIZE)
    expect(strokeSize({ tip: 7 })).toBeGreaterThan(PEN_SIZE)
    expect(strokeSize({ ink: 'pencil' })).toBeLessThan(PEN_SIZE)
  })
  it('blue ink is blue, pencil is grey, and black (or an old stroke) is near-black, in both themes', () => {
    expect(inkColour({ ink: 'blue' }, false)).toBe('#1d4ed8')
    expect(inkColour({ ink: 'pencil' }, false)).toBe('#57534e')
    expect(inkColour({}, false)).toBe(inkColour({ ink: 'black' }, false))
    expect(inkColour({ ink: 'blue' }, true)).not.toBe(inkColour({ ink: 'blue' }, false))
  })
})

describe('mistakes, as in the exam hall', () => {
  it('undo takes back a pen slip only while the ink is wet; pencil always', () => {
    const s = stroke() // ends at 1050 ms into the session
    expect(undoable(s, 1050 + INK_DRY_MS - 1)).toBe(true)
    expect(undoable(s, 1050 + INK_DRY_MS + 1)).toBe(false)
    expect(undoable(stroke({ ink: 'pencil' }), 10 * 60_000)).toBe(true)
  })

  it('a ruler line or a strike-through is straight from where the pen went down to where it is', () => {
    const pts = straightPoints({ x: 0, y: 0, p: 0.8, t: 0 }, { x: 60, y: 30, p: 0.5, t: 100 })
    expect(pts[0]).toMatchObject({ x: 0, y: 0 })
    expect(pts[pts.length - 1]).toMatchObject({ x: 60, y: 30, t: 100 })
    for (const p of pts) expect(Math.abs(p.y - p.x / 2)).toBeLessThan(1e-9) // on the line
    expect(pts.every((p, i) => i === 0 || p.t >= pts[i - 1]!.t)).toBe(true)
  })

  it('the pad has no eraser for pen and no clear-all: the source says so', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../../components/hw/ink/InkPad.tsx'), 'utf8') as string
    expect(src).toContain("s.ink !== 'pencil' || !s.points.some")
    expect(src).not.toContain('doClear')
  })
})
