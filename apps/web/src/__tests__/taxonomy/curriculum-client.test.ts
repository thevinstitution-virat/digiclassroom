/* eslint-disable no-restricted-syntax -- this test sets the environment the client reads */
// Curriculum v2 client: the URLs and header it sends to Vidyaverse's /api/v1/curriculum, the bare (unwrapped) bodies
// it returns, the flag, the cache, and the errors — against a faked fetch.

import {
  CurriculumServiceError,
  _clearCurriculumCache,
  getCurriculumChildren,
  getCurriculumCombinations,
  getCurriculumDomains,
  getCurriculumNode,
  isCurriculumV2Enabled,
  searchCurriculum,
} from '@/lib/taxonomy/curriculum'

const realFetch = global.fetch
const ENV = { ...process.env }
let calls: { url: string; init: RequestInit }[] = []

// A jest.fn, because the repo's jest.setup calls fetch.mockClear() before every test.
function fakeFetch(status: number, body: unknown) {
  global.fetch = jest.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
}

// The shape Vidyaverse (and Book Buddy) answer with.
const SCH = {
  id: '0db7030e-7502-5b02-a5e9-679fa579b987', code: 'SCH', name: 'School Education', nameHi: 'विद्यालयी शिक्षा',
  nodeType: 'DOMAIN', depth: 1, hasChildren: true, verification: 'sourced', completeness: 'complete',
  canonicalSubject: null, path: 'School Education', gradeFrom: null, gradeTo: null, localName: null,
}

beforeEach(() => {
  calls = []
  _clearCurriculumCache()
  process.env.VIDYAVERSE_ISSUER = 'https://vv.test/'
  process.env.TAXONOMY_SERVICE_API_KEY = 'svc-key'
  process.env.TAXONOMY_V2_ENABLED = 'true'
})

afterAll(() => {
  global.fetch = realFetch
  process.env = ENV
})

describe('isCurriculumV2Enabled', () => {
  it('needs the flag and the Vidyaverse URL and key', () => {
    expect(isCurriculumV2Enabled()).toBe(true)
    process.env.TAXONOMY_V2_ENABLED = 'false'
    expect(isCurriculumV2Enabled()).toBe(false)
    process.env.TAXONOMY_V2_ENABLED = 'true'
    delete process.env.TAXONOMY_SERVICE_API_KEY
    expect(isCurriculumV2Enabled()).toBe(false)
  })
})

describe('requests', () => {
  it('calls /api/v1/curriculum with the service key and returns the bare body', async () => {
    fakeFetch(200, [SCH])
    await expect(getCurriculumDomains()).resolves.toEqual([SCH])
    expect(calls[0].url).toBe('https://vv.test/api/v1/curriculum/domains')
    expect((calls[0].init.headers as Record<string, string>)['x-taxonomy-api-key']).toBe('svc-key')
  })

  it('builds the paths of Book Buddy\'s controller', async () => {
    fakeFetch(200, [])
    await getCurriculumChildren(null)
    await getCurriculumChildren(SCH.id)
    await getCurriculumCombinations(SCH.id)
    await searchCurriculum(' जीव विज्ञान ', { domain: 'SCH', types: ['SUBJECT', 'PAPER'], limit: 5 })
    expect(calls.map((c) => c.url.replace('https://vv.test/api/v1/curriculum', ''))).toEqual([
      '/nodes',
      `/nodes?parentId=${SCH.id}`,
      `/nodes/${SCH.id}/combinations`,
      // A space travels as '+', which Vidyaverse's query parser reads as a space.
      `/search?q=${encodeURIComponent('जीव').concat('+', encodeURIComponent('विज्ञान'))}&domain=SCH&types=SUBJECT%2CPAPER&limit=5`,
    ])
  })

  it('does not search for fewer than two characters', async () => {
    fakeFetch(200, [SCH])
    await expect(searchCurriculum(' a ')).resolves.toEqual([])
    expect(calls).toHaveLength(0)
  })

  it('answers a repeated read from its cache', async () => {
    fakeFetch(200, { node: SCH, ancestors: [] })
    await getCurriculumNode(SCH.id)
    await expect(getCurriculumNode(SCH.id)).resolves.toEqual({ node: SCH, ancestors: [] })
    expect(calls).toHaveLength(1)
  })
})

describe('errors', () => {
  it('throws the service message and status, and caches nothing', async () => {
    fakeFetch(404, { statusCode: 404, message: 'Taxonomy node not found', error: 'Not Found' })
    const err = await getCurriculumNode(SCH.id).catch((e) => e)
    expect(err).toBeInstanceOf(CurriculumServiceError)
    expect(err).toMatchObject({ message: 'Taxonomy node not found', status: 404 })
    await getCurriculumNode(SCH.id).catch(() => undefined)
    expect(calls).toHaveLength(2)
  })

  it('reads the error of Vidyaverse\'s auth hook too', async () => {
    fakeFetch(401, { success: false, error: 'Invalid taxonomy service API key' })
    await expect(getCurriculumDomains()).rejects.toMatchObject({ message: 'Invalid taxonomy service API key', status: 401 })
  })

  it('throws when Vidyaverse is not configured, without calling anything', async () => {
    delete process.env.VIDYAVERSE_ISSUER
    delete process.env.TAXONOMY_SERVICE_URL
    fakeFetch(200, [])
    await expect(getCurriculumDomains()).rejects.toBeInstanceOf(CurriculumServiceError)
    expect(calls).toHaveLength(0)
  })

  it('reports an unreachable service', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(getCurriculumDomains()).rejects.toMatchObject({ message: 'Curriculum service unreachable: fetch failed', status: null })
  })
})
