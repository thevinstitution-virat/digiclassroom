// Answer keys over the library hub: scope, R_min on dense cosine, chapter anchoring, citations by passage id, and
// failure handling in buildKey. A fake hub and fake AI; no network.

import { buildKey, type KeyDeps, type KeySettings } from '@/lib/hw/keys'
import { keyScopeOf, retrieveTextbookFromHub, subjectNodeCodes, type HubKeySource } from '@/lib/hw/keys/hub-retrieval'
import type { HubResult, HubSearchRequest } from '@/lib/library/hub-client'
import type { KeyRequest } from '@/lib/hw/keys/types'
import type { AiResult } from '@/lib/hw/ai'
import { HwError } from '@/lib/hw/errors'

const WORK = '11111111-1111-4111-8111-111111111111'
const hit = (id: string, dense: number | null, over: Partial<HubResult> = {}): HubResult => ({
  passage_id: id, work_id: WORK, work_title: 'Science IX', chapter_no: 7, kind: 'prose', block_type: null, label: null,
  section_no: '7.2', section_title: 'Rate of motion', page_start: 76, page_end: 76, pdf_page: 79,
  text: `Text of ${id}.`, retrieval_class: 'reference', score: { fused: 0.03, dense }, context: { before: [], after: [] }, ...over,
})

const settings = { rMin: 0.45, theta: 0.35, topK: 30, maxPassages: 3, pagesVerified: new Set([WORK]) }
const req = (over: Partial<KeyRequest> = {}): KeyRequest => ({
  questionText: 'Define speed.', questionType: 'short', marks: 2, classLevel: '9', subject: 'Science', medium: 'English', ...over,
})

function fakeHub(answer: (r: HubSearchRequest, n: number) => HubResult[]): HubKeySource & { sent: HubSearchRequest[] } {
  const sent: HubSearchRequest[] = []
  return {
    sent,
    indexId: 'hub|library_v2_te3l_3072|text-embedding-3-large',
    search: async (r) => { sent.push(r); return { scope: [], results: answer(r, sent.length), warnings: [] } },
  }
}

describe('scope of a key request', () => {
  it('class + subject become curriculum codes; class 10 mathematics is two courses; medium maps to en/hi', () => {
    expect(subjectNodeCodes('9', 'Science')).toEqual(expect.arrayContaining(['SCH.CBSE.C9.SCIENCE', 'SCH.CBSE.C9.PHYSICS']))
    expect(subjectNodeCodes('Class X', 'Mathematics').sort()).toEqual(['SCH.CBSE.C10.MATHEMATICS', 'SCH.CBSE.C10.MATHEMATICS_BASIC', 'SCH.CBSE.C10.MATHEMATICS_STANDARD'])
    expect(keyScopeOf(req({ medium: 'Hindi' })).medium).toBe('hi')
    expect(keyScopeOf(req({ bookHint: { contentItemId: WORK } })).workIds).toEqual([WORK])
  })
  it('an explicit library scope wins over class and subject', () => {
    expect(keyScopeOf(req({ library: { nodeCodes: ['SCH.CBSE.C9.SCIENCE'] } }))).toEqual({ nodeCodes: ['SCH.CBSE.C9.SCIENCE'], medium: 'en' })
  })
})

describe('retrieveTextbookFromHub', () => {
  it('no passage in scope is "no_book"', async () => {
    const r = await retrieveTextbookFromHub(req(), fakeHub(() => []), settings, [])
    expect(r).toMatchObject({ ok: false, reason: 'no_book' })
  })

  it('R_min is a floor on the dense cosine of the best passage', async () => {
    const r = await retrieveTextbookFromHub(req(), fakeHub(() => [hit('a', 0.3), hit('b', 0.4)]), settings, [])
    expect(r).toMatchObject({ ok: false, reason: 'below_threshold' })
    expect((r as { detail: string }).detail).toMatch(/0\.400 < R_min 0\.45/)
  })

  it('keeps passages at or above R_min, best first, at most maxPassages; ids and citations are passage ids', async () => {
    const hub = fakeHub(() => [hit('a', 0.5), hit('b', 0.9), hit('c', 0.46), hit('d', 0.2), hit('e', 0.47)])
    const r = await retrieveTextbookFromHub(req(), hub, settings, [])
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.passages.map((p) => p.id)).toEqual(['b', 'a', 'e'])
    expect(r.citations.map((c) => c.chunkId)).toEqual(['b', 'a', 'e'])
    expect(r.citations[0]).toMatchObject({ textbookTitle: 'Science IX', pageNumber: 76, contentItemId: WORK, pagesVerified: true, classLevel: 'Class 9' })
    // The first search is plain: reference passages, no window, the hub's own limit.
    expect(hub.sent[0]).toMatchObject({ query: 'Define speed.', limit: 20, window: 0, medium: 'en' })
  })

  it('a passage without a dense score cannot be compared with R_min and is dropped, with a note', async () => {
    const notes: string[] = []
    const r = await retrieveTextbookFromHub(req(), fakeHub(() => [hit('a', null), hit('b', 0.8)]), settings, notes)
    expect(r.ok && r.passages.map((p) => p.id)).toEqual(['b'])
    expect(notes.join(' ')).toMatch(/without a dense score dropped/)
    const none = await retrieveTextbookFromHub(req(), fakeHub(() => [hit('a', null)]), settings, [])
    expect(none).toMatchObject({ ok: false, reason: 'passages_missing' })
  })

  it('practice passages never become key sources', async () => {
    const r = await retrieveTextbookFromHub(req(), fakeHub(() => [hit('p', 0.9, { retrieval_class: 'practice' })]), settings, [])
    expect(r).toMatchObject({ ok: false, reason: 'no_book' })
  })

  it("a question that matches the book's own exercise is anchored to that exercise's chapter", async () => {
    const notes: string[] = []
    const hub = fakeHub((r, n) => {
      if (n === 1) return [hit('ch7-a', 0.8, { chapter_no: 7 }), hit('ch8-a', 0.7, { chapter_no: 8 })]
      if (r.includePractice) return [hit('sci9-en:08:exercise:3', 0.6, { chapter_no: 8, retrieval_class: 'practice', kind: 'block', block_type: 'EXERCISE', text: 'Questions:\n 1. Define speed and give its SI unit.\n' })]
      return [hit('ch8-a', 0.7, { chapter_no: 8 }), hit('ch8-b', 0.6, { chapter_no: 8 }), hit('ch7-b', 0.9, { chapter_no: 7 })]
    })
    const r = await retrieveTextbookFromHub(req({ questionText: 'Define speed and give its SI unit.' }), hub, settings, notes)
    expect(r.ok && r.passages.map((p) => p.id)).toEqual(['ch8-a', 'ch8-b'])
    expect(notes.join(' ')).toMatch(/anchored to chapter 8/)
    expect(hub.sent[2]).toMatchObject({ workIds: [WORK], limit: 20 })
  })

  it('a chapter hint with a number narrows to that chapter without a practice search', async () => {
    const hub = fakeHub(() => [hit('a', 0.8, { chapter_no: 7 }), hit('b', 0.9, { chapter_no: 8 })])
    const r = await retrieveTextbookFromHub(req({ bookHint: { chapter: 'Chapter 8: Force' } }), hub, settings, [])
    expect(r.ok && r.passages.map((p) => p.id)).toEqual(['b'])
    expect(hub.sent).toHaveLength(1)
  })
})

describe('buildKey in hub mode', () => {
  const ai = (json: unknown): AiResult => ({ json, usage: { input: 10, cached: 0, output: 5 }, rawUsage: {}, model: 'm' })
  const writer = { reference_answer: 'Speed is distance per unit time.', value_points: [
    { id: 'p1', text: 'distance per unit time', marks: 1, kind: 'key_point', cites: ['sci9-en:07:sec:7.2:1'], accepted_alternatives: [] },
    { id: 'p2', text: 'a rate', marks: 1, kind: 'key_point', cites: ['sci9-en:07:sec:7.2:1'], accepted_alternatives: [] },
  ] }
  const verifier = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'yes' }, { point_id: 'p2', support: 'supported', reason: 'yes' }] }
  const keySettings = (): KeySettings => ({
    writer: { provider: 'gemini', model: 'gemini-3.6-flash' }, verifier: { provider: 'openrouter', model: 'openai/gpt-5.4-mini' },
    rMin: 0.45, theta: 0.35, topK: 30, maxPassages: 3, pagesVerified: new Set([WORK]),
  })
  const deps = (hub: HubKeySource): KeyDeps => ({
    hub,
    // The Gyankosh retriever and trio reader must not be touched in hub mode.
    retriever: { indexId: 'old', embed: async () => { throw new Error('old retriever used') }, search: async () => { throw new Error('old retriever used') } },
    trio: { practiceRows: async () => { throw new Error('trio used') }, chunks: async () => { throw new Error('trio used') } },
    generate: async (_p, call) => ai(call.systemInstruction.startsWith('You write') ? writer : verifier),
  })

  it('builds a grounded key from hub passages and cites by passage id', async () => {
    const hub = fakeHub(() => [hit('sci9-en:07:sec:7.2:1', 0.7)])
    const out = await buildKey(req(), deps(hub), keySettings())
    expect(out.status).toBe('grounded')
    if (out.status !== 'grounded') return
    expect(out.source).toBe('textbook')
    expect(out.citations.map((c) => c.chunkId)).toEqual(['sci9-en:07:sec:7.2:1'])
  })

  it('the config hash names the hub index, so keys built from the old index are not reused', async () => {
    const hub = fakeHub(() => [hit('sci9-en:07:sec:7.2:1', 0.7)])
    const a = await buildKey(req(), deps(hub), keySettings())
    const b = await buildKey(req(), { ...deps(hub), hub: { ...hub, indexId: 'hub|other' } }, keySettings())
    expect(a.configHash).not.toBe(b.configHash)
  })

  it('a hub outage is an error, never "no book"', async () => {
    const hub: HubKeySource = { indexId: 'hub', search: async () => { throw new Error('library hub unreachable: boom') } }
    await expect(buildKey(req(), deps(hub), keySettings())).rejects.toBeInstanceOf(HwError)
    await expect(buildKey(req(), deps(hub), keySettings())).rejects.toMatchObject({ code: 'PROVIDER_ERROR' })
  })

  it('no book and below the threshold stay data outcomes (no_grounding)', async () => {
    expect(await buildKey(req(), deps(fakeHub(() => [])), keySettings())).toMatchObject({ status: 'no_grounding', reason: 'no_book' })
    expect(await buildKey(req(), deps(fakeHub(() => [hit('x', 0.1)])), keySettings())).toMatchObject({ status: 'no_grounding', reason: 'below_threshold' })
  })
})
