// The tutor's Basic/Prime tiers: the daily split, which tier answers, the model per tier, and the per-request model
// staying inside its own request. Relative paths: jest's '@/' mapper points at apps/web/src.
import {
  decideTutorTier,
  isTutorTier,
  tutorModelOverride,
  tutorTierLimits,
  tutorTierModel,
  useTutorModelForRequest,
  withTutorScope,
} from '../../../../../packages/core/src/lib/ai/tutor-tiers'

const ON = { TUTOR_TIERS_ENABLED: 'true', TUTOR_BASIC_MODEL: 'gpt-6-luna', TUTOR_PRIME_MODEL: 'gpt-5.4-mini' }

describe('tutor tiers', () => {
  it('splits the plan limit 75/25 by default, rounding Prime down', () => {
    expect(tutorTierLimits(20, ON)).toEqual({ total: 20, basic: 15, prime: 5 })
    expect(tutorTierLimits(30, ON)).toEqual({ total: 30, basic: 23, prime: 7 })
    expect(tutorTierLimits(20, { ...ON, TUTOR_PRIME_SHARE: '0.5' })).toEqual({ total: 20, basic: 10, prime: 10 })
  })

  it('is the old single limit and leaves the model alone while off', () => {
    expect(tutorTierLimits(30, {})).toEqual({ total: 30, basic: 30, prime: 0 })
    expect(tutorTierModel('prime', {})).toBeNull()
    expect(tutorTierModel('basic', { TUTOR_TIERS_ENABLED: 'true' })).toBeNull()
  })

  it('answers each tier on its own model', () => {
    expect(tutorTierModel('basic', ON)).toBe('gpt-6-luna')
    expect(tutorTierModel('prime', ON)).toBe('gpt-5.4-mini')
  })

  it('gives Prime while some is left, then Basic instead of refusing; refuses only when the answering tier is used up', () => {
    const l = tutorTierLimits(20, ON)
    expect(decideTutorTier('prime', { basic: 0, prime: 4 }, l)).toEqual({ allowed: true, tier: 'prime', downgraded: false })
    expect(decideTutorTier('prime', { basic: 3, prime: 5 }, l)).toEqual({ allowed: true, tier: 'basic', downgraded: true })
    expect(decideTutorTier('basic', { basic: 15, prime: 0 }, l)).toEqual({ allowed: false })
    expect(decideTutorTier('prime', { basic: 15, prime: 2 }, l)).toEqual({ allowed: true, tier: 'prime', downgraded: false })
    expect(decideTutorTier('prime', { basic: 15, prime: 5 }, l)).toEqual({ allowed: false })
  })

  it('accepts only basic and prime', () => {
    expect(['basic', 'prime', 'gold', undefined].map(isTutorTier)).toEqual([true, true, false, false])
  })

  it('keeps a request\'s model inside that request, even when requests start back to back', async () => {
    const asRequest = (model: string | null) =>
      withTutorScope(async () => {
        useTutorModelForRequest(model)
        await new Promise((r) => setTimeout(r, 5))
        return tutorModelOverride()
      })
    const [prime, basic, none] = await Promise.all([asRequest('gpt-5.4-mini'), asRequest('gpt-6-luna'), asRequest(null)])
    expect([prime, basic, none]).toEqual(['gpt-5.4-mini', 'gpt-6-luna', undefined])
    // Outside any request scope nothing is set, and setting does nothing.
    useTutorModelForRequest('gpt-5.4-mini')
    expect(tutorModelOverride()).toBeUndefined()
  })
})
