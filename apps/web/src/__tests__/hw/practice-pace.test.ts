// Time, writing speed and handwriting for InkBuddy (Phase 4 of docs/hw-eval/inkbuddy-teacher-roadmap.md): the pure calculations.
// The result page's numbers against a database are in practice-pace-db.test.ts.

import { encodeInk, type InkStroke } from '@/lib/hw/ink/stroke-format'
import {
  activeWritingMs, countWords, handwritingFacts, handwritingNote, pacingGuide, PAD_LINE_HEIGHT, PAD_TOP, PAUSE_MS, percentileOf, unclearCount, writingSpeed,
} from '@/lib/hw/practice/pace'
import { elapsedMs, formatClock } from '@/components/hw/student/Stopwatch'

/** A stroke t0 ms into the session lasting `ms`, `h` units tall, sitting `onLine` lines down. */
const stroke = (t0: number, ms: number, x: number, line: number, h: number, over: Partial<InkStroke> = {}): InkStroke => {
  const base = PAD_TOP + line * PAD_LINE_HEIGHT
  return { t0, tool: 'pen', points: [{ x, y: base - h, p: 0.5, t: 0 }, { x: x + 4, y: base - h / 2, p: 0.5, t: Math.round(ms / 2) }, { x: x + 8, y: base - 1, p: 0.5, t: ms }], ...over }
}
const enc = (strokes: InkStroke[]) => encodeInk({ w: 900, h: 2000, strokes })

describe('active writing time', () => {
  it('adds the strokes and the short gaps between them, and leaves out pauses', () => {
    const e = enc([stroke(0, 500, 10, 1, 20), stroke(1500, 500, 30, 1, 20), stroke(2000 + PAUSE_MS + 5000, 500, 50, 1, 20)])
    // 500 + gap 1000 + 500 ; the long pause is not counted ; + 500
    expect(activeWritingMs(e)).toBe(2500)
  })
})

describe('words, speed and the pacing guide', () => {
  it('counts the words written, not unread words or drawings, in English or Hindi', () => {
    expect(countWords('Saliva has [?] amylase [diagram] which breaks starch.')).toBe(6)
    expect(countWords('लार में एमाइलेज होता है')).toBe(5)
    expect(unclearCount('a [?] b [?]')).toBe(2)
  })

  it('times with the stopwatch when used, else the pen; never from too little', () => {
    expect(writingSpeed({ words: 60, stopwatchMs: 240_000, activeMs: 180_000, mode: 'ink' })).toEqual({ words: 60, ms: 240_000, wpm: 15, source: 'stopwatch' })
    expect(writingSpeed({ words: 60, stopwatchMs: null, activeMs: 180_000, mode: 'ink' })).toMatchObject({ wpm: 20, source: 'pen' })
    expect(writingSpeed({ words: 60, stopwatchMs: 5_000, activeMs: 180_000, mode: 'ink' })).toMatchObject({ source: 'pen' }) // a stopwatch barely used
    expect(writingSpeed({ words: 60, activeMs: 180_000, mode: 'photo' })).toBeNull() // a photo has no pen time: only the stopwatch
    expect(writingSpeed({ words: 5, stopwatchMs: 60_000, mode: 'ink' })).toBeNull()
    expect(writingSpeed({ words: 40, typedMs: 120_000, mode: 'typed' })).toMatchObject({ wpm: 20, source: 'typing' })
  })

  it('a guide to how long typical 2-, 3- and 5-mark answers take at this speed, rounded up', () => {
    expect(pacingGuide(15)).toEqual([
      { marks: 2, words: [30, 40], minutes: [2, 3] },
      { marks: 3, words: [50, 60], minutes: [4, 4] },
      { marks: 5, words: [80, 120], minutes: [6, 8] },
    ])
    expect(pacingGuide(0)).toEqual([])
  })
})

describe('percentile against other learners', () => {
  it('only with at least 20 others; ties count half', () => {
    expect(percentileOf(10, Array(19).fill(5))).toBeNull()
    const others = [...Array(10).fill(5), ...Array(10).fill(20)]
    expect(percentileOf(10, others)).toBe(50)
    expect(percentileOf(20, others)).toBe(75)
    expect(percentileOf(25, others)).toBe(100)
  })
})

describe('the handwriting note', () => {
  const line = (n: number, h: number, over: Partial<InkStroke> = {}) => Array.from({ length: 20 }, (_, i) => stroke(i * 300, 200, 40 + i * 20, n, h, over))

  it('measures size against the ruled lines, and whether the writing keeps to them', () => {
    expect(handwritingFacts(enc(line(1, 18)))).toMatchObject({ strokes: 20, crossing: 0, size: expect.closeTo(18 / PAD_LINE_HEIGHT, 1) })
    // strokes that start well above a ruled line and end well below it
    const crossing = line(2, 30).map((s) => ({ ...s, points: s.points.map((p) => ({ ...p, y: p.y + 15 })) }))
    expect(handwritingFacts(enc(crossing))!.crossing).toBeGreaterThan(0.5)
    // ruler lines, strike-throughs and pencil are not handwriting; too little to judge gives nothing
    expect(handwritingFacts(enc(line(1, 18, { ink: 'pencil' })))).toBeNull()
    expect(handwritingFacts(enc(line(1, 18).slice(0, 5)))).toBeNull()
  })

  it('one kind note, the most useful first; typed answers get none', () => {
    const facts = { strokes: 40, size: 0.4, crossing: 0 }
    expect(handwritingNote({ mode: 'ink', facts, unclear: 0 })).toBe('clear')
    expect(handwritingNote({ mode: 'ink', facts, unclear: 3 })).toBe('unclear')
    expect(handwritingNote({ mode: 'ink', facts: { ...facts, crossing: 0.3 }, unclear: 0 })).toBe('crossing')
    expect(handwritingNote({ mode: 'ink', facts: { ...facts, size: 0.1 }, unclear: 0 })).toBe('small')
    expect(handwritingNote({ mode: 'ink', facts: { ...facts, size: 0.9 }, unclear: 0 })).toBe('large')
    expect(handwritingNote({ mode: 'photo', facts: null, unclear: 0 })).toBe('clearPhoto')
    expect(handwritingNote({ mode: 'typed', facts, unclear: 0 })).toBeNull()
    expect(handwritingNote({ mode: 'ink', facts: null, unclear: 0 })).toBeNull()
  })
})

describe('the stopwatch', () => {
  it('counts the running stretch and shows minutes and seconds', () => {
    expect(elapsedMs({ ms: 60_000, since: 1_000, stopped: false }, 31_000)).toBe(90_000)
    expect(elapsedMs({ ms: 60_000, since: null, stopped: true }, 999_999)).toBe(60_000)
    expect(formatClock(90_000)).toBe('01:30')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })
})
