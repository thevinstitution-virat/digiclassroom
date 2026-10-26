// Scope rules, the tutor's adapter over hub results, and the cache-key scope token. Pure; fake hub.

import { classNodeCode, mediumCode, resolveScope, scopeOfContext, scopeToken } from '@/lib/library/scope'
import { searchViaLibraryHub, toQdrantResponse, withContext } from '@/lib/library/tutor-adapter'
import type { HubResult, HubSearchResponse } from '@/lib/library/hub-client'

const WORK = '11111111-1111-4111-8111-111111111111'
const result = (over: Partial<HubResult> = {}): HubResult => ({
  passage_id: 'sci9-en:07:sec:7.2:1', work_id: WORK, work_title: 'Science IX', chapter_no: 7, kind: 'prose', block_type: null, label: null,
  section_no: '7.2', section_title: 'Measuring the rate of motion', page_start: 76, page_end: 76, pdf_page: 79,
  text: 'Speed is the distance travelled per unit time.', retrieval_class: 'reference', score: { fused: 0.03, dense: 0.62 },
  context: { before: [], after: [] }, ...over,
})
const hub = (results: HubResult[], over: Partial<HubSearchResponse> = {}): HubSearchResponse => ({ scope: [], results, warnings: [], ...over })

describe('scope', () => {
  it('class code from the old board and grade; boards with no node give null', () => {
    expect(classNodeCode('CBSE', 9)).toBe('SCH.CBSE.C9')
    expect(classNodeCode('ICSE', 10)).toBe('SCH.CISCE.C10')
    expect(classNodeCode('State Board', 9)).toBeNull()
    expect(classNodeCode('CBSE', 13)).toBeNull()
    expect(classNodeCode(null, 9)).toBeNull()
  })

  it('medium codes', () => {
    expect([mediumCode('English'), mediumCode('hi'), mediumCode('HINDI'), mediumCode('Tamil'), mediumCode(null)]).toEqual(['en', 'hi', 'hi', undefined, undefined])
  })

  it("the learner's goals win; the old class code is the fallback; nothing known gives null", () => {
    const path = { goals: [{ nodeId: 'n1' }, { nodeId: 'n2' }], medium: 'hi' }
    expect(resolveScope({ path, board: 'CBSE', grade: 9, medium: 'English' })).toEqual({ nodeIds: ['n1', 'n2'], medium: 'hi' })
    expect(resolveScope({ path: { goals: [], medium: null }, board: 'CBSE', grade: 9, medium: 'English' })).toEqual({ nodeCodes: ['SCH.CBSE.C9'], medium: 'en' })
    expect(resolveScope({ path: { goals: [{ nodeId: 'n1' }], medium: null }, medium: 'Hindi' })).toEqual({ nodeIds: ['n1'], medium: 'hi' })
    expect(resolveScope({ board: 'State Board', grade: 9 })).toBeNull()
  })

  it('cache tokens differ by goals and medium, not by order', () => {
    const a = scopeToken({ nodeIds: ['b', 'a'], medium: 'en' })
    expect(a).toBe(scopeToken({ nodeIds: ['a', 'b'], medium: 'en' }))
    expect(a).not.toBe(scopeToken({ nodeIds: ['a', 'b'], medium: 'hi' }))
    expect(scopeToken(null)).toBe('noscope')
    expect(scopeToken(scopeOfContext({ board_type: 'CBSE', grade_level: 9 }))).toBe(scopeToken({ nodeCodes: ['SCH.CBSE.C9'] }))
    expect(scopeOfContext({ hubScope: { nodeIds: ['x'] }, board_type: 'CBSE', grade_level: 9 })).toEqual({ nodeIds: ['x'] })
  })
})

describe('tutor adapter', () => {
  it('maps hub passages to the shape the tutor reads, keeping the passage id, work, pages and dense score', () => {
    const r = toQdrantResponse(hub([result({ context: { before: [{ ...result(), text: 'Before.' }], after: [{ ...result(), text: 'After.' }] } })]), { classLevel: 'Class 9', subject: 'Science' }, Date.now() - 5)
    const [m] = r.results
    expect(m.id).toBe('sci9-en:07:sec:7.2:1')
    expect(m.score).toBe(0.62)
    expect(m.content).toBe('Before.\n\nSpeed is the distance travelled per unit time.\n\nAfter.')
    expect(m.metadata).toMatchObject({ passage_id: 'sci9-en:07:sec:7.2:1', work_id: WORK, source: 'Science IX', page: 76, pdf_page: 79, chapter: 'Chapter 7', class: 'Class 9', subject: 'Science', content_type: 'text' })
    expect(r.search_strategy).toBe('library_hub')
  })

  it('blocks keep their type; a degraded answer says so in the strategy and debug info', () => {
    const block = result({ passage_id: 'sci9-en:07:example:7.2', kind: 'block', block_type: 'EXAMPLE', label: 'Example 7.2' })
    const r = toQdrantResponse(hub([block], { degraded: true, warnings: ['direct read'] }), {}, Date.now())
    expect(r.results[0].metadata.content_type).toBe('example')
    expect(r.results[0].metadata.label).toBe('Example 7.2')
    expect(r.search_strategy).toBe('library_direct_degraded')
    expect(r.debug_info).toMatchObject({ degraded: true, warnings: ['direct read'] })
    expect(withContext(block)).toBe(block.text)
  })

  it('a fused-only hit (no dense score) falls back to the fused score', () => {
    expect(toQdrantResponse(hub([result({ score: { fused: 0.04, dense: null } })]), {}, 0).results[0].score).toBe(0.04)
  })

  it('searches with the learner scope and the tutor limits; without any scope returns nothing, loudly', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const sent: unknown[] = []
    const fetchImpl = (async (_u: string, init: RequestInit) => { sent.push(JSON.parse(init.body as string)); return new Response(JSON.stringify(hub([result()])), { status: 200 }) }) as unknown as typeof fetch
    const cfg = { baseUrl: 'https://h', appId: 'digiclassroom', secret: 's', timeoutMs: 1000 }

    const r = await searchViaLibraryHub('what is speed', { hubScope: { nodeIds: ['n1'], medium: 'en' }, topK: 4 }, { cfg, fetchImpl, direct: null })
    expect(sent[0]).toMatchObject({ query: 'what is speed', nodeIds: ['n1'], medium: 'en', limit: 4, window: 1, includePractice: false })
    expect(r.results).toHaveLength(1)

    await searchViaLibraryHub('x', { board: 'CBSE', classLevel: 'Class 10', medium: 'Hindi', contentTypes: ['practice_problems'] }, { cfg, fetchImpl, direct: null })
    expect(sent[1]).toMatchObject({ nodeCodes: ['SCH.CBSE.C10'], medium: 'hi', includePractice: true })

    const none = await searchViaLibraryHub('x', { board: 'State Board', classLevel: 'Class 9' }, { cfg, fetchImpl, direct: null })
    expect(none.results).toEqual([])
    expect(none.debug_info).toMatchObject({ reason: 'no_scope' })
    expect(sent).toHaveLength(2)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
