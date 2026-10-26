// The book's own MCQs as Practest rows, CASA over the hub, and the legacy ingestion switch. Pure; no database.

import { answerLetter, labelRange, parseMcq, scopeFromPlacements, toImportCsv, toPracticestRows, type PracticeMcqSource } from '@/lib/library/practice-mcq'
import { casaScopeCodes, casaTopMatch } from '@/lib/library/casa'
import { legacyIngestionDisabled, libraryHubEnabled } from '@/lib/library/search'
import { parseAndValidate } from '@/lib/practest/import'
import type { HubConfig } from '@/lib/library/hub-client'

const MCQ = 'Which of the following is a vector quantity?\n(a) Speed\n(b) Distance\n(c) Velocity\n(d) Time'
const source = (over: Partial<PracticeMcqSource> = {}): PracticeMcqSource => ({
  passage_id: 'sci9-en:07:exercise:3', chapter_no: 7, page_start: 83, text: MCQ, choices: 'a-d', answer_printed: true,
  work_title: 'Science', edition: 'Reprint 2025-26', answer_text: '(c)', ...over,
})
const scope = { board: 'CBSE', classLevel: 9, subject: 'Science', language: 'English' as const }

describe('reading the options back out of the printed text', () => {
  it('range a-d is four labels; anything else is refused', () => {
    expect(labelRange('a-d')).toEqual(['a', 'b', 'c', 'd'])
    expect(labelRange('a-a')).toBeNull()
    expect(labelRange('a-z')).toBeNull()
    expect(labelRange('1-4')).toBeNull()
  })

  it('parses stem and options for (a), a) and a. markers, on lines or inline', () => {
    expect(parseMcq(MCQ, 'a-d')).toEqual({
      stem: 'Which of the following is a vector quantity?',
      options: [{ label: 'a', text: 'Speed' }, { label: 'b', text: 'Distance' }, { label: 'c', text: 'Velocity' }, { label: 'd', text: 'Time' }],
    })
    expect(parseMcq('Pick one. a) one b) two c) three', 'a-c')?.options.map((o) => o.text)).toEqual(['one', 'two', 'three'])
    expect(parseMcq('Pick one.\nA. one\nB. two', 'a-b')?.options.map((o) => o.text)).toEqual(['one', 'two'])
  })

  it('refuses a text that does not carry all the labelled options in order, or has no stem', () => {
    expect(parseMcq('Which? (a) one (b) two (c) three', 'a-d')).toBeNull()
    expect(parseMcq('Which? (b) two (a) one', 'a-b')).toBeNull()
    expect(parseMcq('(a) one (b) two', 'a-b')).toBeNull()
    expect(parseMcq('Which? (a) (b) two', 'a-b')).toBeNull()
  })

  it('an answer is one option letter or nothing', () => {
    const labels = ['a', 'b', 'c', 'd']
    expect(['(c)', 'c', 'C.', '(b) Distance', ' d '].map((a) => answerLetter(a, labels))).toEqual(['c', 'c', 'c', 'b', 'd'])
    expect(answerLetter('Velocity, because it has direction', labels)).toBeNull()
    expect(answerLetter('(e)', labels)).toBeNull()
    expect(answerLetter(null, labels)).toBeNull()
  })
})

describe('Practest rows', () => {
  it('a readable question with its printed answer becomes a CSV row the Practest importer accepts, anchored by passage id', () => {
    const { rows, problems } = toPracticestRows([source()], scope)
    expect(problems).toEqual([])
    const parsed = parseAndValidate(toImportCsv(rows))
    expect(parsed.rows).toHaveLength(1)
    const r = parsed.rows[0]
    expect(r.status).toBe('new')
    expect(r.question).toMatchObject({
      question_text: 'Which of the following is a vector quantity?', class_level: 9, subject: 'Science', board: 'CBSE', chapter: 'Chapter 7',
      casa_anchor: 'sci9-en:07:exercise:3', casa_page: 83, casa_book: 'Science', casa_edition: 'Reprint 2025-26',
    })
    expect(r.question!.options.map((o) => [o.text, o.isCorrect])).toEqual([['Speed', false], ['Distance', false], ['Velocity', true], ['Time', false]])
  })

  it('questions that cannot be imported are listed with the reason, never guessed', () => {
    const { rows, problems } = toPracticestRows([
      source({ passage_id: 'sci9-en:07:exercise:4', text: 'Which? (a) one (b) two' }),
      source({ passage_id: 'sci9-en:07:exercise:5', answer_printed: false, answer_text: null }),
      source({ passage_id: 'sci9-en:07:exercise:6', answer_text: null }),
      source({ passage_id: 'sci9-en:07:exercise:7', answer_text: 'Velocity, because it has direction' }),
      source({ passage_id: 'sci9-en:07:exercise:8', choices: 'a-e', text: 'Q? (a) 1 (b) 2 (c) 3 (d) 4 (e) 5' }),
    ], scope)
    expect(rows).toEqual([])
    expect(problems.map((p) => [p.passage_id, p.reason])).toEqual([
      ['sci9-en:07:exercise:4', expect.stringMatching(/could not be read/)],
      ['sci9-en:07:exercise:5', expect.stringMatching(/prints no answer/)],
      ['sci9-en:07:exercise:6', expect.stringMatching(/no evaluator access/)],
      ['sci9-en:07:exercise:7', expect.stringMatching(/not a single option letter/)],
      ['sci9-en:07:exercise:8', expect.stringMatching(/5 options/)],
    ])
  })

  it('CSV cells with commas, quotes and newlines survive the importer', () => {
    const tricky = source({ text: 'Which, if any, is "right"?\n(a) one, two\n(b) "three"\n(c) four\n(d) five' })
    const parsed = parseAndValidate(toImportCsv(toPracticestRows([tricky], scope).rows))
    expect(parsed.rows[0].status).toBe('new')
    expect(parsed.rows[0].question!.question_text).toBe('Which, if any, is "right"?')
    expect(parsed.rows[0].question!.options.map((o) => o.text)).toEqual(['one, two', '"three"', 'four', 'five'])
  })

  it('board, class and subject come from the work\'s school placement', () => {
    expect(scopeFromPlacements(['SCH.CBSE.C9', 'SCH.CBSE.C9.SOCIAL_SCIENCE'], 'en')).toEqual({ board: 'CBSE', classLevel: 9, subject: 'Social Science', language: 'English' })
    expect(scopeFromPlacements(['SCH.CBSE.C9'], 'en')).toBeNull()
    expect(scopeFromPlacements(['UG.BSC.Y1.PHYSICS'], 'en')).toBeNull()
    expect(scopeFromPlacements(['SCH.CISCE.C10.HINDI'], 'hi')?.language).toBe('Hindi')
  })
})

describe('CASA over the hub', () => {
  const cfg: HubConfig = { baseUrl: 'https://h', appId: 'digiclassroom', secret: 's', timeoutMs: 1000 }
  const body = (dense: (number | null)[]) => ({
    scope: [], warnings: [],
    results: dense.map((d, i) => ({
      passage_id: `sci9-en:07:sec:7.2:${i + 1}`, work_id: 'w', work_title: 'Science', chapter_no: 7, kind: 'prose', block_type: null, label: null, section_no: '7.2', section_title: null,
      page_start: 76 + i, page_end: 76 + i, pdf_page: null, text: `t${i}`, retrieval_class: 'reference', score: { fused: 0.03, dense: d }, context: { before: [], after: [] },
    })),
  })

  it("scope is the question's board, class and subject as node codes", () => {
    expect(casaScopeCodes({ board: 'CBSE', classLevel: 9, subject: 'Science' })).toEqual(expect.arrayContaining(['SCH.CBSE.C9.SCIENCE']))
    expect(casaScopeCodes({ board: null, classLevel: 9, subject: null })).toEqual(['SCH.CBSE.C9'])
    expect(casaScopeCodes({ board: 'CBSE', classLevel: null, subject: 'Science' })).toBeNull()
  })

  it('returns the best dense match as the anchor candidate, ignoring hits without a dense score; no fallback', async () => {
    let sent: any
    const fetchImpl = (async (_u: string, init: RequestInit) => { sent = JSON.parse(init.body as string); return new Response(JSON.stringify(body([null, 0.4, 0.8])), { status: 200 }) }) as unknown as typeof fetch
    const m = await casaTopMatch('claim', { board: 'CBSE', classLevel: 9, subject: 'Science' }, { cfg, fetchImpl })
    expect(m).toMatchObject({ id: 'sci9-en:07:sec:7.2:3', score: 0.8, page: 78, chapter: 'Chapter 7' })
    expect(sent).toMatchObject({ query: 'claim', limit: 5, window: 0 })
    expect(sent.nodeCodes).toContain('SCH.CBSE.C9.SCIENCE')

    const down = (async () => new Response('', { status: 503 })) as unknown as typeof fetch
    await expect(casaTopMatch('claim', { board: 'CBSE', classLevel: 9, subject: 'Science' }, { cfg, fetchImpl: down })).rejects.toMatchObject({ failure: 'unreachable' })
    await expect(casaTopMatch('claim', { board: 'CBSE', classLevel: null, subject: 'Science' }, { cfg, fetchImpl })).rejects.toThrow(/no class/)
    expect(await casaTopMatch('claim', { board: 'CBSE', classLevel: 9, subject: 'Science' }, { cfg, fetchImpl: (async () => new Response(JSON.stringify(body([null])), { status: 200 })) as unknown as typeof fetch })).toBeNull()
  })
})

describe('flags are off unless set to exactly "true"', () => {
  it('library hub and legacy ingestion switch', () => {
    expect([libraryHubEnabled({} as never), libraryHubEnabled({ LIBRARY_HUB_ENABLED: '1' } as never), libraryHubEnabled({ LIBRARY_HUB_ENABLED: 'true' } as never)]).toEqual([false, false, true])
    expect([legacyIngestionDisabled({} as never), legacyIngestionDisabled({ LEGACY_INGESTION_DISABLED: 'yes' } as never), legacyIngestionDisabled({ LEGACY_INGESTION_DISABLED: 'true' } as never)]).toEqual([false, false, true])
  })
})
