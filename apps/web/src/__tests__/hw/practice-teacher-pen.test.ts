/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// The teacher's pen step of the job runner (practice/teacher-pen.ts), against a real Postgres, with a fake model: off by default; once on,
// each released InkBuddy answer gets a checked remark and notes, its cost is a finished job charged to the learner's trial, a failure is
// tried at most twice, and the result page shows the pen with the marking's green quotes. Marks are never touched.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-teacher-pen

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice-teacher-pen] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres.')

Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '', HW_SELF_PRACTICE_ENABLED: 'true', HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000', HW_GRADE_MODEL: 'pen-test-model',
  HW_PRICE_TABLE_JSON: JSON.stringify({ inr_per_usd: 88, models: { 'pen-test-model': { input: 1, cached: 1, output: 4 } } }),
})

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'
import type { AiCall, AiResult } from '@/lib/hw/ai'

let pen: typeof import('@/lib/hw/practice/teacher-pen')
let subs: typeof import('@/lib/hw/services/submissions')
let trial: typeof import('@/lib/hw/practice/trial')
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T
const READING = 'Saliva contains amylace which breaks starch into sugar. Saliva also digests proteins.'
const REMARK = 'You explained well that saliva has an enzyme that breaks down starch. Add that saliva moistens food so it is easy to swallow. Write it again and you will have every point.'
const reply = (json: unknown): AiResult => ({ json, usage: { input: 1000, cached: 0, output: 200 }, rawUsage: {}, model: 'pen-test-model' } as AiResult)

/** A released InkBuddy answer with an AI-accepted mark, as the practice release leaves it. */
async function released(confidence = 0.95) {
  const u = `tp-${randomUUID().slice(0, 8)}`
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, 'Learner', $2, 'student', now())`, [u, `${u}@example.test`])
  await trial.startTrial(u)
  const [a, q, s, ans, ai] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()]
  await raw.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ('vgp-class-10', $1, 'Class 10', 10) ON CONFLICT DO NOTHING`, [PRACTICE_ORG_ID])
  await raw.query(`INSERT INTO hw_assignment (id, organization_id, class_id, subject, title, allowed_modes, created_by) VALUES ($1, $2, 'vgp-class-10', 'Science', 'Practice', '{ink,typed}', $3)`, [a, PRACTICE_ORG_ID, u])
  await raw.query(`INSERT INTO hw_question (id, organization_id, assignment_id, position, type, prompt, marks, language_hint, origin, rubric_mode) VALUES ($1, $2, $3, 0, 'short', 'What is the role of saliva in digestion?', 3, 'en', 'textbook_exercise', 'key')`, [q, PRACTICE_ORG_ID, a])
  const items: string[] = []
  for (const [i, d] of ['Saliva moistens food', 'Contains salivary amylase', 'Amylase breaks starch into sugar'].entries()) {
    const id = randomUUID(); items.push(id)
    await raw.query(`INSERT INTO hw_rubric_item (id, organization_id, question_id, position, kind, description, marks, source) VALUES ($1, $2, $3, $4, 'key_point', $5, 1, 'key')`, [id, PRACTICE_ORG_ID, q, i, d])
  }
  await raw.query(`UPDATE hw_assignment SET status = 'published' WHERE id = $1`, [a])
  await raw.query(`INSERT INTO hw_submission (id, organization_id, assignment_id, student_id, status, submitted_at) VALUES ($1, $2, $3, $4, 'returned', now())`, [s, PRACTICE_ORG_ID, a, u])
  await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status, transcript_confidence) VALUES ($1, $2, $3, $4, 'ink', $5, 'done', $6)`, [ans, PRACTICE_ORG_ID, s, q, READING, confidence])
  await raw.query(`INSERT INTO hw_ai_grade (id, organization_id, answer_id, model, prompt_version, rubric_version, items, suggested_marks, confidence) VALUES ($1, $2, $3, 'm', 'grade.v1', 1, $4::jsonb, 2, 0.9)`, [ai, PRACTICE_ORG_ID, ans, JSON.stringify([
    { rubric_item_id: items[0], verdict: 'missing', quote: '', marks: 0, confidence: 0.9 },
    { rubric_item_id: items[1], verdict: 'met', quote: 'Saliva contains amylace', marks: 1, confidence: 0.9 },
    { rubric_item_id: items[2], verdict: 'met', quote: 'breaks starch into sugar', marks: 1, confidence: 0.9 },
  ])])
  await raw.query(`INSERT INTO hw_grade (answer_id, organization_id, marks, item_marks, source, ai_grade_id, graded_by) VALUES ($1, $2, 2, $3::jsonb, 'accepted_ai', $4, $5)`, [ans, PRACTICE_ORG_ID, JSON.stringify([{ rubric_item_id: items[1], marks: 1 }, { rubric_item_id: items[2], marks: 1 }]), ai, u])
  return { u, s, ans, actor: { userId: u, orgId: PRACTICE_ORG_ID, role: 'student' as const, isPlatformStaff: false } }
}
const stats = async (ans: string) => (await one<{ s: Record<string, unknown> }>(`SELECT ink_stats AS s FROM hw_answer WHERE id = $1`, [ans])).s

suite('InkBuddy teacher\'s pen — integration', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    trial = await import('@/lib/hw/practice/trial')
    pen = await import('@/lib/hw/practice/teacher-pen')
    subs = await import('@/lib/hw/services/submissions')
  })
  beforeEach(() => { delete process.env.HW_TEACHER_PEN_ENABLED; config._resetHwConfig() })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })
  const on = () => { process.env.HW_TEACHER_PEN_ENABLED = 'true'; config._resetHwConfig() }

  it('is off until switched on: no call, nothing written', async () => {
    const r = await released()
    const generate = jest.fn(async (_c: AiCall) => reply({ remark: REMARK, notes: [] }))
    expect(await pen.runTeacherPen({ generate })).toBe(0)
    expect(generate).not.toHaveBeenCalled()
    expect(await stats(r.ans)).not.toHaveProperty('pen')
  })

  it('writes a checked remark and notes, charges the call to the learner\'s trial as a finished job, and never touches the mark', async () => {
    const r = await released()
    on()
    const seen: string[] = []
    const generate = jest.fn(async (c: AiCall) => {
      seen.push(JSON.stringify(c))
      return reply({ remark: REMARK, notes: [
        { kind: 'language', quote: 'amylace', note: 'Check the spelling.', fix: 'amylase' },
        { kind: 'fact', quote: 'also digests proteins', note: 'Saliva does not digest proteins.', fix: 'Proteins are digested in the stomach.' },
        { kind: 'fact', quote: 'saliva makes bile', note: 'Not in the answer.', fix: '' },
      ] })
    })
    const before = Number((await one<{ p: string }>(`SELECT spent_paise AS p FROM hw_practice_trial WHERE user_id = $1`, [r.u])).p)
    expect(await pen.runTeacherPen({ generate }, 50)).toBeGreaterThanOrEqual(1)
    // the input names the points earned and missed, and carries the reading as data
    const text = seen.find((c) => c.includes('What is the role of saliva in digestion?')) ?? ''
    expect(text).toContain('Saliva moistens food (earned 0 of 1)')
    expect(text).toContain('<learner_answer>')
    const s = await stats(r.ans)
    expect(s.pen).toMatchObject({ remark: REMARK, dropped: 1, v: 'teacher-pen.v1' })
    expect((s.pen as { notes: { kind: string }[] }).notes.map((n) => n.kind)).toEqual(['language', 'fact'])
    // the cost is a finished job on the submission, in the usage view, and charged to the trial
    const job = await one<{ status: string; kind: string; error: string; paise: string }>(`SELECT status, kind, error, cost_estimate_paise AS paise FROM hw_ai_job WHERE submission_id = $1 AND payload_ref LIKE '%"pen":true%'`, [r.s])
    expect(job).toMatchObject({ status: 'done', kind: 'grade', error: 'teacher pen' })
    expect(Number(job.paise)).toBeGreaterThan(0)
    expect(Number((await one<{ p: string }>(`SELECT spent_paise AS p FROM hw_practice_trial WHERE user_id = $1`, [r.u])).p)).toBeGreaterThan(before)
    // the mark is untouched
    expect(Number((await one<{ m: string }>(`SELECT marks AS m FROM hw_grade WHERE answer_id = $1`, [r.ans])).m)).toBe(2)
    // written once: the next pass leaves it alone
    const again = jest.fn(async () => reply({ remark: REMARK, notes: [] }))
    await pen.runTeacherPen({ generate: again }, 50)
    expect(again.mock.calls.some((c) => JSON.stringify(c).includes(r.ans))).toBe(false)

    // the result page: the pen and the marking's green quotes
    const res = await subs.myResult(r.actor as never, r.s)
    const q = res.questions[0] as (typeof res.questions)[number] & { pen: { remark: string } | null; points: { verdict: string; quote: string }[] }
    expect(q.pen?.remark).toBe(REMARK)
    expect(q.points).toEqual([{ verdict: 'met', quote: 'Saliva contains amylace' }, { verdict: 'met', quote: 'breaks starch into sugar' }])
  })

  it('an unsure reading gets no spelling notes', async () => {
    const r = await released(0.75)
    on()
    await pen.runTeacherPen({ generate: async () => reply({ remark: REMARK, notes: [{ kind: 'language', quote: 'amylace', note: 'Spelling.', fix: 'amylase' }] }) }, 50)
    expect((await stats(r.ans)).pen).toMatchObject({ notes: [], dropped: 1 })
  })

  it('a failed call is tried again once, then left; the learner still has their mark', async () => {
    const r = await released()
    on()
    const fail = async (): Promise<AiResult> => { throw new Error('provider down') }
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    await pen.runTeacherPen({ generate: fail }, 50)
    expect(await stats(r.ans)).toMatchObject({ penTries: 1, penError: expect.stringContaining('provider down') })
    await pen.runTeacherPen({ generate: fail }, 50)
    expect(await stats(r.ans)).toMatchObject({ penTries: 2 })
    const late = jest.fn(async () => reply({ remark: REMARK, notes: [] }))
    await pen.runTeacherPen({ generate: late }, 50)
    expect(await stats(r.ans)).not.toHaveProperty('pen')
    warn.mockRestore()
  })
})
