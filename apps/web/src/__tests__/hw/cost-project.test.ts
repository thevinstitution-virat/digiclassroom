// The monthly cost projection: the arithmetic, with round numbers so each step can be checked by hand.

import { ALL_FLAGS, DEFAULTS, NO_FLAGS, allCombos, collectUnitCosts, project, type Assumptions, type RunInfo, type UnitCosts } from '@/lib/hw/eval/cost-project'
import type { ItemRow, LedgerCall } from '@/lib/hw/eval/runner'

const sb = (standard: number, batch = standard / 2) => ({ standard, batch })
const units: UnitCosts = {
  reading: { R0: { en: sb(0.04), hi: sb(0.06) }, R1: { en: sb(0.04), hi: sb(0.06) }, 'R-luna': { en: sb(0.01) } },
  escalation: { E0: { en: sb(0.08), hi: sb(0.1) }, 'E-gemini': { en: sb(0.2), hi: sb(0.25) } },
  marking: { M0: sb(0.05), M1: sb(0.015) },
  keys: { K0: sb(0.25), K1: sb(0.1) },
  runs: [], notes: [],
}
const A: Assumptions = { ...DEFAULTS, assignmentsPerMonth: 10, questionsPerAssignment: 10, penShare: 0.5, paperShare: 0.5, typedShare: 0, hindiShare: 0.5, escalationEn: 0.1, escalationHi: 0.2, oneMarkShare: 0.3, exactMatchShareOfOneMark: 0.5, duplicateRate: 0.1, keyReuseRate: 0.7, studentsPerClass: 50, studentsPerTeacher: 100, childrenPerGuardian: 2 }
const today = { reading: 'R0', escalation: 'E0', marking: 'M0', keys: 'K0' }

describe('projection arithmetic', () => {
  it("today's settings, no flags, by hand", () => {
    const p = project(units, today, NO_FLAGS, A)
    // 100 answers, all read (no typed). Reading: 50 English x 0.04 + 50 Hindi x 0.06 = 5.00
    expect(p.perStudent.reading).toBeCloseTo(5, 6)
    // Escalation: 50 x 0.1 x 0.08 + 50 x 0.2 x 0.10 = 0.4 + 1.0 = 1.4
    expect(p.perStudent.escalation).toBeCloseTo(1.4, 6)
    // Marking: 100 answers x 0.05 = 5.00
    expect(p.perStudent.marking).toBeCloseTo(5, 6)
    // Keys: 100 / 50 = 2 keys per student x 0.25 = 0.50
    expect(p.perStudent.keys).toBeCloseTo(0.5, 6)
    expect(p.perStudent.total).toBeCloseTo(11.9, 6)
    expect(p.perTeacher).toBeCloseTo(1190, 4)
    expect(p.perGuardian).toBeCloseTo(23.8, 6)
  })

  it('typed answers are not read but are still marked', () => {
    const p = project(units, today, NO_FLAGS, { ...A, penShare: 0.25, paperShare: 0.25, typedShare: 0.5 })
    expect(p.perStudent.reading).toBeCloseTo(2.5, 6)
    expect(p.perStudent.marking).toBeCloseTo(5, 6)
  })

  it('all flags on, today\'s models', () => {
    const p = project(units, today, ALL_FLAGS, A)
    // Reading and marking at batch rates: reading 2.5, marking: AI answers = 100 x (1 - 0.15) x (1 - 0.1) = 76.5 x 0.025 = 1.9125
    expect(p.perStudent.reading).toBeCloseTo(2.5, 6)
    expect(p.aiMarkedAnswers).toBeCloseTo(76.5, 6)
    expect(p.perStudent.marking).toBeCloseTo(76.5 * 0.025, 6)
    // Escalation stays synchronous (E0 is not a batch profile): unchanged
    expect(p.perStudent.escalation).toBeCloseTo(1.4, 6)
    // Keys: 2 x (1 - 0.7) = 0.6 keys x 0.25 = 0.15
    expect(p.perStudent.keys).toBeCloseTo(0.15, 6)
  })

  it('each flag moves only its own line', () => {
    const base = project(units, today, NO_FLAGS, A).perStudent
    const only = (k: keyof typeof NO_FLAGS) => project(units, today, { ...NO_FLAGS, [k]: true }, A).perStudent
    expect(only('batch').keys).toBeCloseTo(base.keys, 9)
    expect(only('sharedKeys').marking).toBeCloseTo(base.marking, 9)
    expect(only('sharedKeys').reading).toBeCloseTo(base.reading, 9)
    expect(only('codeMarking').reading).toBeCloseTo(base.reading, 9)
    expect(only('codeMarking').marking).toBeCloseTo(base.marking * 0.85, 9)
    expect(only('dedupe').marking).toBeCloseTo(base.marking * 0.9, 9)
    expect(only('batch').marking).toBeCloseTo(base.marking * 0.5, 9)
  })

  it('a profile that is English-only reads Hindi with the fallback and says so', () => {
    const p = project(units, { ...today, reading: 'R-luna' }, NO_FLAGS, A)
    expect(p.perStudent.reading).toBeCloseTo(50 * 0.01 + 50 * 0.03, 6) // Hindi falls back to R1, which is batch-priced: 0.06 / 2
    expect(p.notes.join(' ')).toMatch(/R-luna has no hi measurement/)
  })

  it('Sarvam is priced per page', () => {
    const u = { ...units, escalation: { ...units.escalation, 'E-sarvam': { perPage: 0.5 } } }
    const p = project(u, { ...today, escalation: 'E-sarvam' }, NO_FLAGS, A)
    expect(p.perStudent.escalation).toBeCloseTo(50 * 0.1 * 0.5 + 50 * 0.2 * 0.5, 6)
  })

  it('the shares must add up to one', () => {
    expect(() => project(units, today, NO_FLAGS, { ...A, typedShare: 0.2 })).toThrow(/add up to 1/)
  })

  it('a missing measurement is an error, not a zero', () => {
    expect(() => project(units, { ...today, marking: 'M2' }, NO_FLAGS, A)).toThrow(/no measured cost for marking M2/)
  })

  it('the combination grid covers every profile axis', () => {
    expect(allCombos()).toHaveLength(4 * 4 * 3 * 2)
  })
})

describe('collecting unit costs from runs', () => {
  const call = (step: LedgerCall['step'], std: number, batch: number): LedgerCall => ({ model: 'm', step, usage: { input: 1, cached: 0, output: 1 }, paise: std, basis: 'reported', tableStandardPaise: std, tableBatchPaise: batch })
  const row = (calls?: LedgerCall[], status: ItemRow['status'] = 'ok'): ItemRow => ({ itemId: Math.random().toString(), questionId: 'q', repeat: 0, mode: 'read', status, tokens: { input: 0, cached: 0, output: 0 }, costPaise: 0, latencyMs: 0, calls })
  const run = (over: Partial<RunInfo>): RunInfo => ({ runId: 'r', mode: 'read', dataset: 'd', profiles: 'R0', forceEscalation: false, readGroup: 10, languageFilter: 'en', status: 'completed', rows: [], ...over })

  it('per-answer reading cost, by language, for ten-to-a-call reads only', () => {
    const rows = [row([call('read_tier1', 40, 20)]), row(), row(), row()] // one call carries four answers
    const u = collectUnitCosts([run({ rows })])
    expect(u.reading.R0.en).toEqual({ standard: 0.1, batch: 0.05 }) // 40 paise / 4 answers = ₹0.10 each
    expect(collectUnitCosts([run({ rows, readGroup: 1 })]).reading).toEqual({})
  })

  it('escalation only from runs that escalated every answer', () => {
    const rows = [row([call('read_escalation', 80, 40)]), row()]
    const u = collectUnitCosts([run({ rows, profiles: 'R0,E0', forceEscalation: true })])
    expect((u.escalation.E0 as { en: unknown }).en).toEqual({ standard: 0.4, batch: 0.2 })
    expect(collectUnitCosts([run({ rows, profiles: 'R0,E0' })]).escalation).toEqual({})
  })

  it('a run with a failed row, or one that did not complete, contributes nothing', () => {
    expect(collectUnitCosts([run({ rows: [row([call('read_tier1', 40, 20)]), row(undefined, 'failed')] })]).reading).toEqual({})
    expect(collectUnitCosts([run({ rows: [row([call('read_tier1', 40, 20)])], status: 'budget_reached' })]).reading).toEqual({})
  })

  it('marking and key costs', () => {
    const mark = collectUnitCosts([run({ mode: 'mark', profiles: 'R0,M1', rows: [row([call('grade', 10, 5)]), row([call('grade', 10, 5)])] })])
    expect(mark.marking.M1).toEqual({ standard: 0.1, batch: 0.05 })
    const key = collectUnitCosts([run({ mode: 'key', profiles: 'R0,K1,M0', rows: [row([call('key_writer', 30, 15), call('key_verifier', 10, 5)])] })])
    expect(key.keys.K1).toEqual({ standard: 0.4, batch: 0.2 })
  })
})
