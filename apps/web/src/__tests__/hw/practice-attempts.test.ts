/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// InkBuddy attempts (Phase 1 of docs/hw-eval/inkbuddy-teacher-roadmap.md; owner's decisions of 13 Nov 2026), against a real Postgres:
// "Attempted (n)", up to N attempts per question in the current plan (a new plan starts the count again), every attempt kept as history,
// a new attempt copying the question's marking points and answer key, and the result page's book answer and history.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-attempts

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice-attempts] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres.')

Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_SELF_PRACTICE_ENABLED: 'true', HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000', HW_SELF_PRACTICE_MAX_ATTEMPTS_PER_QUESTION: '3', HW_SELF_PRACTICE_SCOPES: '10:Science:en' })

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'
import type { HubSearchRequest, HubSearchResponse, HubResult } from '@/lib/library/hub-client'

const Q = 'What is the role of saliva in the digestion of food?'
const ROW: HubResult = {
  passage_id: 'p-at-1', chapter_no: 5, kind: 'block', block_type: 'exercise', label: null, section_no: null, section_title: null, page_start: 98, page_end: 98, pdf_page: null,
  text: `Questions:\n 1. ${Q}`, work_id: 'work-sci-10', work_title: 'Science (Class 10)', retrieval_class: 'practice', score: { fused: 0.5, dense: 0.5 }, context: { before: [], after: [] },
}
const hub = { search: async (_req: HubSearchRequest): Promise<HubSearchResponse> => ({ scope: [], results: [ROW], warnings: [] }) }

let trial: typeof import('@/lib/hw/practice/trial')
let attempt: typeof import('@/lib/hw/practice/attempt')
let attempts: typeof import('@/lib/hw/practice/attempts')
let subs: typeof import('@/lib/hw/services/submissions')
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T

async function learner() {
  const id = `pa-${randomUUID().slice(0, 8)}`
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, 'Learner', $2, 'student', now())`, [id, `${id}@example.test`])
  await raw.query(`INSERT INTO enhanced_user_profiles (user_id, grade_level, medium) VALUES ($1, 10, 'ENGLISH') ON CONFLICT (user_id) DO NOTHING`, [id])
  await trial.startTrial(id)
  return { id, actor: { userId: id, orgId: PRACTICE_ORG_ID, role: 'student' as const, isPlatformStaff: false } }
}

/** The answer key the job runner would have built: ready, with a book answer and its pages, applied as the question's marking points. */
async function keyReady(assignmentId: string) {
  const q = await one<{ id: string }>(`SELECT id FROM hw_question WHERE assignment_id = $1`, [assignmentId])
  const k = await one<{ id: string }>(`SELECT id FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NULL`, [q.id])
  await raw.query(`UPDATE hw_question_key SET status = 'ready', scheme_source = 'textbook_key',
      key = $2::jsonb, citations = $3::jsonb, source_ref = 'textbook: work-sci-10|2026', key_service_version = 'test', config_hash = 'test', built_at = now() WHERE id = $1`, [
    k.id,
    JSON.stringify({ referenceAnswer: 'Saliva moistens food so it is easy to swallow. It contains the enzyme salivary amylase, which breaks down starch into sugar.', valuePoints: [] }),
    JSON.stringify([{ chunkId: 'c1', title: 'Science (Class 10)', chapter: 'Chapter 5', pageStart: 96, pageEnd: 97 }]),
  ])
  await raw.query(`UPDATE hw_question SET active_key_id = $2, scheme_source = 'textbook_key' WHERE id = $1`, [q.id, k.id])
  for (const [i, d] of ['Saliva moistens food', 'Contains salivary amylase', 'Amylase breaks starch into sugar'].entries()) {
    await raw.query(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks, source) VALUES ($1, $2, $3, $4, 'key_point', $5, 1, 'key')`, [randomUUID(), PRACTICE_ORG_ID, q.id, i, d])
  }
  return { questionId: q.id, keyId: k.id }
}

/** The learner answers and the mark comes back (returned), as the practice release leaves it. */
async function markedAt(actor: { userId: string }, assignmentId: string, marks: number) {
  const s = await subs.startSubmission(actor as never, assignmentId)
  const ans = randomUUID()
  await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status, transcript_confidence) VALUES ($1,$2,$3,$4,'ink','Saliva has amylase','done',0.95)`,
    [ans, PRACTICE_ORG_ID, s.submission.id, s.questions[0].id])
  await raw.query(`INSERT INTO hw_grade (answer_id, organization_id, marks, item_marks, source, graded_by) VALUES ($1, $2, $3, '[]', 'manual', $4)`, [ans, PRACTICE_ORG_ID, marks, actor.userId])
  await raw.query(`UPDATE hw_submission SET status = 'returned', submitted_at = now() WHERE id = $1`, [s.submission.id])
  return s.submission.id
}

suite('InkBuddy attempts — integration', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    trial = await import('@/lib/hw/practice/trial')
    attempt = await import('@/lib/hw/practice/attempt')
    attempts = await import('@/lib/hw/practice/attempts')
    subs = await import('@/lib/hw/services/submissions')
    config._resetHwConfig()
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })

  const pick = { classLevel: '10', subject: 'Science', medium: 'en', passageId: 'p-at-1', index: 0, text: Q }

  it('names the same question across attempts: the book exercise, or the board-paper row', () => {
    const { practiceRefOf } = attempts
    expect(practiceRefOf({ exercise: 'p1:0' })).toBe('p1:0')
    expect(practiceRefOf({ bankRowId: 'r9' })).toBe('bank:r9')
    expect(practiceRefOf({})).toBeNull()
  })

  it('a marked question can be written again: a new attempt on a copy with the same key and points; the history keeps both', async () => {
    const { id: u, actor } = await learner()
    const first = await attempt.startAttempt(u, pick, { hub })
    // the question records its book, for concept feedback
    expect((await one<{ w: string }>(`SELECT q.origin_ref ->> 'workId' AS w FROM hw_question q WHERE q.assignment_id = $1`, [first.assignmentId])).w).toBe('work-sci-10')
    const k = await keyReady(first.assignmentId)

    // not marked yet: no new attempt, the open one is where to go
    expect(await attempts.writeAgain(u, first.assignmentId)).toEqual({ assignmentId: first.assignmentId, reused: true })

    await markedAt(actor, first.assignmentId, 2)
    const st = await attempts.attemptStatus((await import('@/lib/hw/db')).db, u, first.assignmentId)
    expect(st).toMatchObject({ usedInPlan: 1, limit: 3, canWriteAgain: true })
    expect(st!.history).toEqual([expect.objectContaining({ n: 1, awarded: 2, outOf: 3, current: true, status: 'returned' })])

    const second = await attempts.writeAgain(u, first.assignmentId)
    expect(second.reused).toBe(false)
    expect(second.assignmentId).not.toBe(first.assignmentId)
    const q2 = await one<{ id: string; active_key_id: string; prompt: string; status: string }>(
      `SELECT q.id, q.active_key_id, q.prompt, a.status FROM hw_question q JOIN hw_assignment a ON a.id = q.assignment_id WHERE q.assignment_id = $1`, [second.assignmentId])
    expect(q2).toMatchObject({ active_key_id: k.keyId, prompt: Q, status: 'published' })
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM hw_rubric_item WHERE question_id = $1 AND retired_at IS NULL`, [q2.id])).n)).toBe(3)
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM hw_question_key WHERE question_id = $1`, [q2.id])).n)).toBe(0) // no new key build

    // picking the question in search again opens the LATEST attempt; search shows it attempted twice
    expect(await attempt.startAttempt(u, pick, { hub })).toEqual({ assignmentId: second.assignmentId, reused: true })
    const counts = await attempts.attemptCounts((await import('@/lib/hw/db')).db, u, ['p-at-1:0', 'p-other:0'])
    expect(counts.get('p-at-1:0')).toEqual({ attempts: 2, latestAssignmentId: second.assignmentId })
    expect(counts.has('p-other:0')).toBe(false)
  })

  it('up to the limit per question in the plan; a new plan starts the count again from zero; the history stays', async () => {
    const { id: u, actor } = await learner()
    let a = (await attempt.startAttempt(u, pick, { hub })).assignmentId
    await keyReady(a)
    for (let i = 0; i < 2; i++) { await markedAt(actor, a, 1); a = (await attempts.writeAgain(u, a)).assignmentId }
    await markedAt(actor, a, 3) // the third attempt, marked: the limit (3 in this suite)
    const db = (await import('@/lib/hw/db')).db
    expect(await attempts.attemptStatus(db, u, a)).toMatchObject({ usedInPlan: 3, canWriteAgain: false })
    await expect(attempts.writeAgain(u, a)).rejects.toMatchObject({ code: 'CONFLICT', publicMessage: expect.stringContaining('3 times') })

    // a new plan (a paid plan's start; here the trial's start moved to now): the count starts again, the old attempts stay in the history
    await raw.query(`UPDATE hw_practice_trial SET started_at = now() + interval '1 second' WHERE user_id = $1`, [u])
    await new Promise((r) => setTimeout(r, 1100))
    const st = await attempts.attemptStatus(db, u, a)
    expect(st).toMatchObject({ usedInPlan: 0, canWriteAgain: true })
    expect(st!.history.map((h) => h.awarded)).toEqual([1, 1, 3])
  })

  it('attempts at one question count once towards the trial\'s limit on different questions', async () => {
    const { id: u, actor } = await learner()
    const a = (await attempt.startAttempt(u, pick, { hub })).assignmentId
    await keyReady(a)
    await markedAt(actor, a, 1)
    await attempts.writeAgain(u, a)
    const n = await one<{ n: number }>(`SELECT count(DISTINCT coalesce(q.origin_ref ->> 'exercise', a.id))::int AS n FROM hw_assignment a JOIN hw_question q ON q.assignment_id = a.id WHERE a.created_by = $1`, [u])
    expect(n.n).toBe(1)
  })

  it('the result page: who evaluated it, the book answer with its pages, the answer as written, and the attempts', async () => {
    const { id: u, actor } = await learner()
    const a = (await attempt.startAttempt(u, pick, { hub })).assignmentId
    await keyReady(a)
    const sid = await markedAt(actor, a, 2)
    const r = await subs.myResult(actor as never, sid)
    expect(r.practiceEstimate).toMatchObject({ label: { en: 'Evaluated by Virat Evaluator · practice marks' }, how: { en: 'How is this marked?' } })
    expect(JSON.stringify(r.practiceEstimate)).not.toMatch(/No teacher/)
    expect(r.attempts).toMatchObject({ usedInPlan: 1, canWriteAgain: true })
    const q = r.questions[0] as (typeof r.questions)[number] & { bookAnswer: { text: string; source: string } | null; yours: { mode: string } | null }
    expect(q.bookAnswer).toEqual({ text: expect.stringContaining('salivary amylase'), source: 'Science (Class 10) · Chapter 5 · pages 96-97' })
    expect(q.yours).toMatchObject({ mode: 'ink' })
  })

  it('concept feedback places an InkBuddy question by its answer key: the book and passages the key was written from, no search', async () => {
    const { id: u, actor } = await learner()
    const a = (await attempt.startAttempt(u, pick, { hub })).assignmentId
    const k = await keyReady(a)
    await raw.query(`UPDATE hw_question_key SET passage_hashes = '{"sci10-en:05:sec:5.2:1": "h1", "sci10-en:05:sec:5.2:2": "h2"}'::jsonb WHERE id = $1`, [k.keyId])
    const sid = await markedAt(actor, a, 2)
    const env = { LIBRARY_HUB_ENABLED: 'true', LIBRARY_GRAPH_ENABLED: 'true', LIBRARY_HUB_URL: 'https://hub.test', LIBRARY_HUB_SECRET: 's' }
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]))
    Object.assign(process.env, env)
    const calls: string[] = []
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      calls.push(String(url))
      if (String(url).endsWith('/api/hub/graph/expand')) {
        expect(JSON.parse(String(init?.body))).toMatchObject({ workId: 'work-sci-10', passageIds: ['sci10-en:05:sec:5.2:1', 'sci10-en:05:sec:5.2:2'] })
        return new Response(JSON.stringify({ concepts: [{ id: 'c1', label: 'salivary amylase', type: 'term', description: null, first_chapter: 5 }], prerequisites: [], relations: [] }), { status: 200 })
      }
      return new Response(JSON.stringify({ scope: [], results: [], warnings: [] }), { status: 200 })
    })
    try {
      const { conceptFeedbackForSubmission } = await import('@/lib/hw/concept-feedback')
      const f = await conceptFeedbackForSubmission(actor as never, sid)
      expect(calls.filter((c) => c.endsWith('/api/hub/graph/expand'))).toHaveLength(1)
      expect(calls.some((c) => c.endsWith('/api/hub/search'))).toBe(false)
      expect([...f.weak.map((w) => w.concept), ...f.strong]).toContain('salivary amylase')
    } finally {
      fetchSpy.mockRestore()
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    }
  })
})
