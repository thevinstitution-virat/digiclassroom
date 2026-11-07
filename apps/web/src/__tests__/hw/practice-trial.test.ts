/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Self-practice for independent learners (migration 031) against a real Postgres: the practice space, the trial, the per-learner budget,
// and the hand-back of marks where no teacher exists. No AI provider is called; AI suggestions are rows written by the test.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-trial

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 031.')

Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '',
  HW_SELF_PRACTICE_ENABLED: 'true',
  HW_SELF_PRACTICE_TRIAL_DAYS: '7',
  HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000',
  HW_SELF_PRACTICE_STEP_RESERVE_PAISE: '5',
  HW_SELF_PRACTICE_PLATFORM_BUDGET_PAISE: '200000',
  HW_PRICE_TABLE_JSON: JSON.stringify({ inr_per_usd: 100, models: { 'gpt-6-luna': { input: 1, cached: 0.1, output: 4 } } }),
})

// The session is faked at the one edge the actor resolver reads it from.
let mockSession: { user: { id: string; role: string }; session: { activeOrganizationId: string | null } } | null = null
jest.mock('../../../../../packages/core/src/auth', () => ({ auth: { api: { getSession: async () => mockSession } } }))

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'

type Trial = typeof import('@/lib/hw/practice/trial')
type Marking = typeof import('@/lib/hw/services/marking')
type Usage = typeof import('@/lib/hw/cost/usage')
let trial: Trial
let marking: Marking
let usage: Usage
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let dbx: typeof import('@/lib/hw/db')
let raw: Pool

const uid = (k: string) => `pt-${randomUUID().slice(0, 8)}-${k}`
async function addUser(k: string) {
  const id = uid(k)
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [id, `${k} Person`, `${id}@example.test`])
  return id
}
async function addSchoolMember(userId: string) {
  const org = uid('school')
  await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org])
  await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [uid('m'), org, userId])
  return org
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T

/** One practice attempt: assignment, question with one key point, a handed-in submission whose answer has been read. */
async function attempt(userId: string, o: { org?: string; transcriptStatus?: string; transcriptConfidence?: number | null; suggestion?: { confidence: number; marks: number } | null; status?: string } = {}) {
  const org = o.org ?? PRACTICE_ORG_ID
  // The practice institution has a class per level, made when a learner starts a question; this fixture stands in for that.
  if (org === PRACTICE_ORG_ID) await raw.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ('vgp-class-9', $1, 'Class 9', 9) ON CONFLICT DO NOTHING`, [org])
  const classId = org === PRACTICE_ORG_ID ? 'vgp-class-9' : (await one<{ id: string }>(`SELECT id FROM institution_classes WHERE organization_id = $1`, [org]))?.id
  const a = randomUUID(), q = randomUUID(), r = randomUUID(), s = randomUUID(), ans = randomUUID()
  await raw.query(`INSERT INTO hw_assignment (id, organization_id, class_id, subject, title, status, allowed_modes, total_marks, created_by) VALUES ($1,$2,$3,'Science','Practice','draft',ARRAY['ink'],2,$4)`, [a, org, classId, userId])
  await raw.query(`INSERT INTO hw_question (id, organization_id, assignment_id, position, type, prompt, marks) VALUES ($1,$2,$3,0,'short','Name the gas plants take in.',2)`, [q, org, a])
  await raw.query(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks) VALUES ($1,$2,$3,0,'key_point','Carbon dioxide',2)`, [r, org, q])
  await raw.query(`UPDATE hw_assignment SET status = 'published', published_at = now() WHERE id = $1`, [a])
  await raw.query(`INSERT INTO hw_submission (id, organization_id, assignment_id, student_id, status, submitted_at) VALUES ($1,$2,$3,$4,$5,now())`, [s, org, a, userId, o.status ?? 'ready_for_review'])
  await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status, transcript_confidence, failure_reason) VALUES ($1,$2,$3,$4,'ink','Carbon dioxide',$5,$6,$7)`,
    [ans, org, s, q, o.transcriptStatus ?? 'done', o.transcriptConfidence === undefined ? 0.95 : o.transcriptConfidence, o.transcriptStatus === 'needs_review' ? 'unclear' : null])
  const sug = o.suggestion === undefined ? { confidence: 0.95, marks: 2 } : o.suggestion
  if (sug) {
    await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence) VALUES ($1,$2,$3,'gpt-6-luna','grade-strict.v2',1,$4,$5,$6)`,
      [randomUUID(), org, ans, JSON.stringify([{ rubric_item_id: r, verdict: 'met', quote: 'Carbon dioxide', marks: sug.marks, confidence: 'high' }]), sug.marks, sug.confidence])
  }
  return { org, assignmentId: a, questionId: q, rubricId: r, submissionId: s, answerId: ans }
}
const statusOf = async (submissionId: string) => (await one<{ status: string }>(`SELECT status FROM hw_submission WHERE id = $1`, [submissionId])).status
const spent = async (userId: string) => Number((await one<{ spent_paise: string }>(`SELECT spent_paise FROM hw_practice_trial WHERE user_id = $1`, [userId])).spent_paise)

suite('self-practice — integration', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    dbx = await import('@/lib/hw/db')
    trial = await import('@/lib/hw/practice/trial')
    marking = await import('@/lib/hw/services/marking')
    usage = await import('@/lib/hw/cost/usage')
    config._resetHwConfig()
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })

  describe('starting a trial', () => {
    it('creates the practice institution, its ceiling and the trial, and enrolls the learner nowhere yet', async () => {
      const u = await addUser('learner')
      const r = await trial.startTrial(u)
      expect(r.started).toBe(true)
      expect(await one(`SELECT id FROM organization WHERE id = $1`, [PRACTICE_ORG_ID])).toBeTruthy()
      const q = await one<{ enabled: boolean; monthly_budget_paise: string }>(`SELECT enabled, monthly_budget_paise FROM hw_tenant_quota WHERE organization_id = $1`, [PRACTICE_ORG_ID])
      expect(q.enabled).toBe(true)
      expect(Number(q.monthly_budget_paise)).toBe(200000)
      const t = await one<{ budget_paise: string; started_at: Date; ends_at: Date; state: string }>(`SELECT * FROM hw_practice_trial WHERE user_id = $1`, [u])
      expect(Number(t.budget_paise)).toBe(1000)
      expect(t.state).toBe('active')
      expect(Math.round((t.ends_at.getTime() - t.started_at.getTime()) / 86_400_000)).toBe(7)
      // No shared class: a learner is enrolled only in their own section, when they start a question (attempt.ts).
      expect(await one(`SELECT 1 FROM student_enrollments WHERE user_id = $1`, [u])).toBeUndefined()
      // The learner is not made a member of the practice institution.
      expect(await one(`SELECT 1 FROM member WHERE user_id = $1`, [u])).toBeUndefined()
    })

    it('is idempotent: a second start returns the same trial', async () => {
      const u = await addUser('twice')
      const a = await trial.startTrial(u)
      const b = await trial.startTrial(u)
      expect(b.started).toBe(false)
      expect(b.endsAt.getTime()).toBe(a.endsAt.getTime())
      expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM hw_practice_trial WHERE user_id = $1`, [u])).n)).toBe(1)
    })

    it('is refused for someone who belongs to an institution', async () => {
      const u = await addUser('pupil')
      await addSchoolMember(u)
      await expect(trial.startTrial(u)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      expect(await one(`SELECT 1 FROM hw_practice_trial WHERE user_id = $1`, [u])).toBeUndefined()
    })

    it('is refused while the feature is off', async () => {
      process.env.HW_SELF_PRACTICE_ENABLED = 'false'; config._resetHwConfig()
      try {
        await expect(trial.startTrial(await addUser('early'))).rejects.toMatchObject({ code: 'FEATURE_DISABLED' })
        expect(await trial.isPracticeLearner(dbx.db, await addUser('nobody'))).toBe(false)
      } finally { process.env.HW_SELF_PRACTICE_ENABLED = 'true'; config._resetHwConfig() }
    })

    it('knows who is a practice learner', async () => {
      const u = await addUser('known')
      expect(await trial.isPracticeLearner(dbx.db, u)).toBe(false)
      await trial.startTrial(u)
      expect(await trial.isPracticeLearner(dbx.db, u)).toBe(true)
    })

    it('reports the trial in the learner\'s language', async () => {
      const u = await addUser('status')
      await trial.startTrial(u)
      expect(await trial.trialStatus(u, 'en')).toMatchObject({ enabled: true, started: true, active: true, daysLeft: 7, remainingRupees: 10, message: null })
      const s = await trial.trialStatus(u, 'hi', new Date(Date.now() + 8 * 86_400_000))
      expect(s.active).toBe(false)
      expect(/[ऀ-ॿ]/.test(s.message ?? '')).toBe(true)
    })
  })

  describe('the per-learner budget', () => {
    it('charges a read job\'s cost to the learner whose work it is', async () => {
      const u = await addUser('payer'); await trial.startTrial(u)
      const at = await attempt(u)
      const job = randomUUID()
      await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, submission_id, status) VALUES ($1,$2,'read',$3,'running')`, [job, PRACTICE_ORG_ID, at.submissionId])
      // 100 000 input tokens at $1 per million = $0.10 = Rs 10 at 100 Rs/USD... use a small call: 1 000 tokens in, 100 out.
      await usage.recordUsage(dbx.db, { jobId: job, orgId: PRACTICE_ORG_ID, model: 'gpt-6-luna', usage: { input: 1000, cached: 0, output: 100 }, batch: false, pagesRead: 1 })
      const cost = Number((await one<{ cost_estimate_paise: string }>(`SELECT cost_estimate_paise FROM hw_ai_job WHERE id = $1`, [job])).cost_estimate_paise)
      expect(cost).toBeGreaterThan(0)
      expect(await spent(u)).toBeCloseTo(cost, 4)
    })

    it('charges a grade job (which names a question, not a submission) to the question\'s learner', async () => {
      const u = await addUser('grader'); await trial.startTrial(u)
      const at = await attempt(u)
      const job = randomUUID()
      await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, question_id, status) VALUES ($1,$2,'grade',$3,'running')`, [job, PRACTICE_ORG_ID, at.questionId])
      await usage.recordUsage(dbx.db, { jobId: job, orgId: PRACTICE_ORG_ID, model: 'gpt-6-luna', usage: { input: 2000, cached: 0, output: 200 }, batch: false, answersGraded: 1 })
      expect(await spent(u)).toBeGreaterThan(0)
    })

    it('does not charge anyone for work outside the practice space', async () => {
      const u = await addUser('pupil2'); const school = await addSchoolMember(u)
      await raw.query(`INSERT INTO institution_classes (id, organization_id, name) VALUES ($1,$2,'Class 9')`, [uid('c'), school])
      const startedFor = await addUser('other'); await trial.startTrial(startedFor)
      const at = await attempt(u, { org: school })
      const job = randomUUID()
      await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, submission_id, status) VALUES ($1,$2,'read',$3,'running')`, [job, school, at.submissionId])
      await usage.recordUsage(dbx.db, { jobId: job, orgId: school, model: 'gpt-6-luna', usage: { input: 1000, cached: 0, output: 100 }, batch: false })
      expect(await spent(startedFor)).toBe(0)
      expect(await one(`SELECT 1 FROM hw_practice_trial WHERE user_id = $1`, [u])).toBeUndefined()
    })

    it('stops further steps once the money is spent, and marks the trial used up', async () => {
      const u = await addUser('spender'); await trial.startTrial(u)
      const at = await attempt(u)
      await expect(trial.requireUsableTrial(dbx.db, u)).resolves.toBeUndefined()
      const job = randomUUID()
      await raw.query(`INSERT INTO hw_ai_job (id, organization_id, kind, submission_id, status) VALUES ($1,$2,'read',$3,'running')`, [job, PRACTICE_ORG_ID, at.submissionId])
      await usage.recordUsage(dbx.db, { jobId: job, orgId: PRACTICE_ORG_ID, model: 'gpt-6-luna', usage: { input: 0, cached: 0, output: 0 }, batch: false, costUsd: 0.10 }) // Rs 10 at 100 Rs/USD
      expect(await spent(u)).toBeCloseTo(1000, 3)
      expect((await one<{ state: string }>(`SELECT state FROM hw_practice_trial WHERE user_id = $1`, [u])).state).toBe('used_up')
      await expect(trial.requireUsableTrial(dbx.db, u)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
      const err = await trial.requireUsableTrial(dbx.db, u).catch((e) => e)
      expect(err.publicMessage).toContain('free trial') // English
      expect(/[ऀ-ॿ]/.test(err.publicMessage)).toBe(true) // and Hindi
    })

    it('stops when the seven days are over', async () => {
      const u = await addUser('late'); await trial.startTrial(u)
      await expect(trial.requireUsableTrial(dbx.db, u, new Date(Date.now() + 8 * 86_400_000))).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' })
    })

    it('refuses a read or mark for a learner without budget, and only inside the practice space', async () => {
      const broke = await addUser('broke'); await trial.startTrial(broke)
      await raw.query(`UPDATE hw_practice_trial SET spent_paise = 999.5 WHERE user_id = $1`, [broke])
      const fine = await addUser('fine'); await trial.startTrial(fine)
      const a = await attempt(broke), b = await attempt(fine)
      const refusals = await trial.practiceRefusals(dbx.db, PRACTICE_ORG_ID, [a.answerId, b.answerId])
      expect([...refusals.keys()]).toEqual([a.answerId])
      expect(refusals.get(a.answerId)).toContain('free trial')
      // The same ids asked about as if they belonged to another institution: nothing is refused.
      expect((await trial.practiceRefusals(dbx.db, 'some-school', [a.answerId])).size).toBe(0)
    })
  })

  describe('returning practice work without a teacher', () => {
    it('gives the AI marks to a fully suggested, confident submission and returns it', async () => {
      const u = await addUser('r1'); await trial.startTrial(u)
      const at = await attempt(u)
      expect(await marking.releasePracticeSubmissions()).toBeGreaterThanOrEqual(1)
      expect(await statusOf(at.submissionId)).toBe('returned')
      const g = await one<{ marks: string; source: string; graded_by: string; ai_grade_id: string }>(`SELECT * FROM hw_grade WHERE answer_id = $1`, [at.answerId])
      expect(Number(g.marks)).toBe(2)
      expect(g.graded_by).toBe(u) // graded_by is a foreign key to a user: the learner; source accepted_ai in the practice institution = no teacher
      expect(g.source).toBe('accepted_ai')
      expect(g.ai_grade_id).toBeTruthy()
    })

    it('is not starved by held-back work: many unmarkable submissions do not stop a fresh one being returned', async () => {
      const u = await addUser('r0'); await trial.startTrial(u)
      // 120 submissions that will never be released (no suggestion yet, and a low-confidence one), all older than the fresh one.
      for (let i = 0; i < 100; i++) await attempt(u, { suggestion: null })
      for (let i = 0; i < 20; i++) await attempt(u, { suggestion: { confidence: 0.3, marks: 2 } })
      const fresh = await attempt(u)
      await marking.releasePracticeSubmissions()
      expect(await statusOf(fresh.submissionId)).toBe('returned')
    })

    it('holds work back when the AI is not confident', async () => {
      const u = await addUser('r2'); await trial.startTrial(u)
      const at = await attempt(u, { suggestion: { confidence: 0.5, marks: 2 } })
      await marking.releasePracticeSubmissions()
      expect(await statusOf(at.submissionId)).toBe('ready_for_review')
      expect(await one(`SELECT 1 FROM hw_grade WHERE answer_id = $1`, [at.answerId])).toBeUndefined()
    })

    it('holds work back when the reader was unsure of the handwriting', async () => {
      const u = await addUser('r3'); await trial.startTrial(u)
      const unsure = await attempt(u, { transcriptStatus: 'needs_review' })
      const lowRead = await attempt(u, { transcriptConfidence: 0.4 })
      await marking.releasePracticeSubmissions()
      expect(await statusOf(unsure.submissionId)).toBe('ready_for_review')
      expect(await statusOf(lowRead.submissionId)).toBe('ready_for_review')
    })

    it('holds work back when there is no suggestion (AI off, not eligible, or refused)', async () => {
      const u = await addUser('r4'); await trial.startTrial(u)
      const at = await attempt(u, { suggestion: null })
      await marking.releasePracticeSubmissions()
      expect(await statusOf(at.submissionId)).toBe('ready_for_review')
    })

    it('never touches work in an ordinary institution', async () => {
      const u = await addUser('r5'); const school = await addSchoolMember(u)
      await raw.query(`INSERT INTO institution_classes (id, organization_id, name) VALUES ($1,$2,'Class 9')`, [uid('c'), school])
      const at = await attempt(u, { org: school })
      await marking.releasePracticeSubmissions()
      expect(await statusOf(at.submissionId)).toBe('ready_for_review')
      expect(await one(`SELECT 1 FROM hw_grade WHERE answer_id = $1`, [at.answerId])).toBeUndefined()
    })

    it('does nothing while the feature is off', async () => {
      const u = await addUser('r6'); await trial.startTrial(u)
      const at = await attempt(u)
      process.env.HW_SELF_PRACTICE_ENABLED = 'false'; config._resetHwConfig()
      try {
        expect(await marking.releasePracticeSubmissions()).toBe(0)
        expect(await statusOf(at.submissionId)).toBe('ready_for_review')
      } finally { process.env.HW_SELF_PRACTICE_ENABLED = 'true'; config._resetHwConfig() }
    })

    it('shows the learner the result with the "AI practice estimate" label in both languages', async () => {
      const subs = await import('@/lib/hw/services/submissions')
      const u = await addUser('r7'); await trial.startTrial(u)
      const at = await attempt(u)
      await marking.releasePracticeSubmissions()
      const res = await subs.myResult({ userId: u, orgId: PRACTICE_ORG_ID, role: 'student', isPlatformStaff: false }, at.submissionId)
      expect(res.practiceEstimate?.label.en).toBe('AI practice estimate')
      expect(/[ऀ-ॿ]/.test(res.practiceEstimate?.label.hi ?? '')).toBe(true)
      expect(res.total).toBe(2)
    })
  })
  describe('who the caller is', () => {
    const as = (id: string) => { mockSession = { user: { id, role: 'student' }, session: { activeOrganizationId: null } } }
    afterEach(() => { mockSession = null })

    it('an independent learner with a trial works in the practice space as a student', async () => {
      const { resolveHwActor } = await import('@/lib/hw/access/actor')
      const u = await addUser('actor1'); await trial.startTrial(u); as(u)
      expect(await resolveHwActor(new Headers())).toEqual({ userId: u, orgId: PRACTICE_ORG_ID, role: 'student', isPlatformStaff: false })
    })
    it('a member of one institution is still in that institution', async () => {
      const { resolveHwActor } = await import('@/lib/hw/access/actor')
      const u = await addUser('actor2'); const school = await addSchoolMember(u); as(u)
      expect(await resolveHwActor(new Headers())).toMatchObject({ userId: u, orgId: school, role: 'student' })
    })
    it('someone with no institution and no trial has no access', async () => {
      const { resolveHwActor } = await import('@/lib/hw/access/actor')
      const u = await addUser('actor3'); as(u)
      await expect(resolveHwActor(new Headers())).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
    it('the practice space cannot be entered by naming it in a header', async () => {
      const { resolveHwActor } = await import('@/lib/hw/access/actor')
      const u = await addUser('actor4'); await trial.startTrial(u); as(u)
      await expect(resolveHwActor(new Headers({ 'x-org-id': PRACTICE_ORG_ID }))).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })
    it('the practice space is closed again when the feature is switched off', async () => {
      const { resolveHwActor } = await import('@/lib/hw/access/actor')
      const u = await addUser('actor5'); await trial.startTrial(u); as(u)
      process.env.HW_SELF_PRACTICE_ENABLED = 'false'; config._resetHwConfig()
      try { await expect(resolveHwActor(new Headers())).rejects.toMatchObject({ code: 'FORBIDDEN' }) }
      finally { process.env.HW_SELF_PRACTICE_ENABLED = 'true'; config._resetHwConfig() }
    })
  })
})
