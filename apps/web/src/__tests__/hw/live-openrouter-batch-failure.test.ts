/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Cost work phase 1b, task 4.2. What happens to a job and its answer when OpenRouter takes an image
// batch (HTTP 202) and then fails it? Real OpenRouter, a real scratch Postgres, the worker's own
// drain loop. Only R2 is faked (in memory). Costs well under ₹1. Skipped unless asked for:
//
//   HW_LIVE_OPENROUTER=1 HW_ITEST_DATABASE_URL=postgresql://postgres:itest@127.0.0.1:5461/hw_itest \
//     npx jest src/__tests__/hw/live-openrouter-batch-failure
//
// The worker never creates this batch itself (OpenRouter reads run synchronously because the provider
// cannot batch images), so the test creates the failing batch the way a provider switch or a future
// change could, and puts the job in the state the worker would have left it in.

import { gzipSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { appendFileSync, readFileSync } from 'node:fs'
import { encodeInk } from '@/lib/hw/ink/stroke-format'
import { encodeGreyPng } from '@/components/hw/ink/png-encode'
import type { HwActor } from '@/lib/hw/access/policy'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const LIVE = process.env.HW_LIVE_OPENROUTER === '1'
const suite = DB_URL && LIVE ? describe : describe.skip
if (!(DB_URL && LIVE)) console.warn('[hw] live OpenRouter batch-failure check SKIPPED: set HW_LIVE_OPENROUTER=1 and HW_ITEST_DATABASE_URL.')

jest.mock('../../../../../packages/core/src/lib/hw/storage/r2', () => {
  const { assertHwKey } = jest.requireActual('../../../../../packages/core/src/lib/hw/storage/keys')
  const store = new Map<string, Uint8Array>()
  return {
    async putHwObject(key: string, body: Uint8Array) { assertHwKey(key); store.set(key, body) },
    async getHwObject(key: string) { assertHwKey(key); const v = store.get(key); if (!v) throw new Error(`no object ${key}`); return v },
    async signedReadUrl(key: string) { assertHwKey(key); return `https://signed.test/${key}` },
  }
})

// The OpenRouter key comes from the eval env file, never from the test source.
function envFileValue(name: string): string | undefined {
  try {
    const m = readFileSync(`${process.cwd()}/../api/.env.local`, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'))
    return m?.[1]?.trim().replace(/^"|"$/g, '')
  } catch { return undefined }
}

// The repo's jest.setup replaces fetch with a mock; this check talks to the real provider.
if (LIVE) {
  // jest.setup replaces fetch with a mock, and undici does not run inside jest's sandbox, so the live
  // check talks to the provider through node:https. It answers to mockClear() because jest.setup calls it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const https = require('node:https') as typeof import('node:https')
  const live = (url: string, init: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
    const req = https.request(url, { method: init.method ?? 'GET', headers: init.headers as Record<string, string> }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(new Response(Buffer.concat(chunks).toString('utf8'), { status: res.statusCode ?? 0 })))
    })
    req.on('error', reject)
    if (init.body) req.write(init.body as string)
    req.end()
  })
  global.fetch = Object.assign(live, { mockClear: () => undefined, mockReset: () => undefined }) as unknown as typeof fetch
}

Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '',
  HW_AI_PROVIDER: 'openrouter',
  OPENROUTER_API_KEY: envFileValue('OPENROUTER_API_KEY') ?? '',
  HW_READ_MODEL: 'google/gemini-3.5-flash-lite',
  HW_ESCALATE_MODEL: 'google/gemini-3.6-flash',
  HW_GRADE_MODEL: 'google/gemini-3.5-flash-lite',
  HW_RUBRIC_MODEL: 'google/gemini-3.5-flash-lite',
  HW_BATCH_ENABLED: 'true',
  HW_GRADE_DEBOUNCE_SECONDS: '0',
  HW_BATCH_POLL_SECONDS: '10',
  HW_PRICE_TABLE_JSON: envFileValue('HW_PRICE_TABLE_JSON') ?? '',
})
delete process.env.HW_HOMEWORK_BATCH_ENABLED

let svc: {
  assignments: typeof import('@/lib/hw/services/assignments')
  submissions: typeof import('@/lib/hw/services/submissions')
  marking: typeof import('@/lib/hw/services/marking')
  runner: typeof import('@/lib/hw/jobs/runner')
  config: typeof import('@/lib/hw/config')
  pool: import('pg').Pool
}
let raw: Pool

async function makeWorld() {
  const org = `it-${randomUUID().slice(0, 8)}`
  const u = (k: string) => `${org}-${k}`
  for (const [k, role] of [['t', 'teacher'], ['s1', 'student']] as const) {
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, $2, $3, $4)`, [u(k), `User ${k}`, `${u(k)}@example.test`, role])
  }
  await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org])
  for (const [k, role] of [['t', 'teacher'], ['s1', 'student']]) await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`, [`m-${u(k)}`, org, u(k), role])
  const classId = `${org}-c9`
  await raw.query(`INSERT INTO institution_classes (id, organization_id, name, level) VALUES ($1, $2, 'Class 9', 9)`, [classId, org])
  await raw.query(`INSERT INTO student_enrollments (id, organization_id, user_id, class_id, status) VALUES ($1, $2, $3, $4, 'active')`, [`e-${u('s1')}`, org, u('s1'), classId])
  await raw.query(`INSERT INTO hw_class_teacher (id, organization_id, class_id, teacher_id, subject) VALUES ($1, $2, $3, $4, 'Science')`, [`l-${org}`, org, classId, u('t')])
  await raw.query(`INSERT INTO hw_tenant_quota (organization_id, enabled, monthly_answer_quota) VALUES ($1, true, 100)`, [org])
  const actor = (k: string, role: HwActor['role']): HwActor => ({ userId: u(k), orgId: org, role, isPlatformStaff: false })
  return { org, classId, teacher: actor('t', 'teacher'), s1: actor('s1', 'student') }
}

/** One ink answer submitted; returns the read job's id, the answer id and the submission id. */
async function submitInk(w: Awaited<ReturnType<typeof makeWorld>>) {
  const { id } = await svc.assignments.createAssignment(w.teacher, { classId: w.classId, sectionId: null, subject: 'Science', title: 'Live check', allowedModes: ['ink'], dueAt: new Date(Date.now() + 5 * 24 * 3_600_000) })
  const q = await svc.assignments.addQuestion(w.teacher, id, { type: 'short', prompt: 'What is photosynthesis?', marks: 2, modelAnswer: 'Plants make food using sunlight.' })
  await svc.assignments.setRubric(w.teacher, q.id, [{ kind: 'key_point', description: 'Plants make food', marks: 1 }, { kind: 'key_point', description: 'Uses sunlight', marks: 1 }])
  await svc.assignments.publishAssignment(w.teacher, id)
  const started = await svc.submissions.startSubmission(w.s1, id)
  const doc = { w: 600, h: 300, strokes: [{ t0: 0, tool: 'pen' as const, points: [{ x: 10, y: 20, p: 0.5, t: 0 }, { x: 60, y: 40, p: 0.6, t: 16 }] }] }
  await svc.submissions.storeInk(w.s1, started.submission.id, q.id, new Uint8Array(gzipSync(JSON.stringify(encodeInk(doc)))), await encodeGreyPng(new Uint8Array(400 * 100).fill(255), 400, 100))
  await svc.submissions.submit(w.s1, started.submission.id)
  const a = (await raw.query(`SELECT id FROM hw_answer WHERE submission_id = $1`, [started.submission.id])).rows[0].id as string
  const job = (await raw.query(`SELECT id FROM hw_ai_job WHERE submission_id = $1 AND kind = 'read'`, [started.submission.id])).rows[0].id as string
  return { assignmentId: id, sid: started.submission.id, answerId: a, jobId: job }
}

/** A real OpenRouter batch with an inline image: accepted, then failed by the provider. */
async function failingImageBatch(): Promise<string> {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const model = 'google/gemini-3.5-flash-lite'
  const res = await fetch('https://openrouter.ai/api/v1/batches', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: '/v1/chat/completions', model, completion_window: '24h', requests: [{ custom_id: 'x', body: { model, messages: [{ role: 'user', content: [{ type: 'text', text: 'read' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${png}`, detail: 'low' } }] }] } }] }),
  })
  const b = (await res.json()) as { id: string }
  note(`[live] OpenRouter accepted the image batch: HTTP ${res.status}, id ${b.id}`)
  for (let i = 0; i < 30; i++) {
    const g = (await (await fetch(`https://openrouter.ai/api/v1/batches/${b.id}`, { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } })).json()) as { status: string; error?: { message?: string } }
    if (g.status === 'failed') { note(`[live] ...then failed it: ${g.error?.message}`); return b.id }
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw new Error('the provider did not fail the batch within a minute')
}

// jest.setup silences console output, so what the check saw goes to a file as well.
const note = (line: string) => { console.log(line); if (process.env.HW_LIVE_LOG) appendFileSync(process.env.HW_LIVE_LOG, `${line}
`) }

async function snapshot(label: string, w: Awaited<ReturnType<typeof makeWorld>>, s: Awaited<ReturnType<typeof submitInk>>) {
  const jobs = (await raw.query(`SELECT kind, status, attempts, error, provider FROM hw_ai_job WHERE submission_id = $1 OR question_id IN (SELECT question_id FROM hw_answer WHERE submission_id = $1) ORDER BY created_at`, [s.sid])).rows
  const ans = (await raw.query(`SELECT transcript_status, failure_reason FROM hw_answer WHERE id = $1`, [s.answerId])).rows[0]
  const sub = (await raw.query(`SELECT status FROM hw_submission WHERE id = $1`, [s.sid])).rows[0]
  const ov = (await svc.marking.classOverview(w.teacher, s.assignmentId)) as unknown as { aiWork?: unknown; failedJobs: { kind: string; error: string }[] }
  note(`[live] ${label}\n  jobs: ${JSON.stringify(jobs)}\n  answer: ${JSON.stringify(ans)}\n  submission: ${sub.status}\n  teacher sees: failedJobs ${JSON.stringify(ov.failedJobs)}${ov.aiWork ? `, aiWork ${JSON.stringify(ov.aiWork)}` : ''}`)
  return { jobs, ans, sub, ov }
}

suite('OpenRouter takes an image batch and fails it', () => {
  jest.setTimeout(180_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    svc = {
      assignments: await import('@/lib/hw/services/assignments'),
      submissions: await import('@/lib/hw/services/submissions'),
      marking: await import('@/lib/hw/services/marking'),
      runner: await import('@/lib/hw/jobs/runner'),
      config: await import('@/lib/hw/config'),
      pool: db.getPool(),
    }
  })
  afterAll(async () => { await raw?.end(); await svc?.pool.end() })

  const park = async (s: Awaited<ReturnType<typeof submitInk>>, batchId: string, managed: boolean) => {
    const now = new Date()
    const payload = { tier: 1, answerIds: [s.answerId], ...(managed ? { readyBy: new Date(now.getTime() + 24 * 3_600_000).toISOString(), submittedAt: now.toISOString() } : {}) }
    await raw.query(`UPDATE hw_ai_job SET status = 'batch_pending', batch_ref = $2, provider = 'openrouter', model = 'google/gemini-3.5-flash-lite', payload_ref = $3, run_after = now() WHERE id = $1`, [s.jobId, batchId, JSON.stringify(payload)])
  }

  it('HW_BATCH_ENABLED only (no homework flag): the failed batch is also re-run on the standard path, visibly', async () => {
    delete process.env.HW_HOMEWORK_BATCH_ENABLED; svc.config._resetHwConfig()
    const w = await makeWorld(); const s = await submitInk(w)
    await park(s, await failingImageBatch(), false)
    const r = await svc.runner.drain('live', 30_000)
    expect(r.errors).toEqual([])
    await snapshot('legacy, flag off: right after the poll saw the failed batch', w, s)
    // The job is retried after a backoff: let the backoff pass and see where it ends.
    await raw.query(`UPDATE hw_ai_job SET run_after = now() WHERE status = 'queued'`)
    await svc.runner.drain('live', 60_000)
    const out = await snapshot('legacy, flag off: after the retry', w, s)
    expect(['done', 'not_needed']).toContain(out.ans.transcript_status)
    // Found in phase 1b: before the fix the first snapshot showed a pending answer with no reason; now the reason is on the overview.
    expect(JSON.stringify(out.ov)).toContain('Re-run on the standard path')
  })

  it('homework batch flag on: the failed batch is re-run on the standard path, visibly', async () => {
    process.env.HW_HOMEWORK_BATCH_ENABLED = 'true'; svc.config._resetHwConfig()
    const w = await makeWorld(); const s = await submitInk(w)
    await park(s, await failingImageBatch(), true)
    await svc.runner.drain('live', 30_000)
    await snapshot('managed, after the poll (job requeued on the standard path)', w, s)
    await raw.query(`UPDATE hw_ai_job SET run_after = now() WHERE status = 'queued'`)
    await svc.runner.drain('live', 60_000)
    const out = await snapshot('managed, after the standard re-run', w, s)
    expect(out.jobs.some((j: { status: string }) => j.status === 'failed')).toBe(false)
    expect(['done', 'not_needed']).toContain(out.ans.transcript_status)
    expect(JSON.stringify(out.ov)).toContain('Re-run on the standard path')
    delete process.env.HW_HOMEWORK_BATCH_ENABLED; svc.config._resetHwConfig()
  })
})
