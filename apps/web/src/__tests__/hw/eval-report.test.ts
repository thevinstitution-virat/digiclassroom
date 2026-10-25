// Virat Evaluator: group breakdowns, teacher baseline, gates, regression gate and reports,
// on synthetic runs whose answers are known. Pure; no network, no database.

import { newItemId, type EvalItem } from '@/lib/hw/eval/dataset'
import { groupBreakdown, markWeight, teacherBaseline } from '@/lib/hw/eval/groups'
import { gateTable, DEFAULT_GATES } from '@/lib/hw/eval/gates'
import { pairedRegressionChecks, regressionChecks, regressionPasses } from '@/lib/hw/eval/regression'
import { buildReport, renderCsv, renderHtml, renderMarkdown, renderPublicSummary } from '@/lib/hw/eval/report'
import { summariseRun } from '@/lib/hw/eval/summary'
import type { ItemRow, RunRecord } from '@/lib/hw/eval/runner'

const KEY = 'a'.repeat(64)

function realItem(ref: number, over: Partial<EvalItem> = {}): EvalItem {
  return {
    id: newItemId(), source: 'D', subject: 'Science', class: 'Class 9', board: 'CBSE', medium: 'English', language: 'en', questionType: 'short', mode: 'photo',
    question: { id: 'q1', text: 'Q', marks: 2 }, media: { photo: 'media/x.png' }, truthTranscript: null,
    key: { source: 'textbook', keyId: KEY, points: [{ id: 'p1', marks: 1, cites: ['c'], text: 'a' }, { id: 'p2', marks: 1, cites: ['c'], text: 'b' }] },
    referenceMarks: { byPoint: { p1: Math.min(1, ref), p2: Math.max(0, ref - 1) }, total: ref, how: 'single_teacher' },
    mutation: null, handwritingBand: 'unknown', device: 'paper', consent: { ref: 'c1', deidentified: true }, ...over,
  }
}

function row(it: EvalItem, total: number, repeat = 0, byPoint?: Record<string, number>): ItemRow {
  const bp = byPoint ?? { p1: Math.min(1, total), p2: Math.max(0, total - 1) }
  return {
    itemId: it.id, questionId: it.question.id, repeat, mode: 'mark', status: 'ok', tokens: { input: 100, cached: 0, output: 10 }, costPaise: 2, latencyMs: 1200,
    mark: { total, confidence: 0.9, model: 'm', notes: [], points: Object.entries(bp).map(([pointId, marks]) => ({ pointId, verdict: marks >= 1 ? 'met' : marks > 0 ? 'partial' : 'missing', marks, quote: '', confidence: 0.9 })) },
  }
}

/** 90 real answers with marks 0/1/2, mutation variants, teacher double marks. */
function world(opts: { aiOf?: (ref: number, i: number) => number; real?: number } = {}) {
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

describe('groups and teacher baseline', () => {
  it('mark weight bands', () => expect([1, 2, 3, 4, 7, 8, 10].map(markWeight)).toEqual(['1', '2-3', '2-3', '4-7', '4-7', '8+', '8+']))
  it('groups say insufficient below 60 answers and give numbers above', () => {
    const w = world({ real: 30 })
    const g = groupBreakdown(w.rows, w.items, ['medium'])
    expect(g[0]).toMatchObject({ dimension: 'all', marking: { n: 33, insufficient: true } })
    const big = world()
    const all = groupBreakdown(big.rows, big.items, ['medium'])[0]
    expect(all.marking).toMatchObject({ insufficient: false, normalisedMae: 0 })
    expect(all.marking!.byScale[0]).toMatchObject({ maxMarks: 2, qwk: 1 })
  })
  it('teacher vs teacher on double-marked answers', () => {
    const w = world()
    const t = teacherBaseline(w.raters, new Map(w.items.map((x) => [x.id, x])))
    expect(t.n).toBe(40)
    expect(t.exact).toBeCloseTo(36 / 40, 10)
    expect(t.byScale[0].qwk).toBeLessThan(1)
    expect(t.alpha).toBeNull()
  })
})

describe('gates', () => {
  const g = (w: ReturnType<typeof world>, over: Partial<Parameters<typeof gateTable>[0]> = {}) =>
    gateTable({ items: w.items, markRows: w.rows, repeatRows: w.repeatRows, raters: w.raters, keyAudits: w.keyAudits, keySupport: w.keySupport, ...over })

  it('Eligible when every gate passes (gaps not applicable with one medium and no bands)', () => {
    const rows = g(world())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ subject: 'Science', questionType: 'short', language: 'en', verdict: 'Eligible' })
    expect(rows[0].checks.find((c) => c.gate === 'Medium gap')!.state).toBe('not_applicable')
  })

  it('Not yet when the AI is lenient: agreement and large errors fail, with reasons', () => {
    const rows = g(world({ aiOf: (r, i) => (i % 4 === 0 ? 2 : r) }))
    expect(rows[0].verdict).toBe('Not yet')
    expect(rows[0].checks.filter((c) => c.state === 'fail').map((c) => c.gate)).toEqual(expect.arrayContaining(['Marking agreement', 'Large errors']))
  })

  it('Insufficient data without a teacher baseline, a 5-run repeat, or a key audit', () => {
    const w = world()
    expect(g(w, { raters: undefined })[0].verdict).toBe('Insufficient data')
    expect(g(w, { repeatRows: undefined })[0].checks.find((c) => c.gate === 'Repeatability')!.state).toBe('insufficient')
    expect(g(w, { keyAudits: undefined })[0].checks.find((c) => c.gate === 'Keys')!.state).toBe('insufficient')
  })

  it('a partly supported key, missed detection or a broken injection is Not yet', () => {
    const w = world()
    expect(g(w, { keySupport: { [KEY]: 'partial' } })[0].verdict).toBe('Not yet')
    const leaky = world()
    const inj = leaky.items.find((x) => x.mutation?.type === 'injection')!
    const rowsBad = leaky.rows.map((r) => (r.itemId === inj.id ? { ...r, mark: { ...r.mark!, total: 3 } } : r))
    expect(g(leaky, { markRows: rowsBad })[0].checks.find((c) => c.gate === 'Injection resistance')!.state).toBe('fail')
  })

  it('a medium gap above 0.05 fails', () => {
    const w = world({ real: 120 })
    const hi = new Set(w.items.filter((x) => !x.mutation).slice(0, 60).map((x) => x.id))
    const items = w.items.map((x) => (hi.has(x.id) ? { ...x, medium: 'Hindi' as const } : x))
    const rows = w.rows.map((r) => (hi.has(r.itemId) && r.mark!.total > 0 ? { ...r, mark: { ...r.mark!, total: r.mark!.total - 1 } } : r))
    const res = gateTable({ items, markRows: rows, raters: w.raters }, DEFAULT_GATES)
    expect(res.find((x) => x.checks.find((c) => c.gate === 'Medium gap')?.state === 'fail')).toBeDefined()
  })
})

describe('regression gate', () => {
  const w = world()
  const base = summariseRun('mark', w.rows, w.items)
  it('identical runs pass; each headline regression fails', () => {
    expect(regressionPasses(regressionChecks(base, base))).toBe(true)
    const worse = world({ aiOf: (r, i) => (i % 5 === 0 ? (r === 2 ? 0 : 2) : r) })
    const cand = summariseRun('mark', worse.rows, w.items)
    const checks = regressionChecks(base, cand)
    expect(regressionPasses(checks)).toBe(false)
    expect(checks.filter((c) => !c.ok).map((c) => c.metric)).toEqual(expect.arrayContaining(['QWK 2-mark', 'normalised MAE']))
  })
  it('a metric the candidate did not measure fails', () => {
    const cand = { ...base, mutations: undefined }
    expect(regressionChecks(base, cand).find((c) => c.metric === 'injection resistance')).toMatchObject({ ok: false })
  })
  it('no baseline metrics is not a pass', () => expect(regressionPasses(regressionChecks({ mode: 'mark', counts: {} }, base))).toBe(false))
})

describe('paired regression gate', () => {
  const w = world()
  const flip = (rows: ItemRow[], ids: Set<string>, to: (t: number) => number) => rows.map((r) => (ids.has(r.itemId) ? { ...r, mark: { ...r.mark!, total: to(r.mark!.total) } } : r))
  const real = w.items.filter((x) => !x.mutation)
  it('the same run passes; one answer flipping in a group does not fail it (noise)', () => {
    expect(regressionPasses(pairedRegressionChecks(w.rows, w.rows, w.items))).toBe(true)
    const one = flip(w.rows, new Set([real.find((x) => x.referenceMarks!.total === 2)!.id]), () => 1)
    const checks = pairedRegressionChecks(w.rows, one, w.items)
    expect(checks.find((c) => c.metric === 'QWK 2-mark')!.candidate).toBeLessThan(1)
    expect(regressionPasses(checks)).toBe(true)
  })
  it('a consistent drop fails, with the interval excluding zero', () => {
    const many = new Set(real.filter((x, i) => x.referenceMarks!.total === 2 && i % 2 === 0).map((x) => x.id))
    const checks = pairedRegressionChecks(w.rows, flip(w.rows, many, () => 0), w.items)
    const q = checks.find((c) => c.metric === 'QWK 2-mark')!
    expect(q.ok).toBe(false)
    expect(q.delta.upper).toBeLessThan(0)
    expect(regressionPasses(checks)).toBe(false)
  })
  it('one injection that works fails the gate outright', () => {
    // The parent is marked 1 but the copy with the injected instruction keeps 2.
    const inj = w.items.find((x) => x.mutation?.type === 'injection')!
    const checks = pairedRegressionChecks(w.rows, flip(w.rows, new Set([inj.mutation!.parentItem!]), () => 1), w.items)
    expect(checks.find((c) => c.metric === 'injection resistance')).toMatchObject({ ok: false, candidate: 0 })
  })
})

describe('reports', () => {
  const w = world()
  const record = (mode: RunRecord['mode'], repeat = 1): RunRecord => ({
    runId: `run_${mode}${repeat}`, mode, dataset: { ref: 'demo@v1', manifestSha256: 'f'.repeat(64), items: w.items.length }, repeat, budgetPaise: 10_000,
    status: 'completed', startedAt: 'x', tokens: { input: 1000, cached: 0, output: 100 }, costPaise: 250, counts: { ok: 93, failed: 0, no_grounding: 0, skipped: 0 }, failures: [],
    meta: { configHash: 'c'.repeat(64), gitCommit: 'abcdef1234' },
  })
  const model = buildReport({
    title: 'Demo <report>', datasetRef: 'demo@v1', manifestSha256: 'f'.repeat(64), items: w.items,
    runs: [{ record: record('mark'), rows: w.rows }, { record: record('mark', 5), rows: w.repeatRows }],
    raters: w.raters, keyAudits: w.keyAudits, keySupport: w.keySupport,
  })
  it('has runs, the teacher comparison and the gate table', () => {
    const md = renderMarkdown(model)
    expect(md).toContain('## AI against the teacher baseline')
    expect(md).toContain('QWK, 2-mark questions')
    expect(md).toMatch(/\| Science \| short \| en \| \*\*Eligible\*\* \|/)
    expect(model.runs[0].costPerAnswerInr).toBeCloseTo(2.5 / 93, 6)
  })
  it('HTML escapes and renders tables; CSV has one row per run × group', () => {
    const html = renderHtml(model)
    expect(html).toContain('<title>Demo &lt;report&gt;</title>')
    expect(html).toContain('<table>')
    expect(renderCsv(model).split('\n')[0]).toContain('"qwk_by_scale"')
  })
  it('the public summary has no item ids, rater names or commits', () => {
    const pub = renderPublicSummary(model)
    expect(pub).not.toMatch(/evitem_|T1|T2|abcdef1|c{10}/)
    expect(pub).toMatch(/meet every gate/)
  })
})
