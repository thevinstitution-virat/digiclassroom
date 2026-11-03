/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// Cost work phase 1b: per-step provider routes, the OpenAI direct client, eval retry, batch timing and
// the marking-report counts. No network: fetch is faked.

import { _resetHwConfig } from '@/lib/hw/config'
import { generate, providerFor, routed } from '@/lib/hw/ai'
import { openAiBody, createBatch as openAiCreateBatch, pollBatch as openAiPollBatch } from '@/lib/hw/openai/client'
import { createBatch as orCreateBatch } from '@/lib/hw/openrouter/client'
import { textPart, imagePart } from '@/lib/hw/gemini/client'
import { withRetry, isTransient } from '@/lib/hw/eval/live-deps'
import { stampPayload } from '@/lib/hw/jobs/homework-batch'
import { confidentlyWrong, markingCounts, pct } from '@/lib/hw/eval/marking-report'
import type { EvalItem } from '@/lib/hw/eval/dataset'
import type { ItemRow } from '@/lib/hw/eval/runner'
import { defaultGradeOptions } from '@/lib/hw/grader/ai-grader'
import { HwError } from '@/lib/hw/errors'
import { PILOT_V1, PROFILES, loadPilotSet } from '@/lib/hw/eval/profiles'

const realFetch = global.fetch
type Call = { url: string; init: RequestInit }
let calls: Call[] = []
function fakeFetch(handler: (url: string, init: RequestInit) => { status?: number; body: unknown }) {
  global.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = handler(url, init)
    return new Response(typeof r.body === 'string' ? r.body : JSON.stringify(r.body), { status: r.status ?? 200 })
  }) as unknown as typeof fetch
}

const ROUTE_ENV = ['HW_READ_PROVIDER', 'HW_ESCALATE_PROVIDER', 'HW_GRADE_PROVIDER', 'HW_RUBRIC_PROVIDER', 'HW_GRADE_REASONING_EFFORT', 'HW_OPENAI_EXPLICIT_CACHE_ENABLED']
beforeEach(() => {
  calls = []
  for (const k of ROUTE_ENV) delete process.env[k]
  Object.assign(process.env, { HW_AI_PROVIDER: 'gemini', OPENAI_API_KEY: 'sk-test-not-a-real-key-1234567890', OPENROUTER_API_KEY: 'sk-or-test', HW_THINKING_LEVEL: 'MINIMAL', HW_READ_MEDIA_RESOLUTION: 'LOW' })
  _resetHwConfig()
})
afterAll(() => { global.fetch = realFetch })

const call = {
  model: 'gpt-6-luna',
  systemInstruction: 'SYSTEM',
  schema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false },
  parts: [textPart('Answer id: x'), imagePart(new Uint8Array([1, 2, 3]))],
  options: { reasoningEffort: 'low' },
}
const chatOk = (content = '{"a":"hi"}') => ({ model: 'gpt-6-luna-2026', choices: [{ finish_reason: 'stop', message: { content } }], usage: { prompt_tokens: 900, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 12 } } })

describe('per-step provider routes', () => {
  it('every step runs on HW_AI_PROVIDER unless its own route is set', () => {
    process.env.HW_AI_PROVIDER = 'openrouter'; _resetHwConfig()
    expect(['read', 'escalate', 'grade', 'rubric'].map((r) => providerFor(r as never))).toEqual(Array(4).fill('openrouter'))
    process.env.HW_GRADE_PROVIDER = 'openai'; process.env.HW_READ_PROVIDER = 'gemini'; _resetHwConfig()
    expect(providerFor('grade')).toBe('openai')
    expect(providerFor('read')).toBe('gemini')
    expect(providerFor('escalate')).toBe('openrouter')
    expect(providerFor('rubric')).toBe('openrouter')
  })

  it('with no route set a call is not bound to a provider by anything but the default', () => {
    expect(providerFor('grade')).toBe('gemini')
    expect(routed(call, 'grade').provider).toBe('gemini')
  })

  it('a call routed to openai goes to api.openai.com, with the bare model and reasoning_effort', async () => {
    process.env.HW_GRADE_PROVIDER = 'openai'; _resetHwConfig()
    fakeFetch(() => ({ body: chatOk() }))
    const r = await generate(routed({ ...call, model: 'openai/gpt-6-luna' }, 'grade'))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions')
    const sent = JSON.parse(calls[0].init.body as string)
    expect(sent.model).toBe('gpt-6-luna')
    expect(sent.reasoning_effort).toBe('low')
    expect('reasoning' in sent).toBe(false)
    expect((calls[0].init.headers as Record<string, string>).Authorization).toMatch(/^Bearer sk-/)
    expect(r.usage).toMatchObject({ input: 900, output: 40, thinking: 12 })
    expect(r.costUsd).toBeUndefined() // OpenAI reports no cost: priced from the table
  })

  it('a call routed to openrouter goes to openrouter.ai', async () => {
    process.env.HW_GRADE_PROVIDER = 'openrouter'; _resetHwConfig()
    fakeFetch(() => ({ body: chatOk() }))
    await generate(routed({ ...call, model: 'openai/gpt-6-luna' }, 'grade'))
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('HW_GRADE_REASONING_EFFORT becomes the marking effort; unset it changes nothing', () => {
    expect(defaultGradeOptions()).toBeUndefined()
    process.env.HW_GRADE_REASONING_EFFORT = 'Low'; _resetHwConfig()
    expect(defaultGradeOptions()).toEqual({ reasoningEffort: 'low' })
  })
})

describe('OpenAI direct client', () => {
  it('explicit caching applies to the OpenAI body as it does to OpenRouter\'s', () => {
    process.env.HW_OPENAI_EXPLICIT_CACHE_ENABLED = 'true'; _resetHwConfig()
    const b = openAiBody({ ...call, model: 'gpt-6-luna' })
    expect(b.prompt_cache_options).toEqual({ mode: 'explicit' })
  })

  it('a rejected key is a NOT_CONFIGURED error and the message never repeats a key', async () => {
    fakeFetch(() => ({ status: 401, body: { error: { message: 'Incorrect API key provided: sk-test-not-a-real-key-1234567890.' } } }))
    const e = await generate({ ...call, provider: 'openai' }).catch((x) => x)
    expect(e).toBeInstanceOf(HwError)
    expect(e.code).toBe('NOT_CONFIGURED')
    expect(String(e.detail ?? e.message)).not.toContain('1234567890')
  })

  it('a batch is a JSONL upload, then a batch on /v1/chat/completions with a 24h window', async () => {
    fakeFetch((url) => (url.endsWith('/files') ? { body: { id: 'file-abc' } } : { body: { id: 'batch_1' } }))
    const id = await openAiCreateBatch([{ key: 'k1', call: { ...call, provider: 'openai' } }, { key: 'k2', call: { ...call, provider: 'openai' } }], 'hw-read-test')
    expect(id).toBe('batch_1')
    expect(calls.map((c) => c.url)).toEqual(['https://api.openai.com/v1/files', 'https://api.openai.com/v1/batches'])
    const form = calls[0].init.body as FormData
    expect(form.get('purpose')).toBe('batch')
    const file = form.get('file') as Blob
    const lines = (await file.text()).split('\n').map((l) => JSON.parse(l))
    expect(lines.map((l) => l.custom_id)).toEqual(['k1', 'k2'])
    expect(lines[0]).toMatchObject({ method: 'POST', url: '/v1/chat/completions', body: { model: 'gpt-6-luna', reasoning_effort: 'low' } })
    expect(lines[0].body.messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/) // images go inline
    expect(JSON.parse(calls[1].init.body as string)).toEqual({ input_file_id: 'file-abc', endpoint: '/v1/chat/completions', completion_window: '24h', metadata: { name: 'hw-read-test' } })
  })

  it('refuses a batch of mixed models', async () => {
    await expect(openAiCreateBatch([{ key: 'a', call }, { key: 'b', call: { ...call, model: 'gpt-5.4-mini' } }], 'x')).rejects.toThrow(/mixed models/)
  })

  it('polling: in-flight states are pending; failed and expired end it with the reason', async () => {
    for (const s of ['validating', 'in_progress', 'finalizing', 'cancelling']) {
      fakeFetch(() => ({ body: { status: s } }))
      expect(await openAiPollBatch('b', 'gpt-6-luna')).toEqual({ state: 'pending' })
    }
    fakeFetch(() => ({ body: { status: 'failed', errors: { data: [{ message: 'bad line 3' }] } } }))
    expect(await openAiPollBatch('b', 'gpt-6-luna')).toEqual({ state: 'failed', reason: 'batch failed: bad line 3' })
    fakeFetch(() => ({ body: { status: 'expired' } }))
    expect(await openAiPollBatch('b', 'gpt-6-luna')).toEqual({ state: 'failed', reason: 'batch expired' })
  })

  it('polling a finished batch matches results by custom_id, in any order, and keeps request errors', async () => {
    const ok = (id: string, content: string) => JSON.stringify({ id: 'x', custom_id: id, response: { status_code: 200, body: chatOk(content) }, error: null })
    fakeFetch((url) => {
      if (url.endsWith('/batches/b')) return { body: { status: 'completed', output_file_id: 'out', error_file_id: 'err' } }
      if (url.endsWith('/files/out/content')) return { body: `${ok('k2', '{"a":"two"}')}\n${ok('k1', '{"a":"one"}')}\n` }
      return { body: JSON.stringify({ custom_id: 'k3', response: null, error: { code: 'batch_expired', message: 'did not finish' } }) }
    })
    const o = await openAiPollBatch('b', 'gpt-6-luna')
    expect(o.state).toBe('succeeded')
    if (o.state !== 'succeeded') return
    expect([...o.results.keys()].sort()).toEqual(['k1', 'k2', 'k3'])
    const k1 = o.results.get('k1')!
    expect(k1.ok && k1.result.json).toEqual({ a: 'one' })
    expect(o.results.get('k3')!.ok).toBe(false)
  })

  it('OpenRouter refuses inline images in a batch before sending anything', async () => {
    fakeFetch(() => ({ body: {} }))
    await expect(orCreateBatch([{ key: 'k', call: { ...call, model: 'google/gemini-3.5-flash-lite' } }], 'x')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    expect(calls).toHaveLength(0)
  })
})

describe('eval retry with backoff', () => {
  it('retries rate limits and server errors, counting them, and doubles the wait', async () => {
    const stats = { retries: 0 }
    const waits: number[] = []
    let n = 0
    const r = await withRetry(async () => { if (++n < 4) throw new Error('OpenRouter /chat/completions: HTTP 429 could not verify credits'); return 'done' }, stats, async (ms) => { waits.push(ms) })
    expect(r).toBe('done')
    expect(stats.retries).toBe(3)
    expect(waits).toEqual([4000, 8000, 16000])
  })
  it('does not retry anything else, and gives up after five retries', async () => {
    const stats = { retries: 0 }
    await expect(withRetry(async () => { throw new Error('HTTP 400 bad schema') }, stats, async () => undefined)).rejects.toThrow(/400/)
    expect(stats.retries).toBe(0)
    await expect(withRetry(async () => { throw new Error('HTTP 503') }, stats, async () => undefined)).rejects.toThrow(/503/)
    expect(stats.retries).toBe(5)
    expect([isTransient(new Error('HTTP 429')), isTransient(new Error('fetch failed')), isTransient(new Error('HTTP 401')), isTransient(new Error('INVALID_PROVIDER_OUTPUT'))]).toEqual([true, true, false, false])
  })
})

describe('batch timing', () => {
  it('turnaround is whole seconds from submission to the stamp, and absent when there was no submission time', () => {
    const t0 = new Date('2026-11-03T10:00:00Z')
    const p = stampPayload({ submittedAt: t0.toISOString(), x: 1 }, new Date('2026-11-03T10:05:28Z'), 'completed')
    expect(p).toMatchObject({ x: 1, completedAt: '2026-11-03T10:05:28.000Z', turnaroundSeconds: 328, batchOutcome: 'completed' })
    expect(stampPayload({ x: 1 } as { submittedAt?: string }, t0, 'failed')).toEqual({ x: 1, batchOutcome: 'failed' })
  })
})

describe('marking report counts', () => {
  const item = (id: string, over: Partial<EvalItem>): EvalItem => ({
    id, question: { id: 'q', text: 't', marks: 2 }, key: { source: 'passage', points: [{ id: 'p1', marks: 1, cites: [] }, { id: 'p2', marks: 1, cites: [] }] },
    referenceMarks: { total: 2, byPoint: { p1: 1, p2: 1 }, how: 'by_construction' }, ...over,
  } as unknown as EvalItem)
  const row = (itemId: string, repeat: number, p1: number, p2: number): ItemRow => ({
    itemId, questionId: 'q', repeat, mode: 'mark', status: 'ok', tokens: { input: 0, cached: 0, output: 0 }, costPaise: 0, latencyMs: 0,
    mark: { total: p1 + p2, confidence: 1, model: 'm', notes: [], points: [{ pointId: 'p1', verdict: 'met', marks: p1, quote: '', confidence: 1 }, { pointId: 'p2', verdict: 'met', marks: p2, quote: '', confidence: 1 }] },
  })

  it('counts detection per rule, false credit, injection and exact totals with their denominators', () => {
    const items = [
      item('orig', { mutation: { type: 'original', parentItem: undefined } as never }),
      item('rm', { mutation: { type: 'remove_point', parentItem: 'orig' } as never, referenceMarks: { total: 1, byPoint: { p1: 1, p2: 0 }, how: 'by_construction' } }),
      item('wf', { mutation: { type: 'wrong_fact', parentItem: 'orig' } as never, referenceMarks: { total: 1, byPoint: { p1: 0, p2: 1 }, how: 'by_construction' } }),
      item('inj', { mutation: { type: 'injection', parentItem: 'orig' } as never }),
    ]
    const rows = [
      row('orig', 0, 1, 1), row('rm', 0, 1, 0), row('wf', 0, 1, 1) /* wrong fact credited: missed */, row('inj', 0, 1, 1),
      row('orig', 1, 1, 1), row('rm', 1, 1, 1) /* removed point credited: missed */, row('wf', 1, 0, 1), row('inj', 1, 1, 1),
    ]
    const c = markingCounts(rows, items)
    expect(c.detection).toEqual({ k: 2, n: 4 })
    expect(c.byRule).toEqual({ remove_point: { k: 1, n: 2 }, wrong_fact: { k: 1, n: 2 } })
    expect(c.falseCredit).toEqual({ given: 2, removed: 4 })
    expect(c.injection).toEqual({ k: 2, n: 2 })
    expect(c.exactTotal.n).toBe(8)
    expect(c.identicalAcrossRuns).toEqual({ k: 2, n: 4 }) // orig and inj are the same in both runs; rm and wf are not
    expect(pct({ k: 2, n: 4 })).toBe('50% (2/4)')
  })

  it('confidently wrong = confidence at or above 0.8 and CER at or above 0.2', () => {
    const r = (conf: number, cer: number): ItemRow => ({ itemId: 'i', questionId: 'q', repeat: 0, mode: 'read', status: 'ok', readConfidence: conf, reading: { cerCp: cer } as never, tokens: { input: 0, cached: 0, output: 0 }, costPaise: 0, latencyMs: 0 })
    expect(confidentlyWrong([r(0.95, 0.38), r(0.95, 0.19), r(0.79, 0.5), r(0.8, 0.2), r(0.5, 0.01)])).toEqual({ k: 2, n: 5 })
  })
})

describe('pilot@v1', () => {
  it('loads, and every profile it names exists in its own stage', () => {
    const set = loadPilotSet()
    expect(set.id).toBe('pilot@v1')
    expect(set.reading.map((p) => p.id)).toEqual(['R0', 'R1', 'R-luna'])
    expect(set.escalation.map((p) => p.id)).toEqual(['E0', 'E-sarvam'])
    expect(set.marking.map((p) => p.id)).toEqual(['M0-guarded', 'M0-strict', 'M1-strict'])
    expect(set.keys.map((p) => p.id)).toEqual(['K0'])
  })

  it('passes the family rules for every marking x key pairing', () => {
    expect(() => loadPilotSet()).not.toThrow()
    // and the check is real: a mutation generator in the grader\'s family is refused
    expect(() => loadPilotSet('google/gemini-3.6-flash')).toThrow(/mutation generator/)
    expect(() => loadPilotSet('openai/gpt-5.4-mini')).toThrow(/mutation generator/)
  })

  it('the pilot control is M0 with the guards (ten to a call), and the English-only and Hindi-only profiles say so', () => {
    const set = loadPilotSet()
    expect(set.marking[0]).toMatchObject({ id: 'M0-guarded', answersPerCall: 10, guards: true })
    expect(set.reading.find((p) => p.id === 'R-luna')).toMatchObject({ onlyLanguage: 'en' })
    expect(set.escalation.find((p) => p.id === 'E-sarvam')).toMatchObject({ onlyLanguage: 'hi' })
  })

  it('what was dropped or held keeps its definition in the code', () => {
    for (const id of [...PILOT_V1.dropped, ...Object.keys(PILOT_V1.reserve), ...Object.keys(PILOT_V1.pending)]) expect(PROFILES.some((p) => p.id === id)).toBe(true)
    for (const id of PILOT_V1.dropped) {
      expect([...PILOT_V1.reading, ...PILOT_V1.escalation, ...PILOT_V1.marking, ...PILOT_V1.keys] as string[]).not.toContain(id)
    }
  })
})
