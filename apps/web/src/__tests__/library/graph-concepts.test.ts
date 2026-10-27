// Virat Gyankosh and the Virat Evaluator reading the library's knowledge graph: the tutor's concept block (concepts,
// what to know first, cited relations), the graph client never failing an answer, and feedback per concept.
// Relative paths: jest's '@/' mapper points at apps/web/src, while the code under test lives in packages/core.
import { formatConceptBlock, graphExpand, libraryGraphEnabled, mainWork, type GraphExpansion } from '../../../../../packages/core/src/lib/library/graph-client'
import { conceptFeedback } from '../../../../../packages/core/src/lib/hw/concept-feedback-core'

const g: GraphExpansion = {
  concepts: [
    { id: 'c1', label: 'evaporation', type: 'process', description: null, first_chapter: 1 },
    { id: 'c2', label: 'latent heat', type: 'term', description: null, first_chapter: 1 },
  ],
  prerequisites: [{ id: 'p1', label: 'kinetic energy of particles', first_chapter: 1, for_concept: 'evaporation', quote: 'particles possess kinetic energy', passage_id: 'sci9-en:01:sec:1.2:3' }],
  relations: [
    { source: 'humidity', relation: 'causes', target: 'evaporation', quote: 'an increase of humidity decreases the rate of evaporation', passage_id: 'sci9-en:01:sec:1.5:3', confidence: 0.9 },
  ],
}

describe('the tutor concept block', () => {
  it('names the concepts, what to know first and the relations, citing an excerpt by number and anything else by chapter', () => {
    const block = formatConceptBlock(g, ['sci9-en:01:sec:1.5:3', 'sci9-en:01:sec:1.4:1'])
    expect(block).toContain('Concepts in these excerpts: evaporation, latent heat.')
    expect(block).toContain('- kinetic energy of particles (chapter 1) before evaporation: "particles possess kinetic energy" (textbook, chapter 1)')
    expect(block).toContain('- humidity causes evaporation: "an increase of humidity decreases the rate of evaporation" [1]')
  })

  it('adds nothing when the graph has nothing', () => {
    expect(formatConceptBlock(null, [])).toBe('')
    expect(formatConceptBlock({ concepts: [], prerequisites: [], relations: [] }, [])).toBe('')
  })

  it('reads the work most excerpts come from', () => {
    expect(mainWork([{ work_id: 'a' }, { work_id: 'b' }, { work_id: 'b' }, undefined])).toBe('b')
    expect(mainWork([{}])).toBeNull()
  })

  it('is on only with the hub and the graph flag', () => {
    expect(libraryGraphEnabled({ LIBRARY_HUB_ENABLED: 'true', LIBRARY_GRAPH_ENABLED: 'true' } as any)).toBe(true)
    expect(libraryGraphEnabled({ LIBRARY_HUB_ENABLED: 'true' } as any)).toBe(false)
  })
})

describe('the graph client', () => {
  const cfg = { baseUrl: 'https://hub.test', secret: 's', appId: 'digiclassroom', timeoutMs: 8000 }

  it('posts the work and passage ids with the app credentials', async () => {
    const fetchImpl = jest.fn(async () => new Response(JSON.stringify(g), { status: 200 })) as unknown as typeof fetch
    expect(await graphExpand('w1', ['sci9-en:01:sec:1.5:3'], { cfg, fetchImpl })).toEqual(g)
    const [url, init] = (fetchImpl as unknown as jest.Mock).mock.calls[0]
    expect(url).toBe('https://hub.test/api/hub/graph/expand')
    expect(init.headers).toMatchObject({ 'x-hub-app': 'digiclassroom', 'x-hub-secret': 's' })
    expect(JSON.parse(init.body)).toEqual({ workId: 'w1', passageIds: ['sci9-en:01:sec:1.5:3'], limit: 8 })
  })

  it('never fails an answer: refused, down or nonsense all give null', async () => {
    const answer = (r: () => Promise<Response>) => graphExpand('w1', ['p'], { cfg, fetchImpl: jest.fn(r) as unknown as typeof fetch })
    expect(await answer(async () => new Response('no', { status: 404 }))).toBeNull()
    expect(await answer(async () => { throw new Error('ECONNREFUSED') })).toBeNull()
    expect(await answer(async () => new Response('{"oops":1}', { status: 200 }))).toBeNull()
    expect(await graphExpand('', ['p'], { cfg })).toBeNull()
  })
})

describe('evaluator feedback per concept', () => {
  const q = (id: string, position: number, marks: number, awarded: number | null) => ({ id, position, prompt: `Q${position}`, marks, awarded })

  it('adds up lost marks per concept, weakest first, with what to revise first', () => {
    const graphs = new Map<string, GraphExpansion | null>([
      ['q1', g],
      ['q2', { concepts: [g.concepts[0]], prerequisites: g.prerequisites, relations: [] }],
      ['q3', { concepts: [{ id: 'c3', label: 'sublimation', type: 'process', description: null, first_chapter: 1 }], prerequisites: [], relations: [] }],
    ])
    const out = conceptFeedback([q('q1', 1, 3, 1), q('q2', 2, 2, 0), q('q3', 3, 2, 2), q('q4', 4, 5, null)], graphs)
    expect(out.weak.map((w) => w.concept)).toEqual(['evaporation', 'latent heat'])
    expect(out.weak[0]).toMatchObject({ lost: 4, outOf: 5, questions: [1, 2], revisitFirst: [{ label: 'kinetic energy of particles', chapter: 1 }] })
    expect(out.weak[0].message).toBe('You lost 4 of 5 marks on evaporation (questions 1, 2). It builds on kinetic energy of particles (chapter 1): revise that first.')
    expect(out.strong).toEqual(['sublimation'])
  })

  it('leaves out questions the graph cannot place and questions not yet marked', () => {
    const out = conceptFeedback([q('q1', 1, 3, 0), q('q2', 2, 3, null)], new Map([['q1', null]]))
    expect(out).toEqual({ weak: [], strong: [] })
  })
})
