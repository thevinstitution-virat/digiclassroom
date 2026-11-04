/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Guardian onboarding (migration 030) against a real Postgres: B2B invitations from an institution admin, B2C invitations from the super admin,
// accepting, and the rules that keep the link between the right people. Mail is faked (deps.send); nothing else is.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/guardian-onboarding

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[guardian] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 030.')

Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_FEATURE_DEFAULT_ENABLED: 'false', GUARDIAN_INVITES_ENABLED: 'true' })

type Caller = import('@/lib/guardian/onboarding').Caller
type Onb = typeof import('@/lib/guardian/onboarding')
let onb: Onb
let config: typeof import('@/lib/hw/config')
let dbMod: typeof import('@/lib/db/connection')
let raw: Pool

const sent: { to: string; subject: string; html: string }[] = []
const deps = () => ({
  send: (async (m: { to: string; subject: string; html: string }) => { sent.push(m); return { ok: true as const } }) as never,
  appUrl: () => 'https://app.test',
  now: () => new Date(),
})
const tokenOf = (link: string) => link.split('/accept-guardian/')[1]

const uid = (k: string) => `gd-${randomUUID().slice(0, 8)}-${k}`
async function addUser(k: string, role: string, opts: { createdAt?: Date; email?: string } = {}) {
  const id = uid(k)
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, $2, $3, $4, $5)`, [id, `${k} Person`, opts.email ?? `${id}@example.test`, role, opts.createdAt ?? new Date()])
  return id
}
async function addOrg() {
  const id = uid('org')
  await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [id, `School ${id}`, id])
  return id
}
async function addMember(org: string, userId: string, role: string) {
  await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, $4, now())`, [`m-${randomUUID().slice(0, 8)}`, org, userId, role])
}
const caller = (userId: string, email: string, globalRole: string, orgId: string | null = null, orgRole: string | null = null, emailVerified = true): Caller => ({ userId, email, emailVerified, globalRole, orgId, orgRole })

/** An institution with an admin and one student; a platform owner; an independent learner. */
async function world() {
  const org = await addOrg()
  const adminId = await addUser('admin', 'student'); await addMember(org, adminId, 'owner')
  const studentId = await addUser('stu', 'student'); await addMember(org, studentId, 'student')
  const superId = await addUser('super', 'student') // the platform forbids minting a super_admin row; the caller object carries the role
  const loneId = await addUser('lone', 'student')
  return {
    org, studentId, loneId,
    admin: caller(adminId, `${adminId}@example.test`, 'student', org, 'owner'),
    superAdmin: caller(superId, `${superId}@example.test`, 'super_admin'),
  }
}
const gEmail = () => `guardian-${randomUUID().slice(0, 6)}@example.test`

suite('guardian onboarding — integration', () => {
  jest.setTimeout(60_000)
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    dbMod = await import('@/lib/db/connection')
    config = await import('@/lib/hw/config')
    onb = await import('@/lib/guardian/onboarding')
    config._resetHwConfig()
  })
  afterAll(async () => { await raw?.end(); await dbMod?.getPool().end() })
  beforeEach(() => { sent.length = 0; process.env.GUARDIAN_INVITES_ENABLED = 'true'; config._resetHwConfig() })

  it('off by default: nothing works until the owner switches it on', async () => {
    const w = await world()
    process.env.GUARDIAN_INVITES_ENABLED = 'false'; config._resetHwConfig()
    await expect(onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: gEmail() }, deps())).rejects.toThrow(/not switched on/)
    await expect(onb.myWards(w.studentId)).rejects.toThrow(/not switched on/)
  })

  describe('B2B: the institution admin invites a guardian of a student of their institution', () => {
    it('sends a bilingual mail with a link; the token is stored only as a hash; accepting creates the link and a parent membership', async () => {
      const w = await world(); const email = gEmail()
      const r = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: email.toUpperCase() }, deps())
      expect(r.emailSent).toBe(true)
      expect(r.link).toMatch(/^https:\/\/app\.test\/accept-guardian\/[A-Za-z0-9_-]{20,}$/)
      expect(sent).toHaveLength(1)
      expect(sent[0].to).toBe(email) // normalised
      expect(sent[0].html).toContain(r.link)
      expect(sent[0].html).toMatch(/अभिभावक/) // Hindi next to English
      const token = tokenOf(r.link)
      const stored = await raw.query(`SELECT * FROM guardian_invitation WHERE id = $1`, [r.id])
      expect(JSON.stringify(stored.rows[0])).not.toContain(token)
      expect(stored.rows[0].issuer_kind).toBe('institution_admin'); expect(stored.rows[0].organization_id).toBe(w.org)

      // The guardian signs up (a new account, forced to student by the platform) and accepts.
      const gid = await addUser('g', 'student', { email })
      const gc = caller(gid, email, 'student')
      const pre = await onb.previewInvitation(gc, token, deps())
      expect(pre).toMatchObject({ valid: true, addressMatches: true, organizationName: expect.stringContaining('School') })
      const acc = await onb.acceptInvitation(gc, token, deps())
      expect(acc.linkId).toBeTruthy()
      const link = await raw.query(`SELECT * FROM guardian_link WHERE id = $1`, [acc.linkId])
      expect(link.rows[0]).toMatchObject({ guardian_user_id: gid, student_user_id: w.studentId, organization_id: w.org, created_via: 'institution_invite', ended_at: null })
      expect((await raw.query(`SELECT role FROM member WHERE organization_id = $1 AND user_id = $2`, [w.org, gid])).rows[0].role).toBe('parent')
      expect((await raw.query(`SELECT role FROM "user" WHERE id = $1`, [gid])).rows[0].role).toBe('parent')
      expect(await onb.myWards(gid)).toEqual([expect.objectContaining({ studentId: w.studentId, organizationId: w.org })])
      // the invitation is used once
      await expect(onb.acceptInvitation(gc, token, deps())).rejects.toThrow(/already been used/)
      // audited
      const audit = await raw.query(`SELECT action FROM hw_admin_audit WHERE entity_id = ANY($1)`, [[r.id, acc.linkId]])
      expect(audit.rows.map((x) => x.action).sort()).toEqual(['guardian_invitation_accepted', 'guardian_invited'])
    })

    it('only for a student of the caller\'s own institution, and only an institution admin may send', async () => {
      const w = await world(); const other = await world()
      await expect(onb.invite(w.admin, { mode: 'institution', studentId: other.studentId, email: gEmail() }, deps())).rejects.toThrow(/not a student of this institution/)
      // a teacher of the same institution cannot
      const tid = await addUser('t', 'teacher'); await addMember(w.org, tid, 'teacher')
      await expect(onb.invite(caller(tid, 'x@example.test', 'teacher', w.org, 'teacher'), { mode: 'institution', studentId: w.studentId, email: gEmail() }, deps())).rejects.toThrow(/institution admin/)
      // a student cannot
      await expect(onb.invite(caller(w.studentId, 'x@example.test', 'student', w.org, 'student'), { mode: 'institution', studentId: w.studentId, email: gEmail() }, deps())).rejects.toThrow(/institution admin/)
      // the institution admin cannot use the independent-learner route
      await expect(onb.invite(w.admin, { mode: 'independent', studentId: w.loneId, email: gEmail() }, deps())).rejects.toThrow(/platform owner/)
      expect(await onb.institutionStudents(w.admin)).toEqual([expect.objectContaining({ id: w.studentId })])
    })

    it('bad address, the student\'s own address, a second open invitation, and an existing link are all refused', async () => {
      const w = await world(); const email = gEmail()
      await expect(onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: 'not-an-address' }, deps())).rejects.toThrow(/valid e-mail/)
      const own = (await raw.query(`SELECT email FROM "user" WHERE id = $1`, [w.studentId])).rows[0].email
      await expect(onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: own }, deps())).rejects.toThrow(/own/)
      const first = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())
      await expect(onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())).rejects.toThrow(/already open/)
      await onb.revokeInvitation(w.admin, first.id)
      await expect(onb.acceptInvitation(caller('x', email, 'student'), tokenOf(first.link), deps())).rejects.toThrow(/cancelled/)
      const second = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())
      const gid = await addUser('g', 'student', { email })
      await onb.acceptInvitation(caller(gid, email, 'student'), tokenOf(second.link), deps())
      await expect(onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())).rejects.toThrow(/already linked/)
    })

    it('an institution admin sees and manages only their own institution\'s invitations and links', async () => {
      const w = await world(); const other = await world()
      const mine = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: gEmail() }, deps())
      const theirs = await onb.invite(other.admin, { mode: 'institution', studentId: other.studentId, email: gEmail() }, deps())
      expect((await onb.listInvitations(w.admin)).map((i) => i.id)).toEqual([mine.id])
      await expect(onb.revokeInvitation(w.admin, theirs.id)).rejects.toThrow(/No open invitation/)
      // a link of the other institution cannot be ended from here
      const email = gEmail(); const inv = await onb.invite(other.admin, { mode: 'institution', studentId: other.studentId, email }, deps())
      const gid = await addUser('g', 'student', { email })
      const acc = await onb.acceptInvitation(caller(gid, email, 'student'), tokenOf(inv.link), deps())
      await expect(onb.endLink(w.admin, acc.linkId)).rejects.toThrow(/No active link/)
      expect((await onb.listLinks(w.admin)).map((l) => l.id)).not.toContain(acc.linkId)
      await onb.endLink(other.admin, acc.linkId)
      expect((await onb.listLinks(other.admin)).find((l) => l.id === acc.linkId)?.endedAt).toBeTruthy()
    })
  })

  describe('B2C: the super admin invites a guardian of an independent learner', () => {
    it('lists only students with no institution; the invitation has no institution; accepting makes a platform link', async () => {
      const w = await world(); const email = gEmail()
      const found = await onb.independentLearners(w.superAdmin, w.loneId.slice(0, 20))
      expect(found.map((f) => f.id)).toEqual([w.loneId])
      expect((await onb.independentLearners(w.superAdmin, w.studentId.slice(0, 20))).map((f) => f.id)).toEqual([]) // a school student never appears
      const r = await onb.invite(w.superAdmin, { mode: 'independent', studentId: w.loneId, email }, deps())
      const stored = await raw.query(`SELECT organization_id, issuer_kind FROM guardian_invitation WHERE id = $1`, [r.id])
      expect(stored.rows[0]).toEqual({ organization_id: null, issuer_kind: 'super_admin' })
      const gid = await addUser('g', 'student', { email })
      const acc = await onb.acceptInvitation(caller(gid, email, 'student'), tokenOf(r.link), deps())
      const link = (await raw.query(`SELECT * FROM guardian_link WHERE id = $1`, [acc.linkId])).rows[0]
      expect(link).toMatchObject({ organization_id: null, created_via: 'platform_invite', student_user_id: w.loneId })
      expect((await raw.query(`SELECT count(*)::int AS n FROM member WHERE user_id = $1`, [gid])).rows[0].n).toBe(0) // no institution membership
      expect((await onb.listLinks(w.superAdmin)).map((l) => l.id)).toContain(acc.linkId)
      await onb.endLink(w.superAdmin, acc.linkId)
      expect(await onb.myWards(gid)).toEqual([])
    })

    it('only the super admin; never for a student who belongs to an institution', async () => {
      const w = await world()
      await expect(onb.invite(w.admin, { mode: 'independent', studentId: w.loneId, email: gEmail() }, deps())).rejects.toThrow(/platform owner/)
      await expect(onb.independentLearners(w.admin, '')).rejects.toThrow(/platform owner/)
      await expect(onb.invite(w.superAdmin, { mode: 'independent', studentId: w.studentId, email: gEmail() }, deps())).rejects.toThrow(/belongs to an institution/)
      await expect(onb.invite(w.superAdmin, { mode: 'independent', studentId: await addUser('tch', 'teacher'), email: gEmail() }, deps())).rejects.toThrow(/not a student/)
    })

    it('the platform list never shows an institution\'s invitations, nor the institution\'s list the platform\'s', async () => {
      const w = await world()
      const a = await onb.invite(w.superAdmin, { mode: 'independent', studentId: w.loneId, email: gEmail() }, deps())
      const b = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: gEmail() }, deps())
      expect((await onb.listInvitations(w.superAdmin)).map((i) => i.id)).toContain(a.id)
      expect((await onb.listInvitations(w.superAdmin)).map((i) => i.id)).not.toContain(b.id)
      expect((await onb.listInvitations(w.admin)).map((i) => i.id)).toEqual([b.id])
    })
  })

  describe('accepting is guarded', () => {
    it('needs the invited address, a verified address, and an account that is not already something else', async () => {
      const w = await world(); const email = gEmail()
      const r = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps()); const token = tokenOf(r.link)
      const gid = await addUser('g', 'student', { email })
      await expect(onb.acceptInvitation(caller(gid, 'someone-else@example.test', 'student'), token, deps())).rejects.toThrow(/different address/)
      await expect(onb.acceptInvitation(caller(gid, email, 'student', null, null, false), token, deps())).rejects.toThrow(/confirm your e-mail/)
      await expect(onb.acceptInvitation(caller(gid, email, 'student'), 'x'.repeat(30), deps())).rejects.toThrow(/not valid/)
      await expect(onb.acceptInvitation(caller(w.studentId, email, 'student'), token, deps())).rejects.toThrow(/own guardian/)
      // an address that already belongs to an older student or teacher account cannot be turned into a guardian
      const oldId = await addUser('old', 'student', { email: gEmail(), createdAt: new Date(Date.now() - 90 * 86_400_000) })
      const oldEmail = (await raw.query(`SELECT email FROM "user" WHERE id = $1`, [oldId])).rows[0].email
      const r2 = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: oldEmail }, deps())
      await expect(onb.acceptInvitation(caller(oldId, oldEmail, 'student'), tokenOf(r2.link), deps())).rejects.toThrow(/another kind of account/)
      const teacherId = await addUser('tt', 'teacher', { email: gEmail() })
      const tEmail = (await raw.query(`SELECT email FROM "user" WHERE id = $1`, [teacherId])).rows[0].email
      const r3 = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email: tEmail }, deps())
      await expect(onb.acceptInvitation(caller(teacherId, tEmail, 'teacher'), tokenOf(r3.link), deps())).rejects.toThrow(/another kind of account/)
      // after all that the first invitation is still usable by the right person
      await onb.acceptInvitation(caller(gid, email, 'student'), token, deps())
    })

    it('an expired invitation cannot be accepted, and a fresh one can then be sent', async () => {
      const w = await world(); const email = gEmail()
      const r = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())
      const later = { ...deps(), now: () => new Date(Date.now() + (onb.INVITATION_VALID_DAYS + 1) * 86_400_000) }
      const gid = await addUser('g', 'parent', { email }); const gc = caller(gid, email, 'parent') // (time is simulated here, so the account is already a guardian one)
      await expect(onb.acceptInvitation(gc, tokenOf(r.link), later)).rejects.toThrow(/expired/)
      expect(await onb.previewInvitation(gc, tokenOf(r.link), later)).toMatchObject({ valid: false })
      // the old one is closed on the next send, so a new one can be made
      const again = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, later)
      await onb.acceptInvitation(gc, tokenOf(again.link), later)
      // and the database refuses to rewrite an invitation's expiry or address
      await expect(raw.query(`UPDATE guardian_invitation SET expires_at = expires_at + interval '1 day' WHERE id = $1`, [again.id])).rejects.toThrow(/cannot be rewritten/)
    })

    it('a guardian of two children, in an institution and independent, sees both; one guardian account for siblings across schools works', async () => {
      const w = await world(); const w2 = await world(); const email = gEmail()
      const a = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())
      const b = await onb.invite(w2.admin, { mode: 'institution', studentId: w2.studentId, email }, deps())
      const c = await onb.invite(w.superAdmin, { mode: 'independent', studentId: w.loneId, email }, deps())
      const gid = await addUser('g', 'student', { email }); const gc = caller(gid, email, 'student')
      await onb.acceptInvitation(gc, tokenOf(a.link), deps())
      await onb.acceptInvitation(caller(gid, email, 'parent'), tokenOf(b.link), deps()) // now a guardian account
      await onb.acceptInvitation(caller(gid, email, 'parent'), tokenOf(c.link), deps())
      const wards = await onb.myWards(gid)
      expect(wards.map((x) => x.studentId).sort()).toEqual([w.studentId, w2.studentId, w.loneId].sort())
    })

    it('links and invitations cannot be deleted directly (they are ended and revoked, with who and when)', async () => {
      const w = await world(); const email = gEmail()
      const r = await onb.invite(w.admin, { mode: 'institution', studentId: w.studentId, email }, deps())
      await expect(raw.query(`DELETE FROM guardian_invitation WHERE id = $1`, [r.id])).rejects.toThrow()
      const gid = await addUser('g', 'student', { email })
      const acc = await onb.acceptInvitation(caller(gid, email, 'student'), tokenOf(r.link), deps())
      await expect(raw.query(`DELETE FROM guardian_link WHERE id = $1`, [acc.linkId])).rejects.toThrow()
      // the database refuses an institution link without an institution
      await expect(raw.query(`INSERT INTO guardian_link (guardian_user_id, student_user_id, organization_id, created_via, created_by) VALUES ($1, $2, NULL, 'institution_invite', 'x')`, [gid, w.loneId])).rejects.toThrow()
    })
  })
})
