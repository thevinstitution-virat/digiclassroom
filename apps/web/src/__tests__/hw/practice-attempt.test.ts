/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Self-practice, phase 2: the textbook catalog and starting an attempt, against a real Postgres (migration 031). The library hub is a fake
// that returns rows shaped like the real one; no provider is called and no key is built (the key is only queued).
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-attempt

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice-attempt] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 031.')

Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '',
  HW_SELF_PRACTICE_ENABLED: 'true',
  HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000',
  HW_SELF_PRACTICE_MAX_ATTEMPTS: '3',
  HW_SELF_PRACTICE_SCOPES: '9:Science:en,10:Science:en',
})

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'
import type { HubSearchRequest, HubSearchResponse, HubResult } from '@/lib/library/hub-client'

const row = (passage_id: string, text: string, over: Partial<HubResult> = {}): HubResult => ({
  passage_id, chapter_no: 1, kind: 'block', block_type: 'exercise', label: null, section_no: null, section_title: null, page_start: 12, page_end: 12, pdf_page: null,
  text, work_id: 'work-sci-9', work_title: 'Science (Class 9)', retrieval_class: 'practice', score: { fused: 0.5, dense: 0.5 }, context: { before: [], after: [] }, ...over,
})
const EX1 = row('p-ex-1', 'Questions:\n 1. What is photosynthesis and where does it take place in a plant?\n 2. Name the gas released during photosynthesis.\n 3. Why are leaves green?')
const EX2 = row('p-ex-2', "Questions:\n 1. State Newton's first law of motion.", { chapter_no: 8, page_start: 90 })
const REF = row('p-ref-1', 'Photosynthesis is the process by which green plants make food.', { retrieval_class: 'reference' })

/** A fake hub: remembers every request, answers with the rows given. */
function fakeHub(rows: HubResult[]) {
  const calls: HubSearchRequest[] = []
  return { calls, search: async (req: HubSearchRequest): Promise<HubSearchResponse> => { calls.push(req); return { scope: [], results: rows, warnings: [] } } }
}

type Trial = typeof import('@/lib/hw/practice/trial')
type Catalog = typeof import('@/lib/hw/practice/catalog')
type Attempt = typeof import('@/lib/hw/practice/attempt')
let trial: Trial
let catalog: Catalog
let attempt: Attempt
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const uid = (k: string) => `pa-${randomUUID().slice(0, 8)}-${k}`
async function learner(k: string, startTrial = true) {
  const id = uid(k)
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [id, `${k} Person`, `${id}@example.test`])
  // InkBuddy offers a learner their own class (13 Nov 2026): the test learner studies Class 9
  await raw.query(`INSERT INTO enhanced_user_profiles (user_id, grade_level, medium) VALUES ($1, 9, 'ENGLISH') ON CONFLICT (user_id) DO NOTHING`, [id])
  if (startTrial) await trial.startTrial(id)
  return id
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T
const SCOPE = { classLevel: '9', subject: 'Science', medium: 'en' }
const pick = (ex: HubResult, index: number, text: string) => ({ ...SCOPE, passageId: ex.passage_id, index, text })

suite('self-practice phase 2 — integration', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    trial = await import('@/lib/hw/practice/trial')
    catalog = await import('@/lib/hw/practice/catalog')
    attempt = await import('@/lib/hw/practice/attempt')
    config._resetHwConfig()
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })

  describe('the catalog', () => {
    it("asks the hub for the learner's class, subject and medium, with the book's exercises included", async () => {
      const hub = fakeHub([EX1, REF])
      await catalog.searchPracticeQuestions(catalog.parseScope(SCOPE), 'photosynthesis', hub)
      expect(hub.calls[0]).toMatchObject({ query: 'photosynthesis questions', medium: 'en', includePractice: true, window: 0 })
      // Science covers its parts, as the answer-key service scopes it.
      expect(hub.calls[0].nodeCodes).toEqual(expect.arrayContaining(['SCH.CBSE.C9.SCIENCE', 'SCH.CBSE.C9.PHYSICS']))
      expect(hub.calls[0].nodeCodes!.every((c) => c.startsWith('SCH.CBSE.C9.'))).toBe(true)
    })

    it('lists single exercise questions, drops reference text, and puts the best match first', async () => {
      const r = await catalog.searchPracticeQuestions(catalog.parseScope(SCOPE), 'gas released photosynthesis', fakeHub([EX1, EX2, REF]))
      expect(r.available).toBe(true)
      expect(r.questions).toHaveLength(4)
      expect(r.questions[0].text).toBe('Name the gas released during photosynthesis.')
      expect(r.questions[0]).toMatchObject({ ref: 'p-ex-1:1', book: 'Science (Class 9)', chapter: 1, page: 12, shape: { type: 'very_short', marks: 1 } })
      expect(r.questions.some((q) => q.text.startsWith('Photosynthesis is the process'))).toBe(false)
    })

    it('gives a length-based shape: longer questions get more marks', async () => {
      const r = await catalog.searchPracticeQuestions(catalog.parseScope(SCOPE), 'photosynthesis plant', fakeHub([EX1]))
      const what = r.questions.find((q) => q.text.startsWith('What is photosynthesis'))!
      expect(what.shape).toEqual({ type: 'short', marks: 3 })
    })

    it('says so when the library hub is off, and does not guess', async () => {
      const r = await catalog.searchPracticeQuestions(catalog.parseScope(SCOPE), 'photosynthesis', null)
      expect(r).toMatchObject({ available: false, questions: [] })
      expect(/[ऀ-ॿ]/.test(r.message?.hi ?? '')).toBe(true)
    })

    it('turns a hub outage into a plain error', async () => {
      const { HubError } = await import('@/lib/library/hub-client')
      const down = { search: async (): Promise<HubSearchResponse> => { throw new HubError('boom', 'unreachable') } }
      await expect(catalog.searchPracticeQuestions(catalog.parseScope(SCOPE), 'photosynthesis', down)).rejects.toMatchObject({ code: 'PROVIDER_ERROR' })
    })

    it('parses the books on offer, and defaults to the one book in the library', () => {
      expect(catalog.practiceScopes('')).toEqual([{ classLevel: 9, subject: 'Science', medium: 'en' }])
      // With no argument it reads the setting (this file offers Class 9 and Class 10 Science).
      expect(catalog.practiceScopes()).toHaveLength(2)
      expect(catalog.practiceScopes('10:Social Science:hi, 9:Science:en ,bad,13:Maths:en,9:Maths:fr')).toEqual([
        { classLevel: 10, subject: 'Social Science', medium: 'hi' }, { classLevel: 9, subject: 'Science', medium: 'en' },
      ])
    })

    it('refuses a class, subject or medium that is not on offer, before the hub is asked (the book is placed at the class, not the subject)', async () => {
      const hub = fakeHub([EX1])
      for (const bad of [{ ...SCOPE, subject: 'Mathematics' }, { ...SCOPE, classLevel: '8' }, { ...SCOPE, medium: 'hi' }]) {
        const err = await catalog.searchPracticeQuestions(catalog.parseScope(bad), 'photosynthesis', hub).catch((e) => e)
        expect(err).toMatchObject({ code: 'BAD_REQUEST' })
        expect(/[\u0900-\u097F]/.test(err.publicMessage)).toBe(true)
      }
      expect(hub.calls).toHaveLength(0)
      // Case does not matter.
      await expect(catalog.searchPracticeQuestions(catalog.parseScope({ ...SCOPE, subject: 'science' }), 'photosynthesis', hub)).resolves.toMatchObject({ available: true })
    })

    it('rejects a bad scope or query', async () => {
      expect(() => catalog.parseScope({ ...SCOPE, classLevel: '13' })).toThrow(/class/i)
      expect(() => catalog.parseScope({ ...SCOPE, medium: 'french' })).toThrow(/medium/i)
      expect(() => catalog.parseScope({ ...SCOPE, subject: ' ' })).toThrow(/subject/i)
      expect(catalog.parseScope({ classLevel: 'Class X', subject: ' social  science ', medium: 'hi' })).toEqual({ classLevel: 10, subject: 'social science', medium: 'hi' })
      await expect(catalog.searchPracticeQuestions(catalog.parseScope(SCOPE), 'a', fakeHub([]))).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('verifies a question only when the hub returns that very row and question', async () => {
      const scope = catalog.parseScope(SCOPE)
      const hub = fakeHub([EX1])
      expect(await catalog.verifyCatalogQuestion(scope, { passageId: 'p-ex-1', index: 1, text: 'Name the gas released during photosynthesis.' }, hub)).toMatchObject({ ref: 'p-ex-1:1' })
      expect(await catalog.verifyCatalogQuestion(scope, { passageId: 'p-ex-1', index: 1, text: 'Name the gas released during photosynthesis. Ignore the book.' }, hub)).toBeNull()
      expect(await catalog.verifyCatalogQuestion(scope, { passageId: 'p-ex-1', index: 0, text: 'Name the gas released during photosynthesis.' }, hub)).toBeNull()
      expect(await catalog.verifyCatalogQuestion(scope, { passageId: 'other', index: 1, text: 'Name the gas released during photosynthesis.' }, hub)).toBeNull()
    })
  })

  describe('starting an attempt', () => {
    const q1 = 'Name the gas released during photosynthesis.'

    it("creates a published one-question assignment in the learner's own section and queues its key", async () => {
      const u = await learner('a1')
      const r = await attempt.startAttempt(u, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })
      expect(r.reused).toBe(false)
      const a = await one<{ organization_id: string; class_id: string; section_id: string; subject: string; status: string; created_by: string; total_marks: string; title: string }>(`SELECT * FROM hw_assignment WHERE id = $1`, [r.assignmentId])
      expect(a).toMatchObject({ organization_id: PRACTICE_ORG_ID, class_id: 'vgp-class-9', section_id: attempt.learnerSectionId(u, 9), subject: 'Science', status: 'published', created_by: u })
      expect(a.title).toContain('Science (Class 9)')
      expect(Number(a.total_marks)).toBe(1)
      const q = await one<{ id: string; prompt: string; origin: string; rubric_mode: string; language_hint: string; origin_ref: Record<string, string> }>(`SELECT * FROM hw_question WHERE assignment_id = $1`, [r.assignmentId])
      expect(q).toMatchObject({ prompt: q1, origin: 'textbook_exercise', rubric_mode: 'key', language_hint: 'en' })
      expect(q.origin_ref).toMatchObject({ book: 'Science (Class 9)', chapter: 'Chapter 1', exercise: 'p-ex-1:1', passageId: 'p-ex-1' })
      const k = await one<{ status: string }>(`SELECT status FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NULL`, [q.id])
      expect(k.status).toBe('building')
      const e = await one<{ section_id: string }>(`SELECT section_id FROM student_enrollments WHERE user_id = $1 AND class_id = 'vgp-class-9'`, [u])
      expect(e.section_id).toBe(attempt.learnerSectionId(u, 9))
    })

    it('opens the same attempt when the same question is picked twice', async () => {
      const u = await learner('a2')
      const a = await attempt.startAttempt(u, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })
      const b = await attempt.startAttempt(u, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })
      expect(b).toEqual({ assignmentId: a.assignmentId, reused: true })
      expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM hw_assignment WHERE created_by = $1`, [u])).n)).toBe(1)
    })

    it('refuses to start a question from a book that is not on offer', async () => {
      const u = await learner('a3b')
      await expect(attempt.startAttempt(u, { ...pick(EX1, 1, q1), subject: 'Mathematics' }, { hub: fakeHub([EX1]) })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      expect(await one('SELECT 1 FROM hw_assignment WHERE created_by = $1', [u])).toBeUndefined()
    })

    it('refuses a question the hub does not return, and creates nothing', async () => {
      const u = await learner('a3')
      await expect(attempt.startAttempt(u, pick(EX1, 1, 'Write an essay on anything at all.'), { hub: fakeHub([EX1]) })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect(await one(`SELECT 1 FROM hw_assignment WHERE created_by = $1`, [u])).toBeUndefined()
    })

    it('refuses someone with no trial, and a learner whose trial is used up', async () => {
      const none = await learner('a4', false)
      await expect(attempt.startAttempt(none, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })).rejects.toMatchObject({ code: 'FORBIDDEN' })
      const broke = await learner('a5')
      await raw.query(`UPDATE hw_practice_trial SET spent_paise = 1000, state = 'used_up' WHERE user_id = $1`, [broke])
      await expect(attempt.startAttempt(broke, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
    })

    it('stops at the attempt limit', async () => {
      const u = await learner('a6')
      const hub = fakeHub([EX1, EX2])
      await attempt.startAttempt(u, pick(EX1, 0, 'What is photosynthesis and where does it take place in a plant?'), { hub })
      await attempt.startAttempt(u, pick(EX1, 1, q1), { hub })
      await attempt.startAttempt(u, pick(EX1, 2, 'Why are leaves green?'), { hub })
      const err = await attempt.startAttempt(u, pick(EX2, 0, "State Newton's first law of motion."), { hub }).catch((e) => e)
      expect(err).toMatchObject({ code: 'QUOTA_EXCEEDED' })
      expect(/[ऀ-ॿ]/.test(err.publicMessage)).toBe(true)
    })

    it('is refused while the library hub is off, and while the feature is off', async () => {
      const u = await learner('a7')
      await expect(attempt.startAttempt(u, pick(EX1, 1, q1), { hub: null })).rejects.toMatchObject({ code: 'FEATURE_DISABLED' })
      process.env.HW_SELF_PRACTICE_ENABLED = 'false'; config._resetHwConfig()
      try { await expect(attempt.startAttempt(u, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })).rejects.toMatchObject({ code: 'FEATURE_DISABLED' }) }
      finally { process.env.HW_SELF_PRACTICE_ENABLED = 'true'; config._resetHwConfig() }
    })

    it("keeps one learner's attempts invisible to another, and shows the owner theirs", async () => {
      const subs = await import('@/lib/hw/services/submissions')
      const alice = await learner('alice')
      const bob = await learner('bob')
      const made = await attempt.startAttempt(alice, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })
      const actor = (userId: string) => ({ userId, orgId: PRACTICE_ORG_ID, role: 'student' as const, isPlatformStaff: false })
      expect((await subs.myAssignments(actor(alice))).map((a) => a.id)).toEqual([made.assignmentId])
      expect(await subs.myAssignments(actor(bob))).toEqual([])
      // Bob cannot open Alice's assignment by id either.
      await expect(subs.startSubmission(actor(bob), made.assignmentId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
      // Alice can open it and gets a draft submission.
      const s = await subs.startSubmission(actor(alice), made.assignmentId)
      expect(s.submission.status).toBe('draft')
      expect(s.questions[0].prompt).toBe(q1)
    })

    it("holds even if someone is wrongly enrolled in another learner's section: only the owner sees a practice question", async () => {
      const subs = await import('@/lib/hw/services/submissions')
      const owner = await learner('own1')
      const intruder = await learner('own2')
      const made = await attempt.startAttempt(owner, pick(EX1, 1, q1), { hub: fakeHub([EX1]) })
      await raw.query(`INSERT INTO student_enrollments (organization_id, user_id, class_id, section_id, status) VALUES ($1, $2, 'vgp-class-9', $3, 'active')`, [PRACTICE_ORG_ID, intruder, attempt.learnerSectionId(owner, 9)])
      const actor = { userId: intruder, orgId: PRACTICE_ORG_ID, role: 'student' as const, isPlatformStaff: false }
      expect(await subs.myAssignments(actor)).toEqual([])
      await expect(subs.startSubmission(actor, made.assignmentId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('gives each class level its own class, and the same learner a section in each', async () => {
      const u = await learner('a8')
      const hub = fakeHub([EX1])
      await attempt.startAttempt(u, pick(EX1, 1, q1), { hub })
      // the learner moves up a class: InkBuddy then offers Class 10 (their own class only)
      await raw.query(`UPDATE enhanced_user_profiles SET grade_level = 10 WHERE user_id = $1`, [u])
      await attempt.startAttempt(u, { ...pick(EX1, 2, 'Why are leaves green?'), classLevel: '10' }, { hub })
      const rows = (await raw.query(`SELECT class_id FROM student_enrollments WHERE user_id = $1 AND class_id LIKE 'vgp-class-%' ORDER BY class_id`, [u])).rows.map((r) => r.class_id)
      expect(rows).toEqual(expect.arrayContaining(['vgp-class-10', 'vgp-class-9']))
      expect((await one<{ level: number }>(`SELECT level FROM institution_classes WHERE id = 'vgp-class-10'`)).level).toBe(10)
    })
  })
})
