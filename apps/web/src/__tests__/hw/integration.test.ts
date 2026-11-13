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
  /** The last "Draft with AI" request: system prompt and user text. */
  lastRubric: null as null | { system: string; text: string },
  batches: new Map<string, Req[]>(),
  /** The picture types the reader was sent. */
  readMimes: [] as string[],
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
    gem.readMimes.push(...parts.filter((p) => p.inlineData).map((p) => (p.inlineData as { mimeType: string }).mimeType))
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
  gem.lastRubric = { system: sys, text: parts.map((p) => p.text ?? '').join(String.fromCharCode(10)) }
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
// This suite's own namespace: its jobs are claimed and polled only by this suite, so suites can run in parallel in one database.
const NS = `it-${randomUUID().slice(0, 6)}-`
Object.assign(process.env, {
  HW_JOB_ORG_PREFIX: NS,
  DATABASE_URL: DB_URL ?? '',
  HW_FEATURE_DEFAULT_ENABLED: 'false',
  GEMINI_API_KEY: 'fake-key-for-tests',
  HW_READ_MODEL: 'gemini-3.5-flash-lite',
  HW_ESCALATE_MODEL: 'gemini-3.6-flash',
  HW_GRADE_MODEL: 'gemini-3.5-flash-lite',
  HW_RUBRIC_MODEL: 'gemini-3.5-flash-lite',
  HW_BATCH_ENABLED: 'false',
  HW_ELIGIBILITY_ENFORCED: 'false', // these suites exercise marking itself; the registry has its own tests (eligibility.test.ts)
  HW_GRADE_DEBOUNCE_SECONDS: '0',
  HW_BATCH_POLL_SECONDS: '10',
  HW_PRICE_TABLE_JSON: JSON.stringify({ inr_per_usd: 84, models: { 'gemini-3.5-flash-lite': { input: 0.3, cached: 0.03, output: 2.5, batch_input: 0.15, batch_output: 1.25 }, 'gemini-3.6-flash': { input: 0.75, cached: 0.075, output: 3.75 }, 'openai/gpt-5.4-mini': { input: 0.75, cached: 0.075, output: 4.5 }, 'text-embedding-3-small': { input: 0.02, cached: 0, output: 0 } } }),
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
  const org = `${NS}${randomUUID().slice(0, 8)}`
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
async function publishedAssignment(w: World, allowedModes: ('typed' | 'ink' | 'photo')[] = ['typed', 'ink']) {
  const { id } = await svc.assignments.createAssignment(w.teacher, { classId: w.classId, sectionId: null, subject: 'Science', title: 'Photosynthesis', allowedModes })
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
    gem.lastRubric = null
    gem.readMimes = []
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

  it('photo answer: checked, stored with its real type, read as that type instead of earlier writing, shown to the teacher', async () => {
    const w = await makeWorld()
    // the smallest bytes the server reads as a JPEG of this size
    const jpeg = (width: number, height: number) => { const b = new Uint8Array(2048); b.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff]); return b }
    const sharp = { sharpness: 0.6, brightness: 0.6, glare: 0.01, override: false }

    // a school assignment takes photos only when the teacher allowed them
    const inkOnly = await publishedAssignment(w)
    const s0 = (await svc.submissions.startSubmission(w.s2, inkOnly.id)).submission.id
    await expect(svc.submissions.storePhoto(w.s2, s0, inkOnly.q2, jpeg(1200, 1600), sharp)).rejects.toThrow(/does not accept photos/)

    const a = await publishedAssignment(w, ['typed', 'ink', 'photo'])
    const sid = (await svc.submissions.startSubmission(w.s1, a.id)).submission.id
    await svc.submissions.saveAnswer(w.s1, sid, a.q1, { mode: 'typed', typedText: 'new delhi', timeSpentMs: 10_000 })
    // writes on screen first, then changes their mind and photographs a paper answer
    const { ink, png } = await inkFiles()
    await svc.submissions.storeInk(w.s1, sid, a.q2, ink, png)

    await expect(svc.submissions.storePhoto(w.s1, sid, a.q2, jpeg(1000, 750), sharp)).rejects.toMatchObject({ publicMessage: expect.stringMatching(/too small/) })
    await expect(svc.submissions.storePhoto(w.s1, sid, a.q2, new TextEncoder().encode('not a picture at all'), sharp)).rejects.toMatchObject({ publicMessage: expect.stringMatching(/not a photo/) })
    await expect(svc.submissions.storePhoto(w.s1, sid, a.q2, jpeg(1200, 1600), { ...sharp, sharpness: 0.1 })).rejects.toMatchObject({ publicMessage: expect.stringMatching(/blurred/) })
    const kept = await svc.submissions.storePhoto(w.s1, sid, a.q2, jpeg(1200, 1600), { ...sharp, sharpness: 0.1, override: true })
    expect(kept).toMatchObject({ version: 1, warning: 'too_blurred' })
    const retake = await svc.submissions.storePhoto(w.s1, sid, a.q2, jpeg(1600, 1200), sharp)
    expect(retake).toMatchObject({ version: 2, warning: null })
    expect(retake.url).toMatch(/photo\.v2\.jpg$/)

    // the photo shows again after a reload; the time autosave keeps the photo
    await svc.submissions.saveAnswer(w.s1, sid, a.q2, { mode: 'photo', timeSpentMs: 60_000 })
    const again = await svc.submissions.startSubmission(w.s1, a.id)
    expect(again.answers.find((x) => x.questionId === a.q2)).toMatchObject({ mode: 'photo', photoUrl: expect.stringMatching(/photo\.v2\.jpg$/) })

    const res = await svc.submissions.submit(w.s1, sid)
    expect(res.status).toBe('processing')
    const a2 = (await raw.query(`SELECT id FROM hw_answer WHERE submission_id = $1 AND question_id = $2`, [sid, a.q2])).rows[0].id as string
    gem.read.set(a2, { text: 'plants make food using sunlight', confidence: 'high' })
    await drainAll()

    expect(gem.readMimes).toEqual(['image/jpeg']) // the photo, not the earlier writing (a PNG)
    expect((await raw.query(`SELECT transcript, transcript_status FROM hw_answer WHERE id = $1`, [a2])).rows[0]).toEqual({ transcript: 'plants make food using sunlight', transcript_status: 'done' })
    // the teacher sees the photo that was read
    expect((await svc.marking.answerDetail(w.teacher, a2)).renderUrl).toMatch(/photo\.v2\.jpg$/)
  })

  it('photo answer: a question set to Photo with no photo taken cannot be handed in', async () => {
    const w = await makeWorld()
    const a = await publishedAssignment(w, ['typed', 'photo'])
    const sid = (await svc.submissions.startSubmission(w.s1, a.id)).submission.id
    await svc.submissions.saveAnswer(w.s1, sid, a.q2, { mode: 'photo', timeSpentMs: 5_000 })
    await expect(svc.submissions.submit(w.s1, sid)).rejects.toThrow(/has no photo yet/)
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

  // ── Roadmap task 3.4: "Draft with AI" ─────────────────────────────────────────────────────────────────
  describe('Draft with AI (roadmap task 3.4)', () => {
    async function draftWorld(modelAnswer: string | null) {
      const w = await makeWorld()
      const { id } = await svc.assignments.createAssignment(w.teacher, { classId: w.classId, sectionId: null, subject: 'Science', title: 'Draft rules', allowedModes: ['typed'] })
      const q = await svc.assignments.addQuestion(w.teacher, id, { type: 'very_short', prompt: 'What do plants take in for photosynthesis?', marks: 1, ...(modelAnswer ? { modelAnswer } : {}) })
      await svc.assignments.useOwnRubric(w.teacher, q.id) // "Draft with AI" applies only to the teacher's own rubric (roadmap 5.2)
      return { w, id, qid: q.id }
    }
    const sources = async (qid: string) => (await raw.query(`SELECT source FROM hw_rubric_item WHERE question_id = $1 AND retired_at IS NULL ORDER BY position`, [qid])).rows.map((r) => r.source as string)

    it('rule 1: a question without a model answer is not drafted: refused, no model call, no job', async () => {
      const { w, qid } = await draftWorld(null)
      await expect(svc.assignments.draftRubric(w.teacher, qid, { replace: false })).rejects.toMatchObject({ code: 'BAD_REQUEST', publicMessage: 'Add a model answer first.' })
      expect(gem.calls.filter((c) => c.kind === 'rubric')).toHaveLength(0)
      expect((await raw.query(`SELECT count(*)::int AS n FROM hw_ai_job WHERE question_id = $1`, [qid])).rows[0].n).toBe(0)
      // a blank model answer counts as none
      await svc.assignments.updateQuestion(w.teacher, qid, { modelAnswer: '   ' })
      await expect(svc.assignments.draftRubric(w.teacher, qid, { replace: false })).rejects.toMatchObject({ publicMessage: 'Add a model answer first.' })
    })

    it("rule 2: the draft is made only from the teacher's model answer (prompt rubric-draft.v2)", async () => {
      const { w, qid } = await draftWorld('Plants take in carbon dioxide.')
      await svc.assignments.draftRubric(w.teacher, qid, { replace: false })
      expect(gem.calls.filter((c) => c.kind === 'rubric')).toHaveLength(1)
      const sent = gem.lastRubric!
      expect(sent.system).toContain('Use ONLY the model answer')
      expect(sent.system).not.toContain('standard for the question')
      expect(sent.text).toContain('Plants take in carbon dioxide.')
      expect(sent.text).not.toContain('(none given)')
      const job = (await raw.query(`SELECT payload_ref FROM hw_ai_job WHERE question_id = $1 AND kind = 'rubric_draft'`, [qid])).rows[0]
      expect(JSON.parse(job.payload_ref)).toEqual({ promptVersion: 'rubric-draft.v2' })
    })

    it('rule 3: drafted points are stored as AI drafts and stay so until the teacher saves the key points', async () => {
      const { w, qid } = await draftWorld('Plants take in carbon dioxide.')
      await svc.assignments.draftRubric(w.teacher, qid, { replace: false })
      expect(await sources(qid)).toEqual(['ai_draft'])
      // the teacher saves the key points (unchanged is enough): they become the teacher's
      await svc.assignments.setRubric(w.teacher, qid, [{ kind: 'key_point', description: 'Drafted point', marks: 1 }])
      expect(await sources(qid)).toEqual(['teacher'])
    })

    it('rule 4: Publish is refused while an unsaved AI-draft point exists, and works once the key points are saved', async () => {
      const { w, id, qid } = await draftWorld('Plants take in carbon dioxide.')
      await svc.assignments.draftRubric(w.teacher, qid, { replace: false })
      await expect(svc.assignments.publishAssignment(w.teacher, id)).rejects.toMatchObject({ code: 'CONFLICT' })
      await expect(svc.assignments.publishAssignment(w.teacher, id)).rejects.toThrow(/Question 1 still has AI-drafted key points/)
      expect((await raw.query(`SELECT status FROM hw_assignment WHERE id = $1`, [id])).rows[0].status).toBe('draft')
      await svc.assignments.setRubric(w.teacher, qid, [{ kind: 'key_point', description: 'Drafted point', marks: 1 }])
      const pub = await svc.assignments.publishAssignment(w.teacher, id)
      expect(pub.totalMarks).toBe(1)
      expect((await raw.query(`SELECT status FROM hw_assignment WHERE id = $1`, [id])).rows[0].status).toBe('published')
    })

    it('a teacher-written rubric never blocks Publish (nothing was drafted)', async () => {
      const { w, id, qid } = await draftWorld(null)
      await svc.assignments.setRubric(w.teacher, qid, [{ kind: 'key_point', description: 'Carbon dioxide', marks: 1 }])
      await expect(svc.assignments.publishAssignment(w.teacher, id)).resolves.toMatchObject({ totalMarks: 1 })
    })
  })

  // ── Roadmap 5.3: eligibility is enforced in marking ───────────────────────────────────────────────────
  describe('Eligibility (roadmap 5.3)', () => {
    const KEY = 'science|short|en|teacher_rubric'
    const enforce = (on: boolean) => { process.env.HW_ELIGIBILITY_ENFORCED = on ? 'true' : 'false'; process.env.HW_TEACHER_RUBRIC_AI_ENABLED = on ? 'true' : 'false'; svc.config._resetHwConfig() }
    afterEach(() => { process.env.HW_GRADE_MODEL = 'gemini-3.5-flash-lite'; enforce(false) })

    async function promoteNow() {
      const reg = await import('@/lib/hw/eligibility/registry')
      const group = await import('@/lib/hw/eligibility/group')
      const p = group.parseGroupKey(KEY)!
      const id = randomUUID()
      await raw.query(
        `INSERT INTO hw_eval_gate_result (id, group_key, subject, question_type, language, scheme_source, verdict, checks, run_ids, dataset_versions, production_fingerprint, report_sha256, imported_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'eligible', '[]'::jsonb, ARRAY['run_x'], ARRAY['heldout-1d@v1'], $7, $8, 'itest')`,
        [id, KEY, p.subject, p.questionType, p.language, p.schemeSource, reg.runningConfig().hash, randomUUID().replace(/-/g, '').padEnd(64, '0')],
      )
      return reg.promote({ userId: 'itest-owner', isSuperAdmin: true, rater: null }, { groupKey: KEY, gateResultId: id, reason: 'Passed every gate on heldout-1d@v1.', confirm: true })
    }
    const unregister = () => raw.query(`DELETE FROM hw_eligibility WHERE group_key = $1`, [KEY])

    it('a group that is not eligible gets no AI call: answers wait for the teacher with the reason, rules in code still mark, the queue says why', async () => {
      await unregister()
      enforce(true)
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })
      await drainAll()

      expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(0) // no model was asked to mark
      const sugg = (await raw.query(`SELECT answer_id, model FROM hw_ai_grade WHERE answer_id = ANY($1)`, [[h.a1, h.a2]])).rows
      expect(sugg).toEqual([{ answer_id: h.a1, model: 'exact_match' }]) // the exact-match rule is code, not AI
      const wait = (await raw.query(`SELECT failure_reason FROM hw_answer WHERE id = $1`, [h.a2])).rows[0].failure_reason as string
      expect(wait).toMatch(/^AI suggestions are not switched on for this kind of question yet/)

      const q2 = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      expect(q2.answers[0].suggestion).toBeNull()
      expect(q2).toMatchObject({ aiOff: { reason: 'no_record' } })
      const q1 = await svc.marking.questionQueue(w.teacher, a.q1, 'all')
      expect(q1.answers[0].suggestion).toMatchObject({ model: 'exact_match' }) // a rule's mark stays visible
      // the teacher can still mark by hand
      await svc.marking.manualGrade(w.teacher, h.a2, { marks: 1.5, comment: 'by hand' })
      expect((await raw.query(`SELECT source FROM hw_grade WHERE answer_id = $1`, [h.a2])).rows[0].source).toBe('manual')
    })

    it('a promotion marks the answers that were waiting, and shows their suggestions', async () => {
      await unregister()
      enforce(true)
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })
      await drainAll()
      expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(0)

      const r = await promoteNow()
      expect(r.requeuedQuestions).toBeGreaterThanOrEqual(1)
      await drainAll()
      expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(1) // now the model is asked
      expect((await raw.query(`SELECT failure_reason FROM hw_answer WHERE id = $1`, [h.a2])).rows[0].failure_reason).toBeNull()
      const q2 = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      expect(q2.answers[0].suggestion).not.toBeNull()
      expect('aiOff' in q2).toBe(false)
      const ai = q2.answers[0].suggestion!
      await expect(svc.marking.acceptAiGrade(w.teacher, h.a2, ai.id)).resolves.toBeUndefined()
    })

    it('when the marking setup changes, existing AI suggestions are hidden and cannot be accepted, singly or in bulk; rules in code still can', async () => {
      await unregister()
      enforce(true)
      await promoteNow()
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })
      await drainAll()
      const before = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      const sugg = before.answers[0].suggestion!
      expect(sugg).not.toBeNull()
      expect((await svc.marking.bulkAcceptPreview(w.teacher, a.q2)).count).toBe(1)

      process.env.HW_GRADE_MODEL = 'gemini-3.6-flash' // the setup changes
      svc.config._resetHwConfig()
      const after = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      expect(after.answers[0].suggestion).toBeNull()
      expect(after).toMatchObject({ aiOff: { reason: 'config_changed' } })
      await expect(svc.marking.acceptAiGrade(w.teacher, h.a2, sugg.id)).rejects.toThrow(/paused for this kind of question/)
      expect((await svc.marking.bulkAcceptPreview(w.teacher, a.q2)).count).toBe(0)
      const exact = await svc.marking.questionQueue(w.teacher, a.q1, 'all')
      expect(exact.answers[0].suggestion).toMatchObject({ model: 'exact_match' }) // a rule is not an AI suggestion
      expect((await svc.marking.bulkAcceptPreview(w.teacher, a.q1)).count).toBe(1)
    })

    it('with enforcement off (these suites\' setting) nothing is checked', async () => {
      await unregister()
      enforce(false)
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })
      await drainAll()
      expect(gem.calls.filter((c) => c.kind === 'grade')).toHaveLength(1)
      expect((await svc.marking.questionQueue(w.teacher, a.q2, 'all')).answers[0].suggestion).not.toBeNull()
    })
  })

  describe('Tenant control (roadmap 5.1)', () => {
    const owner = { userId: 'owner-itest', isSuperAdmin: true, rater: null }
    let tenants: typeof import('@/lib/hw/tenants')
    let monthKey: () => string
    beforeAll(async () => {
      tenants = await import('@/lib/hw/tenants')
      monthKey = (await import('@/lib/hw/db')).monthKey
    })
    const edit = (w: World, over: Partial<import('@/lib/hw/tenants').TenantInput> = {}) =>
      tenants.setTenant(owner, { organizationId: w.org, enabled: true, monthlyBudgetPaise: 0, scopeRestricted: false, scope: [], reason: 'pilot set-up', ...over })
    const spend = (w: World, costPaise: number) =>
      raw.query(`INSERT INTO hw_ai_usage_monthly (organization_id, month, pages_read, answers_graded, cost_paise) VALUES ($1, $2, 4, 3, $3)
                 ON CONFLICT (organization_id, month) DO UPDATE SET cost_paise = $3`, [w.org, monthKey(), costPaise])
    const auditRows = async (w: World) => (await raw.query(`SELECT action, actor_id, reason, old_value, new_value FROM hw_admin_audit WHERE entity = 'tenant' AND entity_id = $1 ORDER BY at`, [w.org])).rows

    it('only the platform owner may change or read it', async () => {
      const w = await makeWorld()
      const nobody = { userId: 'x', isSuperAdmin: false, rater: null }
      await expect(tenants.listTenants(nobody)).rejects.toThrow(/Only the platform owner/)
      await expect(tenants.setTenant(nobody, { organizationId: w.org, enabled: true, monthlyBudgetPaise: 0, scopeRestricted: false, scope: [], reason: 'try' })).rejects.toThrow(/Only the platform owner/)
      await expect(tenants.tenantHistory(nobody, w.org)).rejects.toThrow(/Only the platform owner/)
    })

    it('a change is saved with an audit row (old, new, who, why); an unchanged save writes nothing; the history lists it', async () => {
      const w = await makeWorld()
      expect(await edit(w, { monthlyBudgetPaise: 50_000, reason: 'ten-rupee pilot budget' })).toEqual({ changed: true })
      expect(await edit(w, { monthlyBudgetPaise: 50_000, reason: 'same again' })).toEqual({ changed: false })
      const rows = await auditRows(w)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ action: 'tenant_changed', actor_id: owner.userId, reason: 'ten-rupee pilot budget' })
      expect(rows[0].old_value).toMatchObject({ enabled: true, monthlyBudgetPaise: 0, scopeRestricted: false })
      expect(rows[0].new_value).toMatchObject({ enabled: true, monthlyBudgetPaise: 50_000 })
      await edit(w, { enabled: false, monthlyBudgetPaise: 50_000, reason: 'paused for the holidays' })
      const hist = await tenants.tenantHistory(owner, w.org)
      expect(hist.map((h) => h.reason)).toEqual(['paused for the holidays', 'ten-rupee pilot budget']) // newest first
    })

    it('it needs a reason, a sane budget, and a real class list; classes of another institution are refused', async () => {
      const w = await makeWorld()
      const other = await makeWorld()
      await expect(edit(w, { reason: ' x ' })).rejects.toThrow(/Say why/)
      await expect(edit(w, { monthlyBudgetPaise: -1 })).rejects.toThrow(/between/)
      await expect(edit(w, { monthlyBudgetPaise: 1.5 })).rejects.toThrow(/between/)
      await expect(edit(w, { scopeRestricted: true, scope: [] })).rejects.toThrow(/at least one class/)
      await expect(edit(w, { scopeRestricted: true, scope: [{ classId: other.classId, sectionId: null }] })).rejects.toThrow(/does not belong/)
      await expect(tenants.setTenant(owner, { organizationId: 'no-such-org', enabled: true, monthlyBudgetPaise: 0, scopeRestricted: false, scope: [], reason: 'try' })).rejects.toThrow(/not found/)
      expect(await auditRows(w)).toHaveLength(0) // every refusal left nothing behind
    })

    it('the audit table refuses updates and deletes at the database', async () => {
      const w = await makeWorld()
      await edit(w, { monthlyBudgetPaise: 100 })
      await expect(raw.query(`UPDATE hw_admin_audit SET reason = 'edited' WHERE entity = 'tenant' AND entity_id = $1`, [w.org])).rejects.toThrow()
      await expect(raw.query(`DELETE FROM hw_admin_audit WHERE entity = 'tenant' AND entity_id = $1`, [w.org])).rejects.toThrow()
      expect(await auditRows(w)).toHaveLength(1)
    })

    it('class limit: assignments can be made, listed and seen only for the listed classes — admins too', async () => {
      const w = await makeWorld()
      const c8 = `${w.org}-c8`
      await raw.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ($1, $2, 'Class 8', 8)`, [c8, w.org])
      await raw.query(`INSERT INTO hw_class_teacher (id, organization_id, class_id, teacher_id, subject) VALUES ($1, $2, $3, $4, 'Science')`, [`l8-${w.org}`, w.org, c8, w.teacher.userId])
      const a = await publishedAssignment(w) // class 9, made while unrestricted
      const mk = (actor: HwActor, classId: string) => svc.assignments.createAssignment(actor, { classId, sectionId: null, subject: 'Science', title: 'T', allowedModes: ['typed'] })

      await edit(w, { scopeRestricted: true, scope: [{ classId: c8, sectionId: null }] })
      await expect(mk(w.teacher, w.classId)).rejects.toThrow(/not switched on for this class/)
      await expect(mk(w.admin, w.classId)).rejects.toThrow(/not switched on for this class/)
      await expect(mk(w.teacher, c8)).resolves.toBeDefined()
      expect((await svc.assignments.assignmentTargets(w.admin)).classes.map((c) => c.id)).toEqual([c8])
      expect((await svc.assignments.assignmentTargets(w.teacher)).classes.map((c) => c.id)).toEqual([c8])
      // The class-9 assignment made earlier is no longer visible to its students.
      expect(await svc.submissions.myAssignments(w.s1)).toEqual([])
      await expect(svc.guards.assignmentForStudent(w.s1, a.id)).rejects.toThrow(/not found/i)

      await edit(w, { scopeRestricted: true, scope: [{ classId: w.classId, sectionId: null }, { classId: c8, sectionId: null }], reason: 'both classes now' })
      expect((await svc.submissions.myAssignments(w.s1)).map((x) => x.id)).toContain(a.id)
      await edit(w, { scopeRestricted: false, scope: [], reason: 'whole school' })
      await expect(mk(w.teacher, w.classId)).resolves.toBeDefined()
    })

    it('a rupee budget: AI runs below it, and at 100% answers wait for the teacher with "AI quota reached"', async () => {
      const w = await makeWorld(0) // the older answer quota is 0, so only the budget can let AI run
      await edit(w, { monthlyBudgetPaise: 1_000 })
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun light', confidence: 'high' })
      await drainAll()
      expect(gem.calls.length).toBeGreaterThan(0)

      await spend(w, 1_000)
      gem.calls = []
      const h2 = await studentHandsIn(w, a, w.s2)
      await drainAll()
      expect(gem.calls).toHaveLength(0)
      const ans = (await raw.query(`SELECT transcript_status, failure_reason FROM hw_answer WHERE id = $1`, [h2.a2])).rows[0]
      expect(ans.transcript_status).toBe('needs_review')
      expect(ans.failure_reason).toMatch(/AI quota reached \(₹10\.00 of ₹10\.00 this month\)/)
    })

    it('the 80% warning shows on the Tenants tab and on the institution admin card, with the same numbers', async () => {
      const w = await makeWorld()
      await edit(w, { monthlyBudgetPaise: 1_000 })
      await spend(w, 799)
      let card = (await svc.marking.usageThisMonth(w.admin)).thisMonth
      expect(card).toMatchObject({ warn: false, exhausted: false })
      await spend(w, 800)
      card = (await svc.marking.usageThisMonth(w.admin)).thisMonth
      const tab = (await tenants.listTenants(owner, { organizationId: w.org }))[0].usage
      expect(card).toEqual(tab)
      expect(card).toMatchObject({ pagesRead: 4, answersGraded: 3, costPaise: 800, budgetPaise: 1_000, warn: true, exhausted: false })
      expect(card.fraction).toBeCloseTo(0.8)
      await spend(w, 1_000)
      expect((await svc.marking.usageThisMonth(w.admin)).thisMonth).toMatchObject({ warn: true, exhausted: true })
    })

    it('the older quota endpoint audits too', async () => {
      const w = await makeWorld()
      const staff: HwActor = { userId: 'staff-itest', orgId: w.org, role: 'admin', isPlatformStaff: true }
      await svc.marking.setQuota(staff, w.org, { enabled: true, monthlyAnswerQuota: 77 })
      const rows = await auditRows(w)
      expect(rows.at(-1)).toMatchObject({ action: 'quota_changed', actor_id: 'staff-itest' })
      expect(rows.at(-1)?.new_value).toMatchObject({ monthlyAnswerQuota: 77 })
    })
  })

  describe('Monitoring (roadmap 5.4)', () => {
    it('the per-group roll-up counts what teachers did with the AI suggestions, from real marking, and is the same when run twice', async () => {
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h1 = await studentHandsIn(w, a)
      const h2 = await studentHandsIn(w, a, w.s2)
      gem.read.set(h1.a2, { text: 'plants make food from sun light', confidence: 'high' })
      gem.read.set(h2.a2, { text: 'plants make food from sun light', confidence: 'high' })
      await drainAll()

      // Q1 (very short, exact match): the rule marked both; the teacher accepts. Q2 (short): one accepted as it was, one changed from 2 to 1.
      const q1 = await svc.marking.questionQueue(w.teacher, a.q1, 'all')
      for (const ans of q1.answers) await svc.marking.acceptAiGrade(w.teacher, ans.answerId, ans.suggestion!.id)
      const q2 = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      expect(q2.answers).toHaveLength(2)
      const rubric = (await raw.query(`SELECT id FROM hw_rubric_item WHERE question_id = $1 AND retired_at IS NULL ORDER BY position`, [a.q2])).rows
      await svc.marking.acceptAiGrade(w.teacher, q2.answers[0].answerId, q2.answers[0].suggestion!.id)
      await svc.marking.editAiGrade(w.teacher, q2.answers[1].answerId, q2.answers[1].suggestion!.id, [{ rubric_item_id: rubric[0].id, marks: 1 }, { rubric_item_id: rubric[1].id, marks: 0 }])

      const { rollupGroupDay } = await import('@/lib/hw/monitoring/rollup')
      const { recentDays } = await import('@/lib/hw/shadow/monitor')
      const today = recentDays()[1]
      const read = async () => (await raw.query(
        `SELECT group_key, question_type, language, scheme_source, answers_marked, suggestions_shown, accepted_unchanged, accepted_edited, marked_by_hand, marked_by_rule,
                overrides, large_overrides, override_abs_sum::float AS abs_sum, jobs_total, jobs_failed, actual_cost_paise::float AS cost, projected_paise_per_answer
           FROM hw_monitor_group_daily WHERE organization_id = $1 AND day = $2::date ORDER BY group_key`, [w.org, today])).rows
      await rollupGroupDay(today)
      const rows = await read()
      expect(rows.map((r) => r.group_key)).toEqual(['science|short|en|teacher_rubric', 'science|very_short|en|teacher_rubric'])
      const [short, veryShort] = rows
      expect(short).toMatchObject({ answers_marked: 2, suggestions_shown: 2, accepted_unchanged: 1, accepted_edited: 1, marked_by_hand: 0, marked_by_rule: 0, overrides: 1, large_overrides: 1, abs_sum: 1, jobs_failed: 0, projected_paise_per_answer: null })
      expect(short.jobs_total).toBeGreaterThanOrEqual(1)
      expect(short.cost).toBeGreaterThan(0) // the marking call and this question's share of the reading call
      expect(veryShort).toMatchObject({ answers_marked: 2, suggestions_shown: 0, marked_by_rule: 2, accepted_unchanged: 0, accepted_edited: 0, overrides: 0 }) // a rule in code is not an AI suggestion

      await rollupGroupDay(today)
      expect(await read()).toEqual(rows)
    })

    it('instruction flags, "not an instruction" taps, transcript fixes and misread taps are counted for the group', async () => {
      const w = await makeWorld()
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun light', confidence: 'high' })
      await drainAll()
      await raw.query(`INSERT INTO hw_instruction_flag (organization_id, answer_id, transcript_hash, screen_version, pattern_ids, dismissed_at, dismissed_by) VALUES ($1, $2, 'h1', 'v1', '["p1"]'::jsonb, now(), $3)`, [w.org, h.a2, w.teacher.userId])
      await raw.query(`UPDATE hw_answer SET student_flags = '[{"kind":"misread"}]'::jsonb WHERE id = $1`, [h.a2])
      await svc.marking.fixTranscript(w.teacher, h.a2, { text: 'plants make food from sunlight' })
      const { rollupGroupDay } = await import('@/lib/hw/monitoring/rollup')
      const { recentDays } = await import('@/lib/hw/shadow/monitor')
      await rollupGroupDay(recentDays()[1])
      const r = (await raw.query(`SELECT instruction_flags, instruction_not_taps, transcript_fixes, misread_taps FROM hw_monitor_group_daily WHERE organization_id = $1 AND group_key = 'science|short|en|teacher_rubric'`, [w.org])).rows[0]
      expect(r).toMatchObject({ instruction_flags: 1, instruction_not_taps: 1, transcript_fixes: 1, misread_taps: 1 })
      await drainAll() // the corrected transcript is marked again; leave nothing queued for the next test
    })
  })

  // ── Roadmap 5.2: answer keys in the product ───────────────────────────────────────────────────────────
  describe('Answer keys (roadmap 5.2)', () => {
    type Hit = { id: string; score: number; contentItemId: string; chapter: string }
    const CH3 = 'Chapter 3: Poverty as a Challenge'
    const PROMPT = 'How is the poverty line estimated in India?'
    const chunk = (id: string, text: string, p = 41) => ({ id, contentItemId: 'book-1', chapter: CH3, pageStart: p, pageEnd: p, text, title: 'Understanding Society: India and Beyond', isbn: '978-93-0000-000-0', edition: '2026', lang: 'English' })
    const FRESH_CHUNKS = () => ({
      c1: chunk('c1', 'Poverty line is estimated on the basis of minimum calorie requirement: 2400 calories in rural areas and 2100 in urban areas.'),
      c2: chunk('c2', 'Social exclusion and vulnerability are also seen as dimensions of poverty.', 42),
    } as Record<string, ReturnType<typeof chunk>>)
    const GOOD_KEY = {
      reference_answer: 'It is based on calorie needs: 2400 in rural and 2100 in urban areas.',
      value_points: [
        { id: 'p1', text: 'Based on minimum calorie requirement', marks: 1, kind: 'key_point', cites: ['c1'], accepted_alternatives: [] },
        { id: 'p2', text: '2400 calories rural, 2100 urban', marks: 1, kind: 'key_point', cites: ['c1'], accepted_alternatives: [] },
      ],
    }
    const PASSAGE_KEY = { ...GOOD_KEY, value_points: GOOD_KEY.value_points.map((p) => ({ ...p, cites: ['given'] })) }
    const SUPPORTED = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'c1' }, { point_id: 'p2', support: 'supported', reason: 'c1' }] }
    const PARTIAL = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'c1' }, { point_id: 'p2', support: 'partial', reason: 'only the rural figure' }] }
    const HITS: Hit[] = [{ id: 'c1', score: 0.71, contentItemId: 'book-1', chapter: CH3 }, { id: 'c2', score: 0.52, contentItemId: 'book-1', chapter: CH3 }]
    const OFFICIAL = { label: 'CBSE SQP 2025-26, 086, Q14', key: { referenceAnswer: 'Calorie norm.', valuePoints: [
      { id: 'o1', text: 'Minimum calorie requirement', marks: 1, kind: 'key_point' as const, cites: [], acceptedAlternatives: [] },
      { id: 'o2', text: '2400 rural and 2100 urban', marks: 1, kind: 'key_point' as const, cites: [], acceptedAlternatives: [] },
    ] } }

    // The key service's providers, faked. State is reset before every test.
    let writerOut: unknown, verifierOut: unknown, hits: Hit[], chunks: Record<string, ReturnType<typeof chunk>>, rMin: number | undefined, unavailable: boolean
    let sharedOn: boolean, official: boolean, counts: { writer: number; verifier: number; embed: number }
    let shared: ReturnType<typeof import('@/lib/hw/keys').memorySharedKeyStore>
    let keys: typeof import('@/lib/hw/keys/product')
    let reg: typeof import('@/lib/hw/eligibility/registry')
    let keysMod: typeof import('@/lib/hw/keys')
    let HwErr: typeof import('@/lib/hw/errors').HwError
    let appDb: unknown

    const runtime = () => {
      if (unavailable) throw new HwErr('NOT_CONFIGURED', 'Answer keys are not configured.', 'test')
      return {
        settings: { writer: { provider: 'gemini' as const, model: 'gemini-3.6-flash' }, verifier: { provider: 'openrouter' as const, model: 'openai/gpt-5.4-mini' }, rMin, theta: 0.35, topK: 30, maxPassages: 6, pagesVerified: new Set(['book-1']), ...(sharedOn ? { sharedKeys: true } : {}) },
        deps: {
          ...(sharedOn ? { shared } : {}),
          ...(official ? { official: async () => OFFICIAL } : {}),
          retriever: {
            indexId: 'test-index|embed',
            embed: async () => { counts.embed++; return { vector: [0.1], call: { role: 'embed' as const, provider: 'openai' as const, model: 'text-embedding-3-small', usage: { input: 12, cached: 0, output: 0 } } } },
            search: async () => hits,
          },
          trio: { practiceRows: async () => [], chunks: async (ids: readonly string[]) => ids.map((i) => chunks[i]).filter(Boolean) },
          generate: async (_p: string, call: { model: string; systemInstruction: string }) => {
            const writer = call.systemInstruction.startsWith('You write')
            if (writer) counts.writer++; else counts.verifier++
            return { json: writer ? writerOut : verifierOut, usage: { input: 1000, cached: 0, output: 200 }, rawUsage: {}, model: call.model }
          },
        },
      } as never
    }

    const enforce = (on: boolean) => { process.env.HW_ELIGIBILITY_ENFORCED = on ? 'true' : 'false'; svc.config._resetHwConfig() }
    beforeAll(async () => {
      keys = await import('@/lib/hw/keys/product'); reg = await import('@/lib/hw/eligibility/registry'); keysMod = await import('@/lib/hw/keys')
      HwErr = (await import('@/lib/hw/errors')).HwError; appDb = (await import('@/db')).db
    })
    beforeEach(() => {
      writerOut = GOOD_KEY; verifierOut = SUPPORTED; hits = HITS; chunks = FRESH_CHUNKS(); rMin = 0.45; unavailable = false; sharedOn = false; official = false
      counts = { writer: 0, verifier: 0, embed: 0 }; shared = keysMod.memorySharedKeyStore()
      keys._setKeyRuntime(runtime)
    })
    afterEach(() => { keys._setKeyRuntime(null); enforce(false) })

    const qrow = async (qid: string) => (await raw.query(`SELECT rubric_mode, scheme_source, active_key_id, origin FROM hw_question WHERE id = $1`, [qid])).rows[0]
    const currentKey = async (qid: string) => (await raw.query(`SELECT * FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NULL`, [qid])).rows[0]
    const rubricOf = async (qid: string) => (await raw.query(`SELECT description, marks::float AS marks, source FROM hw_rubric_item WHERE question_id = $1 AND retired_at IS NULL ORDER BY position`, [qid])).rows
    const viewOf = async (w: World, id: string, qid: string) => (await svc.assignments.getForManage(w.teacher, id)).questions.find((q) => q.id === qid)!.key
    async function keyed(w: World, over: Record<string, unknown> = {}) {
      const { id } = await svc.assignments.createAssignment(w.teacher, { classId: w.classId, sectionId: null, subject: 'Science', title: 'Keys', allowedModes: ['typed'] })
      const q = await svc.assignments.addQuestion(w.teacher, id, { type: 'short', prompt: PROMPT, marks: 2, ...over } as never)
      return { id, qid: q.id }
    }
    async function submitTyped(w: World, a: { id: string; qid: string }, text = 'It is based on the minimum calorie requirement, 2400 rural and 2100 urban.', student = w.s1) {
      const started = await svc.submissions.startSubmission(student, a.id)
      const sid = started.submission.id
      await svc.submissions.saveAnswer(student, sid, a.qid, { mode: 'typed', typedText: text, timeSpentMs: 1000 })
      await svc.submissions.submit(student, sid)
      return (await raw.query(`SELECT id FROM hw_answer WHERE submission_id = $1`, [sid])).rows[0].id as string
    }
    const KEYG = 'science|short|en|textbook_key'
    async function promoteGroup(key: string) {
      const p = (await import('@/lib/hw/eligibility/group')).parseGroupKey(key)!
      const id = randomUUID()
      await raw.query(
        `INSERT INTO hw_eval_gate_result (id, group_key, subject, question_type, language, scheme_source, verdict, checks, run_ids, dataset_versions, production_fingerprint, report_sha256, imported_by)
         VALUES ($1, $2, $3, $4, $5, $6, 'eligible', '[]'::jsonb, ARRAY['run_x'], ARRAY['heldout-1d@v1'], $7, $8, 'itest')`,
        [id, key, p.subject, p.questionType, p.language, p.schemeSource, reg.runningConfig().hash, randomUUID().replace(/-/g, '').padEnd(64, '0')])
      await reg.promote({ userId: 'itest-owner', isSuperAdmin: true, rater: null }, { groupKey: key, gateResultId: id, reason: 'Passed every gate on heldout-1d@v1.', confirm: true })
    }
    const unregister = (key: string) => raw.query(`DELETE FROM hw_eligibility WHERE group_key = $1`, [key])
    const decision = (qid: string) => reg.eligibilityOfQuestion(appDb as never, qid)

    // ── every status ──
    it('building → ready: the key becomes the rubric, with citations; it is paid for and shown as a "keys" line', async () => {
      const w = await makeWorld(); const a = await keyed(w)
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ mode: 'key', status: 'building', handMarked: 'key_pending' })
      expect(await rubricOf(a.qid)).toEqual([]) // nothing is marked against a key that is not ready

      await drainAll()
      const view = await viewOf(w, a.id, a.qid)
      expect(view).toMatchObject({ mode: 'key', status: 'ready', schemeSource: 'textbook_key', handMarked: null, total: 2, fromShared: false })
      expect(view.valuePoints.map((p) => p.text)).toEqual(['Based on minimum calorie requirement', '2400 calories rural, 2100 urban'])
      expect(view.valuePoints[0].citations[0]).toMatch(/Understanding Society.*p\. 41/) // book and page
      expect(await rubricOf(a.qid)).toEqual([{ description: 'Based on minimum calorie requirement', marks: 1, source: 'key' }, { description: '2400 calories rural, 2100 urban', marks: 1, source: 'key' }])
      expect(await qrow(a.qid)).toMatchObject({ rubric_mode: 'key', scheme_source: 'textbook_key', active_key_id: (await currentKey(a.qid)).id })
      const k = await currentKey(a.qid)
      expect(k).toMatchObject({ status: 'ready', scheme_source: 'textbook_key', from_shared: false })
      expect(Number(k.cost_paise)).toBeGreaterThan(0)

      const u = await svc.marking.usageThisMonth(w.admin)
      expect(u.thisMonth.keyBuilds).toBe(1)
      expect(u.thisMonth.keyCostPaise).toBeCloseTo(Number(k.cost_paise), 3)
      expect(u.thisMonth.costPaise).toBeGreaterThanOrEqual(u.thisMonth.keyCostPaise) // counted in the month's cost, so the budget sees it
    })

    it('partial: never used for marking, and the teacher is told why', async () => {
      verifierOut = PARTIAL
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll()
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ status: 'partial', handMarked: 'key_partial' })
      expect(await rubricOf(a.qid)).toEqual([])
      expect((await qrow(a.qid)).active_key_id).toBeNull()
      enforce(true)
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_partial' })
    })

    it('no_grounding: nothing in the book supports a key, so the teacher marks by hand', async () => {
      hits = []
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll()
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ status: 'no_grounding', reason: 'no_book', handMarked: 'key_no_grounding' })
      enforce(true)
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_no_grounding' })
    })

    it('failed: with a visible reason, and "try again" builds a new key', async () => {
      writerOut = { nonsense: true }
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll()
      const v = await viewOf(w, a.id, a.qid)
      expect(v).toMatchObject({ status: 'failed', reason: 'writer_output', handMarked: 'key_failed' })
      expect(v.detail).toBeTruthy()
      writerOut = GOOD_KEY
      await svc.assignments.retryKey(w.teacher, a.qid)
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ status: 'building' })
      await drainAll()
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ status: 'ready' })
      expect((await raw.query(`SELECT count(*)::int AS n FROM hw_question_key WHERE question_id = $1`, [a.qid])).rows[0].n).toBe(2) // the failed one is kept, superseded
    })

    it('not_available: the key service is not switched on (no models, or R_min not calibrated); never an error for the teacher', async () => {
      unavailable = true
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll()
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ status: 'not_available', handMarked: 'key_not_available' })
      unavailable = false; rMin = undefined // the service is set up, but R_min was never calibrated
      const b = await keyed(w)
      await drainAll()
      expect(await viewOf(w, b.id, b.qid)).toMatchObject({ status: 'not_available', handMarked: 'key_not_available' })
      expect(counts.writer).toBe(0) // no model was asked for a key without a calibrated threshold
    })

    // ── the teacher's own rubric ──
    it('"Use my own rubric instead": the key is dropped, the question is hand-marked during the pilot, and Draft with AI applies only now', async () => {
      const w = await makeWorld(); const a = await keyed(w, { modelAnswer: 'Calorie norm: 2400 rural, 2100 urban.' })
      await drainAll()
      await expect(svc.assignments.draftRubric(w.teacher, a.qid, { replace: false })).rejects.toThrow(/uses an answer key/) // key mode: no draft
      await svc.assignments.useOwnRubric(w.teacher, a.qid)
      expect(await qrow(a.qid)).toMatchObject({ rubric_mode: 'teacher', scheme_source: 'teacher_rubric', active_key_id: null })
      expect(await currentKey(a.qid)).toBeUndefined() // the key is superseded
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ mode: 'teacher', status: 'teacher', handMarked: 'teacher_rubric' })
      enforce(true)
      await promoteGroup('science|short|en|teacher_rubric')
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'teacher_rubric' }) // even though the group is eligible
      process.env.HW_TEACHER_RUBRIC_AI_ENABLED = 'true'; svc.config._resetHwConfig()
      expect((await decision(a.qid)).eligible).toBe(true) // the switch for when teacher-rubric marking has been measured
      process.env.HW_TEACHER_RUBRIC_AI_ENABLED = 'false'; svc.config._resetHwConfig()
      await unregister('science|short|en|teacher_rubric')
      enforce(false)
      await expect(svc.assignments.draftRubric(w.teacher, a.qid, { replace: true })).resolves.toBeDefined() // now it applies (the key's points were the starting point; replacing them is confirmed)
      // and back
      await svc.assignments.useAnswerKey(w.teacher, a.qid)
      expect(await viewOf(w, a.id, a.qid)).toMatchObject({ mode: 'key', status: 'building' })
    })

    it('writing a rubric by hand is choosing the teacher’s own rubric', async () => {
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll()
      await svc.assignments.setRubric(w.teacher, a.qid, [{ kind: 'key_point', description: 'My point', marks: 2 }])
      expect(await qrow(a.qid)).toMatchObject({ rubric_mode: 'teacher', scheme_source: 'teacher_rubric', active_key_id: null })
      expect((await rubricOf(a.qid)).map((r) => r.source)).toEqual(['teacher'])
    })

    // ── scheme source ──
    it('the scheme source is recorded on the question and is part of the eligibility group', async () => {
      official = true
      const w = await makeWorld()
      const gk = async (qid: string) => { const g = await reg.groupOfQuestion(appDb as never, qid); return (await import('@/lib/hw/eligibility/group')).groupKey(g!) }
      const textbook = await keyed(w)
      const passage = await keyed(w, { passage: 'The poverty line is the money needed for a minimum calorie intake.' })
      const board = await keyed(w, { origin: 'board_paper', originRef: { kind: 'sqp', session: '2025-26', subjectCode: '086', questionNo: '14' } })
      const own = await keyed(w); await svc.assignments.useOwnRubric(w.teacher, own.qid)
      writerOut = PASSAGE_KEY // the passage question's writer cites the passage
      await drainAll()
      expect((await qrow(passage.qid)).scheme_source).toBe('passage_key')
      expect(await gk(passage.qid)).toBe('science|short|en|passage_key')
      expect(await gk(board.qid)).toBe('science|short|en|board_scheme_key')
      expect(await gk(own.qid)).toBe('science|short|en|teacher_rubric')
      // the plain question went through the textbook path with the passage writer output: its points cite 'given', which no textbook passage has
      expect((await viewOf(w, textbook.id, textbook.qid)).status).toBe('failed')
      writerOut = GOOD_KEY
      await svc.assignments.retryKey(w.teacher, textbook.qid)
      await drainAll()
      expect(await gk(textbook.qid)).toBe('science|short|en|textbook_key')
    })

    // ── the board-paper bank as the official scheme (phase 3) ──
    it('a board-paper question is keyed from the person-checked bank, and its key goes stale when the row is no longer checked', async () => {
      const { cloneBank } = await import('@/test-support/hw/bank-fixture')
      const { expandBank, sha256 } = await import('@/lib/hw/bank/expand')
      const bankStore = await import('@/lib/hw/bank/store')
      const reviewStore = await import('@/lib/hw/bank/review-store')
      const { lookupOfficialScheme } = await import('@/lib/hw/bank/official-store')
      const code = `IT-${randomUUID().slice(0, 8)}`
      const b = cloneBank(); b.paper.code = code
      await bankStore.importDraft(appDb as never, expandBank(b), { actor: 'itest', sourceSha256: sha256(JSON.stringify(b)) })
      const hashOf = async () => (await raw.query(`SELECT q.content_hash FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = 2 AND q.alt = 'B' AND q.variant IS NULL`, [code])).rows[0].content_hash as string
      const verdict = async (v: 'ok' | 'fix', note = '') => reviewStore.applyReview(appDb as never, {
        format: 'cbse-paper-check/1', paper: { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' }, reviewer: 'Mrs Rao',
        verdicts: [{ q: 2, alt: 'B', variant: null, content_hash: await hashOf(), verdict: v, confirmed: [], note }],
      }, { recordedBy: 'itest' })
      const ref = { kind: 'sqp', session: '2099-00', subjectCode: code, questionNo: '2B', board: 'TESTBOARD' }
      const BOARDG = 'science|short|en|board_scheme_key'
      try {
        official = false
        const w = await makeWorld()
        // The real lookup, in place of the fake one.
        keys._setKeyRuntime(() => { const rt = runtime() as { deps: Record<string, unknown> }; rt.deps.official = (r: never) => lookupOfficialScheme(appDb as never, r); return rt as never })
        const a = await keyed(w, { origin: 'board_paper', originRef: ref, prompt: 'Name the organ that filters blood.', marks: 2 })

        // Not checked yet: the bank is not a source, so no official key (the question falls through to the other sources).
        expect(await lookupOfficialScheme(appDb as never, ref as never)).toBeNull()

        await verdict('ok')
        await drainAll()
        const k = await currentKey(a.qid)
        expect(k).toMatchObject({ status: 'ready', scheme_source: 'board_scheme_key' })
        expect(k.source_ref).toMatch(/^official: bank row /)
        expect(Object.keys(k.passage_hashes)).toEqual([expect.stringMatching(/^bank:/)])
        expect(await rubricOf(a.qid)).toEqual([{ description: 'Kidney', marks: 1, source: 'key' }, { description: 'It filters the blood', marks: 1, source: 'key' }])
        expect(await qrow(a.qid)).toMatchObject({ rubric_mode: 'key', scheme_source: 'board_scheme_key' })
        expect(gem.calls.length).toBe(0)   // an official key is not written by a model

        // The key is good while the row is checked...
        enforce(true); await unregister(BOARDG); await promoteGroup(BOARDG)
        expect(await decision(a.qid)).toEqual({ eligible: true, reason: 'eligible' })
        // ...is withdrawn the moment a person says the row needs a correction...
        await verdict('fix', 'The second point should say the blood is filtered in the nephron')
        expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_stale_book' })
        // ...and good again when the row is checked again with the same content.
        await verdict('ok')
        expect(await decision(a.qid)).toEqual({ eligible: true, reason: 'eligible' })
      } finally {
        await unregister('science|short|en|board_scheme_key')
        await raw.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code])
      }
    })

    it('a teacher adds a published paper question from the picker: made from the bank row, keyed officially, and the student sees its figure', async () => {
      const { cloneBank } = await import('@/test-support/hw/bank-fixture')
      const { expandBank, sha256 } = await import('@/lib/hw/bank/expand')
      const bankStore = await import('@/lib/hw/bank/store')
      const reviewStore = await import('@/lib/hw/bank/review-store')
      const figures = await import('@/lib/hw/bank/figures')
      const { lookupOfficialScheme } = await import('@/lib/hw/bank/official-store')
      const { addBankQuestion } = await import('@/lib/hw/bank/teacher')
      const { putHwObject } = await import('@/lib/hw/storage/r2')
      const code = `IT-${randomUUID().slice(0, 8)}`
      const ident = { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' as const }
      const b = cloneBank(); b.paper.code = code
      await bankStore.importDraft(appDb as never, expandBank(b), { actor: 'itest', sourceSha256: sha256(JSON.stringify(b)) })
      const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
      const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(120), ...be32(80), 8, 2, 0, 0, 0, ...new Array(40).fill(7)])
      try {
        await figures.attachFigureImage(appDb as never, putHwObject, ident, 'q4-fig1', png)
        const drafts = (await raw.query(`SELECT q.number, q.alt, q.variant, q.content_hash, q.needs_check FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1`, [code])).rows
        await reviewStore.applyReview(appDb as never, {
          format: 'cbse-paper-check/1', paper: ident, reviewer: 'Mrs Rao',
          verdicts: drafts.map((r) => ({ q: r.number, alt: r.alt, variant: r.variant, content_hash: r.content_hash, verdict: 'ok' as const, confirmed: r.needs_check, note: '' })),
        }, { recordedBy: 'itest' })
        const rowId = async (n: number) => (await raw.query(`SELECT q.id FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND q.variant IS NULL`, [code, n])).rows[0].id as string

        const w = await makeWorld()
        const a = await svc.assignments.createAssignment(w.teacher, { classId: w.classId, sectionId: null, subject: 'Science', title: 'From a paper', allowedModes: ['typed'] })
        // Not published yet: not on offer, so not added.
        await expect(addBankQuestion(w.teacher, a.id, await rowId(4))).rejects.toMatchObject({ code: 'NOT_FOUND' })
        await reviewStore.setPublished(appDb as never, ident, true, { actor: 'itest-owner' })
        // Q3 has a figure with no picture: not on offer either.
        await expect(addBankQuestion(w.teacher, a.id, await rowId(3))).rejects.toMatchObject({ code: 'NOT_FOUND' })

        const added = await addBankQuestion(w.teacher, a.id, await rowId(4))
        expect(added).toMatchObject({ marks: 2, excludedMarks: 2 })   // the drawing's marks are not counted
        const q = (await raw.query(`SELECT * FROM hw_question WHERE id = $1`, [added.id])).rows[0]
        expect(q).toMatchObject({ origin: 'board_paper', rubric_mode: 'key', type: 'long' })
        expect(q.origin_ref).toMatchObject({ kind: 'sqp', session: '2099-00', subjectCode: code, questionNo: '4', board: 'TESTBOARD', classLevel: '10' })
        expect(q.prompt).toContain('Part i asks for a drawing')
        // The custom question next to it carries no figures.
        const plain = await svc.assignments.addQuestion(w.teacher, a.id, { type: 'short', prompt: 'A question of my own.', marks: 1 } as never)

        // Keyed from the board's own scheme, with the real lookup; no model writes it.
        keys._setKeyRuntime(() => { const rt = runtime() as { deps: Record<string, unknown> }; rt.deps.official = (r: never) => lookupOfficialScheme(appDb as never, r); return rt as never })
        await drainAll()
        expect(await currentKey(added.id)).toMatchObject({ status: 'ready', scheme_source: 'board_scheme_key' })
        expect((await rubricOf(added.id)).map((r) => [r.description, r.marks])).toEqual([['F = m a', 2]])
        void plain

        await svc.assignments.publishAssignment(w.teacher, a.id)
        const opened = await svc.submissions.startSubmission(w.s1, a.id)
        const shown = opened.questions.find((x) => x.id === added.id) as { figures?: { figureId: string; description: string; url: string }[] }
        expect(shown.figures).toEqual([{ figureId: 'q4-fig1', description: 'A blank circle to draw in.', url: expect.stringMatching(/^https:\/\/signed\.test\/hw-bank\/[0-9a-f-]+\.v1\.png$/) }])
        expect((opened.questions.find((x) => x.id === plain.id) as { figures?: unknown }).figures).toBeUndefined()
        // The student's view never carries the marking scheme or accepted answers.
        expect(JSON.stringify(opened.questions)).not.toMatch(/value_points|acceptedAnswers|F = m a/)
      } finally {
        await raw.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code])
      }
    })

    // ── the backstop at marking time ──
    async function readyPublished(opts: { student?: boolean } = {}) {
      enforce(true)
      await unregister(KEYG)
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll()
      expect((await viewOf(w, a.id, a.qid)).status).toBe('ready')
      await svc.assignments.publishAssignment(w.teacher, a.id)
      await promoteGroup(KEYG)
      const answerId = opts.student === false ? '' : await submitTyped(w, a)
      return { w, a, answerId }
    }
    const gradeCalls = () => gem.calls.filter((c) => c.kind === 'grade').length

    it('a ready key and an eligible group: the model marks, and the suggestion records the key and the key-service version it used', async () => {
      const { a, answerId } = await readyPublished()
      await drainAll()
      expect(gradeCalls()).toBe(1)
      const key = await currentKey(a.qid)
      const row = (await raw.query(`SELECT s.scheme_source, s.question_key_id, s.key_service_version, s.config_hash FROM hw_ai_grade g JOIN hw_ai_grade_scheme s ON s.ai_grade_id = g.id WHERE g.answer_id = $1`, [answerId])).rows
      expect(row).toEqual([{ scheme_source: 'textbook_key', question_key_id: key.id, key_service_version: key.key_service_version, config_hash: key.config_hash }])
      expect(key.key_service_version).toMatch(/key-checks\.v1/)
    })

    it('R_min changed: no suggestion, the reason says so, a rebuild is queued; when the rebuilt key matches it is used again', async () => {
      const { w, a, answerId } = await readyPublished({ student: false })
      const oldKey = await currentKey(a.qid)
      rMin = 0.5 // the threshold is recalibrated
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_stale_config' })
      expect((await currentKey(a.qid)).status).toBe('building') // rebuild queued, once
      await decision(a.qid)
      expect((await raw.query(`SELECT count(*)::int AS n FROM hw_question_key WHERE question_id = $1 AND status = 'building' AND superseded_at IS NULL`, [a.qid])).rows[0].n).toBe(1)

      const ans = await submitTyped(w, a)
      await drainAll() // marking first finds no usable key (paused), the rebuilt key then matches the published rubric and the answer is marked against it
      void answerId
      const newKey = await currentKey(a.qid)
      expect(newKey.id).not.toBe(oldKey.id)
      expect(newKey.config_hash).not.toBe(oldKey.config_hash)
      expect(gradeCalls()).toBe(1)
      const s = (await raw.query(`SELECT s.question_key_id FROM hw_ai_grade g JOIN hw_ai_grade_scheme s ON s.ai_grade_id = g.id WHERE g.answer_id = $1`, [ans])).rows
      expect(s).toEqual([{ question_key_id: newKey.id }])
    })

    it('the book text changed (a new edition or reprint): no suggestion, rebuild queued', async () => {
      const { w, a } = await readyPublished({ student: false })
      chunks.c1 = chunk('c1', 'Poverty line is now estimated using a consumption basket (2026 revision).')
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_stale_book' })
      expect((await currentKey(a.qid)).status).toBe('building')
      const ans = await submitTyped(w, a)
      expect((await raw.query(`SELECT failure_reason FROM hw_answer WHERE id = $1`, [ans])).rows[0].failure_reason).toBeNull() // not yet looked at
      await drainAll() // the key is rebuilt from the new text; its points are the published ones, so it is used again and the answer is marked
      expect(gradeCalls()).toBe(1)
      expect((await currentKey(a.qid)).passage_hashes.c1).not.toBe((await raw.query(`SELECT passage_hashes FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NOT NULL ORDER BY created_at LIMIT 1`, [a.qid])).rows[0].passage_hashes.c1)
    })

    it('a key built through the library hub is checked against the library, not the old content tables (13 Nov 2026)', async () => {
      const { a } = await readyPublished({ student: false })
      const k = await currentKey(a.qid)
      const cited = Object.keys(k.passage_hashes).filter((i) => i !== 'given')
      expect(cited.length).toBeGreaterThan(0)
      // the same key, as if built in hub mode: the hub's index in the settings, so the config still matches
      const trioChunks = jest.fn(async () => { throw new Error('TRIO_CONTENT_DATABASE_URL is not set') })
      const hubRt = () => { const rt = runtime() as { deps: Record<string, unknown> }; rt.deps.hub = { indexId: 'hub|library_v2|embed', search: async () => ({ scope: [], results: [], warnings: [] }) }; rt.deps.trio = { practiceRows: async () => [], chunks: trioChunks }; return rt as never }
      await raw.query(`UPDATE hw_question_key SET config_hash = $2 WHERE id = $1`, [k.id, keys.currentConfigHash(hubRt())])
      const { db: hwDb } = await import('@/lib/hw/db')
      const { hwQuestion } = await import('@/db/hw-schema')
      const { eq } = await import('drizzle-orm')
      const [qrow] = await hwDb.select().from(hwQuestion).where(eq(hwQuestion.id, a.qid))
      const text = (i: string) => chunks[i].text
      const check = (lib: (ids: readonly string[]) => Promise<{ id: string; text: string }[]>) =>
        keys.checkKeyForMarking(hwDb, qrow as never, { rt: hubRt(), rebuild: false, libraryPassages: lib })
      // the same text in the library: good, and the old content tables are never touched
      expect(await check(async (ids) => ids.map((i) => ({ id: i, text: text(i) })))).toMatchObject({ ok: true })
      // another book has a passage with the same id and other words: still good (ids are unique within a book only)
      expect(await check(async (ids) => ids.flatMap((i) => [{ id: i, text: 'another book' }, { id: i, text: text(i) }]))).toMatchObject({ ok: true })
      // the words changed, or the passage is gone: stale
      expect(await check(async (ids) => ids.map((i) => ({ id: i, text: text(i) + ' (revised)' })))).toEqual({ ok: false, reason: 'key_stale_book' })
      expect(await check(async () => [])).toEqual({ ok: false, reason: 'key_stale_book' })
      // the library cannot be read: not marked, said as such
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      expect(await check(async () => { throw new Error('LIBRARY_READER_DATABASE_URL is not set') })).toEqual({ ok: false, reason: 'key_stale_book' })
      warn.mockRestore()
      expect(trioChunks).not.toHaveBeenCalled()
    })

    it('the key-service version changed, or the question changed after its key was built: no suggestion', async () => {
      const { a } = await readyPublished({ student: false })
      await raw.query(`UPDATE hw_question_key SET key_service_version = 'old-prompts+old-checks' WHERE id = $1`, [(await currentKey(a.qid)).id])
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_stale_version' })
      await drainAll() // rebuilt with the current version, same points: active again
      expect(await decision(a.qid)).toEqual({ eligible: true, reason: 'eligible' })
    })

    it('a published question edited after its key was built is stale until its key is rebuilt', async () => {
      const { w, a } = await readyPublished({ student: false })
      await svc.assignments.updateQuestion(w.teacher, a.qid, { prompt: `${PROMPT} (Answer with the figures.)` })
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_stale_question' })
    })

    it('a key rebuilt with different points never replaces a published rubric: no suggestion until the teacher decides', async () => {
      const { a } = await readyPublished({ student: false })
      rMin = 0.5
      await decision(a.qid) // queues the rebuild
      writerOut = { ...GOOD_KEY, value_points: [{ ...GOOD_KEY.value_points[0], text: 'A different first point', marks: 2 }] }
      verifierOut = { verdicts: [{ point_id: 'p1', support: 'supported', reason: 'c1' }] }
      await drainAll()
      expect((await currentKey(a.qid)).status).toBe('ready')
      expect((await rubricOf(a.qid)).map((r) => r.description)).toEqual(['Based on minimum calorie requirement', '2400 calories rural, 2100 urban']) // frozen
      expect(await decision(a.qid)).toEqual({ eligible: false, reason: 'key_changed' })
    })

    // ── publishing, students, sharing, money ──
    it('publishing is never blocked by key status; the builder lists what will be hand-marked, and why', async () => {
      enforce(true)
      writerOut = { nonsense: true }
      const w = await makeWorld(); const a = await keyed(w)
      await drainAll() // failed
      const b = await svc.assignments.addQuestion(w.teacher, a.id, { type: 'short', prompt: 'Name two causes of poverty.', marks: 2 })
      const pre = await svc.assignments.publishPreview(w.teacher, a.id)
      expect(pre.handMarked.map((h) => [h.questionId, h.reason]).sort()).toEqual([[a.qid, 'key_failed'], [b.id, 'key_pending']].sort())
      expect(pre.handMarked.every((h) => /^AI suggestions are/.test(h.message))).toBe(true)
      const pub = await svc.assignments.publishAssignment(w.teacher, a.id)
      expect(pub.handMarked).toHaveLength(2)
      expect((await raw.query(`SELECT status FROM hw_assignment WHERE id = $1`, [a.id])).rows[0].status).toBe('published')
    })

    it('the publish preview only looks: it never queues a rebuild of a stale key', async () => {
      const { a } = await readyPublished({ student: false })
      rMin = 0.5 // the key is now stale
      const before = (await raw.query(`SELECT count(*)::int AS n FROM hw_question_key WHERE question_id = $1`, [a.qid])).rows[0].n
      const w = await makeWorld()
      void w
      const pre = await reg.eligibilityOfQuestion(appDb as never, a.qid, { rebuild: false })
      expect(pre).toEqual({ eligible: false, reason: 'key_stale_config' })
      expect((await raw.query(`SELECT count(*)::int AS n FROM hw_question_key WHERE question_id = $1`, [a.qid])).rows[0].n).toBe(before) // nothing queued
      expect((await reg.eligibilityOfQuestion(appDb as never, a.qid)).reason).toBe('key_stale_config') // marking does queue it
      expect((await raw.query(`SELECT count(*)::int AS n FROM hw_question_key WHERE question_id = $1`, [a.qid])).rows[0].n).toBe(before + 1)
    })

    it('students never receive key content; they do see the passage that is part of the question', async () => {
      writerOut = PASSAGE_KEY
      const w = await makeWorld(); const a = await keyed(w, { passage: 'The poverty line is the money needed for a minimum calorie intake.', modelAnswer: 'SECRET model answer text.' })
      await drainAll()
      await svc.assignments.publishAssignment(w.teacher, a.id)
      const started = await svc.submissions.startSubmission(w.s1, a.id)
      const mine = await svc.submissions.myAssignments(w.s1)
      const payload = JSON.stringify({ started, mine })
      expect(payload).toContain('minimum calorie intake') // the passage is part of the question
      for (const secret of ['Based on minimum calorie requirement', '2400 calories rural', 'It is based on calorie needs', 'SECRET model answer', 'value_points', 'valuePoints', 'referenceAnswer', 'question_key', 'rubric']) {
        expect(payload).not.toContain(secret)
      }
    })

    it('a custom question’s key is never shared across institutions; a public question’s key is, and costs the second institution nothing', async () => {
      sharedOn = true
      const wa = await makeWorld(); const wb = await makeWorld()
      // custom, same text in two institutions: each builds its own key and the library stays empty
      const ca = await keyed(wa); const cb = await keyed(wb)
      await drainAll()
      expect(counts.writer).toBe(2)
      expect(shared.rows.size).toBe(0)
      expect((await currentKey(ca.qid)).from_shared).toBe(false)
      expect((await currentKey(cb.qid)).from_shared).toBe(false)
      // a textbook exercise: built once, then served from the library
      const pa = await keyed(wa, { origin: 'textbook_exercise', originRef: { book: 'Understanding Society', chapter: CH3, exercise: 'Q2' } })
      await drainAll()
      expect(counts.writer).toBe(3)
      expect(shared.rows.size).toBe(1)
      const pb = await keyed(wb, { origin: 'textbook_exercise', originRef: { book: 'Understanding Society', chapter: CH3, exercise: 'Q2' } })
      await drainAll()
      expect(counts.writer).toBe(3) // no model call for the second institution
      const kb = await currentKey(pb.qid)
      expect(kb).toMatchObject({ status: 'ready', from_shared: true })
      expect(Number(kb.cost_paise)).toBe(0)
      void pa
    })

    it('the quota is checked before every key call: an institution over its budget gets no call; a library hit for one with budget left is free', async () => {
      sharedOn = true
      const wa = await makeWorld()
      const pub = { origin: 'textbook_exercise', originRef: { book: 'Understanding Society', chapter: CH3, exercise: 'Q2' } }
      await keyed(wa, pub)
      await drainAll() // fills the library
      expect(counts.writer).toBe(1)

      // an institution with its monthly budget used up
      const wb = await makeWorld(0)
      await raw.query(`UPDATE hw_tenant_quota SET monthly_budget_paise = 1000 WHERE organization_id = $1`, [wb.org])
      await raw.query(`INSERT INTO hw_ai_usage_monthly (organization_id, month, cost_paise) VALUES ($1, $2, 1000) ON CONFLICT (organization_id, month) DO UPDATE SET cost_paise = 1000`, [wb.org, (await import('@/lib/hw/db')).monthKey()])
      const custom = await keyed(wb)
      await drainAll()
      expect(counts.writer).toBe(1) // unchanged: no call was made
      expect(counts.embed).toBe(1) // only the first institution's retrieval: nothing was embedded for the refused one
      expect(await viewOf(wb, custom.id, custom.qid)).toMatchObject({ status: 'failed', reason: 'quota', handMarked: 'key_failed' })
      expect((await viewOf(wb, custom.id, custom.qid)).detail).toMatch(/AI quota reached/)

      // the quota is checked before the first call of any build, a library hit included, so an exhausted institution gets nothing until its budget resets
      const refused = await keyed(wb, pub)
      await drainAll()
      expect(await viewOf(wb, refused.id, refused.qid)).toMatchObject({ status: 'failed', reason: 'quota' })
      expect(counts.writer).toBe(1)

      // an institution with budget left: the library hit makes no key call and records no cost and no build
      const wd = await makeWorld(0)
      await raw.query(`UPDATE hw_tenant_quota SET monthly_budget_paise = 100000 WHERE organization_id = $1`, [wd.org])
      const hit = await keyed(wd, pub)
      await drainAll()
      expect(counts.writer).toBe(1)
      expect(await viewOf(wd, hit.id, hit.qid)).toMatchObject({ status: 'ready', fromShared: true })
      expect(Number((await currentKey(hit.qid)).cost_paise)).toBe(0)
      expect((await svc.marking.usageThisMonth(wd.admin)).thisMonth).toMatchObject({ keyBuilds: 0, keyCostPaise: 0, costPaise: 0 })

      // the older answer-count quota refuses the same way
      const wc = await makeWorld(0)
      const c2 = await keyed(wc)
      await drainAll()
      expect(await viewOf(wc, c2.id, c2.qid)).toMatchObject({ status: 'failed', reason: 'quota' })
      expect(counts.writer).toBe(1)
    })
  })

  // ── Parent view (roadmap-remaining.md workstream A) ───────────────────────────────────────────────────
  describe('Parent view', () => {
    let g: typeof import('@/lib/hw/services/guardian')
    const flag = (on: boolean) => { process.env.HW_PARENT_VIEW_ENABLED = on ? 'true' : 'false'; svc.config._resetHwConfig() }
    beforeAll(async () => { g = await import('@/lib/hw/services/guardian') })
    beforeEach(() => flag(true))
    afterEach(() => flag(false))

    async function addParent(w: World, org = w.org) {
      const id = `${org}-p${randomUUID().slice(0, 6)}`
      await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'Parent', $2, 'student')`, [id, `${id}@example.test`])
      await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'parent', now())`, [`m-${id}`, org, id])
      return { userId: id, orgId: org, role: 'parent', isPlatformStaff: false } as HwActor
    }
    async function returned(w: World) {
      const a = await publishedAssignment(w)
      const h = await studentHandsIn(w, a)
      gem.read.set(h.a2, { text: 'plants make food from sun lite', confidence: 'high' })
      await drainAll()
      const q1 = await svc.marking.questionQueue(w.teacher, a.q1, 'all'); const q2 = await svc.marking.questionQueue(w.teacher, a.q2, 'all')
      await svc.marking.acceptAiGrade(w.teacher, h.a1, q1.answers[0].suggestion!.id)
      await svc.marking.acceptAiGrade(w.teacher, h.a2, q2.answers[0].suggestion!.id)
      await svc.marking.setComment(w.teacher, h.a2, 'Good, say more about sunlight.')
      return { a, h }
    }

    // Links are made through guardian invitations (guardian-onboarding.test.ts); here a live link is inserted directly.
    const linkTo = async (w: World, p: HwActor, studentId: string) => {
      const r = await raw.query(`INSERT INTO guardian_link (guardian_user_id, student_user_id, organization_id, created_via, created_by) VALUES ($1, $2, $3, 'institution_invite', $4) RETURNING id`, [p.userId, studentId, w.org, w.admin.userId])
      return r.rows[0].id as string
    }

    it('off by default: nothing works until the owner switches it on', async () => {
      flag(false)
      const w = await makeWorld(); const p = await addParent(w)
      await expect(g.myChildren(p)).rejects.toThrow(/not switched on/)
    })

    it('a parent sees nothing of a child who is not linked: another child, a child of another institution, or after the link ended', async () => {
      const w = await makeWorld(); const other = await makeWorld(); const p = await addParent(w)
      const id = await linkTo(w, p, w.s1.userId)
      expect(await g.myChildren(p)).toEqual([{ id: w.s1.userId, name: 'User s1' }])
      await expect(g.childAssignments(p, w.s2.userId)).rejects.toThrow(/Student not found/) // a sibling who is not linked
      await expect(g.childAssignments(p, other.s1.userId)).rejects.toThrow(/Student not found/)
      expect(await g.childAssignments(p, w.s1.userId)).toEqual([])
      // students and teachers have no parent view
      await expect(g.myChildren(w.s1)).rejects.toThrow()
      await expect(g.myChildren(w.teacher)).rejects.toThrow()
      // a link made for another institution does not open this one
      const w2 = await makeWorld()
      await raw.query(`INSERT INTO guardian_link (guardian_user_id, student_user_id, organization_id, created_via, created_by) VALUES ($1, $2, $3, 'institution_invite', 'x')`, [p.userId, w2.s1.userId, w2.org])
      expect(await g.myChildren(p)).toEqual([{ id: w.s1.userId, name: 'User s1' }]) // only this institution's links
      // ending the link closes it
      await raw.query(`UPDATE guardian_link SET ended_at = now(), ended_by = 'x' WHERE id = $1`, [id])
      expect(await g.myChildren(p)).toEqual([])
      await expect(g.childAssignments(p, w.s1.userId)).rejects.toThrow(/Student not found/)
    })

    it('a linked parent sees what was set, whether it was handed in, and the result only after the teacher returns it: marks and comment, never the transcript or any AI content', async () => {
      const w = await makeWorld(); const p = await addParent(w)
      await linkTo(w, p, w.s1.userId)
      const a = await publishedAssignment(w)
      expect((await g.childAssignments(p, w.s1.userId)).find((x) => x.id === a.id)).toMatchObject({ handedIn: false, returned: false, submissionId: null })

      const h = (await returned(w)).h
      let list = (await g.childAssignments(p, w.s1.userId)).find((x) => x.handedIn)!
      expect(list).toMatchObject({ handedIn: true, returned: false, submissionId: null })
      await expect(g.childResult(p, w.s1.userId, h.sid)).rejects.toThrow(/not returned/) // before the teacher returns it

      const aid = (await raw.query(`SELECT assignment_id FROM hw_submission WHERE id = $1`, [h.sid])).rows[0].assignment_id
      await svc.marking.returnAssignment(w.teacher, aid)
      list = (await g.childAssignments(p, w.s1.userId)).find((x) => x.id === aid)!
      expect(list).toMatchObject({ handedIn: true, returned: true, submissionId: h.sid })
      const res = await g.childResult(p, w.s1.userId, h.sid)
      expect(res.total).toBeGreaterThan(0)
      expect(res.questions.find((q) => q.comment)?.comment).toBe('Good, say more about sunlight.')
      const text = JSON.stringify(res)
      for (const secret of ['plants make food from sun lite', 'transcript', 'suggest', 'accepted', 'modelAnswer', 'Plants make food using sunlight.', 'confidence']) expect(text).not.toContain(secret)
      // another parent, linked to someone else, cannot ask for this submission
      const stranger = await addParent(w)
      await linkTo(w, stranger, w.s2.userId)
      await expect(g.childResult(stranger, w.s1.userId, h.sid)).rejects.toThrow(/Student not found/)
      await expect(g.childResult(stranger, w.s2.userId, h.sid)).rejects.toThrow() // her own child's id, someone else's submission
    })
  })
})
