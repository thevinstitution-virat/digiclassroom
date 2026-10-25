/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// Handwritten Assignments: the OpenRouter provider — request shape, usage and cost, errors,
// and batch results — against a faked fetch.

import { _resetHwConfig } from '@/lib/hw/config'
import { chatBody, createBatch, generate, parseChat, pollBatch } from '@/lib/hw/openrouter/client'
import { imagePart, textPart } from '@/lib/hw/gemini/client'
import { HwError } from '@/lib/hw/errors'

const realFetch = global.fetch
let calls: { url: string; init: RequestInit }[] = []
// A jest.fn, because the repo's jest.setup calls fetch.mockClear() before every test.
function fakeFetch(status: number, body: unknown) {
  global.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  }) as unknown as typeof fetch
}

const call = {
  model: 'google/gemini-3.5-flash-lite',
  systemInstruction: 'SYSTEM',
  schema: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false },
  parts: [textPart('Answer id: x'), imagePart(new Uint8Array([1, 2, 3]))],
}

const ok = (content: string, usage = { prompt_tokens: 500, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 100 }, cost: 0.00021 }) => ({
  model: 'google/gemini-3.5-flash-lite-001', choices: [{ finish_reason: 'stop', message: { content } }], usage,
})

beforeEach(() => {
  calls = []
  process.env.OPENROUTER_API_KEY = 'sk-or-test'
  process.env.HW_THINKING_LEVEL = 'MINIMAL'
  process.env.HW_READ_MEDIA_RESOLUTION = 'LOW'
  _resetHwConfig()
})
afterAll(() => { global.fetch = realFetch })

describe('OpenRouter request', () => {
  it('maps the Gemini-shaped call to chat completions with strict JSON and minimal reasoning', () => {
    const b = chatBody(call)
    expect(b.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' })
    expect(b.messages[1].role).toBe('user')
    expect(b.messages[1].content).toEqual([
      { type: 'text', text: 'Answer id: x' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AQID', detail: 'low' } },
    ])
    expect(b.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'hw_output', strict: true, schema: call.schema } })
    expect(b.reasoning).toEqual({ effort: 'minimal' })
  })
})

describe('OpenRouter response', () => {
  it('returns parsed JSON, token usage (thinking counted as output) and the reported cost', async () => {
    fakeFetch(200, ok('{"a":"hello"}'))
    const r = await generate(call)
    expect(r.json).toEqual({ a: 'hello' })
    expect(r.usage).toEqual({ input: 500, cached: 100, output: 40 })
    expect(r.costUsd).toBe(0.00021)
    expect(r.model).toBe('google/gemini-3.5-flash-lite-001')
    expect(calls[0].url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-or-test')
  })

  it('keeps usage on unusable output so it is still billed and recorded', () => {
    try {
      parseChat(ok('not json'), 'm')
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(HwError)
      expect((e as HwError).code).toBe('INVALID_PROVIDER_OUTPUT')
      expect((e as unknown as { usage: unknown }).usage).toEqual({ input: 500, cached: 100, output: 40 })
    }
  })

  it('treats a cut-off answer as unusable', () => {
    expect(() => parseChat({ ...ok('{"a":'), choices: [{ finish_reason: 'length', message: { content: '{"a":' } }] }, 'm')).toThrow(/finish_reason length/)
  })

  it('does not retry a bad key or missing credits (NOT_CONFIGURED), but does retry a server error', async () => {
    fakeFetch(402, { error: { message: 'Insufficient credits' } })
    await expect(generate(call)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    fakeFetch(503, { error: { message: 'upstream unavailable' } })
    await expect(generate(call)).rejects.toMatchObject({ code: 'PROVIDER_ERROR' })
  })

  it('refuses to run without a key', async () => {
    delete process.env.OPENROUTER_API_KEY
    _resetHwConfig()
    await expect(generate(call)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
  })
})

describe('OpenRouter batch', () => {
  it('submits requests with custom ids, with the batch fields before `requests`', async () => {
    fakeFetch(202, { id: 'batch_1', status: 'validating' })
    const marking = { ...call, parts: [textPart('question block'), textPart('answers block')] }
    const id = await createBatch([{ key: 'job-a', call: marking }, { key: 'job-b', call: marking }], 'x')
    expect(id).toBe('batch_1')
    const raw = String(calls[0].init.body)
    expect(raw.indexOf('"requests"')).toBeGreaterThan(raw.indexOf('"completion_window"'))
    const body = JSON.parse(raw)
    expect(body).toMatchObject({ endpoint: '/v1/chat/completions', model: call.model, completion_window: '24h' })
    expect(body.requests.map((r: { custom_id: string }) => r.custom_id)).toEqual(['job-a', 'job-b'])
  })

  it('maps results by custom_id, parses each, and reports per-request failures', async () => {
    fakeFetch(200, {
      status: 'completed',
      results: [
        { custom_id: 'job-b', response: { status_code: 200, body: ok('{"a":"b"}') } },
        { custom_id: 'job-a', error: { message: 'model overloaded' } },
        { custom_id: 'job-c', response: { status_code: 200, body: ok('oops') } },
      ],
    })
    const out = await pollBatch('batch_1', call.model)
    expect(out.state).toBe('succeeded')
    if (out.state !== 'succeeded') return
    expect(out.results.get('job-b')).toMatchObject({ ok: true, result: { json: { a: 'b' } } })
    expect(out.results.get('job-a')).toMatchObject({ ok: false })
    const c = out.results.get('job-c')!
    expect(c.ok).toBe(false)
    expect(!c.ok && (c.error as HwError).code).toBe('INVALID_PROVIDER_OUTPUT')
  })

  it('keeps waiting while in progress, or when completed results are not populated yet', async () => {
    fakeFetch(200, { status: 'in_progress' })
    expect((await pollBatch('b', 'm')).state).toBe('pending')
    fakeFetch(200, { status: 'completed', results: null })
    expect((await pollBatch('b', 'm')).state).toBe('pending')
    fakeFetch(200, { status: 'expired' })
    expect(await pollBatch('b', 'm')).toEqual({ state: 'failed', reason: 'batch expired' })
  })
})

describe('OpenRouter batch limits', () => {
  it('refuses to batch images (OpenRouter rejects inline images in batches)', async () => {
    fakeFetch(202, { id: 'never' })
    await expect(createBatch([{ key: 'a', call }], 'x')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    expect(calls).toHaveLength(0)
  })
  it('reports the provider’s reason when a batch fails', async () => {
    fakeFetch(200, { status: 'failed', error: { message: 'contains unsupported image_url content' } })
    expect(await pollBatch('b', 'm')).toEqual({ state: 'failed', reason: 'batch failed: contains unsupported image_url content' })
  })
  it('batches text-only work such as marking', async () => {
    fakeFetch(202, { id: 'batch_text' })
    const textOnly = { ...call, parts: [textPart('question'), textPart('answers')] }
    await expect(createBatch([{ key: 'a', call: textOnly }], 'x')).resolves.toBe('batch_text')
  })
})
