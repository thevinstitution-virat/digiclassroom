/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Self-practice: "write it again" for an answer that got no mark, against a real Postgres (migration 031). The library hub is a fake; the
// states of the submission, its jobs and its answer key are set directly, as the job runner would leave them.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-retry

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice-retry] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 031.')

Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_SELF_PRACTICE_ENABLED: 'true', HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000' })

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'
import type { HubSearchRequest, HubSearchResponse, HubResult } from '@/lib/library/hub-client'

const Q = 'Name the gas released during photosynthesis.'
const ROW: HubResult = {
  passage_id: 'p-rt-1', chapter_no: 1, kind: 'block', block_type: 'exercise', label: null, section_no: null, section_title: null, page_start: 12, page_end: 12, pdf_page: null,
  text: `Questions:\n 1. ${Q}`, work_id: 'w1', work_title: 'Science (Class 9)', retrieval_class: 'practice', score: { fused: 0.5, dense: 0.5 }, context: { before: [], after: [] },
}
const hub = { search: async (_req: HubSearchRequest): Promise<HubSearchResponse> => ({ scope: [], results: [ROW], warnings: [] }) }

type Trial = typeof import('@/lib/hw/practice/trial')
type Attempt = typeof import('@/lib/hw/practice/attempt')
let trial: Trial
let attempt: Attempt
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const uid = (k: string) => `pr-${randomUUID().slice(0, 8)}-${k}`
async function learner(k: string) {
  const id = uid(k)
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [id, `${k} Person`, `${id}@example.test`])
  await trial.startTrial(id)
  return id
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T
const count = async (sql: string, args: unknown[] = []) => Number((await one<{ n: string }>(sql, args)).n)

/** A started question whose answer was handed in and read, left in `status` with an AI suggestion (or not). */
async function held(k: string, status = 'ready_for_review') {
  const u = await learner(k)
  const made = await attempt.startAttempt(u, { classLevel: '9', subject: 'Science', medium: 'en', passageId: 'p-rt-1', index: 0, text: Q }, { hub })
  const subs = await import('@/lib/hw/services/submissions')
  const actor = { userId: u, orgId: PRACTICE_ORG_ID, role: 'student' as const, isPlatformStaff: false }
  const s = await subs.startSubmission(actor, made.assignmentId)
  const qid = s.questions[0].id
  const ans = randomUUID()
  await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status, transcript_confidence) VALUES ($1,$2,$3,$4,'ink','Carbon dioxide','done',0.9)`, [ans, PRACTICE_ORG_ID, s.submission.id, qid])
  await raw.query(`UPDATE hw_submission SET status = $2, submitted_at = now() WHERE id = $1`, [s.submission.id, status])
  return { u, actor, assignmentId: made.assignmentId, submissionId: s.submission.id, questionId: qid, answerId: ans }
}

suite('self-practice: write it again — integration', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    trial = await import('@/lib/hw/practice/trial')
    attempt = await import('@/lib/hw/practice/attempt')
    config._resetHwConfig()
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })

  it('turns a read-but-unmarked answer back into a draft on the same question, with the answer and its suggestions gone', async () => {
    const h = await held('t1')
    await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence) VALUES ($1,$2,$3,'gpt-6-luna','grade-strict.v2',1,'[]',1,0.4)`, [randomUUID(), PRACTICE_ORG_ID, h.answerId])
    const r = await attempt.retryAttempt(h.u, h.submissionId)
    expect(r.submissionId).toBe(h.submissionId)
    const s = await one<{ status: string; submitted_at: Date | null; is_late: boolean }>(`SELECT * FROM hw_submission WHERE id = $1`, [h.submissionId])
    expect(s).toMatchObject({ status: 'draft', submitted_at: null, is_late: false })
    expect(await count(`SELECT count(*) AS n FROM hw_answer WHERE submission_id = $1`, [h.submissionId])).toBe(0)
    expect(await count(`SELECT count(*) AS n FROM hw_ai_grade WHERE answer_id = $1`, [h.answerId])).toBe(0)
    // Same assignment, same question, same key.
    expect(await count(`SELECT count(*) AS n FROM hw_question WHERE assignment_id = $1 AND id = $2`, [h.assignmentId, h.questionId])).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NULL`, [h.questionId])).toBe(1)
    // The learner opens a blank draft.
    const subs = await import('@/lib/hw/services/submissions')
    const again = await subs.startSubmission(h.actor, h.assignmentId)
    expect(again.submission.status).toBe('draft')
    expect(again.answers).toEqual([])
  })

  it('also works for an answer that was graded but not returned', async () => {
    const h = await held('t2', 'graded')
    await attempt.retryAttempt(h.u, h.submissionId)
    expect((await one<{ status: string }>(`SELECT status FROM hw_submission WHERE id = $1`, [h.submissionId])).status).toBe('draft')
  })

  it('does not touch a marked (returned) answer, a draft, or one still being read', async () => {
    const done = await held('t3', 'returned')
    const e1 = await attempt.retryAttempt(done.u, done.submissionId).catch((e) => e)
    expect(e1).toMatchObject({ code: 'CONFLICT' })
    expect(await count(`SELECT count(*) AS n FROM hw_answer WHERE submission_id = $1`, [done.submissionId])).toBe(1)

    const fresh = await held('t4', 'draft')
    await raw.query(`UPDATE hw_submission SET submitted_at = NULL WHERE id = $1`, [fresh.submissionId])
    await expect(attempt.retryAttempt(fresh.u, fresh.submissionId)).rejects.toMatchObject({ code: 'CONFLICT' })

    const reading = await held('t5', 'processing')
    const e2 = await attempt.retryAttempt(reading.u, reading.submissionId).catch((e) => e)
    expect(e2).toMatchObject({ code: 'CONFLICT' })
    expect(e2.publicMessage).toContain('still being processed')
    expect(/[ऀ-ॿ]/.test(e2.publicMessage)).toBe(true)
  })

  it('waits while a job is still working on the submission or its question', async () => {
    const h = await held('t6')
    const job = randomUUID()
    await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, question_id, status) VALUES ($1,$2,'grade',$3,'running')`, [job, PRACTICE_ORG_ID, h.questionId])
    await expect(attempt.retryAttempt(h.u, h.submissionId)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await count(`SELECT count(*) AS n FROM hw_answer WHERE submission_id = $1`, [h.submissionId])).toBe(1)
    await raw.query(`UPDATE hw_ai_job SET status = 'done' WHERE id = $1`, [job])
    await expect(attempt.retryAttempt(h.u, h.submissionId)).resolves.toBeTruthy()
  })

  it("is only for the learner's own submission", async () => {
    const h = await held('t7')
    const other = await learner('t7b')
    await expect(attempt.retryAttempt(other, h.submissionId)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await count(`SELECT count(*) AS n FROM hw_answer WHERE submission_id = $1`, [h.submissionId])).toBe(1)
  })

  it('refuses once the trial is used up', async () => {
    const h = await held('t8')
    await raw.query(`UPDATE hw_practice_trial SET spent_paise = 1000, state = 'used_up' WHERE user_id = $1`, [h.u])
    await expect(attempt.retryAttempt(h.u, h.submissionId)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
    expect(await count(`SELECT count(*) AS n FROM hw_answer WHERE submission_id = $1`, [h.submissionId])).toBe(1)
  })

  describe('the answer key', () => {
    it('a question the book has no key for stays refused', async () => {
      const h = await held('k1')
      await raw.query(`UPDATE hw_question_key SET status = 'no_grounding' WHERE question_id = $1 AND superseded_at IS NULL`, [h.questionId])
      const err = await attempt.retryAttempt(h.u, h.submissionId).catch((e) => e)
      expect(err).toMatchObject({ code: 'CONFLICT' })
      expect(err.publicMessage).toContain('no answer key')
      expect(/[ऀ-ॿ]/.test(err.publicMessage)).toBe(true)
      expect(await count(`SELECT count(*) AS n FROM hw_answer WHERE submission_id = $1`, [h.submissionId])).toBe(1)
    })

    it('a failed key is queued again', async () => {
      const h = await held('k2')
      await raw.query(`UPDATE hw_question_key SET status = 'failed' WHERE question_id = $1 AND superseded_at IS NULL`, [h.questionId])
      await attempt.retryAttempt(h.u, h.submissionId)
      const cur = await one<{ status: string }>(`SELECT status FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NULL`, [h.questionId])
      expect(cur.status).toBe('building')
      expect(await count(`SELECT count(*) AS n FROM hw_question_key WHERE question_id = $1`, [h.questionId])).toBe(2)
    })

    it('stops rebuilding a failing key after three builds', async () => {
      const h = await held('k3')
      await raw.query(`UPDATE hw_question_key SET status = 'failed' WHERE question_id = $1 AND superseded_at IS NULL`, [h.questionId])
      for (let i = 0; i < 2; i++) {
        await raw.query(`INSERT INTO hw_question_key (id, organization_id, question_id, status, question_hash, superseded_at) VALUES ($1,$2,$3,'failed',$4, now())`, [randomUUID(), PRACTICE_ORG_ID, h.questionId, 'a'.repeat(64)])
      }
      const err = await attempt.retryAttempt(h.u, h.submissionId).catch((e) => e)
      expect(err).toMatchObject({ code: 'CONFLICT' })
      expect(err.publicMessage).toContain('could not be built')
      expect(await count(`SELECT count(*) AS n FROM hw_question_key WHERE question_id = $1`, [h.questionId])).toBe(3)
    })

    it('a key that is ready or still building is left alone', async () => {
      const h = await held('k4')
      await attempt.retryAttempt(h.u, h.submissionId)
      expect(await count(`SELECT count(*) AS n FROM hw_question_key WHERE question_id = $1`, [h.questionId])).toBe(1)
    })
  })

  it('is off while self-practice is off', async () => {
    const h = await held('t9')
    process.env.HW_SELF_PRACTICE_ENABLED = 'false'; config._resetHwConfig()
    try { await expect(attempt.retryAttempt(h.u, h.submissionId)).rejects.toMatchObject({ code: 'FEATURE_DISABLED' }) }
    finally { process.env.HW_SELF_PRACTICE_ENABLED = 'true'; config._resetHwConfig() }
  })
})
