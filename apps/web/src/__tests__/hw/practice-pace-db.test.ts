/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// InkBuddy time, speed and handwriting against a real Postgres (Phase 4 of docs/hw-eval/inkbuddy-teacher-roadmap.md): the stopwatch and
// the pen's own writing time and handwriting facts are saved with the answer, and the result page gives the speed, the percentile among
// other learners' FIRST attempts at the same question (only with at least 20 of them), the pacing guide and the handwriting note.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-pace-db

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { gzipSync } from 'node:zlib'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice-pace-db] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres.')

Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_SELF_PRACTICE_ENABLED: 'true', HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000', HW_SELF_PRACTICE_SCOPES: '10:Science:en' })

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'
import { encodeInk, type InkStroke } from '@/lib/hw/ink/stroke-format'
import { encodeGreyPng } from '@/components/hw/ink/png-encode'
import type { HubSearchRequest, HubSearchResponse, HubResult } from '@/lib/library/hub-client'

// the R2 store, in memory (same key checks)
jest.mock('../../../../../packages/core/src/lib/hw/storage/r2', () => {
  const { assertHwKey } = jest.requireActual('../../../../../packages/core/src/lib/hw/storage/keys')
  const store = new Map<string, Uint8Array>()
  return {
    async putHwObject(key: string, body: Uint8Array) { assertHwKey(key); store.set(key, body) },
    async getHwObject(key: string) { assertHwKey(key); return store.get(key)! },
    async signedReadUrl(key: string) { assertHwKey(key); return `https://signed.test/${key}` },
  }
})

const Q = 'Describe the role of the small intestine in digestion.'
// this run's own question, so the field of other learners is exactly the one built below
const PID = `p-pace-${randomUUID().slice(0, 6)}`
const ROW: HubResult = {
  passage_id: PID, chapter_no: 5, kind: 'block', block_type: 'exercise', label: null, section_no: null, section_title: null, page_start: 99, page_end: 99, pdf_page: null,
  text: `Questions:\n 1. ${Q}`, work_id: 'work-sci-10', work_title: 'Science (Class 10)', retrieval_class: 'practice', score: { fused: 0.5, dense: 0.5 }, context: { before: [], after: [] },
}
const hub = { search: async (_req: HubSearchRequest): Promise<HubSearchResponse> => ({ scope: [], results: [ROW], warnings: [] }) }
const SIXTY = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ')

let trial: typeof import('@/lib/hw/practice/trial')
let attempt: typeof import('@/lib/hw/practice/attempt')
let subs: typeof import('@/lib/hw/services/submissions')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T

async function learner() {
  const id = `pc-${randomUUID().slice(0, 8)}`
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, 'Learner', $2, 'student', now())`, [id, `${id}@example.test`])
  await raw.query(`INSERT INTO enhanced_user_profiles (user_id, grade_level, medium) VALUES ($1, 10, 'ENGLISH') ON CONFLICT (user_id) DO NOTHING`, [id])
  await trial.startTrial(id)
  return { id, actor: { userId: id, orgId: PRACTICE_ORG_ID, role: 'student' as const, isPlatformStaff: false } }
}

/** A learner's marked answer to the question, with what it was timed at. */
async function markedAnswer(u: { id: string; actor: { userId: string } }, opts: { transcript: string; stats: Record<string, unknown>; mode?: string }) {
  const a = (await attempt.startAttempt(u.id, { classLevel: '10', subject: 'Science', medium: 'en', passageId: PID, index: 0, text: Q }, { hub })).assignmentId
  const s = await subs.startSubmission(u.actor as never, a)
  const ans = randomUUID()
  await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status, transcript_confidence, ink_stats) VALUES ($1,$2,$3,$4,$5,$6,'done',0.95,$7::jsonb)`,
    [ans, PRACTICE_ORG_ID, s.submission.id, s.questions[0].id, opts.mode ?? 'ink', opts.transcript, JSON.stringify(opts.stats)])
  await raw.query(`INSERT INTO hw_grade (answer_id, organization_id, marks, item_marks, source, graded_by) VALUES ($1, $2, 1, '[]', 'manual', $3)`, [ans, PRACTICE_ORG_ID, u.id])
  await raw.query(`UPDATE hw_submission SET status = 'returned', submitted_at = now() WHERE id = $1`, [s.submission.id])
  return { assignmentId: a, submissionId: s.submission.id }
}

suite('InkBuddy time, speed and handwriting — integration', () => {
  jest.setTimeout(120_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    trial = await import('@/lib/hw/practice/trial')
    attempt = await import('@/lib/hw/practice/attempt')
    subs = await import('@/lib/hw/services/submissions')
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })

  it('saves the stopwatch with the answer, and the pen\'s writing time and handwriting facts with the ink', async () => {
    const u = await learner()
    const a = (await attempt.startAttempt(u.id, { classLevel: '10', subject: 'Science', medium: 'en', passageId: PID, index: 0, text: Q }, { hub })).assignmentId
    const s = await subs.startSubmission(u.actor as never, a)
    const qid = s.questions[0].id
    const strokes: InkStroke[] = Array.from({ length: 20 }, (_, i) => ({
      t0: i * 400, tool: 'pen', points: [{ x: 60 + i * 20, y: 50, p: 0.5, t: 0 }, { x: 64 + i * 20, y: 58, p: 0.5, t: 100 }, { x: 68 + i * 20, y: 67, p: 0.5, t: 200 }],
    }))
    const ink = new Uint8Array(gzipSync(JSON.stringify(encodeInk({ w: 900, h: 700, strokes }))))
    const png = await encodeGreyPng(new Uint8Array(400 * 100).fill(255), 400, 100)
    await subs.storeInk(u.actor as never, s.submission.id, qid, ink, png)
    await subs.saveAnswer(u.actor as never, s.submission.id, qid, { mode: 'ink', timeSpentMs: 90_000, stopwatchMs: 75_000 })
    const st = (await one<{ s: { ink: { activeMs: number; hand: { strokes: number } }; stopwatch: { ms: number } } }>(`SELECT ink_stats AS s FROM hw_answer WHERE submission_id = $1`, [s.submission.id])).s
    expect(st.stopwatch).toEqual({ ms: 75_000 })
    expect(st.ink.activeMs).toBe(19 * 400 + 200) // each stroke and every short gap
    expect(st.ink.hand).toMatchObject({ strokes: 20, crossing: 0 })
  })

  it('the result: speed from the stopwatch, the percentile among others\' first attempts, the guide and the handwriting note', async () => {
    // twenty others answered first at 6..25 words a minute (60 words each); one of them tried again much faster, which does not count
    for (let i = 0; i < 20; i++) {
      const o = await learner()
      const wpm = 6 + i
      const first = await markedAnswer(o, { transcript: SIXTY, stats: { ink: { activeMs: Math.round((60 / wpm) * 60_000), hand: { strokes: 40, size: 0.4, crossing: 0 } } } })
      if (i === 0) {
        await raw.query(`UPDATE hw_assignment SET created_at = now() - interval '1 day' WHERE id = $1`, [first.assignmentId])
        const again = await import('@/lib/hw/practice/attempts')
        const second = await again.writeAgain(o.id, first.assignmentId)
        const s2 = await subs.startSubmission(o.actor as never, second.assignmentId)
        const ans = randomUUID()
        await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status, ink_stats) VALUES ($1,$2,$3,$4,'ink',$5,'done',$6::jsonb)`,
          [ans, PRACTICE_ORG_ID, s2.submission.id, s2.questions[0].id, SIXTY, JSON.stringify({ ink: { activeMs: 30_000 } })]) // 120 wpm
        await raw.query(`INSERT INTO hw_grade (answer_id, organization_id, marks, item_marks, source, graded_by) VALUES ($1, $2, 1, '[]', 'manual', $3)`, [ans, PRACTICE_ORG_ID, o.id])
        await raw.query(`UPDATE hw_submission SET status = 'returned', submitted_at = now() WHERE id = $1`, [s2.submission.id])
      }
    }
    const me = await learner()
    // 60 words in 4 minutes on my stopwatch = 15 words a minute; the pen says faster, but the stopwatch is mine
    const mine = await markedAnswer(me, { transcript: `${SIXTY} [?] [?]`, stats: { stopwatch: { ms: 240_000 }, ink: { activeMs: 120_000, hand: { strokes: 40, size: 0.4, crossing: 0 } } } })
    const r = await subs.myResult(me.actor as never, mine.submissionId)
    const pace = (r.questions[0] as unknown as { pace: { speed: { wpm: number; source: string }; percentile: number | null; peers: number; guide: unknown[]; hand: string } }).pace
    expect(pace.speed).toMatchObject({ wpm: 15, source: 'stopwatch' })
    // twenty others, first attempts only (the 120 wpm second attempt is not in the field): 9 slower (6..14), one tie (15): 9.5 of 20
    expect(pace.peers).toBe(20)
    expect(pace.percentile).toBe(48)
    expect(pace.guide).toHaveLength(3)
    expect(pace.hand).toBe('unclear') // two words could not be read
  })
})
