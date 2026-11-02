/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// Cost work, task 1 and the shared plumbing of task 2/3: usage details are kept, cache writes
// are priced, the request observer sees what is sent, profiles refuse broken family rules, and
// with every flag off the provider request is the one production sends today.

import { _resetHwConfig } from '@/lib/hw/config'
import { estimateCost, parsePriceTable } from '@/lib/hw/cost/pricing'
import { chatBody, isExplicitCacheModel, parseChat } from '@/lib/hw/openrouter/client'
import { imagePart, textPart, usageOf } from '@/lib/hw/gemini/client'
import { redactImages, setRequestObserver, withStep, emitRequest } from '@/lib/hw/ai/observe'
import { loadProfileSet, PROFILES, ProfileError, assertFamilyRules } from '@/lib/hw/eval/profiles'
import { stepTable } from '@/lib/hw/eval/cost-table'
import { imageSize } from '@/lib/hw/eval/live-deps'
import type { ItemRow } from '@/lib/hw/eval/runner'

const base = {
  model: 'google/gemini-3.5-flash-lite',
  systemInstruction: 'SYSTEM',
  schema: { type: 'object' },
  parts: [textPart('Answer id: x'), imagePart(new Uint8Array([1, 2, 3]))],
}

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = 'sk-or-test'
  process.env.HW_THINKING_LEVEL = 'MINIMAL'
  process.env.HW_READ_MEDIA_RESOLUTION = 'LOW'
  delete process.env.HW_OPENAI_EXPLICIT_CACHE_ENABLED
  _resetHwConfig()
})
afterEach(() => setRequestObserver(null))

const TABLE = JSON.stringify({
  inr_per_usd: 88,
  models: {
    'openai/gpt-6-luna': { input: 0.1, cached: 0.01, output: 0.5, cache_write: 0.125, batch_input: 0.05, batch_output: 0.25, batch_cached: 0.005, batch_cache_write: 0.0625 },
    'google/gemini-3.5-flash-lite': { input: 0.3, cached: 0.03, output: 2.5, batch_input: 0.15, batch_output: 1.25 },
  },
})

describe('usage details are kept', () => {
  it('OpenRouter: cache writes and reasoning tokens are recorded beside input and output', () => {
    const r = parseChat({
      model: 'openai/gpt-6-luna',
      choices: [{ finish_reason: 'stop', message: { content: '{"a":1}' } }],
      usage: { prompt_tokens: 2000, completion_tokens: 300, prompt_tokens_details: { cached_tokens: 500, cache_write_tokens: 1200 }, completion_tokens_details: { reasoning_tokens: 120 }, cost: 0.0004 },
    }, 'openai/gpt-6-luna')
    expect(r.usage).toEqual({ input: 2000, cached: 500, output: 300, cacheWrite: 1200, thinking: 120 })
  })

  it('a detail the provider does not report stays absent (not zero)', () => {
    const r = parseChat({ model: 'm', choices: [{ finish_reason: 'stop', message: { content: '{}' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } }, 'm')
    expect(r.usage).toEqual({ input: 10, cached: 0, output: 2 })
  })

  it('Gemini: modality split and thinking tokens come from usageMetadata', () => {
    const { usage } = usageOf({
      usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 0, candidatesTokenCount: 80, thoughtsTokenCount: 20, promptTokensDetails: [{ modality: 'IMAGE', tokenCount: 280 }, { modality: 'TEXT', tokenCount: 720 }] },
    } as never)
    expect(usage).toEqual({ input: 1000, cached: 0, output: 100, thinking: 20, inputImage: 280, inputText: 720 })
  })
})

describe('price of a cache write', () => {
  it('tokens written to a cache cost the write rate, not the input rate', () => {
    const t = parsePriceTable(TABLE)
    const withWrite = estimateCost(t, 'openai/gpt-6-luna', { input: 2000, cached: 0, output: 0, cacheWrite: 2000 }, { batch: false })
    const without = estimateCost(t, 'openai/gpt-6-luna', { input: 2000, cached: 0, output: 0 }, { batch: false })
    expect(withWrite.paise / without.paise).toBeCloseTo(1.25, 6)
  })

  it('without cacheWrite the estimate is what it was before', () => {
    const t = parsePriceTable(TABLE)
    // 700 uncached * 0.30 + 300 cached * 0.03 + 100 out * 2.5 = 469 micro-USD
    const e = estimateCost(t, 'google/gemini-3.5-flash-lite', { input: 1000, cached: 300, output: 100 }, { batch: false })
    expect(e.paise).toBeCloseTo((469 / 1_000_000) * 88 * 100, 3)
  })

  it('batch rates apply to measured tokens', () => {
    const t = parsePriceTable(TABLE)
    const std = estimateCost(t, 'google/gemini-3.5-flash-lite', { input: 1000, cached: 0, output: 100 }, { batch: false })
    const bat = estimateCost(t, 'google/gemini-3.5-flash-lite', { input: 1000, cached: 0, output: 100 }, { batch: true })
    expect(bat.paise / std.paise).toBeCloseTo(0.5, 6)
  })
})

describe('request observer', () => {
  it('sees the body as sent, labelled by step, with image bytes replaced by their size', () => {
    const seen: unknown[] = []
    setRequestObserver((r) => seen.push(r))
    withStep('read_tier1', async () => emitRequest('openrouter', 'generate', chatBody(base)))
    return new Promise<void>((resolve) => setImmediate(() => {
      expect(seen).toHaveLength(1)
      const r = seen[0] as { step: string; body: { messages: { content: { image_url?: { url: string } }[] }[] } }
      expect(r.step).toBe('read_tier1')
      expect(r.body.messages[1].content[1].image_url!.url).toMatch(/^<image image\/png: 3 bytes, sha256 [0-9a-f]{12}>$/)
      resolve()
    }))
  })

  it('does nothing when no observer is installed', () => {
    expect(() => emitRequest('openrouter', 'generate', { a: 1 })).not.toThrow()
  })

  it('redacts Gemini inlineData as well', () => {
    const r = redactImages({ contents: [{ parts: [{ inlineData: { mimeType: 'image/png', data: 'AQID' } }] }] }) as { contents: { parts: { inlineData: { data: string } }[] }[] }
    expect(r.contents[0].parts[0].inlineData.data).toMatch(/^<image image\/png: 3 bytes/)
  })
})

describe('with every cost flag off, the request is the one sent today', () => {
  it('no per-call options: reasoning and image detail come from the environment', () => {
    const b = chatBody(base)
    expect(b.reasoning).toEqual({ effort: 'minimal' })
    expect(JSON.stringify(b)).not.toContain('prompt_cache')
    expect((b.messages[1].content as { image_url?: { detail: string } }[])[1].image_url!.detail).toBe('low')
  })

  it('a GPT-5.6+ model gets no cache options while the flag is off', () => {
    const b = chatBody({ ...base, model: 'openai/gpt-6-luna', options: { reasoningEffort: 'low', staticPrefixParts: 1 } })
    expect(b.reasoning).toEqual({ effort: 'low' })
    expect('prompt_cache_options' in b).toBe(false)
  })
})

describe('explicit caching for GPT-5.6+ (flag on)', () => {
  const longQuestion = 'Q '.repeat(2500) // ~5000 chars, 1250+ tokens even at 4 chars per token
  const call = (model: string, text: string, n = 1) => ({ ...base, model, parts: [textPart(text), textPart('<student_answer>x</student_answer>')], options: { staticPrefixParts: n } })

  beforeEach(() => { process.env.HW_OPENAI_EXPLICIT_CACHE_ENABLED = 'true'; _resetHwConfig() })

  it('recognises GPT-5.6 and later only', () => {
    for (const m of ['openai/gpt-6-luna', 'openai/gpt-5.6-luna', 'openai/gpt-6.1-sol', 'gpt-6-astra']) expect(isExplicitCacheModel(m)).toBe(true)
    for (const m of ['openai/gpt-5.4-mini', 'openai/gpt-5.5', 'google/gemini-3.5-flash-lite', 'anthropic/claude-haiku-5.5']) expect(isExplicitCacheModel(m)).toBe(false)
  })

  it('explicit mode and NO breakpoint when the static prefix is too short to be cached', () => {
    const b = chatBody(call('openai/gpt-6-luna', 'short question block'))
    expect(b.prompt_cache_options).toEqual({ mode: 'explicit' })
    expect(JSON.stringify(b)).not.toContain('prompt_cache_breakpoint')
  })

  it('one breakpoint, after the static prefix only, when the prefix reaches 1,024 tokens', () => {
    const b = chatBody(call('openai/gpt-6-luna', longQuestion))
    const content = b.messages[1].content as Record<string, unknown>[]
    expect(content[0].prompt_cache_breakpoint).toEqual({ mode: 'explicit' })
    expect(content[1].prompt_cache_breakpoint).toBeUndefined()
  })

  it('a call with no declared static prefix never gets a breakpoint', () => {
    const b = chatBody({ ...call('openai/gpt-6-luna', longQuestion), options: undefined })
    expect(b.prompt_cache_options).toEqual({ mode: 'explicit' })
    expect(JSON.stringify(b)).not.toContain('prompt_cache_breakpoint')
  })

  it('models before GPT-5.6 and other families are left alone', () => {
    expect('prompt_cache_options' in chatBody(call('openai/gpt-5.4-mini', longQuestion))).toBe(false)
    expect('prompt_cache_options' in chatBody(call('google/gemini-3.5-flash-lite', longQuestion))).toBe(false)
  })
})

describe('profiles', () => {
  it('every named profile of the cost work exists', () => {
    expect(PROFILES.map((p) => p.id)).toEqual(expect.arrayContaining(['R0', 'R1', 'R2', 'R-luna', 'E-gemini', 'E-sarvam', 'E1', 'M0', 'M1', 'M2', 'K0', 'K1']))
  })

  it('every marking profile marks one answer per call except M0, which is today\'s ten', () => {
    for (const id of ['M1', 'M2']) expect(PROFILES.find((p) => p.id === id)).toMatchObject({ answersPerCall: 1 })
    expect(PROFILES.find((p) => p.id === 'M0')).toMatchObject({ answersPerCall: 10 })
  })

  it('loads the intended combinations', () => {
    expect(() => loadProfileSet({ reading: 'R1', escalation: 'E-gemini', marking: 'M1', keys: 'K1' })).not.toThrow()
    expect(() => loadProfileSet({ reading: 'R0', marking: 'M0', keys: 'K0' })).not.toThrow()
  })

  it('refuses a key profile whose verifier is the writer\'s family', () => {
    const k1 = PROFILES.find((p) => p.id === 'K1')!
    if (k1.stage !== 'keys') throw new Error('K1 is a key profile')
    const bad = { ...k1, verifier: { ...k1.verifier, model: 'openai/gpt-5.4-mini' } }
    const m1 = PROFILES.find((p) => p.id === 'M1')!
    if (m1.stage !== 'marking') throw new Error('M1 is a marking profile')
    expect(() => assertFamilyRules({ marking: m1, keys: bad, mutationModel: 'anthropic/claude-haiku-5.5' })).toThrow(ProfileError)
  })

  it('refuses a grader in the mutation generator\'s family', () => {
    expect(() => loadProfileSet({ reading: 'R0', marking: 'M1' }, 'openai/gpt-5.4-mini')).toThrow(/mutation generator/)
    expect(() => loadProfileSet({ reading: 'R0', marking: 'M0' }, 'google/gemini-3.6-flash')).toThrow(/mutation generator/)
  })

  it('refuses an unknown id and a profile of the wrong stage', () => {
    expect(() => loadProfileSet({ reading: 'R9', marking: 'M0' })).toThrow(/unknown profile/)
    expect(() => loadProfileSet({ reading: 'M0', marking: 'M0' })).toThrow(/not a reading profile/)
  })
})

describe('the step table', () => {
  const row = (calls: ItemRow['calls']): ItemRow => ({ itemId: 'i', questionId: 'q', repeat: 0, mode: 'read', status: 'ok', tokens: { input: 0, cached: 0, output: 0 }, costPaise: 0, latencyMs: 0, calls })
  const c = (step: 'read_tier1' | 'grade', paise: number, extra = {}) => ({ model: 'm', step, usage: { input: 1000, cached: 0, output: 100 }, paise, basis: 'reported' as const, ...extra })

  it('splits cost by step and leaves out measurement-only calls', () => {
    const t = stepTable([row([c('read_tier1', 6), c('grade', 2), { ...c('grade', 50), purpose: 'eval_truth_mark' as const }])], 2)
    expect(t.map((r) => [r.step, r.inr])).toEqual([['read_tier1', 0.06], ['grade', 0.02]])
    expect(t[0].shareOfTotal).toBeCloseTo(0.75, 6)
    expect(t[0].inrPerAnswer).toBeCloseTo(0.03, 6)
  })

  it('reports an unreported detail as null, not zero', () => {
    const t = stepTable([row([c('read_tier1', 1)])], 1)
    expect(t[0].thinking).toBeNull()
    expect(t[0].cacheWrite).toBeNull()
    expect(t[0].inputTokens.image).toBeNull()
  })
})

describe('imageSize', () => {
  it('reads a PNG header', () => {
    const png = new Uint8Array(33)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    new DataView(png.buffer).setUint32(16, 1000)
    new DataView(png.buffer).setUint32(20, 182)
    expect(imageSize(png)).toEqual({ width: 1000, height: 182 })
  })
  it('returns null for something else', () => expect(imageSize(new Uint8Array([1, 2, 3, 4]))).toBeNull())
})
