/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// Phase 1d: four verdicts, partial credit as a setting, and marks recomputed from stored verdicts. Pure; no network.

import { _resetHwConfig, getHwConfig } from '@/lib/hw/config'
import { marksFor, partialCredit, ruleFor } from '@/lib/hw/grader/partial-credit'
import { STRICT_CONFIDENCE, validateStrictOutput } from '@/lib/hw/grader/strict'
import type { GradeInput, GradeQuestion } from '@/lib/hw/grader/types'
import { STRICT_RESPONSE_SCHEMA_V2, STRICT_SYSTEM_PROMPT_V2 } from '@/lib/hw/prompts/grade-strict.v2'
import { quoteIsInTranscript } from '@/lib/hw/text/normalise'
import { markUnderRule, ruleTable, verdictsOnTarget } from '@/lib/hw/eval/partial-credit-report'
import { parseManifest, type EvalItem } from '@/lib/hw/eval/dataset'
import type { ItemRow } from '@/lib/hw/eval/runner'
import { PROFILES } from '@/lib/hw/eval/profiles'
import { fisherOneSided, groupingMovement, groupingVerdict, summariseMovement } from '@/lib/hw/eval/grouping'

const ENV = ['HW_PARTIAL_CREDIT_RULE', 'HW_PARTIAL_CREDIT_BY_SUBJECT']
const saved: Record<string, string | undefined> = {}
beforeEach(() => { for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k] } _resetHwConfig() })
afterEach(() => { for (const k of ENV) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } _resetHwConfig() })

const q: GradeQuestion = {
  id: 'q', type: 'short', prompt: 'p', marks: 3, modelAnswer: 'ignored', acceptedAnswers: [], rubricVersion: 1,
  rubric: [{ id: 'p1', kind: 'key_point', description: 'x', marks: 1 }, { id: 'p2', kind: 'key_point', description: 'y', marks: 1.5 }, { id: 'p3', kind: 'key_point', description: 'z', marks: 0.5 }],
}
const TEXT = 'it rained a lot. farmers grew wheat. the pond was full.'
const input: GradeInput = { question: q, answers: [{ answerId: 'A', transcript: TEXT }] }
type Verdict = 'same_fact' | 'right_idea_wrong_detail' | 'different_fact' | 'absent'
const run = (points: { point_id: string; verdict: Verdict; quote: string }[], opts?: Parameters<typeof validateStrictOutput>[3]) =>
  validateStrictOutput({ results: [{ answer_id: 'A', points }] }, input, { model: 'm' }, opts)[0]

/** Phase 1c's per-point mapping, written out from its rules (same_fact + evidence -> full; different_fact keeps the words only with evidence; ...). */
function phase1cOracle(points: { point_id: string; verdict: 'same_fact' | 'different_fact' | 'absent'; quote: string }[]) {
  const LOW = getLow()
  return q.rubric.map((r) => {
    const p = points.find((x) => x.point_id === r.id)
    if (!p) return { id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: LOW }
    const ev = p.verdict === 'absent' ? true : quoteIsInTranscript(p.quote, TEXT)
    if (p.verdict === 'absent') return { id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: STRICT_CONFIDENCE }
    if (p.verdict === 'same_fact') return ev ? { id: r.id, verdict: 'met', quote: p.quote, marks: r.marks, confidence: STRICT_CONFIDENCE } : { id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: LOW }
    return { id: r.id, verdict: 'missing', quote: ev ? p.quote : '', marks: 0, confidence: ev ? STRICT_CONFIDENCE : LOW }
  })
}
const getLow = () => run([{ point_id: 'p1', verdict: 'same_fact', quote: 'never written' }]).items[0].confidence

describe('the default rule (zero) reproduces phase 1c exactly', () => {
  it('for every combination of the three phase-1c verdicts, with and without evidence, the items and total are the same', () => {
    const verdicts = ['same_fact', 'different_fact', 'absent'] as const
    const quotes = { good: ['it rained a lot', 'farmers grew wheat', 'the pond was full'], bad: ['never written 1', 'never written 2', 'never written 3'] }
    let combos = 0
    for (const v1 of verdicts) for (const v2 of verdicts) for (const v3 of verdicts) for (const which of ['good', 'bad'] as const) {
      const pts = [v1, v2, v3].map((verdict, i) => ({ point_id: `p${i + 1}`, verdict, quote: verdict === 'absent' ? '' : quotes[which][i] }))
      const got = run(pts, { version: 1 })
      const want = phase1cOracle(pts)
      expect(got.items.map((i) => ({ id: i.rubric_item_id, verdict: i.verdict, quote: i.quote, marks: i.marks, confidence: i.confidence }))).toEqual(want)
      expect(got.suggestedMarks).toBe(Math.min(want.reduce((s, x) => s + x.marks, 0), 3))
      combos++
    }
    expect(combos).toBe(54)
  })

  it('the same holds for the four-verdict prompt: right_idea_wrong_detail under zero is marked exactly like different_fact', () => {
    for (const which of ['it rained a lot', 'never written']) {
      const a = run([{ point_id: 'p1', verdict: 'right_idea_wrong_detail', quote: which }, { point_id: 'p2', verdict: 'same_fact', quote: 'farmers grew wheat' }], { version: 2 })
      const b = run([{ point_id: 'p1', verdict: 'different_fact', quote: which }, { point_id: 'p2', verdict: 'same_fact', quote: 'farmers grew wheat' }], { version: 2 })
      const core = (r: typeof a) => ({ items: r.items.map((i) => ({ id: i.rubric_item_id, verdict: i.verdict, quote: i.quote, marks: i.marks, confidence: i.confidence })), total: r.suggestedMarks, confidence: r.confidence })
      expect(core(a)).toEqual(core(b))
    }
  })

  it('with nothing set, the configuration says zero and no subject has an override', () => {
    expect(getHwConfig().HW_PARTIAL_CREDIT_RULE).toBe('zero')
    expect(getHwConfig().HW_PARTIAL_CREDIT_BY_SUBJECT).toEqual({})
    expect(ruleFor('Science', getHwConfig())).toBe('zero')
  })
})

describe('partial credit as a setting', () => {
  it('half is half the point, rounded down to a half mark; full is the point; zero is nothing', () => {
    expect([1, 1.5, 2, 3, 0.5, 4].map((m) => partialCredit('half', m))).toEqual([0.5, 0.5, 1, 1.5, 0, 2])
    expect([1, 1.5, 0.5].map((m) => partialCredit('full', m))).toEqual([1, 1.5, 0.5])
    expect([1, 1.5, 0.5].map((m) => partialCredit('zero', m))).toEqual([0, 0, 0])
    expect(marksFor('same_fact', 1.5, 'zero')).toBe(1.5)
    expect(marksFor('different_fact', 1.5, 'full')).toBe(0)
    expect(marksFor('absent', 1.5, 'full')).toBe(0)
  })

  const pts = [{ point_id: 'p1', verdict: 'right_idea_wrong_detail' as const, quote: 'it rained a lot' }, { point_id: 'p2', verdict: 'right_idea_wrong_detail' as const, quote: 'farmers grew wheat' }, { point_id: 'p3', verdict: 'same_fact' as const, quote: 'the pond was full' }]
  it('the rule sets what right_idea_wrong_detail earns, and the total follows', () => {
    expect(run(pts, { version: 2, rule: 'zero' }).suggestedMarks).toBe(0.5)
    expect(run(pts, { version: 2, rule: 'half' }).suggestedMarks).toBe(0.5 + 0.5 + 0.5)
    expect(run(pts, { version: 2, rule: 'full' }).suggestedMarks).toBe(3)
    const half = run(pts, { version: 2, rule: 'half' })
    expect(half.items.map((i) => [i.verdict, i.marks])).toEqual([['partial', 0.5], ['partial', 0.5], ['met', 0.5]])
    expect(half.validationNotes.join(' ')).toMatch(/right idea with a wrong detail; 0.5 of 1 marks under the "half" rule/)
  })

  it('credit for the right idea still needs the words to be in the answer\'s own text', () => {
    const r = run([{ point_id: 'p1', verdict: 'right_idea_wrong_detail', quote: 'words the student never wrote' }], { version: 2, rule: 'full' })
    expect(r.items[0].marks).toBe(0)
    expect(r.items[0].confidence).toBeLessThan(0.85)
    expect(r.validationNotes.join(' ')).toMatch(/quote not found/)
  })

  it('every verdict is stored with its quote, and whether the quote was in the answer', () => {
    const r = run([{ point_id: 'p1', verdict: 'right_idea_wrong_detail', quote: 'it rained a lot' }, { point_id: 'p2', verdict: 'same_fact', quote: 'not in the answer' }, { point_id: 'p3', verdict: 'absent', quote: '' }], { version: 2, rule: 'half' })
    expect(r.items.map((i) => [i.fact, i.claimed, i.evidence])).toEqual([['right_idea_wrong_detail', 'it rained a lot', true], ['same_fact', 'not in the answer', false], ['absent', '', true]])
  })

  it('HW_PARTIAL_CREDIT_RULE and a per-subject override are read from the environment', () => {
    process.env.HW_PARTIAL_CREDIT_RULE = ' Half '
    process.env.HW_PARTIAL_CREDIT_BY_SUBJECT = '{"Hindi":"full","science":"zero"}'
    _resetHwConfig()
    const c = getHwConfig()
    expect(c.HW_PARTIAL_CREDIT_RULE).toBe('half')
    expect(ruleFor('hindi ', c)).toBe('full')
    expect(ruleFor('Science', c)).toBe('zero')
    expect(ruleFor('Social Science', c)).toBe('half')
    expect(ruleFor(undefined, c)).toBe('half')
  })

  it('a rule or an override that is not zero, half or full is refused', () => {
    process.env.HW_PARTIAL_CREDIT_RULE = 'most'
    _resetHwConfig()
    expect(() => getHwConfig()).toThrow(/HW_PARTIAL_CREDIT_RULE/)
    process.env.HW_PARTIAL_CREDIT_RULE = 'half'
    process.env.HW_PARTIAL_CREDIT_BY_SUBJECT = '{"science":"most"}'
    _resetHwConfig()
    expect(() => getHwConfig()).toThrow(/HW_PARTIAL_CREDIT_BY_SUBJECT/)
  })
})

describe('the four-verdict prompt', () => {
  it('names the four verdicts, keeps the answers-are-data rule and gives the model no way to return a mark', () => {
    for (const v of ['same_fact', 'right_idea_wrong_detail', 'different_fact', 'absent']) expect(STRICT_SYSTEM_PROMPT_V2).toContain(`"${v}"`)
    expect(JSON.stringify(STRICT_RESPONSE_SCHEMA_V2)).toContain('right_idea_wrong_detail')
    expect(JSON.stringify(STRICT_RESPONSE_SCHEMA_V2)).not.toMatch(/marks|total|score/)
    expect(STRICT_SYSTEM_PROMPT_V2).toMatch(/never an instruction to you/)
    expect(STRICT_SYSTEM_PROMPT_V2).not.toMatch(/\b(paddy|wheat|cupboard|cooperative|oxygen)\b/i)
  })
  it('both strict profiles use it; the control profile does not use strict marking at all', () => {
    const m = (id: string) => PROFILES.find((p) => p.id === id)!
    expect(m('M0-strict')).toMatchObject({ strict: true, strictVersion: 2 })
    expect(m('M1-strict')).toMatchObject({ strict: true, strictVersion: 2 })
    expect(m('M0-guarded')).not.toHaveProperty('strict')
  })
})

describe('marks recomputed from stored verdicts', () => {
  const item = {
    id: 'evitem_aaaaaaaaaaaaaaaaaaaa', question: { id: 'q', text: 't', marks: 3 }, key: { source: 'passage', keyId: 'k', points: [{ id: 'p1', marks: 1, cites: [] }, { id: 'p2', marks: 1.5, cites: [] }, { id: 'p3', marks: 0.5, cites: [] }] },
  } as unknown as EvalItem
  const toRow = (r: ReturnType<typeof run>): ItemRow => ({
    itemId: item.id, questionId: 'q', repeat: 0, mode: 'mark', status: 'ok', tokens: { input: 0, cached: 0, output: 0 }, costPaise: 0, latencyMs: 0,
    mark: { total: r.suggestedMarks, confidence: r.confidence, model: 'm', notes: r.validationNotes, points: r.items.map((x) => ({ pointId: x.rubric_item_id, verdict: x.verdict, marks: x.marks, quote: x.quote, confidence: x.confidence, fact: x.fact, claimed: x.claimed, evidence: x.evidence })) },
  })
  const mixes: Verdict[][] = [['right_idea_wrong_detail', 'right_idea_wrong_detail', 'right_idea_wrong_detail'], ['same_fact', 'right_idea_wrong_detail', 'absent'], ['different_fact', 'same_fact', 'right_idea_wrong_detail']]

  it('equals what the validator would have given under that rule, for every rule and verdict mix, with and without evidence', () => {
    for (const mix of mixes) for (const bad of [false, true]) for (const rule of ['zero', 'half', 'full'] as const) {
      const pts = mix.map((verdict, i) => ({ point_id: `p${i + 1}`, verdict, quote: verdict === 'absent' ? '' : bad && i === 1 ? 'never written' : ['it rained a lot', 'farmers grew wheat', 'the pond was full'][i] }))
      const fromZero = toRow(run(pts, { version: 2, rule: 'zero' }))
      const direct = run(pts, { version: 2, rule })
      const re = markUnderRule(fromZero.mark!, item, rule)
      expect(re.total).toBe(direct.suggestedMarks)
      expect(re.points.map((p) => p.marks)).toEqual(direct.items.map((i) => i.marks))
      expect(re.points.map((p) => p.verdict)).toEqual(direct.items.map((i) => i.verdict))
    }
  })

  it('points without a stored verdict (rule-marked answers, older runs) keep their marks under every rule', () => {
    const old: ItemRow['mark'] = { total: 2, confidence: 1, model: 'x', notes: [], points: [{ pointId: 'p1', verdict: 'met', marks: 1, quote: 'q', confidence: 1 }, { pointId: 'p2', verdict: 'partial', marks: 1, quote: 'q', confidence: 1 }] }
    for (const rule of ['zero', 'half', 'full'] as const) expect(markUnderRule(old, item, rule).total).toBe(2)
  })

  it('the wrong-fact leak count reads the verdict on the changed point', () => {
    const wf = { ...item, mutation: { type: 'wrong_fact', target: 'p1', rule: 'r', parentItem: 'x' } } as unknown as EvalItem
    const rows = [
      { ...toRow(run([{ point_id: 'p1', verdict: 'right_idea_wrong_detail', quote: 'it rained a lot' }], { version: 2 })), itemId: wf.id },
      { ...toRow(run([{ point_id: 'p1', verdict: 'different_fact', quote: 'it rained a lot' }], { version: 2 })), itemId: wf.id, repeat: 1 },
      { ...toRow(run([{ point_id: 'p1', verdict: 'different_fact', quote: 'it rained a lot' }], { version: 2 })), itemId: wf.id, repeat: 2 },
    ]
    expect(verdictsOnTarget(rows, [wf], 'wrong_fact')).toMatchObject({ right_idea_wrong_detail: 1, different_fact: 2, same_fact: 0 })
  })

  it('a near-miss item is judged against its expected marks under each rule', () => {
    const near = {
      ...item, mutation: { type: 'near_miss', target: 'p1', rule: 'r', parentItem: 'x' },
      referenceMarks: { how: 'by_construction', total: 2, byPoint: { p1: 0, p2: 1.5, p3: 0.5 }, byRule: { zero: { total: 2, byPoint: { p1: 0, p2: 1.5, p3: 0.5 } }, half: { total: 2.5, byPoint: { p1: 0.5, p2: 1.5, p3: 0.5 } }, full: { total: 3, byPoint: { p1: 1, p2: 1.5, p3: 0.5 } } } },
    } as unknown as EvalItem
    const row = { ...toRow(run([{ point_id: 'p1', verdict: 'right_idea_wrong_detail', quote: 'it rained a lot' }, { point_id: 'p2', verdict: 'same_fact', quote: 'farmers grew wheat' }, { point_id: 'p3', verdict: 'same_fact', quote: 'the pond was full' }], { version: 2 })), itemId: near.id }
    const t = (rule: 'zero' | 'half' | 'full') => ruleTable([row], [near], rule)
    for (const rule of ['zero', 'half', 'full'] as const) expect(t(rule).nearMissPoint).toEqual({ k: 1, n: 1 })
    for (const rule of ['zero', 'half', 'full'] as const) expect(t(rule).nearMissTotal).toEqual({ k: 1, n: 1 })
  })
})

describe('near-miss items in a dataset', () => {
  const base = {
    id: 'evitem_bbbbbbbbbbbbbbbbbbbb', source: 'B', subject: 'Science', class: 'Class 9', board: 'CBSE', medium: 'English', language: 'en', questionType: 'short', mode: 'typed',
    question: { id: 'q', text: 't', marks: 2 }, media: {}, truthTranscript: { text: 'x', how: 'known_text' },
    key: { source: 'passage', keyId: 'k', points: [{ id: 'p1', marks: 1, cites: [] }, { id: 'p2', marks: 1, cites: [] }] },
    referenceMarks: { how: 'by_construction', total: 1, byPoint: { p1: 0, p2: 1 }, byRule: { zero: { total: 1, byPoint: { p1: 0, p2: 1 } }, half: { total: 1.5, byPoint: { p1: 0.5, p2: 1 } }, full: { total: 2, byPoint: { p1: 1, p2: 1 } } } },
    mutation: { type: 'near_miss', target: 'p1', rule: 'r', parentItem: 'evitem_cccccccccccccccccccc' },
    consent: { ref: null, deidentified: true },
  }
  const parent = { ...base, id: 'evitem_cccccccccccccccccccc', referenceMarks: { how: 'by_construction', total: 2, byPoint: { p1: 1, p2: 1 } }, mutation: { type: 'original', rule: 'full marks', parentItem: null } }
  const text = (x: unknown[]) => x.map((i) => JSON.stringify(i)).join('\n')

  it('parses, and the zero entry must equal the plain expected marks', () => {
    expect('items' in parseManifest(text([parent, base]))).toBe(true)
    const bad = { ...base, referenceMarks: { ...base.referenceMarks, byRule: { ...base.referenceMarks.byRule, zero: { total: 2, byPoint: { p1: 1, p2: 1 } } } } }
    const r = parseManifest(text([parent, bad]))
    expect('problems' in r && r.problems.join(' ')).toMatch(/byRule.zero must equal/)
  })
})

describe('grouping effect statistic (task 4)', () => {
  const it1 = { id: 'evitem_dddddddddddddddddddd', referenceMarks: { total: 2, byPoint: {}, how: 'by_construction' } } as unknown as EvalItem
  const row = (g: number, repeat: number, total: number): ItemRow => ({ itemId: it1.id, questionId: 'q', repeat, mode: 'mark', status: 'ok', tokens: { input: 0, cached: 0, output: 0 }, costPaise: 0, latencyMs: 0, mark: { total, confidence: 1, model: 'm', notes: [], points: [] } })
  const g = (a: number, b: number, k: number) => [row(k, 0, a), row(k, 1, b)]

  it('an answer is "moved" only when the groupings differ by more than the answer varies inside one grouping', () => {
    const same = groupingMovement([g(2, 2, 1), g(2, 2, 2), g(2, 2, 3)], [it1]).answers[0]
    expect(same).toMatchObject({ within: 0, across: 0, moved: false })
    const noisy = groupingMovement([g(2, 1, 1), g(2, 1, 2), g(1, 2, 3)], [it1]).answers[0] // each grouping wobbles by 1, groupings agree on the mean
    expect(noisy).toMatchObject({ within: 1, across: 0, moved: false })
    const moved = groupingMovement([g(2, 2, 1), g(1, 1, 2), g(2, 2, 3)], [it1]).answers[0]
    expect(moved).toMatchObject({ within: 0, across: 1, moved: true, highIsCloser: true })
    expect(summariseMovement([moved])).toMatchObject({ n: 1, moved: 1, highNearer: 1, lowNearer: 0, splitOnExpected: 1, sizes: { '1 to 1.5': 1 } })
  })

  it('an answer missing a run is left out and counted, not guessed', () => {
    const r = groupingMovement([g(2, 2, 1), [row(2, 0, 2)], g(2, 2, 3)], [it1])
    expect(r.answers).toHaveLength(0)
    expect(r.incomplete).toBe(1)
  })

  it('Fisher exact (one-sided) matches known values, and the verdict needs both a higher count and p <= 0.10', () => {
    expect(fisherOneSided(3, 0, 0, 3)).toBeCloseTo(0.05, 9)
    expect(fisherOneSided(0, 3, 3, 0)).toBeCloseTo(1, 9)
    expect(groupingVerdict({ moved: 8, n: 39 }, { moved: 1, n: 39 }).sensitive).toBe(true)
    expect(groupingVerdict({ moved: 3, n: 39 }, { moved: 2, n: 39 }).sensitive).toBe(false)
    expect(groupingVerdict({ moved: 1, n: 39 }, { moved: 5, n: 39 }).sensitive).toBe(false)
  })
})
