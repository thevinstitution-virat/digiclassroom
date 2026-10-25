// Answer-key service: resolution order, strict scope, threshold, code checks, verifier
// outcomes and cache — with a fake retriever, fake trio reader and fake AI. No network.

import { buildKey, keyConfigHash, memoryKeyCache, type KeyDeps, type KeySettings } from '@/lib/hw/keys'
import { normaliseClass, normaliseMedium, qdrantFilter, scopeOf, subjectValues } from '@/lib/hw/keys/scope'
import { bestExerciseMatch, exerciseQuestions, jaccard, shingles } from '@/lib/hw/keys/exercise-match'
import { checkKey, modelFamily, parseVerifierOutput, parseWriterOutput } from '@/lib/hw/keys/checks'
import { canonicalJson } from '@/lib/hw/keys/cache'
import type { ChunkRow } from '@/lib/hw/keys/trio'
import type { VectorHit } from '@/lib/hw/keys/retriever'
import type { KeyRequest } from '@/lib/hw/keys/types'
import type { AiCall, AiProvider, AiResult } from '@/lib/hw/ai'
import { HwError } from '@/lib/hw/errors'

const settings: KeySettings = {
  writer: { provider: 'gemini', model: 'gemini-3.6-flash' },
  verifier: { provider: 'openrouter', model: 'openai/gpt-5.4-mini' },
  rMin: 0.45, theta: 0.35, topK: 30, maxPassages: 6, pagesVerified: new Set(['book-1']),
}

const CH3 = 'Chapter 3: Poverty as a Challenge'
const row = (id: string, text: string, over: Partial<ChunkRow> = {}): ChunkRow => ({
  id, contentItemId: 'book-1', chapter: CH3, pageStart: 41, pageEnd: 41, text,
  title: 'Understanding Society: India and Beyond', isbn: '978-93-0000-000-0', edition: '2026', lang: 'English', ...over,
})
const CHUNKS: Record<string, ChunkRow> = {
  c1: row('c1', 'Poverty line is estimated on the basis of minimum calorie requirement: 2400 calories in rural areas and 2100 in urban areas.'),
  c2: row('c2', 'Social exclusion and vulnerability are also seen as dimensions of poverty.', { pageStart: 42, pageEnd: 43 }),
}

interface Fakes {
  searches: { filter: { must: Record<string, unknown>[] }; limit: number }[]
  ai: { provider: AiProvider; call: AiCall }[]
}

function deps(opts: {
  hits?: VectorHit[] | ((filter: { must: Record<string, unknown>[] }) => VectorHit[])
  writer?: unknown
  verifier?: unknown
  chunks?: Record<string, ChunkRow>
  practice?: { id: string; contentItemId: string; chapter: string | null; text: string }[]
  cache?: ReturnType<typeof memoryKeyCache>
  official?: KeyDeps['official']
}): KeyDeps & { fakes: Fakes } {
  const fakes: Fakes = { searches: [], ai: [] }
  return {
    fakes,
    cache: opts.cache,
    official: opts.official,
    retriever: {
      indexId: 'test-index|embed',
      embed: async () => ({ vector: [0.1, 0.2], call: { role: 'embed', provider: 'openai', model: 'embed', usage: { input: 12, cached: 0, output: 0 } } }),
      search: async (_v, filter, limit) => {
        fakes.searches.push({ filter: filter as { must: Record<string, unknown>[] }, limit })
        const h = opts.hits ?? []
        return typeof h === 'function' ? h(filter as { must: Record<string, unknown>[] }) : h
      },
    },
    trio: {
      practiceRows: async () => opts.practice ?? [],
      chunks: async (ids) => ids.map((id) => (opts.chunks ?? CHUNKS)[id]).filter(Boolean),
    },
    generate: async (provider, call): Promise<AiResult> => {
      fakes.ai.push({ provider, call })
      const json = call.systemInstruction.startsWith('You write') ? opts.writer : opts.verifier
      return { json, usage: { input: 1000, cached: 0, output: 200 }, rawUsage: {}, model: call.model }
    },
  }
}

const req = (over: Partial<KeyRequest> = {}): KeyRequest => ({
  questionText: 'How is the poverty line estimated in India?', questionType: 'short', marks: 2,
  classLevel: '9', subject: 'Social Science', medium: 'English', ...over,
})

const goodKey = {
  reference_answer: 'It is based on calorie needs: 2400 in rural and 2100 in urban areas.',
  value_points: [
    { id: 'p1', text: 'Based on minimum calorie requirement', marks: 1, kind: 'key_point', cites: ['c1'], accepted_alternatives: [] },
    { id: 'p2', text: '2400 calories rural, 2100 urban', marks: 1, kind: 'key_point', cites: ['c1'], accepted_alternatives: ['2400/2100'] },
  ],
}
const allSupported = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'c1 says so' }, { point_id: 'p2', support: 'supported', reason: 'c1' }] }
const hitsOk: VectorHit[] = [
  { id: 'c1', score: 0.71, contentItemId: 'book-1', chapter: CH3 },
  { id: 'c2', score: 0.52, contentItemId: 'book-1', chapter: CH3 },
  { id: 'c9', score: 0.30, contentItemId: 'book-1', chapter: CH3 },
]

describe('scope', () => {
  it('normalises class and medium; refuses what it cannot read', () => {
    expect(['10', 'Class X', 'class 10', 'Grade 10', 'X'].map(normaliseClass)).toEqual(Array(5).fill('Class 10'))
    expect(normaliseMedium('hi')).toBe('Hindi')
    expect(() => normaliseClass('Class 13')).toThrow()
    expect(() => normaliseMedium('Urdu')).toThrow()
  })
  it('a whole-book subject covers its parts; a part does not widen', () => {
    expect(subjectValues('social science')).toEqual(expect.arrayContaining(['Social Science', 'History', 'Geography', 'Economics']))
    expect(subjectValues('History')).toEqual(['History'])
  })
  it('the filter is strict: global content only, reference text, class, subject and medium all required', () => {
    const f = qdrantFilter(scopeOf(req({ medium: 'Hindi' })))
    expect(f.must).toEqual(expect.arrayContaining([
      { is_empty: { key: 'organization_id' } },
      { key: 'retrieval_class', match: { value: 'reference' } },
      { key: 'class', match: { value: 'Class 9' } },
      { key: 'medium', match: { value: 'Hindi' } },
    ]))
    expect(JSON.stringify(f)).not.toMatch(/should/) // nothing optional
  })
})

describe('exercise match', () => {
  it('splits numbered exercise questions and skips the header', () => {
    expect(exerciseQuestions('[DISCUSSION_PROMPT | Page 183]\nQuestions:\n  1. What do you mean by poverty?\n  2. List three causes.'))
      .toEqual(['What do you mean by poverty?', 'List three causes.'])
  })
  it('jaccard over word 3-grams ignores case and punctuation', () => {
    expect(jaccard(shingles('Describe the poverty line.'), shingles('describe the POVERTY line'))).toBe(1)
    expect(jaccard(shingles('a b c'), shingles('x y z'))).toBe(0)
  })
  it('anchors only at or above theta, never to a glossary row', () => {
    const rows = [
      { id: 'g', contentItemId: 'book-1', chapter: CH3, text: '[GLOSSARY TERM | Page 50]\nTerm: Poverty line\nDefinition: how is the poverty line estimated in india' },
      { id: 'e', contentItemId: 'book-1', chapter: CH3, text: '[EXERCISE]\nQuestions:\n  1. How is the poverty line estimated in India?' },
    ]
    expect(bestExerciseMatch('How is the poverty line estimated in India?', rows, 0.35)?.rowId).toBe('e')
    expect(bestExerciseMatch('Name two rivers of Kerala.', rows, 0.35)).toBeNull()
  })
})

describe('code checks', () => {
  const key = (parseWriterOutput(goodKey) as { key: never }).key
  it('a good key passes', () => expect(checkKey(key, new Set(['c1']), 2)).toEqual([]))
  it('marks must add up, be > 0 and on the 0.5 grid; cites must be given', () => {
    const bad = parseWriterOutput({ ...goodKey, value_points: [
      { ...goodKey.value_points[0], marks: 0.3, cites: ['c7'] },
      { ...goodKey.value_points[1], marks: 0, cites: [] },
    ] }) as { key: never }
    const p = checkKey(bad.key, new Set(['c1']), 2)
    expect(p.join('\n')).toMatch(/0.5 steps/)
    expect(p.join('\n')).toMatch(/more than 0/)
    expect(p.join('\n')).toMatch(/c7, which was not given/)
    expect(p.join('\n')).toMatch(/cites no passage/)
    expect(p.join('\n')).toMatch(/add up to 0.3/)
  })
  it('writer output is never repaired', () => {
    expect(parseWriterOutput({ reference_answer: 'x', value_points: [{ id: 'p1', text: 't', marks: '1', kind: 'fact', cites: 'c1' }] }))
      .toHaveProperty('problems')
  })
  it('verifier must judge every point exactly once', () => {
    expect(parseVerifierOutput({ verdicts: [{ point_id: 'p1', support: 'supported', reason: '' }] }, ['p1', 'p2'])).toHaveProperty('problems')
    expect(parseVerifierOutput({ verdicts: [{ point_id: 'p1', support: 'maybe', reason: '' }] }, ['p1'])).toHaveProperty('problems')
  })
  it('model families', () => {
    expect(modelFamily('gemini-3.6-flash')).toBe('google')
    expect(modelFamily('google/gemini-3.6-flash')).toBe('google')
    expect(modelFamily('openai/gpt-5.4-mini')).toBe('openai')
    expect(modelFamily('anthropic/claude-haiku-5-5')).toBe('anthropic')
  })
})

describe('buildKey', () => {
  it('textbook: grounded, cited, verified, with usage for every call', async () => {
    const d = deps({ hits: hitsOk, writer: goodKey, verifier: allSupported })
    const r = await buildKey(req(), d, settings)
    expect(r.status).toBe('grounded')
    if (r.status !== 'grounded') return
    expect(r.source).toBe('textbook')
    expect(r.passages.map((p) => p.id)).toEqual(['c1', 'c2']) // c9 is under R_min
    expect(r.citations).toHaveLength(1) // only c1 is cited
    expect(r.citations[0]).toMatchObject({ chunkId: 'c1', pageNumber: 41, pagesVerified: true, isbn: '978-93-0000-000-0', medium: 'English' })
    expect(r.citations[0].citationFormat).toBe('Understanding Society: India and Beyond (Class 9, English), Ch. 3, p. 41')
    expect(r.calls.map((c) => c.role)).toEqual(['embed', 'writer', 'verifier'])
    expect(d.fakes.ai.map((a) => a.provider)).toEqual(['gemini', 'openrouter'])
    expect(r.partial).toBe(false)
  })

  it('no book in scope -> no_grounding: no_book, and no AI call', async () => {
    const d = deps({ hits: [] })
    const r = await buildKey(req({ classLevel: '12', medium: 'Hindi' }), d, settings)
    expect(r).toMatchObject({ status: 'no_grounding', reason: 'no_book' })
    expect(d.fakes.ai).toHaveLength(0)
    expect(d.fakes.searches).toHaveLength(1) // no relaxed retry
  })

  it('best passage under R_min -> no_grounding: below_threshold', async () => {
    const d = deps({ hits: [{ id: 'c1', score: 0.44, contentItemId: 'book-1', chapter: CH3 }] })
    expect(await buildKey(req(), d, settings)).toMatchObject({ status: 'no_grounding', reason: 'below_threshold' })
    expect(d.fakes.ai).toHaveLength(0)
  })

  it('index ids missing from the content tables are dropped and noted', async () => {
    const d = deps({ hits: [{ id: 'gone', score: 0.8, contentItemId: 'book-1', chapter: CH3 }] })
    const r = await buildKey(req(), d, settings)
    expect(r).toMatchObject({ status: 'no_grounding', reason: 'passages_missing' })
    expect(r.notes.join()).toMatch(/gone is in the index but not in content.content_chunk/)
  })

  it('a chunk whose book language disagrees with the medium is dropped', async () => {
    const d = deps({ hits: hitsOk, chunks: { ...CHUNKS, c1: { ...CHUNKS.c1, lang: 'Hindi' } }, writer: { ...goodKey, value_points: goodKey.value_points.map((p) => ({ ...p, cites: ['c2'] })) }, verifier: allSupported })
    const r = await buildKey(req(), d, settings)
    expect(r.status === 'grounded' && r.passages.map((p) => p.id)).toEqual(['c2'])
  })

  it('exercise match anchors retrieval to that book and chapter', async () => {
    const d = deps({
      hits: hitsOk, writer: goodKey, verifier: allSupported,
      practice: [{ id: 'e', contentItemId: 'book-1', chapter: CH3, text: 'Questions:\n  1. How is the poverty line estimated in India?' }],
    })
    const r = await buildKey(req(), d, settings)
    expect(d.fakes.searches).toHaveLength(2)
    expect(d.fakes.searches[1].filter.must).toEqual(expect.arrayContaining([{ key: 'chapter', match: { value: CH3 } }, { key: 'content_item_id', match: { value: 'book-1' } }]))
    expect(r.notes.join()).toMatch(/anchored to "Chapter 3/)
  })

  it('writer citing a passage it was not given -> key_invalid, verifier not called', async () => {
    const d = deps({ hits: hitsOk, writer: { ...goodKey, value_points: [{ ...goodKey.value_points[0], cites: ['c9'] }, goodKey.value_points[1]] } })
    const r = await buildKey(req(), d, settings)
    expect(r).toMatchObject({ status: 'key_invalid', reason: 'checks_failed' })
    expect(d.fakes.ai).toHaveLength(1)
  })

  it('any unsupported point -> no_grounding: unsupported_key; partial is flagged', async () => {
    const un = await buildKey(req(), deps({ hits: hitsOk, writer: goodKey, verifier: { verdicts: [allSupported.verdicts[0], { point_id: 'p2', support: 'unsupported', reason: 'not in c1' }] } }), settings)
    expect(un).toMatchObject({ status: 'no_grounding', reason: 'unsupported_key' })
    const pa = await buildKey(req(), deps({ hits: hitsOk, writer: goodKey, verifier: { verdicts: [allSupported.verdicts[0], { point_id: 'p2', support: 'partial', reason: 'only urban' }] } }), settings)
    expect(pa).toMatchObject({ status: 'grounded', partial: true })
  })

  it('passage questions use only the given passage; without it, no_grounding', async () => {
    const d = deps({ hits: hitsOk, writer: { ...goodKey, value_points: goodKey.value_points.map((p) => ({ ...p, cites: ['given'] })) }, verifier: allSupported })
    const r = await buildKey(req({ questionType: 'case_based', passageText: 'Ravi earns ₹80 a day…' }), d, settings)
    expect(r).toMatchObject({ status: 'grounded', source: 'passage' })
    expect(d.fakes.searches).toHaveLength(0)
    expect(await buildKey(req({ questionType: 'source_based' }), deps({}), settings)).toMatchObject({ status: 'no_grounding', reason: 'missing_passage' })
  })

  it('official scheme comes first and makes no AI or search call', async () => {
    const d = deps({ official: async () => ({ label: 'CBSE SQP 2025-26 Q14', key: { referenceAnswer: 'x', valuePoints: [{ id: 'p1', text: 'x', marks: 2, kind: 'key_point', cites: [], acceptedAlternatives: [] }] } }) })
    const r = await buildKey(req({ officialRef: { kind: 'sqp', session: '2025-26', subjectCode: '087', questionNo: '14' } }), d, settings)
    expect(r).toMatchObject({ status: 'grounded', source: 'official' })
    expect(d.fakes.ai).toHaveLength(0)
    expect(d.fakes.searches).toHaveLength(0)
  })

  it('the cache returns the same key without AI calls; a changed setting misses it', async () => {
    const cache = memoryKeyCache()
    const first = deps({ hits: hitsOk, writer: goodKey, verifier: allSupported, cache })
    await buildKey(req(), first, settings)
    const second = deps({ hits: hitsOk, writer: goodKey, verifier: allSupported, cache })
    const r = await buildKey(req(), second, settings)
    expect(r.fromCache).toBe(true)
    expect(second.fakes.ai).toHaveLength(0)
    const third = deps({ hits: hitsOk, writer: goodKey, verifier: allSupported, cache })
    await buildKey(req(), third, { ...settings, rMin: 0.5 })
    expect(third.fakes.ai).toHaveLength(2)
  })

  it('R_min is needed only for textbook keys: passage keys build without it, textbook keys refuse', async () => {
    const noRmin = { ...settings, rMin: undefined }
    const d = deps({ writer: { ...goodKey, value_points: goodKey.value_points.map((p) => ({ ...p, cites: ['given'] })) }, verifier: allSupported })
    expect(await buildKey(req({ questionType: 'case_based', passageText: 'Passage.' }), d, noRmin)).toMatchObject({ status: 'grounded', source: 'passage' })
    await expect(buildKey(req(), deps({ hits: hitsOk }), noRmin)).rejects.toThrow(/HW_KEY_R_MIN is not set/)
  })

  it('refuses one model family for writer and verifier, and bad marks', async () => {
    const same = { ...settings, verifier: { provider: 'openrouter' as const, model: 'google/gemini-3.8-flash' } }
    await expect(buildKey(req(), deps({}), same)).rejects.toThrow(/another model family/)
    await expect(buildKey(req({ marks: 1.25 }), deps({}), settings)).rejects.toBeInstanceOf(HwError)
  })

  it('config hash is stable and canonical JSON sorts keys', () => {
    expect(keyConfigHash(settings, 'i')).toBe(keyConfigHash({ ...settings }, 'i'))
    expect(keyConfigHash(settings, 'i')).not.toBe(keyConfigHash(settings, 'j'))
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe('{"a":[2,{"d":1}],"b":1}')
  })
})
