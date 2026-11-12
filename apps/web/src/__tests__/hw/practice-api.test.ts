/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Self-practice, phase 3: the tRPC procedures behind the Virat Evaluator tab, against a real Postgres (migration 031). The session and the
// library hub are the only fakes.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/practice-api

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[practice-api] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 031.')

Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '',
  HW_SELF_PRACTICE_ENABLED: 'true',
  HW_SELF_PRACTICE_TRIAL_DAYS: '7',
  HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000',
})

// The session: set per test.
let mockUser: string | null = null
jest.mock('../../../../../packages/core/src/auth', () => ({
  auth: { api: { getSession: async () => (mockUser ? { user: { id: mockUser, role: 'student' }, session: { activeOrganizationId: null } } : null) } },
}))
jest.mock('next/headers', () => ({ headers: jest.fn().mockResolvedValue(new Map()), cookies: jest.fn() }))

// The library hub: on, off, or down.
let hubMode: 'on' | 'off' = 'on'
const hubRow = {
  passage_id: 'p-api-1', chapter_no: 2, kind: 'block', block_type: 'exercise', label: null, section_no: null, section_title: null, page_start: 31, page_end: 31, pdf_page: null,
  text: 'Questions:\n 1. Name the gas released during photosynthesis.\n 2. Why do leaves look green?', work_id: 'w1', work_title: 'Science (Class 9)',
  retrieval_class: 'practice', score: { fused: 0.5, dense: 0.5 }, context: { before: [], after: [] },
}
jest.mock('../../../../../packages/core/src/lib/library/search', () => ({
  libraryHubEnabled: () => hubMode === 'on',
  legacyIngestionDisabled: () => false,
  searchLibrary: async () => ({ scope: [], results: [hubRow], warnings: [] }),
}))

import { PRACTICE_ORG_ID } from '@/lib/hw/practice/rules'

let router: typeof import('@/lib/trpc/routers/hw')
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const uid = (k: string) => `pi-${randomUUID().slice(0, 8)}-${k}`
async function addUser(k: string) {
  const id = uid(k)
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [id, `${k} Person`, `${id}@example.test`])
  // InkBuddy offers a learner their own class (13 Nov 2026): the test learner studies Class 9
  await raw.query(`INSERT INTO enhanced_user_profiles (user_id, grade_level, medium) VALUES ($1, 9, 'ENGLISH') ON CONFLICT (user_id) DO NOTHING`, [id])
  return id
}
const caller = (userId: string | null) => router.hwRouter.createCaller({
  userId, userRole: 'student', tenantId: 'default', req: new Request('http://localhost/api/trpc'), sessionClaims: null,
} as never)
const as = (id: string | null) => { mockUser = id; return caller(id) }
const pickInput = { classLevel: '9', subject: 'Science', medium: 'en' as const }
const Q = 'Name the gas released during photosynthesis.'

suite('self-practice phase 3 — API', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    router = await import('@/lib/trpc/routers/hw')
    config._resetHwConfig()
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })
  afterEach(() => { mockUser = null; hubMode = 'on' })

  describe('status', () => {
    it('a new independent learner can start; nothing is started yet', async () => {
      const u = await addUser('s1')
      expect(await as(u).practice.status()).toMatchObject({ enabled: true, eligible: true, started: false, active: false, trialDays: 7, allowanceLeftPct: 100, message: null })
    })

    it('says "not ready" until the library and the answer keys are wired, so the screen offers "coming soon" instead of the trial', async () => {
      const u = await addUser('s0')
      const KEYS = { HW_KEY_WRITER_MODEL: 'google/gemini-3.6-flash', HW_KEY_VERIFIER_MODEL: 'openai/gpt-5.4-mini', HW_KEY_R_MIN: '0.5', OPENROUTER_API_KEY: 'test-key', HW_KEY_WRITER_PROVIDER: 'openrouter', HW_KEY_VERIFIER_PROVIDER: 'openrouter', HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP: 'false' }
      const saved = Object.fromEntries(Object.keys(KEYS).map((k) => [k, process.env[k]]))
      try {
        // Library on, keys not configured.
        expect((await as(u).practice.status()) as { ready?: boolean }).toMatchObject({ ready: false })
        // Keys configured, library off.
        Object.assign(process.env, KEYS); config._resetHwConfig(); hubMode = 'off'
        expect((await as(u).practice.status()) as { ready?: boolean }).toMatchObject({ ready: false })
        // Both.
        hubMode = 'on'
        expect((await as(u).practice.status()) as { ready?: boolean }).toMatchObject({ ready: true })
        // Same model family for writer and verifier, or no calibrated R_min: not ready.
        process.env.HW_KEY_VERIFIER_MODEL = 'google/gemini-3.5-flash-lite'; config._resetHwConfig()
        expect((await as(u).practice.status()) as { ready?: boolean }).toMatchObject({ ready: false })
        process.env.HW_KEY_VERIFIER_MODEL = KEYS.HW_KEY_VERIFIER_MODEL; delete process.env.HW_KEY_R_MIN; config._resetHwConfig()
        expect((await as(u).practice.status()) as { ready?: boolean }).toMatchObject({ ready: false })
        // Everything set but the provider has no API key (production today: keys routed through OpenRouter, no OpenRouter key).
        process.env.HW_KEY_R_MIN = '0.5'; delete process.env.OPENROUTER_API_KEY; config._resetHwConfig()
        expect((await as(u).practice.status()) as { ready?: boolean }).toMatchObject({ ready: false })
      } finally {
        for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
        config._resetHwConfig()
      }
    })

    it('OpenAI for both writer and verifier needs the owner to accept one family; ready then also needs a textbook group that can be marked', async () => {
      const u = await addUser('s00')
      const ENV = {
        HW_KEY_WRITER_PROVIDER: 'openai', HW_KEY_WRITER_MODEL: 'gpt-6-luna', HW_KEY_VERIFIER_PROVIDER: 'openai', HW_KEY_VERIFIER_MODEL: 'gpt-5.4-mini', HW_KEY_R_MIN: '0.5',
        OPENAI_API_KEY: 'test-key', HW_GRADE_PROVIDER: 'openai', HW_GRADE_MODEL: 'gpt-6-luna', HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP: 'false',
      }
      const touched = [...Object.keys(ENV), 'HW_KEY_ALLOW_SAME_FAMILY']
      const saved = Object.fromEntries(touched.map((k) => [k, process.env[k]]))
      const ready = async () => ((await as(u).practice.status()) as { ready?: boolean }).ready
      let groupKey: string | null = null
      try {
        Object.assign(process.env, ENV); config._resetHwConfig(); hubMode = 'on'
        expect(await ready()).toBe(false) // one family, not accepted
        process.env.HW_KEY_ALLOW_SAME_FAMILY = 'true'; config._resetHwConfig()
        expect(await ready()).toBe(true) // accepted, eligibility not required here
        // The same model checking itself is never accepted.
        process.env.HW_KEY_VERIFIER_MODEL = 'gpt-6-luna'; config._resetHwConfig()
        expect(await ready()).toBe(false)
        process.env.HW_KEY_VERIFIER_MODEL = 'gpt-5.4-mini'
        // Eligibility required (the default): no textbook group can be marked yet.
        process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'true'; config._resetHwConfig()
        expect(await ready()).toBe(false)
        // A textbook-key group eligible for a DIFFERENT setup does not count; one for the running setup does.
        const { runningConfig } = await import('@/lib/hw/eligibility/registry')
        groupKey = `${uid('g').toLowerCase()}|short|en|textbook_key`
        const insert = (hash: string) => raw.query(`INSERT INTO hw_eligibility (group_key, subject, question_type, language, scheme_source, status, config_hash, gate_result_id, dataset_versions, decided_by, reason) VALUES ($1,'Science','short','en','textbook_key','eligible',$2,'test-gate',ARRAY['test@v1'],'test','test')`, [groupKey, hash])
        await insert('f'.repeat(64))
        expect(await ready()).toBe(false)
        await raw.query('UPDATE hw_eligibility SET config_hash = $2 WHERE group_key = $1', [groupKey, runningConfig().hash])
        expect(await ready()).toBe(true)
        // An eligible group of another kind of scheme does not count.
        await raw.query("UPDATE hw_eligibility SET scheme_source = 'teacher_rubric' WHERE group_key = $1", [groupKey])
        expect(await ready()).toBe(false)
      } finally {
        if (groupKey) await raw.query('DELETE FROM hw_eligibility WHERE group_key = $1', [groupKey])
        for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
        config._resetHwConfig()
      }
    })

    it('tells the screen which books are on offer, and refuses others', async () => {
      const u = await addUser('s01')
      expect((await as(u).practice.status()) as { scopes?: unknown }).toMatchObject({ scopes: [{ classLevel: 9, subject: 'Science', medium: 'en' }] })
      await as(u).practice.start()
      await expect(as(u).practice.search({ ...pickInput, subject: 'Mathematics', query: 'algebra' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
      const saved = process.env.HW_SELF_PRACTICE_SCOPES
      try {
        process.env.HW_SELF_PRACTICE_SCOPES = '9:Science:en,10:Mathematics:en'; config._resetHwConfig()
        // a Class 9 learner is offered Class 9 only (owner, 13 Nov 2026), however many classes the library has
        expect(((await as(u).practice.status()) as { scopes?: unknown[] }).scopes).toEqual([{ classLevel: 9, subject: 'Science', medium: 'en' }])
        await expect(as(u).practice.search({ ...pickInput, classLevel: '10', subject: 'Mathematics', query: 'algebra' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
        // once their profile says Class 10, they are offered Class 10
        await raw.query(`UPDATE enhanced_user_profiles SET grade_level = 10 WHERE user_id = $1`, [u])
        expect(((await as(u).practice.status()) as { scopes?: unknown[]; classLevels?: number[] })).toMatchObject({ scopes: [{ classLevel: 10, subject: 'Mathematics', medium: 'en' }], classLevels: [10], classSet: true })
        await expect(as(u).practice.search({ ...pickInput, classLevel: '10', subject: 'Mathematics', query: 'algebra' })).resolves.toMatchObject({ available: true })
      } finally { if (saved === undefined) delete process.env.HW_SELF_PRACTICE_SCOPES; else process.env.HW_SELF_PRACTICE_SCOPES = saved; config._resetHwConfig() }
    })

    it('a learner with no class set is offered no book and told so', async () => {
      const u = await addUser('s01b')
      await raw.query(`DELETE FROM enhanced_user_profiles WHERE user_id = $1`, [u])
      expect(await as(u).practice.status()).toMatchObject({ scopes: [], classSet: false, classLevels: [] })
      await as(u).practice.start()
      await expect(as(u).practice.search({ ...pickInput, query: 'photosynthesis' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('someone in an institution may start a trial too (owner, 13 Nov 2026)', async () => {
      const u = await addUser('s2')
      const org = uid('school')
      await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org])
      await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [uid('m'), org, u])
      expect(await as(u).practice.status()).toMatchObject({ enabled: true, eligible: true, started: false })
      expect(await as(u).practice.start()).toMatchObject({ started: true })
    })

    it('says "off" while the feature is off', async () => {
      const u = await addUser('s3')
      process.env.HW_SELF_PRACTICE_ENABLED = 'false'; config._resetHwConfig()
      try {
        expect(await as(u).practice.status()).toEqual({ enabled: false })
        await expect(as(u).practice.start()).rejects.toMatchObject({ code: 'FORBIDDEN' })
      } finally { process.env.HW_SELF_PRACTICE_ENABLED = 'true'; config._resetHwConfig() }
    })

    it('needs a signed-in user', async () => {
      await expect(as(null).practice.status()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
  })

  describe('the trial and a question, end to end through the API', () => {
    it('starts a trial, shows it, finds a question, starts it, and the ordinary student screens work on it', async () => {
      const u = await addUser('e1')
      const api = as(u)
      expect((await api.practice.start()).started).toBe(true)
      expect((await api.practice.start()).started).toBe(false) // idempotent
      expect(await api.practice.status()).toMatchObject({ started: true, active: true, daysLeft: 7, allowanceLeftPct: 100, message: null })
      // hw.status now places the learner in the practice space, as a student, enabled.
      expect(await api.status()).toMatchObject({ enabled: true, role: 'student', orgId: PRACTICE_ORG_ID, practice: true })

      const found = await api.practice.search({ ...pickInput, query: 'photosynthesis gas' })
      expect(found.available).toBe(true)
      expect(found.questions[0]).toMatchObject({ text: Q, passageId: 'p-api-1', index: 0, chapter: 2, page: 31, book: 'Science (Class 9)' })

      const made = await api.practice.startQuestion({ ...pickInput, passageId: 'p-api-1', index: 0, text: Q })
      expect(made.reused).toBe(false)
      const list = await api.student.assignments()
      expect(list.map((a) => a.id)).toEqual([made.assignmentId])
      const opened = await api.student.start({ assignmentId: made.assignmentId })
      expect(opened.practice).toBe(true)
      expect(opened.submission.status).toBe('draft')
      expect(opened.questions[0].prompt).toBe(Q)
    })

    it("the practice flag comes from the assignment's institution, so ordinary school work keeps its teacher wording", async () => {
      const src = (await import('node:fs')).readFileSync(require.resolve('../../../../../packages/core/src/lib/hw/services/submissions'), 'utf8')
      expect(src).toContain('practice: a.organizationId === PRACTICE_ORG_ID')
    })

    it('"write it again" goes through the API: a held answer becomes a draft, a stranger gets nothing', async () => {
      const u = await addUser('e5')
      const api = as(u)
      await api.practice.start()
      const made = await api.practice.startQuestion({ ...pickInput, passageId: 'p-api-1', index: 0, text: Q })
      const opened = await api.student.start({ assignmentId: made.assignmentId })
      const sid = opened.submission.id
      await raw.query(`INSERT INTO hw_answer (id, organization_id, submission_id, question_id, mode, transcript, transcript_status) VALUES ($1,$2,$3,$4,'ink','x','done')`, [randomUUID(), PRACTICE_ORG_ID, sid, opened.questions[0].id])
      await raw.query(`UPDATE hw_submission SET status = 'ready_for_review', submitted_at = now() WHERE id = $1`, [sid])
      const stranger = await addUser('e6')
      await as(stranger).practice.start()
      await expect(as(stranger).practice.retry({ submissionId: sid })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect(await as(u).practice.retry({ submissionId: sid })).toEqual({ submissionId: sid })
      expect((await as(u).student.start({ assignmentId: made.assignmentId })).submission.status).toBe('draft')
    })

    it('search says so when the library hub is off, and a question cannot be started then', async () => {
      const u = await addUser('e2')
      const api = as(u)
      await api.practice.start()
      hubMode = 'off'
      const found = await api.practice.search({ ...pickInput, query: 'photosynthesis' })
      expect(found).toMatchObject({ available: false, questions: [] })
      expect(/[ऀ-ॿ]/.test(found.message?.hi ?? '')).toBe(true)
      await expect(api.practice.startQuestion({ ...pickInput, passageId: 'p-api-1', index: 0, text: Q })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('refuses a question that is not the book\'s, and input that is not well formed', async () => {
      const u = await addUser('e3')
      const api = as(u)
      await api.practice.start()
      await expect(api.practice.startQuestion({ ...pickInput, passageId: 'p-api-1', index: 0, text: 'Write a long essay about anything you like.' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(api.practice.search({ ...pickInput, medium: 'fr' as never, query: 'photosynthesis' })).rejects.toBeTruthy()
      await expect(api.practice.search({ ...pickInput, query: 'a' })).rejects.toBeTruthy()
      await expect(api.practice.search({ ...pickInput, classLevel: '13', query: 'photosynthesis' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })

    it('stops with a plain two-language message once the trial is used up, but still lists past work', async () => {
      const u = await addUser('e4')
      const api = as(u)
      await api.practice.start()
      const made = await api.practice.startQuestion({ ...pickInput, passageId: 'p-api-1', index: 0, text: Q })
      await raw.query(`UPDATE hw_practice_trial SET spent_paise = 1000, state = 'used_up' WHERE user_id = $1`, [u])
      const st = await api.practice.status()
      expect(st).toMatchObject({ started: true, active: false, allowanceLeftPct: 0 })
      expect(st.message?.en).toMatch(/free trial/)
      expect(/[ऀ-ॿ]/.test(st.message?.hi ?? '')).toBe(true)
      const err = await api.practice.startQuestion({ ...pickInput, passageId: 'p-api-1', index: 1, text: 'Why do leaves look green?' }).catch((e) => e)
      expect(err).toMatchObject({ code: 'TOO_MANY_REQUESTS' })
      expect(/[ऀ-ॿ]/.test(err.message)).toBe(true)
      expect((await api.student.assignments()).map((a) => a.id)).toEqual([made.assignmentId])
    })
  })
})
