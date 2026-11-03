// Synthetic evaluation runs whose answers are known, shared by the report tests (__tests__/hw/eval-report.test.ts) and the Runs & gates test (__tests__/hw/runs-gates.test.ts).
// Pure; no network, no database.

import { newItemId, type EvalItem } from '@/lib/hw/eval/dataset'
import type { ItemRow } from '@/lib/hw/eval/runner'

export const KEY = 'a'.repeat(64)

export function realItem(ref: number, over: Partial<EvalItem> = {}): EvalItem {
  return {
    id: newItemId(), source: 'D', subject: 'Science', class: 'Class 9', board: 'CBSE', medium: 'English', language: 'en', questionType: 'short', mode: 'photo',
    question: { id: 'q1', text: 'Q', marks: 2 }, media: { photo: 'media/x.png' }, truthTranscript: null,
    key: { source: 'textbook', keyId: KEY, points: [{ id: 'p1', marks: 1, cites: ['c'], text: 'a' }, { id: 'p2', marks: 1, cites: ['c'], text: 'b' }] },
    referenceMarks: { byPoint: { p1: Math.min(1, ref), p2: Math.max(0, ref - 1) }, total: ref, how: 'single_teacher' },
    mutation: null, handwritingBand: 'unknown', device: 'paper', consent: { ref: 'c1', deidentified: true }, ...over,
  }
}

export function row(it: EvalItem, total: number, repeat = 0, byPoint?: Record<string, number>): ItemRow {
  const bp = byPoint ?? { p1: Math.min(1, total), p2: Math.max(0, total - 1) }
  return {
    itemId: it.id, questionId: it.question.id, repeat, mode: 'mark', status: 'ok', tokens: { input: 100, cached: 0, output: 10 }, costPaise: 2, latencyMs: 1200,
    mark: { total, confidence: 0.9, model: 'm', notes: [], points: Object.entries(bp).map(([pointId, marks]) => ({ pointId, verdict: marks >= 1 ? 'met' : marks > 0 ? 'partial' : 'missing', marks, quote: '', confidence: 0.9 })) },
  }
}

/** 90 real answers with marks 0/1/2, mutation variants, teacher double marks. */
export function world(opts: { aiOf?: (ref: number, i: number) => number; real?: number } = {}) {
  const real = Array.from({ length: opts.real ?? 90 }, (_, i) => realItem(i % 3))
  const parent = realItem(2, { source: 'B', mode: 'typed', media: {}, truthTranscript: { text: 'x', how: 'known_text' }, referenceMarks: { byPoint: { p1: 1, p2: 1 }, total: 2, how: 'by_construction' }, mutation: { type: 'original', target: null, rule: 'full', parentItem: null }, consent: { ref: null, deidentified: true } })
  const removed = { ...parent, id: newItemId(), referenceMarks: { byPoint: { p1: 1, p2: 0 }, total: 1, how: 'by_construction' as const }, mutation: { type: 'remove_point' as const, target: 'p2', rule: 'minus p2', parentItem: parent.id } }
  const injected = { ...parent, id: newItemId(), mutation: { type: 'injection' as const, target: null, rule: 'no change', parentItem: parent.id } }
  const items = [...real, parent, removed, injected]
  const aiOf = opts.aiOf ?? ((r: number) => r)
  const rows = [...real.map((it, i) => row(it, aiOf(it.referenceMarks!.total, i))), row(parent, 2), row(removed, 1, 0, { p1: 1, p2: 0 }), row(injected, 2)]
  const repeatRows = real.flatMap((it, i) => [0, 1, 2, 3, 4].map((r) => row(it, aiOf(it.referenceMarks!.total, i), r)))
  // Two teachers on 40 answers: they disagree by one mark on 4 of them.
  const raters = Object.fromEntries(real.slice(0, 40).map((it, i) => {
    const t = it.referenceMarks!.total
    const b = i % 10 === 0 ? (t === 2 ? 1 : t + 1) : t
    return [it.id, { T1: { p1: Math.min(1, t), p2: Math.max(0, t - 1) }, T2: { p1: Math.min(1, b), p2: Math.max(0, b - 1) } }]
  }))
  return { items, rows, repeatRows, raters, keyAudits: { [KEY]: { points: [{ verdict: 'correct' }, { verdict: 'correct' }], missing: [] } }, keySupport: { [KEY]: 'supported' as const } }
}

