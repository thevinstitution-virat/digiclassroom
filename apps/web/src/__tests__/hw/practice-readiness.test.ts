// Self-practice pilot readiness: the checklist rules (packages/core/src/lib/hw/practice/readiness.ts). Pure; no database, no network.

import { evaluateReadiness, renderReadiness, verdictOf, type Check, type ReadinessFacts, type Route } from '@/lib/hw/practice/readiness'

const r = (step: string, provider = 'openai', model: string | undefined = 'gpt-6-luna', keyPresent = true): Route => ({ step, provider, model, keyPresent })

/** A setup that is ready except for what only a person can confirm. */
const READY: ReadinessFacts = {
  pilot: { learners: 10, subjects: ['Science'], media: ['en'] },
  env: {
    selfPracticeEnabled: false, trialDays: 7, trialBudgetPaise: 1000, platformBudgetPaise: 200_000, maxAttempts: 25, eligibilityEnforced: true,
    strictMarking: true, instructionGuard: true, sharedKeys: true, cronSecretLength: 48, hubEnabled: true, hubUrlSet: true, hubSecretSet: true,
  },
  routes: [r('read'), r('re-read'), r('mark')],
  keys: { ok: true, rMin: 0.62, writer: r('key writer', 'openrouter', 'google/gemini-3.6-flash'), verifier: r('key verifier', 'openai', 'gpt-5.4-mini') },
  tables: { practiceTrial: true, instructionFlag: true },
  eligibility: { runningHash: 'abc', groups: [{ key: 'a', eligible: true, reason: 'eligible' }, { key: 'b', eligible: true, reason: 'eligible' }] },
  hub: { probes: [{ scope: 'Class 9 Science, English medium', ok: true, practiceRows: 12 }] },
}
const with_ = (over: Partial<ReadinessFacts>): ReadinessFacts => ({ ...READY, ...over })
const by = (cs: Check[], id: string) => cs.find((c) => c.id === id)!

describe('self-practice readiness', () => {
  it('a fully set up system is ready, and only people can still hold it back', () => {
    const cs = evaluateReadiness(READY)
    const v = verdictOf(cs)
    expect(v.ready).toBe(true)
    expect(v.failing).toEqual([])
    // The things the code cannot see are listed for a person, never passed.
    expect(v.manual.map((c) => c.id).sort()).toEqual(['consent', 'cron-scheduled', 'qdrant-protected', 'r-min'])
  })

  it('blocks on a missing migration', () => {
    const cs = evaluateReadiness(with_({ tables: { practiceTrial: false, instructionFlag: true } }))
    expect(by(cs, 'migration-031').status).toBe('fail')
    expect(verdictOf(cs).ready).toBe(false)
  })

  it('blocks when a step has no model or no provider key', () => {
    expect(by(evaluateReadiness(with_({ routes: [r('read'), { ...r('re-read'), model: undefined }, r('mark')] })), 'ai-models')).toMatchObject({ status: 'fail', detail: expect.stringContaining('re-read') })
    expect(by(evaluateReadiness(with_({ routes: [r('read'), r('re-read'), r('mark', 'gemini', 'gemini-3.6-flash', false)] })), 'ai-models')).toMatchObject({ status: 'fail', detail: expect.stringContaining('mark (gemini)') })
  })

  it('blocks when the eligibility check is off, and when no pilot group is eligible', () => {
    expect(by(evaluateReadiness(with_({ env: { ...READY.env, eligibilityEnforced: false } })), 'elig-enforced').status).toBe('fail')
    const none = with_({ eligibility: { runningHash: 'abc', groups: [{ key: 'a', eligible: false, reason: 'config_changed' }] } })
    expect(by(evaluateReadiness(none), 'eligibility')).toMatchObject({ status: 'fail', detail: expect.stringContaining('hw:eval:gates') })
    expect(by(evaluateReadiness(with_({ eligibility: { runningHash: null, groups: [] } })), 'eligibility').status).toBe('fail')
  })

  it('only warns when some pilot groups are eligible, and says which are not', () => {
    const some = with_({ eligibility: { runningHash: 'abc', groups: [{ key: 'ok', eligible: true, reason: 'eligible' }, { key: 'Science|long|en|textbook_key', eligible: false, reason: 'not_yet' }] } })
    const c = by(evaluateReadiness(some), 'eligibility')
    expect(c.status).toBe('warn')
    expect(c.detail).toContain('1 of 2')
    expect(c.detail).toContain('Science|long|en|textbook_key')
  })

  it('blocks on answer keys that are not configured, or whose provider has no key', () => {
    expect(by(evaluateReadiness(with_({ keys: { ok: false, problem: 'HW_KEY_WRITER_MODEL is not set' } })), 'keys')).toMatchObject({ status: 'fail', detail: 'HW_KEY_WRITER_MODEL is not set' })
    const noOpenRouter = with_({ keys: { ...READY.keys, writer: r('key writer', 'openrouter', 'google/gemini-3.6-flash', false) } })
    expect(by(evaluateReadiness(noOpenRouter), 'keys')).toMatchObject({ status: 'fail', detail: expect.stringContaining('OpenRouter') })
    expect(by(evaluateReadiness(with_({ keys: { ...READY.keys, rMin: undefined } })), 'r-min').status).toBe('fail')
  })

  it('blocks when the library is off, or returns no exercise questions for any pilot scope; warns when only some', () => {
    expect(by(evaluateReadiness(with_({ env: { ...READY.env, hubEnabled: false, hubUrlSet: false } })), 'hub')).toMatchObject({ status: 'fail', detail: expect.stringContaining('LIBRARY_HUB_URL') })
    const empty = with_({ hub: { probes: [{ scope: 'Class 9 Science, English medium', ok: true, practiceRows: 0 }] } })
    expect(by(evaluateReadiness(empty), 'hub').status).toBe('fail')
    const half = with_({ pilot: { ...READY.pilot, media: ['en', 'hi'] }, hub: { probes: [{ scope: 'en', ok: true, practiceRows: 5 }, { scope: 'hi', ok: true, practiceRows: 0 }] } })
    expect(by(evaluateReadiness(half), 'hub').status).toBe('warn')
    expect(by(evaluateReadiness(with_({ hub: null })), 'hub').status).toBe('warn')
  })

  it('blocks on an instruction guard whose table is missing, and on a job route with no usable secret', () => {
    expect(by(evaluateReadiness(with_({ tables: { practiceTrial: true, instructionFlag: false } })), 'guard').status).toBe('fail')
    expect(by(evaluateReadiness(with_({ env: { ...READY.env, instructionGuard: false } })), 'guard').status).toBe('warn')
    expect(by(evaluateReadiness(with_({ env: { ...READY.env, cronSecretLength: 12 } })), 'cron-secret').status).toBe('fail')
  })

  it('warns when the pilot could outspend the monthly ceiling, and states the key cost as unmeasured', () => {
    const big = with_({ pilot: { ...READY.pilot, learners: 500 } })
    expect(by(evaluateReadiness(big), 'budget').status).toBe('warn')
    expect(by(evaluateReadiness(READY), 'budget').status).toBe('pass')
    expect(by(evaluateReadiness(READY), 'key-cost')).toMatchObject({ status: 'warn', detail: expect.stringContaining('250 keys') })
    expect(by(evaluateReadiness(with_({ env: { ...READY.env, sharedKeys: false } })), 'shared-keys').status).toBe('warn')
  })

  it('asks for a Hindi review only when the pilot includes Hindi medium', () => {
    expect(by(evaluateReadiness(READY), 'hindi').status).toBe('info')
    expect(by(evaluateReadiness(with_({ pilot: { ...READY.pilot, media: ['en', 'hi'] } })), 'hindi').status).toBe('manual')
  })

  it('prints a readable report and names what blocks', () => {
    const text = renderReadiness(evaluateReadiness(with_({ tables: { practiceTrial: false, instructionFlag: true } })))
    expect(text).toContain('FAIL  Migration 031 (trial table)')
    expect(text).toContain('NOT READY: 1 check(s) block the pilot (migration-031)')
    expect(renderReadiness(evaluateReadiness(READY))).toContain('No check blocks the pilot.')
    // No secret can appear: the facts hold only whether a key is present.
    expect(JSON.stringify(READY)).not.toMatch(/sk-|secret=/i)
  })
})
