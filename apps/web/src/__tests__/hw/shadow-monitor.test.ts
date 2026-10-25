/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// Shadow mode and monitoring: sampling, settings, the daily merge, IST days, and the live
// report's summaries. Pure; the database paths are in integration.test.ts.

import { _resetHwConfig } from '@/lib/hw/config'
import { sampled, shadowSettings } from '@/lib/hw/shadow/shadow'
import { mergeCounts, recentDays } from '@/lib/hw/shadow/monitor'
import { renderLiveMarkdown, summariseMonitoring, summariseShadow, type ShadowRow } from '@/lib/hw/eval/live'

afterEach(() => {
  delete process.env.HW_SHADOW_RATE
  delete process.env.HW_SHADOW_CONFIG_JSON
  _resetHwConfig()
})

describe('shadow settings and sampling', () => {
  it('off by default; on with a valid candidate; refuses to run half-configured', () => {
    _resetHwConfig()
    expect(shadowSettings()).toBeNull()
    process.env.HW_SHADOW_RATE = '0.1'
    _resetHwConfig()
    expect(() => shadowSettings()).toThrow(/HW_SHADOW_CONFIG_JSON/)
    process.env.HW_SHADOW_CONFIG_JSON = JSON.stringify({ grader: { model: 'x' }, extra: 1 })
    _resetHwConfig()
    expect(() => shadowSettings()).toThrow()
    process.env.HW_SHADOW_CONFIG_JSON = JSON.stringify({ grader: { model: 'gemini-3.6-flash' } })
    _resetHwConfig()
    const s = shadowSettings()!
    expect(s.rate).toBe(0.1)
    expect(s.configHash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('the config hash changes with the candidate', () => {
    process.env.HW_SHADOW_RATE = '1'
    process.env.HW_SHADOW_CONFIG_JSON = JSON.stringify({ grader: { model: 'a' } })
    _resetHwConfig()
    const a = shadowSettings()!.configHash
    process.env.HW_SHADOW_CONFIG_JSON = JSON.stringify({ grader: { model: 'b' } })
    _resetHwConfig()
    expect(shadowSettings()!.configHash).not.toBe(a)
  })
  it('sampling is deterministic and close to the rate', () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `ans-${i}`)
    const picked = ids.filter((id) => sampled(id, 'h', 0.1))
    expect(picked.length / ids.length).toBeGreaterThan(0.08)
    expect(picked.length / ids.length).toBeLessThan(0.12)
    expect(ids.filter((id) => sampled(id, 'h', 0.1))).toEqual(picked)
    expect(sampled('x', 'h', 0)).toBe(false)
    expect(sampled('x', 'h', 1)).toBe(true)
  })
})

describe('monitoring', () => {
  it('merges marks, transcript fixes and flags per institution, subject and question type', () => {
    const m = mergeCounts(
      [{ org: 'o', subject: 'Science', type: 'short', marked: 10, suggested: 8, overrides: 2, abs_sum: '1.5' }],
      [{ org: 'o', subject: 'Science', type: 'short', n: 3 }, { org: 'o', subject: 'Maths', type: 'long', n: 1 }],
      [{ org: 'o', subject: 'Science', type: 'short', n: 1 }],
    )
    expect(m.get('o|Science|short')).toEqual({ answersMarked: 10, aiSuggested: 8, overrides: 2, overrideAbsSum: 1.5, transcriptFixes: 3, misreadFlags: 1 })
    expect(m.get('o|Maths|long')).toMatchObject({ answersMarked: 0, transcriptFixes: 1 })
  })
  it('days are Indian Standard Time', () => {
    // 20:00 UTC on 25 Oct is 01:30 IST on 26 Oct.
    expect(recentDays(new Date('2026-10-25T20:00:00Z'))).toEqual(['2026-10-25', '2026-10-26'])
  })
  it('summaries: override rate over AI-suggested answers, mean change over overridden ones', () => {
    const s = summariseMonitoring([
      { day: '2026-10-25', subject: 'Science', questionType: 'short', answersMarked: 10, aiSuggested: 8, overrides: 2, overrideAbsSum: 1.5, transcriptFixes: 1, misreadFlags: 0 },
      { day: '2026-10-26', subject: 'Science', questionType: 'short', answersMarked: 10, aiSuggested: 2, overrides: 1, overrideAbsSum: 0.5, transcriptFixes: 0, misreadFlags: 2 },
    ])
    expect(s[0]).toMatchObject({ days: 2, answersMarked: 20, aiSuggested: 10, overrideRate: 0.3, transcriptFixes: 1, misreadFlags: 2 })
    expect(s[0].meanOverride).toBeCloseTo(2 / 3, 10)
  })
})

describe('shadow comparisons', () => {
  const base: ShadowRow = { kind: 'mark', configHash: 'h'.repeat(64), status: 'ok', predictedTranscript: null, productionTranscript: null, currentTranscript: null, teacherCorrected: false, predictedMarks: 2, productionMarks: 2, finalMarks: 1, costPaise: 10 }
  it('marking: agreement with production and error against final teacher marks', () => {
    const [s] = summariseShadow([base, { ...base, predictedMarks: 1, productionMarks: 2, finalMarks: 1 }, { ...base, status: 'failed', predictedMarks: null }])
    expect(s).toMatchObject({ n: 2, failed: 1, sameAsProduction: 0.5, meanAbsVsProduction: 0.5, costInr: 0.3 })
    expect(s.final).toEqual({ n: 2, candidateMae: 0.5, productionMae: 1, candidateExact: 0.5, productionExact: 0 })
  })
  it('reading: against production, and against teacher-corrected text where there is one', () => {
    const r = { ...base, kind: 'read' as const, predictedMarks: null, productionMarks: null, finalMarks: null }
    const [s] = summariseShadow([
      { ...r, predictedTranscript: 'plants make food', productionTranscript: 'plants make fod', currentTranscript: 'plants make food', teacherCorrected: true },
      { ...r, predictedTranscript: 'abc', productionTranscript: 'abc', currentTranscript: 'abc' },
    ])
    expect(s.cerVsProduction).toBeCloseTo(1 / 18, 10)
    expect(s.corrected).toEqual({ n: 1, candidateCer: 0, productionCer: 1 / 16 })
  })
  it('the live report has no answer text', () => {
    const md = renderLiveMarkdown({ from: 'a', to: 'b', monitoring: [], shadow: summariseShadow([{ ...base, kind: 'read', predictedTranscript: 'SECRET ANSWER TEXT', productionTranscript: 'x' }]) })
    expect(md).not.toContain('SECRET')
    expect(md).toContain('Shadow mode')
  })
})
