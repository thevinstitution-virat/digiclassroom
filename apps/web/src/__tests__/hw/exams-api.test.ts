/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Exam packages, phase 2: the hw.exams.admin procedures — only a super-admin gets in, errors arrive as readable tRPC errors, grants find the
// learner by email. The builder itself is covered by exams-builder-db.test.ts.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-api     (needs migrations 032-034)

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[exams-api] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032-034.')
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' })

jest.mock('../../../../../packages/core/src/auth', () => ({ auth: { api: { getSession: async () => null } } }))
jest.mock('next/headers', () => ({ headers: jest.fn().mockResolvedValue(new Map()), cookies: jest.fn() }))

let router: typeof import('@/lib/trpc/routers/hw')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool
const packageIds: string[] = []
const userIds: string[] = []

const caller = (userRole: string) => router.hwRouter.createCaller({
  userId: 'owner-1', userRole, tenantId: 'default', req: new Request('http://localhost/api/trpc'), sessionClaims: null,
} as never)
const pkgInput = () => ({ board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `a-${randomUUID().slice(0, 8)}`, title: 'API package' })

suite('exam packages — super-admin API', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    router = await import('@/lib/trpc/routers/hw')
  })
  afterAll(async () => {
    if (packageIds.length) await raw.query(`DELETE FROM hw_exam_package WHERE id = ANY($1) AND status = 'draft'`, [packageIds])
    if (userIds.length) await raw.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds])
    await raw?.end()
    await dbMod?.getPool().end()
  })

  it.each(['student', 'teacher', 'admin'])('a %s cannot use the builder', async (role) => {
    await expect(caller(role).exams.admin.list()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(caller(role).exams.admin.create(pkgInput())).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('a super-admin creates a package, sees it, and gets readable refusals', async () => {
    const sa = caller('super_admin')
    const input = pkgInput()
    const { id } = await sa.exams.admin.create(input)
    packageIds.push(id)
    expect((await sa.exams.admin.list()).find((p) => p.id === id)).toMatchObject({ slug: input.slug, status: 'draft', sets: 0 })
    await expect(sa.exams.admin.create(input)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('a package with this board, class, exam year and slug') })
    await expect(sa.exams.admin.publish({ packageId: id })).resolves.toEqual({ published: false, problems: ['Publish at least one set first.'] })
    await expect(sa.exams.admin.get({ packageId: 'no-such-package' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(sa.exams.admin.create({ ...pkgInput(), slug: 'Bad Slug' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('the learner procedures are open to a student, and shut while HW_EXAMS_ENABLED is off', async () => {
    const config = await import('@/lib/hw/config')
    const st = caller('student')
    try {
      process.env.HW_EXAMS_ENABLED = 'false'; config._resetHwConfig()
      await expect(st.exams.enabled()).resolves.toEqual({ enabled: false })
      await expect(st.exams.catalogue()).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('not open yet') })
      process.env.HW_EXAMS_ENABLED = 'true'; config._resetHwConfig()
      await expect(st.exams.enabled()).resolves.toEqual({ enabled: true })
      await expect(st.exams.catalogue()).resolves.toEqual(expect.any(Array))
      await expect(st.exams.attempt({ attemptId: 'not-mine' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      delete process.env.HW_EXAMS_ENABLED; config._resetHwConfig()
    }
  })

  it('grants a package by email; an unknown email is NOT_FOUND', async () => {
    const sa = caller('super_admin')
    const { id } = await sa.exams.admin.create(pkgInput())
    packageIds.push(id)
    const u = `ea-${randomUUID().slice(0, 8)}`
    userIds.push(u)
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`])
    const g = await sa.exams.admin.grant({ email: ` ${u}@EXAMPLE.TEST `, packageId: id, attemptsPerSet: 3 })
    expect((await raw.query(`SELECT user_id, granted_by, attempts_per_set FROM hw_exam_entitlement WHERE id = $1`, [g.id])).rows[0])
      .toEqual({ user_id: u, granted_by: 'owner-1', attempts_per_set: 3 })
    await expect(sa.exams.admin.grant({ email: 'nobody@example.test', packageId: id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
