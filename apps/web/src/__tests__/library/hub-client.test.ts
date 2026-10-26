// The library hub client and `searchLibrary`: credentials, error classes, and the one place a fallback is allowed.
// A fake fetch and fake direct readers; no network, no Qdrant.

import { HubError, hubConfigFromEnv, hubSearch, LibraryNotConfigured, type HubConfig, type HubSearchResponse } from '@/lib/library/hub-client'
import { directSearch, filterFor, forgetRememberedScopes, rememberScope, type DirectDeps } from '@/lib/library/direct-reader'
import { searchLibrary } from '@/lib/library/search'

const cfg: HubConfig = { baseUrl: 'https://pdlms.test', appId: 'digiclassroom', secret: 's3cret', timeoutMs: 500 }
const WORK = '11111111-1111-4111-8111-111111111111'

const hubBody = (over: Partial<HubSearchResponse> = {}): HubSearchResponse => ({
  scope: [{ work_id: WORK, title: 'Science IX', medium: 'en', chapters: [1, 2], via: ['SCH.CBSE.C9.SCIENCE'] }],
  results: [{
    passage_id: 'sci9-en:01:sec:1.1:1', work_id: WORK, work_title: 'Science IX', chapter_no: 1, kind: 'prose',
    block_type: null, label: null, section_no: '1.1', section_title: 'Physical nature of matter', page_start: 1, page_end: 1, pdf_page: 4,
    text: 'Matter is made up of particles.', retrieval_class: 'reference', score: { fused: 0.03, dense: 0.71 }, context: { before: [], after: [] },
  }],
  warnings: [],
  ...over,
})

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
const status = (code: number, text = ''): Response => new Response(text, { status: code })
const asFetch = (f: (...a: any[]) => Promise<Response>) => f as unknown as typeof fetch

describe('hubConfigFromEnv', () => {
  it('needs the URL and the secret, names what is missing, defaults the app id', () => {
    expect(() => hubConfigFromEnv({} as never)).toThrow(LibraryNotConfigured)
    expect(() => hubConfigFromEnv({ LIBRARY_HUB_URL: 'https://x' } as never)).toThrow(/LIBRARY_HUB_SECRET/)
    const c = hubConfigFromEnv({ LIBRARY_HUB_URL: 'https://x/', LIBRARY_HUB_SECRET: 'k' } as never)
    expect(c).toMatchObject({ baseUrl: 'https://x', appId: 'digiclassroom', secret: 'k' })
  })
})

describe('hubSearch', () => {
  it('posts the request with the app credentials in headers, never in the URL, and refuses redirects', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const fetchImpl = asFetch(async (url: string, init: RequestInit) => { calls.push({ url, init }); return ok(hubBody()) })
    const res = await hubSearch(cfg, { query: 'what is matter', nodeCodes: ['SCH.CBSE.C9'], medium: 'en' }, fetchImpl)
    expect(res.results[0].passage_id).toBe('sci9-en:01:sec:1.1:1')
    expect(calls[0].url).toBe('https://pdlms.test/api/hub/search')
    expect(calls[0].url).not.toContain('s3cret')
    expect(calls[0].init.headers).toMatchObject({ 'x-hub-app': 'digiclassroom', 'x-hub-secret': 's3cret' })
    expect(calls[0].init.redirect).toBe('error')
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ query: 'what is matter', nodeCodes: ['SCH.CBSE.C9'] })
  })

  it.each([
    [401, 'unauthorized'], [403, 'unauthorized'], [404, 'disabled'], [400, 'bad_request'], [429, 'rate_limited'], [500, 'unreachable'], [503, 'unreachable'],
  ])('HTTP %i is %s', async (code, failure) => {
    const fetchImpl = asFetch(async () => status(code, 'nope'))
    await expect(hubSearch(cfg, { query: 'q', nodeCodes: ['SCH.CBSE.C9'] }, fetchImpl)).rejects.toMatchObject({ failure, status: code })
  })

  it('a network failure and a malformed answer are "unreachable"; a hung hub times out', async () => {
    const boom = asFetch(async () => { throw new TypeError('fetch failed') })
    await expect(hubSearch(cfg, { query: 'q' }, boom)).rejects.toMatchObject({ failure: 'unreachable' })
    const junk = asFetch(async () => ok({ nothing: true }))
    await expect(hubSearch(cfg, { query: 'q' }, junk)).rejects.toMatchObject({ failure: 'unreachable' })
    const hang = asFetch((_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted')))))
    await expect(hubSearch({ ...cfg, timeoutMs: 20 }, { query: 'q' }, hang)).rejects.toMatchObject({ failure: 'unreachable' })
  })
})

describe('searchLibrary: the fallback covers a hub outage and nothing else', () => {
  const direct = (hits: number[] = [0.8]) => {
    const seen: { filter: Record<string, unknown>; limit: number }[] = []
    const deps: DirectDeps = {
      embed: async () => [0.1],
      query: async ({ filter, limit }) => {
        seen.push({ filter, limit })
        return hits.map((score) => ({
          score,
          payload: { work_id: WORK, passage_id: 'sci9-en:01:sec:1.1:1', chapter_no: 1, text: 'Matter is made up of particles.', page_start: 1, page_end: 1, pdf_page: 4, kind: 'prose' as const, retrieval_class: 'reference' as const },
        }))
      },
    }
    return { deps, seen }
  }
  const req = { query: 'matter', nodeCodes: ['SCH.CBSE.C9'], medium: 'en' as const }
  beforeEach(() => forgetRememberedScopes())

  it('returns the hub answer as it is, with no degraded flag', async () => {
    const res = await searchLibrary(req, { cfg, fetchImpl: asFetch(async () => ok(hubBody())), direct: null })
    expect(res.degraded).toBeUndefined()
    expect(res.results).toHaveLength(1)
  })

  it('hub unreachable + direct reader configured: answers degraded, with a warning, applying the remembered scope', async () => {
    await searchLibrary(req, { cfg, fetchImpl: asFetch(async () => ok(hubBody())), direct: null }) // remembers the scope the hub gave
    const d = direct()
    const warned: string[] = []
    const res = await searchLibrary(req, { cfg, fetchImpl: asFetch(async () => status(503)), direct: async () => d.deps, warn: (m) => warned.push(m) })
    expect(res.degraded).toBe(true)
    expect(res.warnings.join(' ')).toMatch(/could not be reached/)
    expect(res.warnings.join(' ')).toMatch(/earlier/)
    expect(warned[0]).toMatch(/hub search failed/)
    const should = d.seen[0].filter.should as { must: unknown[] }[]
    expect(should[0].must).toEqual([{ key: 'work_id', match: { value: WORK } }, { key: 'chapter_no', match: { any: [1, 2] } }])
  })

  it('without a remembered scope the warning says every public book in the medium was searched', async () => {
    const res = await searchLibrary(req, { cfg, fetchImpl: asFetch(async () => status(500)), direct: async () => direct().deps })
    expect(res.degraded).toBe(true)
    expect(res.warnings.join(' ')).toMatch(/every published public book/)
  })

  it.each([[401], [404], [400], [429]])('HTTP %i is thrown, never covered by the fallback', async (code) => {
    let used = false
    await expect(searchLibrary(req, { cfg, fetchImpl: asFetch(async () => status(code)), direct: async () => { used = true; return direct().deps } })).rejects.toBeInstanceOf(HubError)
    expect(used).toBe(false)
  })

  it('an outage with no fallback configured throws the hub error, not the configuration error', async () => {
    const down = asFetch(async () => status(503))
    await expect(searchLibrary(req, { cfg, fetchImpl: down, direct: async () => { throw new LibraryNotConfigured('LIBRARY_QDRANT_URL is not set') } })).rejects.toMatchObject({ failure: 'unreachable' })
    await expect(searchLibrary(req, { cfg, fetchImpl: down, direct: null })).rejects.toBeInstanceOf(HubError)
  })
})

describe('direct reader', () => {
  it('filters live public reference passages of the medium; practice only on request; R_min applies', async () => {
    expect(filterFor({ query: 'q', medium: 'hi' }, null).must).toEqual([
      { key: 'status', match: { value: 'live' } },
      { key: 'visibility', match: { value: 'public' } },
      { key: 'retrieval_class', match: { value: 'reference' } },
      { key: 'medium', match: { value: 'hi' } },
    ])
    expect((filterFor({ query: 'q', includePractice: true }, null).must as { key: string }[]).map((m) => m.key)).not.toContain('retrieval_class')

    const deps: DirectDeps = {
      embed: async () => [0],
      query: async () => [0.9, 0.2].map((score) => ({ score, payload: { work_id: 'w', passage_id: 'sci9-en:01:sec:1.1:1', text: 't', chapter_no: 1 } })),
    }
    const res = await directSearch({ query: 'q', minDense: 0.5 }, deps)
    expect(res.results.map((r) => r.score.dense)).toEqual([0.9])
  })

  it('remembers a scope per goal set, not across goals', async () => {
    forgetRememberedScopes()
    rememberScope({ query: 'a', nodeCodes: ['SCH.CBSE.C9'], medium: 'en' }, hubBody())
    const seen: Record<string, unknown>[] = []
    const deps: DirectDeps = { embed: async () => [0], query: async ({ filter }) => { seen.push(filter); return [] } }
    await directSearch({ query: 'b', nodeCodes: ['SCH.CBSE.C9'], medium: 'en' }, deps)
    await directSearch({ query: 'b', nodeCodes: ['SCH.CBSE.C10'], medium: 'en' }, deps)
    expect(seen[0].should).toBeDefined()
    expect(seen[1].should).toBeUndefined()
  })
})
