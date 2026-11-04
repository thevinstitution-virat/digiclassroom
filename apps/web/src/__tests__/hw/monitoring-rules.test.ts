// Monitoring arithmetic (roadmap 5.4), pure: rolling sums, the rates, which alerts a group raises, the minimum sizes, the projection setting.
// The database side (roll-up, alerts, automatic demotion, email, the institution view) is in monitoring.test.ts and integration.test.ts.

import { addDays, findAlerts, lastSevenDays, parseProjection, ratesOf, suppressedForInstitution, sumRows, ZERO_COUNTS, type Counts, type DailyRow, type Thresholds } from '@/lib/hw/monitoring/rules'

const day = (over: Partial<DailyRow> = {}): DailyRow => ({
  answers_marked: 0, suggestions_shown: 0, accepted_unchanged: 0, accepted_edited: 0, marked_by_hand: 0, marked_by_rule: 0, overrides: 0, large_overrides: 0,
  override_abs_sum: 0, transcript_fixes: 0, misread_taps: 0, instruction_flags: 0, instruction_not_taps: 0, jobs_failed: 0, jobs_total: 0, batch_fallbacks: 0,
  actual_cost_paise: 0, projected_paise_per_answer: null, ...over,
})
const TH: Thresholds = { minAnswers: 30, maxOverrideRate: 0.5, maxLargeOverrideRate: 0.1, maxTranscriptFixRate: 0.25, maxFailedJobRate: 0.1, maxCostRatio: 1.5 }
const counts = (over: Partial<Counts>): Counts => ({ ...ZERO_COUNTS, ...over })

describe('adding days and the rates', () => {
  it('sums the rows, and the rates are over the right denominators', () => {
    const c = sumRows([
      day({ answers_marked: 20, suggestions_shown: 10, accepted_unchanged: 6, accepted_edited: 4, marked_by_hand: 6, marked_by_rule: 4, overrides: 4, large_overrides: 1, override_abs_sum: 6, transcript_fixes: 2, jobs_total: 5, jobs_failed: 1, actual_cost_paise: 40 }),
      day({ answers_marked: 20, suggestions_shown: 10, accepted_unchanged: 10, marked_by_hand: 10, instruction_flags: 4, instruction_not_taps: 1, misread_taps: 4, jobs_total: 5, actual_cost_paise: 60 }),
    ])
    expect(c).toMatchObject({ answers: 40, shown: 20, unchanged: 16, edited: 4, byHand: 16, byRule: 4, overrides: 4, large: 1, costPaise: 100 })
    const r = ratesOf(c)
    expect(r.overrideRate).toBeCloseTo(4 / 20)
    expect(r.largeOverrideRate).toBeCloseTo(1 / 20)
    expect(r.meanOverride).toBeCloseTo(6 / 4) // mean change over the answers that were changed
    expect(r.transcriptFixRate).toBeCloseTo(2 / 40)
    expect(r.misreadRate).toBeCloseTo(4 / 40)
    expect(r.instructionNotRate).toBeCloseTo(1 / 4)
    expect(r.failedJobRate).toBeCloseTo(1 / 10)
    expect(r.paisePerAnswer).toBeCloseTo(100 / 40)
  })
  it('a rate with nothing to divide by is null, never 0 or NaN', () => {
    const r = ratesOf(ZERO_COUNTS)
    expect(Object.values(r).every((v) => v === null)).toBe(true)
  })
  it('cost against projection compares only the days that have a projection', () => {
    const c = sumRows([day({ answers_marked: 10, actual_cost_paise: 150, projected_paise_per_answer: 10 }), day({ answers_marked: 10, actual_cost_paise: 999 })])
    expect(c.projectedPaise).toBe(100)
    expect(c.projectedBasisCostPaise).toBe(150)
    expect(ratesOf(c).costRatio).toBeCloseTo(1.5)
    expect(ratesOf(sumRows([day({ answers_marked: 10, actual_cost_paise: 150 })])).costRatio).toBeNull()
  })
})

describe('which alerts a group raises', () => {
  it('nothing under the limits', () => {
    expect(findAlerts(counts({ answers: 100, shown: 100, overrides: 50, large: 10, transcriptFixes: 25, jobsTotal: 100, jobsFailed: 10 }), TH)).toEqual([])
  })
  it('over the limit but under the minimum number of answers: nothing (a few answers prove nothing)', () => {
    expect(findAlerts(counts({ answers: 29, shown: 29, overrides: 29, large: 29 }), TH)).toEqual([])
  })
  it('at the minimum, an override rate over its limit demotes; so does a large-override rate', () => {
    const f = findAlerts(counts({ answers: 30, shown: 30, overrides: 16, large: 4 }), TH)
    expect(f.map((x) => [x.code, x.severity])).toEqual([['override_rate', 'demote'], ['large_override_rate', 'demote']])
    expect(f[0].message).toMatch(/53\.3% of the AI suggestions.*limit 50%.*30 suggestions/)
  })
  it('the limit itself is not a breach', () => {
    expect(findAlerts(counts({ answers: 100, shown: 100, overrides: 50, large: 10 }), TH)).toEqual([])
    expect(findAlerts(counts({ answers: 100, shown: 100, overrides: 51 }), TH).map((x) => x.code)).toEqual(['override_rate'])
  })
  it('transcript fixes, failed jobs and cost only warn', () => {
    const f = findAlerts(counts({ answers: 100, shown: 0, transcriptFixes: 40, jobsTotal: 100, jobsFailed: 20, projectedPaise: 100, projectedBasisCostPaise: 200 }), TH)
    expect(f.map((x) => [x.code, x.severity])).toEqual([['transcript_fix_rate', 'warn'], ['failed_job_rate', 'warn'], ['cost_over_projection', 'warn']])
  })
  it('suggestions that were never shown cannot breach the override limits', () => {
    expect(findAlerts(counts({ answers: 500, shown: 0, overrides: 0 }), TH)).toEqual([])
  })
})

describe('minimum group size, dates, settings', () => {
  it('a group under the minimum is suppressed for an institution', () => {
    expect(suppressedForInstitution(9, 10)).toBe(true)
    expect(suppressedForInstitution(10, 10)).toBe(false)
  })
  it('seven days end today, oldest first, across a month end', () => {
    expect(lastSevenDays('2026-11-04')).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'])
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('the projection setting ignores anything malformed instead of failing a background job', () => {
    expect(parseProjection(undefined)).toEqual({})
    expect(parseProjection('not json')).toEqual({})
    expect(parseProjection('{"short": 12, "long": -1, "essay": "x", "other": 3}')).toEqual({ short: 12 })
  })
})

describe('the default thresholds (the owner’s, provisional until Phase 4)', () => {
  it('60 suggestions in 7 days; demote above 5% large changes or 30% changed at all; the rest only warn', async () => {
    const { getHwConfig, _resetHwConfig } = await import('@/lib/hw/config')
    const keep = { ...process.env }
    for (const k of ['HW_MONITOR_MIN_ANSWERS', 'HW_MONITOR_MAX_OVERRIDE_RATE', 'HW_MONITOR_MAX_LARGE_OVERRIDE_RATE']) delete process.env[k]
    _resetHwConfig()
    const c = getHwConfig()
    expect([c.HW_MONITOR_MIN_ANSWERS, c.HW_MONITOR_MAX_OVERRIDE_RATE, c.HW_MONITOR_MAX_LARGE_OVERRIDE_RATE]).toEqual([60, 0.3, 0.05])
    Object.assign(process.env, keep)
    _resetHwConfig()
    const th: Thresholds = { minAnswers: 60, maxOverrideRate: 0.3, maxLargeOverrideRate: 0.05, maxTranscriptFixRate: 0.25, maxFailedJobRate: 0.1, maxCostRatio: 1.5 }
    expect(findAlerts(counts({ answers: 59, shown: 59, overrides: 59, large: 59 }), th)).toEqual([]) // under 60 suggestions: nothing
    expect(findAlerts(counts({ answers: 60, shown: 60, overrides: 18, large: 3 }), th)).toEqual([]) // exactly 30% and 5%: not over
    expect(findAlerts(counts({ answers: 60, shown: 60, overrides: 19, large: 4 }), th).map((f) => [f.code, f.severity])).toEqual([['override_rate', 'demote'], ['large_override_rate', 'demote']])
  })
})
