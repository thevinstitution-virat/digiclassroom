/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads */
// Cost work, task 2: savings that cannot change an answer, a mark or a key. Pure rules and the key
// service with fakes; the database-backed flows are in cost-savings-integration.test.ts.

import { _resetHwConfig, getHwConfig } from '@/lib/hw/config'
import { codeMark, normaliseForCodeMatch } from '@/lib/hw/grader/code-marking'
import { gradeWithoutAi } from '@/lib/hw/grader/exact-match'
import { keyVersionHash, planDuplicates, transcriptHash } from '@/lib/hw/grader/dedupe'
import { gradeCall } from '@/lib/hw/grader/ai-grader'
import type { GradeQuestion } from '@/lib/hw/grader/types'
import { readCall } from '@/lib/hw/reader/gemini-reader'
import { decideBatch, isOverdue, isUrgent, readyBy, summariseStatus, fallbackNote } from '@/lib/hw/jobs/homework-batch'
import { reusedSuggestion } from '@/lib/hw/pipeline'
import { buildKey, memoryKeyCache, memorySharedKeyStore, type KeyDeps, type KeySettings } from '@/lib/hw/keys'
import { sharedKeyId, normaliseQuestion, isPublicOrigin } from '@/lib/hw/keys/shared'
import type { ChunkRow } from '@/lib/hw/keys/trio'
import type { VectorHit } from '@/lib/hw/keys/retriever'
import type { KeyRequest } from '@/lib/hw/keys/types'
import type { AiCall, AiProvider, AiResult } from '@/lib/hw/ai'

const FLAGS = ['HW_HOMEWORK_BATCH_ENABLED', 'HW_SHARED_KEYS_ENABLED', 'HW_CODE_MARKING_ENABLED', 'HW_DEDUPE_MARKING_ENABLED', 'HW_OPENAI_EXPLICIT_CACHE_ENABLED']
beforeEach(() => { for (const f of FLAGS) delete process.env[f]; _resetHwConfig() })

describe('every cost flag is off unless set', () => {
  it('defaults', () => {
    const c = getHwConfig()
    expect([c.HW_HOMEWORK_BATCH_ENABLED, c.HW_SHARED_KEYS_ENABLED, c.HW_CODE_MARKING_ENABLED, c.HW_DEDUPE_MARKING_ENABLED, c.HW_OPENAI_EXPLICIT_CACHE_ENABLED]).toEqual([false, false, false, false, false])
  })
  it('each is read from its own variable', () => {
    for (const f of FLAGS) {
      process.env[f] = 'true'; _resetHwConfig()
      const c = getHwConfig() as unknown as Record<string, boolean>
      expect(FLAGS.filter((g) => c[g])).toEqual([f])
      delete process.env[f]
    }
  })
})

// ── Code marking ──────────────────────────────────────────────────────────────────────────

const q = (over: Partial<GradeQuestion> = {}): GradeQuestion => ({
  id: 'q1', type: 'short', prompt: 'Capital of India?', marks: 1, modelAnswer: null, acceptedAnswers: ['New Delhi', 'नई दिल्ली', '12'],
  rubricVersion: 1, rubric: [{ id: 'r1', kind: 'key_point', description: 'New Delhi', marks: 1 }], ...over,
})

describe('code marking (one mark, exact match after normalising)', () => {
  it('marks case, spacing, punctuation and NFC differences as equal', () => {
    for (const t of ['new delhi', '  NEW   Delhi.', 'New-Delhi!', 'New Delhi ।']) expect(codeMark(q(), 'a', t)?.suggestedMarks).toBe(1)
    // NFC: decomposed and composed forms of the same Devanagari text
    expect(codeMark(q({ acceptedAnswers: ['क़लम'] }), 'a', 'क़लम'.normalize('NFD'))?.suggestedMarks).toBe(1)
  })

  it('folds Devanagari digits, and nothing else about numbers', () => {
    expect(normaliseForCodeMatch('१२')).toBe('12')
    expect(codeMark(q(), 'a', '१२')?.suggestedMarks).toBe(1)
    expect(codeMark(q(), 'a', '13')).toBeNull()
    expect(codeMark(q(), 'a', 'twelve')).toBeNull()
  })

  it('does NOT fold the nukta: a different spelling goes to the AI', () => {
    expect(codeMark(q({ acceptedAnswers: ['क़लम'] }), 'a', 'कलम')).toBeNull()
  })

  it('anything that is not an exact match returns null (to the AI)', () => {
    for (const t of ['delhi', 'It is New Delhi', 'New Delhi and Mumbai', 'Old Delhi', '']) expect(codeMark(q(), 'a', t)).toBeNull()
  })

  it('only one-mark questions with accepted answers', () => {
    expect(codeMark(q({ marks: 2 }), 'a', 'New Delhi')).toBeNull()
    expect(codeMark(q({ acceptedAnswers: [] }), 'a', 'New Delhi')).toBeNull()
  })

  it('the result is a full-marks suggestion with source `code`, citing the student\'s own words', () => {
    const r = codeMark(q(), 'a1', ' new delhi ')!
    expect(r).toMatchObject({ answerId: 'a1', markSource: 'code', suggestedMarks: 1, confidence: 1 })
    expect(r.items).toEqual([{ rubric_item_id: 'r1', verdict: 'met', quote: 'new delhi', marks: 1, confidence: 1 }])
  })

  it('flag off: the rule grader returns exactly what it returned before (a one-mark short question is left to the AI)', () => {
    expect(gradeWithoutAi(q(), 'a', 'New Delhi')).toBeNull()
    const vs = gradeWithoutAi(q({ type: 'very_short' }), 'a', 'new delhi.')!
    expect(vs).toMatchObject({ model: 'exact_match', suggestedMarks: 1 })
    expect('markSource' in vs).toBe(false)
  })

  it('flag on: the one-mark short question is marked in code; a very short answer still uses the lenient rule', () => {
    expect(gradeWithoutAi(q(), 'a', 'New Delhi', { codeMarking: true })).toMatchObject({ markSource: 'code', suggestedMarks: 1 })
    expect(gradeWithoutAi(q(), 'a', 'Mumbai', { codeMarking: true })).toBeNull()
    expect(gradeWithoutAi(q({ type: 'very_short', acceptedAnswers: ['क़लम'] }), 'a', 'कलम', { codeMarking: true })).toMatchObject({ model: 'exact_match', suggestedMarks: 1 })
  })
})

// ── Identical answers ─────────────────────────────────────────────────────────────────────

describe('identical answers are marked once', () => {
  it('groups by normalised transcript; the earliest of each group goes to the AI', () => {
    const p = planDuplicates([
      { answerId: 'a', transcript: 'Plants make food using sunlight.' },
      { answerId: 'b', transcript: 'plants make food using sunlight.' }, // case differs: NOT the same answer
      { answerId: 'c', transcript: '  Plants make   food using sunlight.\n' }, // spacing only: the same
      { answerId: 'd', transcript: 'Plants make food using sunlight' }, // punctuation differs: NOT the same
      { answerId: 'e', transcript: 'Plants make food using sunlight.' },
    ])
    expect(p.toAi.map((x) => x.answerId)).toEqual(['a', 'b', 'd'])
    expect(p.followers).toEqual({ a: ['c', 'e'] })
  })

  it('a different question or key version is a different hash', () => {
    const base = keyVersionHash(q())
    expect(keyVersionHash(q())).toBe(base)
    expect(keyVersionHash(q({ id: 'q2' }))).not.toBe(base)
    expect(keyVersionHash(q({ rubricVersion: 2 }))).not.toBe(base)
    expect(keyVersionHash(q({ rubric: [{ id: 'r1', kind: 'key_point', description: 'New Delhi (and Delhi)', marks: 1 }] }))).not.toBe(base)
    expect(keyVersionHash(q({ marks: 2 }))).not.toBe(base)
    expect(keyVersionHash(q({ modelAnswer: 'x' }))).not.toBe(base)
    expect(keyVersionHash(q({ acceptedAnswers: ['Delhi'] }))).not.toBe(base)
  })

  it('transcript hash ignores spacing only', () => {
    expect(transcriptHash('a  b\n')).toBe(transcriptHash('a b'))
    expect(transcriptHash('a b')).not.toBe(transcriptHash('A b'))
    expect(transcriptHash('a b')).not.toBe(transcriptHash('a b.'))
  })

  it('a reused suggestion points at its original and says so', () => {
    const original = { answerId: 'a', model: 'm', promptVersion: 'grade.v1', rubricVersion: 1, items: [], suggestedMarks: 2, confidence: 0.9, validationNotes: ['x'], markSource: 'ai' as const }
    const r = reusedSuggestion(original, 'c', { transcriptHash: 't', keyVersionHash: 'k' })
    expect(r).toMatchObject({ answerId: 'c', markSource: 'reuse', reusedFromAnswerId: 'a', suggestedMarks: 2, transcriptHash: 't', keyVersionHash: 'k' })
    expect(r.validationNotes).toHaveLength(2)
    // copying a copy does not stack the note
    expect(reusedSuggestion(r, 'd', { transcriptHash: 't', keyVersionHash: 'k' }).validationNotes).toHaveLength(2)
  })
})

// ── Requests are unchanged with every flag off ────────────────────────────────────────────

describe('with every flag off the provider requests are the ones sent today', () => {
  it('the read and grade calls carry no options', () => {
    const rc = readCall('m', { answers: [{ answerId: 'a', languageHint: 'en', png: new Uint8Array([1]) }] })
    const gc = gradeCall('m', { question: q(), answers: [{ answerId: 'a', transcript: 'x' }] })
    expect('options' in rc).toBe(false)
    expect('options' in gc).toBe(false)
    expect(Object.keys(gc).sort()).toEqual(['model', 'parts', 'schema', 'systemInstruction'])
    expect(gc.parts).toHaveLength(2) // question block, then the answers block
  })
})

// ── Homework batch rules ──────────────────────────────────────────────────────────────────

describe('homework batch rules', () => {
  const now = new Date('2026-11-03T10:00:00Z')
  const hours = (h: number) => new Date(now.getTime() + h * 3_600_000)

  it('urgent = due within the threshold or already past due; no due date is homework', () => {
    expect(isUrgent(hours(2), now, 3)).toBe(true)
    expect(isUrgent(hours(-5), now, 3)).toBe(true)
    expect(isUrgent(hours(4), now, 3)).toBe(false)
    expect(isUrgent(null, now, 3)).toBe(false)
  })

  it('homework batches; urgent work, a fallback and an unbatchable provider stay standard, each with its reason', () => {
    const base = { standardForced: false, providerCanBatch: true, dueAt: hours(48), now, urgentHours: 3 }
    expect(decideBatch(base)).toEqual({ batch: true })
    expect(decideBatch({ ...base, dueAt: hours(1) })).toMatchObject({ batch: false, reason: expect.stringContaining('due soon') })
    expect(decideBatch({ ...base, providerCanBatch: false })).toMatchObject({ batch: false, reason: expect.stringContaining('cannot batch') })
    expect(decideBatch({ ...base, standardForced: true, fallbackReason: fallbackNote('the batch failed') })).toMatchObject({ batch: false, reason: 'Re-run on the standard path: the batch failed' })
  })

  it('"ready by" is now plus the deadline; overdue is strictly after it', () => {
    const r = readyBy(now, 24)
    expect(r.toISOString()).toBe('2026-11-04T10:00:00.000Z')
    expect(isOverdue(r.toISOString(), hours(23))).toBe(false)
    expect(isOverdue(r.toISOString(), hours(25))).toBe(true)
    expect(isOverdue(undefined, hours(1000))).toBe(false)
  })

  it('the teacher status: waiting for a batch shows the latest ready-by; a fallback is listed once', () => {
    const j = (status: string, error: string | null = null, readyByIso?: string) => ({ status, error, payloadRef: readyByIso ? JSON.stringify({ readyBy: readyByIso }) : null })
    expect(summariseStatus([])).toEqual({ state: 'idle', readyBy: null, batches: 0, fallbacks: [] })
    expect(summariseStatus([j('batch_pending', null, '2026-11-04T10:00:00.000Z'), j('batch_pending', null, '2026-11-04T12:00:00.000Z')])).toMatchObject({ state: 'waiting_for_batch', readyBy: '2026-11-04T12:00:00.000Z', batches: 2 })
    expect(summariseStatus([j('running')])).toMatchObject({ state: 'working' })
    const fb = fallbackNote('the batch failed (JOB_STATE_FAILED)')
    expect(summariseStatus([j('done', fb), j('queued', fb), j('done', 'cost note')]).fallbacks).toEqual([fb])
  })
})

// ── The shared key library ────────────────────────────────────────────────────────────────

const settings: KeySettings = {
  writer: { provider: 'gemini', model: 'gemini-3.6-flash' },
  verifier: { provider: 'openrouter', model: 'openai/gpt-5.4-mini' },
  rMin: 0.45, theta: 0.35, topK: 30, maxPassages: 6, pagesVerified: new Set(['book-1']), sharedKeys: true,
}
const CH3 = 'Chapter 3: Poverty as a Challenge'
const row = (id: string, text: string, over: Partial<ChunkRow> = {}): ChunkRow => ({
  id, contentItemId: 'book-1', chapter: CH3, pageStart: 41, pageEnd: 41, text,
  title: 'Understanding Society', isbn: '978-93-0000-000-0', edition: '2026', lang: 'English', ...over,
})
const CHUNKS: Record<string, ChunkRow> = {
  c1: row('c1', 'Poverty line is estimated on the basis of minimum calorie requirement: 2400 calories in rural areas and 2100 in urban areas.'),
}
const goodKey = {
  reference_answer: 'It is based on calorie needs.',
  value_points: [
    { id: 'p1', text: 'Based on minimum calorie requirement', marks: 1, kind: 'key_point', cites: ['c1'], accepted_alternatives: [] },
    { id: 'p2', text: '2400 calories rural, 2100 urban', marks: 1, kind: 'key_point', cites: ['c1'], accepted_alternatives: [] },
  ],
}
const supported = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'c1' }, { point_id: 'p2', support: 'supported', reason: 'c1' }] }
const partial = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'c1' }, { point_id: 'p2', support: 'partial', reason: 'only part' }] }
const hits: VectorHit[] = [{ id: 'c1', score: 0.71, contentItemId: 'book-1', chapter: CH3 }]

function deps(shared: ReturnType<typeof memorySharedKeyStore> | undefined, opts: { chunks?: Record<string, ChunkRow>; verifier?: unknown } = {}): KeyDeps & { ai: { provider: AiProvider; call: AiCall }[] } {
  const ai: { provider: AiProvider; call: AiCall }[] = []
  return {
    ai,
    shared,
    cache: undefined,
    retriever: {
      indexId: 'test-index|embed',
      embed: async () => ({ vector: [0.1], call: { role: 'embed', provider: 'openai', model: 'embed', usage: { input: 12, cached: 0, output: 0 } } }),
      search: async () => hits,
    },
    trio: { practiceRows: async () => [], chunks: async (ids) => ids.map((id) => (opts.chunks ?? CHUNKS)[id]).filter(Boolean) },
    generate: async (provider, call): Promise<AiResult> => {
      ai.push({ provider, call })
      const json = call.systemInstruction.startsWith('You write') ? goodKey : (opts.verifier ?? supported)
      return { json, usage: { input: 1000, cached: 0, output: 200 }, rawUsage: {}, model: call.model }
    },
  }
}
const req = (over: Partial<KeyRequest> = {}): KeyRequest => ({
  questionText: 'How is the poverty line estimated in India?', questionType: 'short', marks: 2,
  classLevel: '9', subject: 'Social Science', medium: 'English', questionOrigin: 'textbook_exercise', ...over,
})

describe('the shared key library', () => {
  it('a public textbook question is built once and served to the next tenant with no model call', async () => {
    const shared = memorySharedKeyStore()
    const first = deps(shared)
    const a = await buildKey(req(), first, settings)
    expect(a).toMatchObject({ status: 'grounded', source: 'textbook', fromCache: false })
    expect(first.ai).toHaveLength(2) // writer + verifier
    expect(shared.rows.size).toBe(1)

    const second = deps(shared)
    const b = await buildKey(req(), second, settings)
    expect(second.ai).toHaveLength(0)
    expect(b).toMatchObject({ status: 'grounded', fromCache: true })
    expect(b.notes).toContain('key from the shared library')
    if (a.status === 'grounded' && b.status === 'grounded') expect(b.key).toEqual(a.key)
    expect(b.calls).toEqual([{ role: 'embed', provider: 'openai', model: 'embed', usage: { input: 12, cached: 0, output: 0 } }]) // only this request's own embedding
  })

  it('a custom question is never read from or written to the library, for any tenant', async () => {
    for (const origin of ['custom', undefined] as const) {
      const shared = memorySharedKeyStore()
      const tenantA = deps(shared)
      const tenantB = deps(shared)
      await buildKey(req({ questionOrigin: origin }), tenantA, settings)
      await buildKey(req({ questionOrigin: origin }), tenantB, settings)
      expect(tenantA.ai).toHaveLength(2)
      expect(tenantB.ai).toHaveLength(2) // B paid for its own: A's key was never offered
      expect(shared.rows.size).toBe(0)
      expect(shared.reads).toBe(0)
    }
  })

  it('a key built from the question\'s own passage is never shared, even for a public question', async () => {
    const shared = memorySharedKeyStore()
    const d = deps(shared)
    await buildKey(req({ questionType: 'source_based', passageText: 'Poverty line is estimated on the basis of minimum calorie requirement.' }), { ...d, generate: async (p, c) => { const r = await d.generate(p, c); return r.model ? { ...r, json: c.systemInstruction.startsWith('You write') ? { ...goodKey, value_points: goodKey.value_points.map((v) => ({ ...v, cites: ['given'] })) } : r.json } : r } }, settings)
    expect(shared.rows.size).toBe(0)
  })

  it('a new edition or changed passage text is a different key', async () => {
    const shared = memorySharedKeyStore()
    await buildKey(req(), deps(shared), settings)
    const newEdition = deps(shared, { chunks: { c1: row('c1', CHUNKS.c1.text, { edition: '2027' }) } })
    await buildKey(req(), newEdition, settings)
    expect(newEdition.ai).toHaveLength(2) // a new edition invalidates the old key even when the passage text did not change
    const reprinted = deps(shared, { chunks: { c1: row('c1', CHUNKS.c1.text + ' (revised)', { edition: '2027' }) } })
    await buildKey(req(), reprinted, settings)
    expect(reprinted.ai).toHaveLength(2)
    expect(shared.rows.size).toBe(3) // the original, the new edition, the revised text
  })

  it('a different book (ISBN) is a different key', async () => {
    const shared = memorySharedKeyStore()
    await buildKey(req(), deps(shared), settings)
    const other = deps(shared, { chunks: { c1: row('c1', CHUNKS.c1.text, { isbn: '978-93-1111-111-1' }) } })
    await buildKey(req(), other, settings)
    expect(other.ai).toHaveLength(2)
  })

  it('a changed model configuration or key-service setting is a different key', async () => {
    const shared = memorySharedKeyStore()
    await buildKey(req(), deps(shared), settings)
    const otherWriter = deps(shared)
    await buildKey(req(), otherWriter, { ...settings, writer: { provider: 'openrouter', model: 'openai/gpt-6-luna' }, verifier: { provider: 'openrouter', model: 'google/gemini-3.6-flash' } })
    expect(otherWriter.ai).toHaveLength(2)
    const otherThreshold = deps(shared)
    await buildKey(req(), otherThreshold, { ...settings, rMin: 0.5 })
    expect(otherThreshold.ai).toHaveLength(2)
  })

  it('a different question, mark value, medium or subject is a different key', async () => {
    const shared = memorySharedKeyStore()
    await buildKey(req(), deps(shared), settings)
    for (const over of [{ questionText: 'Why is the poverty line used?' }, { marks: 3 }, { subject: 'Economics' }]) {
      const d = deps(shared)
      await buildKey(req(over), d, settings)
      expect(d.ai.length).toBeGreaterThan(0)
    }
  })

  it('question text is compared after normalising (case, spacing, punctuation)', async () => {
    const shared = memorySharedKeyStore()
    await buildKey(req(), deps(shared), settings)
    const d = deps(shared)
    await buildKey(req({ questionText: '  how is the POVERTY line estimated   in india' }), d, settings)
    expect(d.ai).toHaveLength(0)
    expect(normaliseQuestion('A, b.')).toBe(normaliseQuestion('a  b'))
  })

  it('a partly supported key is not shared', async () => {
    const shared = memorySharedKeyStore()
    const d = deps(shared, { verifier: partial })
    const k = await buildKey(req(), d, settings)
    expect(k).toMatchObject({ status: 'grounded', partial: true })
    expect(shared.rows.size).toBe(0)
  })

  it('flag off: the library is neither read nor written', async () => {
    const shared = memorySharedKeyStore()
    const off = { ...settings, sharedKeys: undefined }
    const d = deps(shared)
    await buildKey(req(), d, off)
    await buildKey(req(), deps(shared), off)
    expect(shared.rows.size).toBe(0)
    expect(shared.reads).toBe(0)
    expect(d.ai).toHaveLength(2)
  })

  it('only the two public origins qualify, and the cache id does not depend on who asked', () => {
    expect([isPublicOrigin('textbook_exercise'), isPublicOrigin('board_paper'), isPublicOrigin('custom'), isPublicOrigin(undefined)]).toEqual([true, true, false, false])
    const a = sharedKeyId(req(), 'textbook', 'ref', 'v1', 'cfg')
    const b = sharedKeyId({ ...req(), bookHint: { title: 'x' } }, 'textbook', 'ref', 'v1', 'cfg')
    expect(a.cacheKey).toBe(b.cacheKey)
    expect(sharedKeyId(req(), 'textbook', 'ref', 'v2', 'cfg').cacheKey).not.toBe(a.cacheKey)
    expect(sharedKeyId(req(), 'textbook', 'ref2', 'v1', 'cfg').cacheKey).not.toBe(a.cacheKey)
  })

  it('works alongside the per-run cache (a hit there costs nothing either)', async () => {
    const shared = memorySharedKeyStore()
    const cache = memoryKeyCache()
    const d = { ...deps(shared), cache }
    await buildKey(req(), d, settings)
    await buildKey(req(), d, settings)
    expect(d.ai).toHaveLength(2)
  })
})
