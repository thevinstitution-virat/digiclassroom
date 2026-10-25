/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Handwritten Assignments — integration tests against a real Postgres with migration 014
// applied, the real services, job queue, reader and grader. Only two edges are faked:
//   - R2 (in-memory store, same key checks),
//   - the Gemini SDK client (returns responses shaped like the real API, with usage).
//
// Needs a throwaway database:
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/integration
// Without it the suite is skipped, and says so.

import { gzipSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { encodeInk } from '@/lib/hw/ink/stroke-format'
import { encodeGreyPng } from '@/components/hw/ink/png-encode'
import type { HwActor } from '@/lib/hw/access/policy'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 014.')

// ── Fake R2 ──────────────────────────────────────────────────────────────────
jest.mock('../../../../../packages/core/src/lib/hw/storage/r2', () => {
  const { assertHwKey } = jest.requireActual('../../../../../packages/core/src/lib/hw/storage/keys')
  const store = new Map<string, Uint8Array>()
  return {
    __store: store,
    async putHwObject(key: string, body: Uint8Array) { assertHwKey(key); store.set(key, body) },
    async getHwObject(key: string) {
      assertHwKey(key)
      const v = store.get(key)
      if (!v) throw new Error(`no object ${key}`)
      return v
    },
    async signedReadUrl(key: string) { assertHwKey(key); return `https://signed.test/${key}` },
  }
})

// ── Fake Gemini ──────────────────────────────────────────────────────────────
type Req = { model: string; contents: { parts: { text?: string; inlineData?: unknown }[] }[]; config: { systemInstruction: string } }
interface ReadPlan { text: string; confidence?: 'high' | 'medium' | 'low' }
const gem = {
  calls: [] as { model: string; kind: 'read' | 'grade' | 'rubric' }[],
  read: new Map<string, ReadPlan>(), // answerId -> what the reader "sees"
  readByModel: new Map<string, Map<string, ReadPlan>>(), // per-model override (escalation)
  gradeQuote: (transcript: string) => transcript.split(/\s+/).slice(0, 3).join(' '),
  fail: null as null | 'throw' | 'badjson',
  batches: new Map<string, Req[]>(),
}

function respond(model: string, body: unknown, usage = { promptTokenCount: 1000, candidatesTokenCount: 120, thoughtsTokenCount: 30, cachedContentTokenCount: 200 }) {
  return {
    modelVersion: model,
    usageMetadata: usage,
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: typeof body === 'string' ? body : JSON.stringify(body) }] } }],
  }
}

function handle(req: Req) {
  const sys = req.config.systemInstruction
  const kind: 'read' | 'grade' | 'rubric' = sys.startsWith('You transcribe') ? 'read' : sys.startsWith('You help a school teacher mark') ? 'grade' : 'rubric'
  gem.calls.push({ model: req.model, kind })
  if (gem.fail === 'throw') throw new Error('503 UNAVAILABLE (fake)')
  if (gem.fail === 'badjson') return respond(req.model, 'this is not json')
  const parts = req.contents[0].parts
  if (kind === 'read') {
    const ids = parts.map((p) => p.text?.match(/^Answer id: (\S+)/)?.[1]).filter(Boolean) as string[]
    const plans = gem.readByModel.get(req.model) ?? gem.read
    return respond(req.model, {
      answers: ids.map((id) => {
        const p = plans.get(id) ?? { text: '' }
        return { answer_id: id, text: p.text, language: 'en', confidence: p.confidence ?? 'high', blank: !p.text }
      }),
    })
  }
  if (kind === 'grade') {
    const text = parts.map((p) => p.text ?? '').join('\n')
    const rubric = [...text.matchAll(/- id: (\S+) \| marks: ([\d.]+)/g)].map((m) => ({ id: m[1], marks: Number(m[2]) }))
    const answers = [...text.matchAll(/<student_answer id="([^"]+)">\n([\s\S]*?)\n<\/student_answer>/g)].map((m) => ({ id: m[1], transcript: m[2] }))
    return respond(req.model, {
      results: answers.map((a) => ({
        answer_id: a.id,
        items: rubric.map((r) => ({ rubric_item_id: r.id, verdict: 'met', quote: gem.gradeQuote(a.transcript), marks: r.marks, confidence: 'high' })),
      })),
    })
  }
  return respond(req.model, { items: [{ kind: 'key_point', description: 'Drafted point', marks: 1 }] })
}

const fakeClient = {
  models: { generateContent: async (req: Req) => handle(req) },
  batches: {
    create: async ({ src }: { model: string; src: (Req & { metadata: { key: string } })[] }) => {
      const name = `batches/fake-${randomUUID()}`
      gem.batches.set(name, src)
      return { name }
    },
    get: async ({ name }: { name: string }) => {
      const src = gem.batches.get(name) as unknown as ({ contents: Req['contents']; config: Req['config']; metadata: { key: string } })[]
      return {
        state: 'JOB_STATE_SUCCEEDED',
        dest: { inlinedResponses: src.map((r) => ({ metadata: r.metadata, response: handle({ model: 'gemini-3.5-flash-lite', contents: r.contents, config: r.config }) })) },
      }
    },
  },
}

// ── Environment (before any feature module loads) ────────────────────────────
Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '',
  HW_FEATURE_DEFAULT_ENABLED: 'false',
  GEMINI_API_KEY: 'fake-key-for-tests',
  HW_READ_MODEL: 'gemini-3.5-flash-lite',
  HW_ESCALATE_MODEL: 'gemini-3.6-flash',
  HW_GRADE_MODEL: 'gemini-3.5-flash-lite',
  HW_RUBRIC_MODEL: 'gemini-3.5-flash-lite',
  HW_BATCH_ENABLED: 'false',
  HW_GRADE_DEBOUNCE_SECONDS: '0',
  HW_BATCH_POLL_SECONDS: '10',
  HW_PRICE_TABLE_JSON: JSON.stringify({ inr_per_usd: 84, models: { 'gemini-3.5-flash-lite': { input: 0.3, cached: 0.03, output: 2.5, batch_input: 0.15, batch_output: 1.25 }, 'gemini-3.6-flash': { input: 0.75, cached: 0.075, output: 3.75 } } }),
})

// Loaded in beforeAll, after the environment is set.
let svc: {
  assignments: typeof import('@/lib/hw/services/assignments')
  submissions: typeof import('@/lib/hw/services/submissions')
  marking: typeof import('@/lib/hw/services/marking')
  runner: typeof import('@/lib/hw/jobs/runner')
  gemini: typeof import('@/lib/hw/gemini/client')
  config: typeof import('@/lib/hw/config')
  guards: typeof import('@/lib/hw/access/guards')
  pool: import('pg').Pool
}
let raw: Pool

async function drainAll(passes = 3) {
  for (let i = 0; i < passes; i++) {
    await raw.query(`UPDATE hw_ai_job SET run_after = now() WHERE status IN ('queued', 'batch_pending')`)
    const s = await svc.runner.drain('itest', 20_000)
    if (s.errors.length) throw new Error(s.errors.join('; '))
  }
}

interface World { org: string; teacher: HwActor; admin: HwActor; s1: HwActor; s2: HwActor; classId: string }

/** A fresh institution per test, so tests never see each other's rows. */
async function makeWorld(quota = 1000): Promise<World> {
  const org = `it-${randomUUID().slice(0, 8)}`
  const u = (k: string) => `${org}-${k}`
  for (const [k, role] of [['t', 'teacher'], ['a', 'owner'], ['s1', 'student'], ['s2', 'student']] as const) {
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)`, [u(k), `User ${k}`, `${u(k)}@example.test`, role === 'teacher' ? 'teacher' : 'student'])
  }
  await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org])
  for (const [k, role] of [['t', 'teacher'], ['a', 'owner'], ['s1', 'student'], ['s2', 'student']]) {
    await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`, [`m-${u(k)}`, org, u(k), role])
  }
  const classId = `${org}-c9`
  await raw.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ($1, $2, 'Class 9', 9)`, [classId, org])
  for (const k of ['s1', 's2']) {
    await raw.query(`INSERT INTO student_enrollments (id, organization_id, user_id, class_id, status) VALUES ($1, $2, $3, $4, 'active')`, [`e-${u(k)}`, org, u(k), classId])
  }
  await raw.query(`INSERT INTO hw_class_teacher (id, organization_id, class_id, teacher_id, subject) VALUES ($1, $2, $3, $4, 'Science')`, [`l-${org}`, org, classId, u('t')])
  await raw.query(`INSERT INTO hw_tenant_quota (organization_id, enabled, monthly_answer_quota) VALUES ($1, true, $2)`, [org, quota])
  const actor = (k: string, role: HwActor['role']): HwActor => ({ userId: u(k), orgId: org, role, isPlatformStaff: false })
  return { org, classId, teacher: actor('t', 'teacher'), admin: actor('a', 'admin'), s1: actor('s1', 'student'), s2: actor('s2', 'student') }
}

/** Teacher builds and publishes: Q1 very short with accepted answers, Q2 short with two key points. */
async function publishedAssignment(w: World) {
  const { id } = await svc.assignments.createAssignment(w.teacher, { classId: w.classId, sectionId: null, subject: 'Science', title: 'Photosynthesis', allowedModes: ['typed', 'ink'] })
  const q1 = await svc.assignments.addQuestion(w.teacher, id, { type: 'very_short', prompt: 'Capital of India?', marks: 1, acceptedAnswers: ['New Delhi', 'नई दिल्ली'] })
  const q2 = await svc.assignments.addQuestion(w.teacher, id, { type: 'short', prompt: 'What is photosynthesis?', marks: 2, modelAnswer: 'Plants make food using sunlight.' })
  await svc.assignments.setRubric(w.teacher, q2.id, [
    { kind: 'key_point', description: 'Plants make their own food', marks: 1 },
    { kind: 'key_point', description: 'Uses sunlight', marks: 1 },
  ])
  const pub = await svc.assignments.publishAssignment(w.teacher, id)
  return { id, q1: q1.id, q2: q2.id, totalMarks: pub.totalMarks }
}

async function inkFiles() {
  const doc = { w: 600, h: 300, strokes: [{ t0: 0, tool: 'pen' as const, points: [{ x: 10, y: 20, p: 0.5, t: 0 }, { x: 60, y: 40, p: 0.6, t: 16 }, { x: 120, y: 30, p: 0.5, t: 32 }] }] }
  const ink = new Uint8Array(gzipSync(JSON.stringify(encodeInk(doc))))
  const png = await encodeGreyPng(new Uint8Array(400 * 100).fill(255), 400, 100)
  return { ink, png }
}

/** Student answers Q1 typed and Q2 in ink, and hands in. Returns ids. */
async function studentHandsIn(w: World, a: Awaited<ReturnType<typeof publishedAssignment>>, student = w.s1, q1Text = 'new delhi.') {
  const started = await svc.submissions.startSubmission(student, a.id)
  const sid = started.submission.id
  await svc.submissions.saveAnswer(student, sid, a.q1, { mode: 'typed', typedText: q1Text, timeSpentMs: 30_000 })
  const { ink, png } = await inkFiles()
  await svc.submissions.storeInk(student, sid, a.q2, ink, png)
  const res = await svc.submissions.submit(student, sid)
  const { rows } = await raw.query(`SELECT id, question_id FROM hw_answer WHERE submission_id = $1`, [sid])
  const answerOf = (qid: string) => rows.find((r) => r.question_id === qid).id as string
  return { sid, status: res.status, a1: answerOf(a.q1), a2: answerOf(a.q2) }
}

suite('handwritten assignments — integration', () => {
  jest.setTimeout(60_000)

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    svc = {
      assignments: await import('@/lib/hw/services/assignments'),
      submissions: await import('@/lib/hw/services/submissions'),
      marking: await import('@/lib/hw/services/marking'),
      runner: await import('@/lib/hw/jobs/runner'),
      gemini: await import('@/lib/hw/gemini/client'),
      config: await import('@/lib/hw/config'),
      guards: await import('@/lib/hw/access/guards'),
      pool: db.getPool(),
    }
    svc.gemini._setGeminiClient(fakeClient as never)
  })

  beforeEach(() => {
    gem.calls = []
    gem.read = new Map()
    gem.readByModel = new Map()
    gem.gradeQuote = (t) => t.split(/\s+/).slice(0, 3).join(' ')
    gem.fail = null
    process.env.HW_BATCH_ENABLED = 'false'
    svc.config._resetHwConfig()
  })

  afterAll(async () => {
    await raw?.end()
    await svc?.pool.end()
  })

  it('full flow: build → answer (typed + ink) → read → grade → teacher accepts → return → result', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    expect(a.totalMarks).toBe(3)

    const h = await studentHandsIn(w, a)
    expect(h.status).toBe('processing')
    gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })

    await drainAll()

    const sub = (await raw.query(`SELECT status FROM hw_submission WHERE id = $1`, [h.sid])).rows[0]
    expect(sub.status).toBe('ready_for_review')

    const ans = (await raw.query(`SELECT id, transcript, transcript_status, reader_engine, reader_tier FROM hw_answer WHERE submission_id = $1`, [h.sid])).rows
    const ink = ans.find((r) => r.id === h.a2)
    expect(ink).toMatchObject({ transcript: 'plants make food from sun lite', transcript_status: 'done', reader_tier: 1 })
    expect(ink.reader_engine).toContain('gemini-3.5-flash-lite')

    // One read call for the whole submission, one grade call for Q2; Q1 marked by exact match, no AI.
    expect(gem.calls.filter((c) => c.kind === 'read')).toHaveLength(1)
    expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(1)
    const sugg = (await raw.query(`SELECT answer_id, model, suggested_marks::float AS m, rubric_version FROM hw_ai_grade WHERE answer_id = ANY($1)`, [[h.a1, h.a2]])).rows
    expect(sugg.find((s) => s.answer_id === h.a1)).toMatchObject({ model: 'exact_match', m: 1 })
    expect(sugg.find((s) => s.answer_id === h.a2)).toMatchObject({ m: 2 })

    // AI never finalises a mark.
    expect((await raw.query(`SELECT count(*)::int AS n FROM hw_grade WHERE answer_id = ANY($1)`, [[h.a1, h.a2]])).rows[0].n).toBe(0)

    // Real usage recorded on the jobs and rolled up for the month.
    const jobs = (await raw.query(`SELECT kind, status, tokens_in, tokens_cached, tokens_out, cost_estimate_paise::float AS paise FROM hw_ai_job WHERE organization_id = $1`, [w.org])).rows
    expect(jobs.every((j) => j.status === 'done')).toBe(true)
    for (const j of jobs.filter((x) => x.tokens_in > 0)) {
      expect(j).toMatchObject({ tokens_in: '1000', tokens_cached: '200', tokens_out: '150' })
      expect(j.paise).toBeGreaterThan(0)
    }
    const usage = (await raw.query(`SELECT pages_read, answers_graded, tokens_in::int AS t FROM hw_ai_usage_monthly WHERE organization_id = $1`, [w.org])).rows[0]
    expect(usage).toMatchObject({ pages_read: 1, answers_graded: 1, t: 2000 })

    // Teacher accepts both suggestions, returns the work.
    const queue1 = await svc.marking.questionQueue(w.teacher, a.q1, 'all')
    const queue2 = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
    await svc.marking.acceptAiGrade(w.teacher, h.a1, queue1.answers[0].suggestion!.id)
    await svc.marking.acceptAiGrade(w.teacher, h.a2, queue2.answers[0].suggestion!.id)
    const grades = (await raw.query(`SELECT source, graded_by FROM hw_grade WHERE answer_id = ANY($1)`, [[h.a1, h.a2]])).rows
    expect(grades).toHaveLength(2)
    expect(grades.every((g) => g.source === 'accepted_ai' && g.graded_by === w.teacher.userId)).toBe(true)

    // Not visible to the student until returned.
    await expect(svc.submissions.myResult(w.s1, h.sid)).rejects.toMatchObject({ code: 'CONFLICT' })
    const ret = await svc.marking.returnAssignment(w.teacher, a.id)
    expect(ret).toEqual({ returned: 1, notYetGraded: 0 })
    const result = await svc.submissions.myResult(w.s1, h.sid)
    expect(result.total).toBe(3)
    expect(result.questions[1].keyPoints.map((k) => k.marks)).toEqual([1, 1])

    // Files only under the feature prefix.
    const store = (jest.requireMock('../../../../../packages/core/src/lib/hw/storage/r2') as { __store: Map<string, Uint8Array> }).__store
    const keys = [...store.keys()].filter((k) => k.includes(w.org))
    expect(keys.length).toBe(2)
    expect(keys.every((k) => k.startsWith(`hw-assignments/${w.org}/${a.id}/${h.sid}/${a.q2}/`))).toBe(true)
  })

  it('access: a student cannot read another student’s work; another institution sees nothing', async () => {
    const w = await makeWorld()
    const other = await makeWorld()
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    await expect(svc.guards.submissionForView(w.s2, h.sid)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(svc.submissions.myResult(w.s2, h.sid)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(svc.marking.answerDetail(other.teacher, h.a1)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(svc.assignments.getForManage(other.admin, a.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // A student never receives model answers or accepted answers.
    const started = await svc.submissions.startSubmission(w.s2, a.id)
    expect(JSON.stringify(started.questions)).not.toMatch(/New Delhi|modelAnswer|acceptedAnswers|sunlight/)
  })

  it('provider error: retried, then the job fails with a visible reason and answers go to the teacher', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    gem.fail = 'throw'
    await drainAll(4)
    const job = (await raw.query(`SELECT status, attempts, error FROM hw_ai_job WHERE submission_id = $1 AND kind = 'read'`, [h.sid])).rows[0]
    expect(job).toMatchObject({ status: 'failed', attempts: 3 })
    expect(job.error).toMatch(/503 UNAVAILABLE/)
    const ans = (await raw.query(`SELECT transcript_status, failure_reason FROM hw_answer WHERE id = $1`, [h.a2])).rows[0]
    expect(ans.transcript_status).toBe('failed')
    expect(ans.failure_reason).toMatch(/Reading failed/)
    expect((await raw.query(`SELECT status FROM hw_submission WHERE id = $1`, [h.sid])).rows[0].status).toBe('ready_for_review')
  })

  it('invalid JSON from the reader: failed at once (not retried), with the reason recorded and tokens still counted', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    gem.fail = 'badjson'
    await drainAll(2)
    const job = (await raw.query(`SELECT status, attempts, error, tokens_in FROM hw_ai_job WHERE submission_id = $1 AND kind = 'read'`, [h.sid])).rows[0]
    expect(job).toMatchObject({ status: 'failed', attempts: 1, tokens_in: '1000' })
    expect(job.error).toMatch(/INVALID_PROVIDER_OUTPUT/)
  })

  it('invented quote: the item is downgraded to missing with a validation note', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    gem.read.set(h.a2, { text: 'plants make food from sun lite' })
    gem.gradeQuote = () => 'chlorophyll absorbs light energy'
    await drainAll()
    const g = (await raw.query(`SELECT items, suggested_marks::float AS m, validation_notes FROM hw_ai_grade WHERE answer_id = $1`, [h.a2])).rows[0]
    expect(g.m).toBe(0)
    expect(g.items.every((i: { verdict: string }) => i.verdict === 'missing')).toBe(true)
    expect(g.validation_notes.join(' ')).toMatch(/quote not found/)
  })

  it('quota exceeded: no AI call is made; answers wait for the teacher with the reason', async () => {
    const w = await makeWorld(0)
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    await drainAll()
    expect(gem.calls).toHaveLength(0)
    const ans = (await raw.query(`SELECT transcript_status, failure_reason FROM hw_answer WHERE id = $1`, [h.a2])).rows[0]
    expect(ans.transcript_status).toBe('needs_review')
    expect(ans.failure_reason).toMatch(/AI is switched off/)
    // The typed exact-match answer was still marked for free.
    expect((await raw.query(`SELECT model FROM hw_ai_grade WHERE answer_id = $1`, [h.a1])).rows[0].model).toBe('exact_match')
  })

  it('escalation: a doubtful tier-1 read goes to tier 2; still doubtful → needs_review with a reason', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    gem.read.set(h.a2, { text: 'pl[?]nts m[?]ke', confidence: 'low' })
    gem.readByModel.set('gemini-3.6-flash', new Map([[h.a2, { text: 'pl[?]nts make [?]', confidence: 'low' }]]))
    await drainAll(4)
    const reads = gem.calls.filter((c) => c.kind === 'read').map((c) => c.model)
    expect(reads).toEqual(['gemini-3.5-flash-lite', 'gemini-3.6-flash'])
    const ans = (await raw.query(`SELECT transcript, transcript_status, reader_tier, failure_reason FROM hw_answer WHERE id = $1`, [h.a2])).rows[0]
    expect(ans).toMatchObject({ transcript: 'pl[?]nts make [?]', transcript_status: 'needs_review', reader_tier: 2 })
    expect(ans.failure_reason).toMatch(/Hard to read/)
    // Not graded until the teacher fixes or confirms the transcript.
    expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(0)
    await svc.marking.fixTranscript(w.teacher, h.a2, { text: 'plants make food' })
    await drainAll()
    expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(1)
    const revs = (await raw.query(`SELECT source FROM hw_transcript_revision WHERE answer_id = $1 ORDER BY created_at`, [h.a2])).rows.map((r) => r.source)
    expect(revs).toEqual(['reader', 'teacher_edit'])
  })

  it('batch mode: reads and grades go through the Batch API and apply when the batch finishes', async () => {
    process.env.HW_BATCH_ENABLED = 'true'
    svc.config._resetHwConfig()
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    const h1 = await studentHandsIn(w, a, w.s1)
    const h2 = await studentHandsIn(w, a, w.s2)
    gem.read.set(h1.a2, { text: 'plants make food using sunlight' })
    gem.read.set(h2.a2, { text: 'plants use sunlight to make food' })
    await drainAll(4)
    // Both submissions' reads shared one provider batch.
    const readBatches = (await raw.query(`SELECT DISTINCT batch_ref FROM hw_ai_job WHERE organization_id = $1 AND kind = 'read'`, [w.org])).rows
    expect(readBatches).toHaveLength(1)
    const jobs = (await raw.query(`SELECT kind, status FROM hw_ai_job WHERE organization_id = $1`, [w.org])).rows
    expect(jobs.every((j) => j.status === 'done')).toBe(true)
    expect((await raw.query(`SELECT count(*)::int AS n FROM hw_ai_grade WHERE answer_id = ANY($1)`, [[h1.a2, h2.a2]])).rows[0].n).toBe(2)
  })

  it('bulk accept requires the confirmed count to still match', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w)
    const h = await studentHandsIn(w, a)
    gem.read.set(h.a2, { text: 'plants make food from sunlight' })
    await drainAll()
    const preview = await svc.marking.bulkAcceptPreview(w.teacher, a.q2)
    expect(preview.count).toBe(1)
    await expect(svc.marking.bulkAccept(w.teacher, a.q2, 5)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(svc.marking.bulkAccept(w.teacher, a.q2, 1)).resolves.toEqual({ accepted: 1 })
  })

  describe('shadow mode and monitoring', () => {
    const CANDIDATE = 'gemini-3.6-flash'
    beforeEach(() => {
      process.env.HW_SHADOW_RATE = '1'
      process.env.HW_SHADOW_CONFIG_JSON = JSON.stringify({ reader: { model: CANDIDATE }, grader: { model: CANDIDATE } })
      svc.config._resetHwConfig()
    })
    afterEach(() => {
      process.env.HW_SHADOW_RATE = '0'
      delete process.env.HW_SHADOW_CONFIG_JSON
      svc.config._resetHwConfig()
    })

    it('the candidate reads and marks live answers into shadow results only; teachers’ changes are monitored', async () => {
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })
      gem.readByModel.set(CANDIDATE, new Map([[h.a2, { text: 'plants make food from sun light', confidence: 'high' }]]))
      await drainAll()

      // Production is exactly what it is without shadow mode.
      const ans = (await raw.query(`SELECT transcript, reader_engine FROM hw_answer WHERE id = $1`, [h.a2])).rows[0]
      expect(ans).toMatchObject({ transcript: 'plants make food from sun lite' })
      expect(ans.reader_engine).toContain('gemini-3.5-flash-lite')
      expect((await raw.query(`SELECT count(*)::int AS n FROM hw_ai_grade WHERE answer_id = $1`, [h.a2])).rows[0].n).toBe(1)

      // The candidate's results are only in hw_eval_shadow_result.
      const sh = (await raw.query(`SELECT kind, status, predicted_transcript, production_transcript, predicted_marks::float AS pm, production_marks::float AS prod, tokens_in, cost_paise::float AS paise
        FROM hw_eval_shadow_result WHERE organization_id = $1 ORDER BY kind`, [w.org])).rows
      expect(sh).toEqual([
        expect.objectContaining({ kind: 'mark', status: 'ok', pm: 2, prod: 2 }),
        expect.objectContaining({ kind: 'read', status: 'ok', predicted_transcript: 'plants make food from sun light', production_transcript: 'plants make food from sun lite' }),
      ])
      expect(sh.every((r) => r.tokens_in > 0 && r.paise > 0)).toBe(true)
      // Q1 was marked by exact match on both sides: no shadow marking call for it.
      expect(gem.calls.filter((c) => c.model === CANDIDATE).map((c) => c.kind).sort()).toEqual(['grade', 'read'])
      // Shadow calls count in the month's usage, as any AI call does.
      expect((await raw.query(`SELECT pages_read, answers_graded FROM hw_ai_usage_monthly WHERE organization_id = $1`, [w.org])).rows[0]).toMatchObject({ pages_read: 2, answers_graded: 2 })

      // Draining again does not run the candidate twice.
      const before = gem.calls.length
      await svc.runner.drain('itest', 5_000)
      expect(gem.calls.length).toBe(before)

      // The teacher accepts Q1 and lowers Q2 by one mark; monitoring and the shadow comparison see it.
      const q1 = await svc.marking.questionQueue(w.teacher, a.q1, 'all')
      const q2 = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      await svc.marking.acceptAiGrade(w.teacher, h.a1, q1.answers[0].suggestion!.id)
      const rubric = (await raw.query(`SELECT id FROM hw_rubric_item WHERE question_id = $1 AND retired_at IS NULL ORDER BY position`, [a.q2])).rows
      await svc.marking.editAiGrade(w.teacher, h.a2, q2.answers[0].suggestion!.id, [{ rubric_item_id: rubric[0].id, marks: 1 }, { rubric_item_id: rubric[1].id, marks: 0 }])
      const monitor = await import('@/lib/hw/shadow/monitor')
      monitor._resetMonitorTick()
      await monitor.monitorTick()
      const day = (await raw.query(`SELECT answers_marked, ai_suggested, overrides, override_abs_sum::float AS abs, question_type FROM hw_eval_monitor_daily WHERE organization_id = $1 ORDER BY question_type`, [w.org])).rows
      expect(day).toEqual([
        { answers_marked: 1, ai_suggested: 1, overrides: 1, abs: 1, question_type: 'short' },
        { answers_marked: 1, ai_suggested: 0, overrides: 0, abs: 0, question_type: 'very_short' },
      ])
      expect((await raw.query(`SELECT final_marks::float AS f FROM hw_eval_shadow_result WHERE answer_id = $1 AND kind = 'mark'`, [h.a2])).rows[0].f).toBe(1)
    })

    it('over quota: the candidate is not run, and says so', async () => {
      const w = await makeWorld(1)
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food', confidence: 'high' })
      await drainAll()
      expect(gem.calls.filter((c) => c.model === CANDIDATE)).toHaveLength(0)
      const sh = (await raw.query(`SELECT kind, status, failure_reason FROM hw_eval_shadow_result WHERE organization_id = $1 AND kind = 'read'`, [w.org])).rows
      expect(sh).toEqual([{ kind: 'read', status: 'failed', failure_reason: 'AI quota reached: not run' }])
    })
  })
})
