/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Rater invitations and evaluator isolation (roadmap task 3.2): pure parts, and the full flow against a real Postgres with
// migrations 014, 015 and 021 (invite, accept on a verified email, blocked and expired invitations, the account rule, the audit).
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/eval-invites

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { inviteEmailContent, normaliseInviteEmail, signUpLink } from '@/lib/hw/eval-tools/invite-content'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] invitation DB tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014, 015 and 021.')
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EVAL_TOOLS_ENABLED: 'true' })

describe('invitation link and email (pure)', () => {
  it('the link carries the address and sends the person to /evaluate after sign-in', () => {
    const link = signUpLink('Ravi.K+eval@Example.com'.toLowerCase(), 'https://app.example.org/')
    const u = new URL(link)
    expect(u.origin + u.pathname).toBe('https://app.example.org/sign-up')
    expect(u.searchParams.get('email')).toBe('ravi.k+eval@example.com')
    expect(u.searchParams.get('redirect_url')).toBe('/evaluate')
  })
  it('the email is in English and Hindi, names the pseudonym and the link, and says until when', () => {
    const c = inviteEmailContent({ pseudonym: 'Volunteer_07', link: 'https://app.example.org/sign-up?email=a%40b.in', expiresAt: new Date('2026-12-04T10:00:00Z') })
    expect(c.subject).toContain('मूल्यांकन')
    expect(c.html).toContain('Volunteer_07')
    expect(c.html).toContain('https://app.example.org/sign-up?email=a%40b.in')
    expect(c.html).toContain('2026-12-04')
    expect(c.html).toMatch(/मूल्यांकनकर्ता/)
    expect(c.html).toContain('THIS email address')
  })
  it('addresses are compared in lower case, trimmed', () => {
    expect(normaliseInviteEmail('  Asha@School.IN ')).toBe('asha@school.in')
  })
})

suite('rater invitations — database', () => {
  jest.setTimeout(60_000)
  const tag = randomUUID().slice(0, 8)
  const ids = { users: [] as string[], orgs: [] as string[] }
  let raw: Pool
  let m: {
    invites: typeof import('@/lib/hw/eval-tools/invites')
    admin: typeof import('@/lib/hw/eval-tools/admin')
    only: typeof import('@/lib/hw/eval-tools/evaluator-only')
    config: typeof import('@/lib/hw/config')
    pool: import('pg').Pool
  }
  let owner: import('@/lib/hw/eval-tools/access').EvalActor
  const sent: { to: string; subject: string; html: string }[] = []
  const deps = (ok = true) => ({
    send: (async (p: { to: string; subject: string; html: string }) => { sent.push(p); return ok ? { ok: true as const, id: 'x' } : { ok: false as const, error: 'provider down' } }) as never,
    appUrl: 'https://app.example.org',
    now: () => new Date(),
  })

  async function newUser(label: string, over: { role?: string; verified?: boolean; email?: string } = {}) {
    const id = `${tag}-${label}`
    const email = over.email ?? `${id}@example.test`
    await raw.query(`INSERT INTO "user" (id, name, email, role, email_verified) VALUES ($1, $2, $3, $4, $5)`, [id, label, email, over.role ?? 'student', over.verified ?? false])
    ids.users.push(id)
    return { id, email }
  }
  const verify = (id: string) => raw.query(`UPDATE "user" SET email_verified = true WHERE id = $1`, [id])
  const inviteRow = async (email: string) => (await raw.query(`SELECT status, accepted_user_id, blocked_reason FROM hw_eval_rater_invite WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, [email])).rows[0]
  const audit = async (action: string, entityId: string) => (await raw.query(`SELECT actor_id, old_value, new_value, reason FROM hw_admin_audit WHERE action = $1 AND entity_id = $2`, [action, entityId])).rows

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    m = {
      invites: await import('@/lib/hw/eval-tools/invites'),
      admin: await import('@/lib/hw/eval-tools/admin'),
      only: await import('@/lib/hw/eval-tools/evaluator-only'),
      config: await import('@/lib/hw/config'),
      pool: db.getPool(),
    }
    m.config._resetHwConfig()
    const inviter = await newUser('owner', { role: 'teacher', verified: true })
    owner = { userId: inviter.id, isSuperAdmin: true, rater: null }
  })

  afterAll(async () => {
    await raw.query(`DELETE FROM hw_eval_rater_invite WHERE invited_by = ANY($1) OR accepted_user_id = ANY($1)`, [ids.users])
    await raw.query(`DELETE FROM hw_eval_rater WHERE user_id = ANY($1)`, [ids.users])
    await raw.query(`DELETE FROM member WHERE user_id = ANY($1)`, [ids.users])
    await raw.query(`DELETE FROM organization WHERE id = ANY($1)`, [ids.orgs])
    await raw.query(`DELETE FROM "user" WHERE id = ANY($1)`, [ids.users])
    await raw.end()
    await m?.pool.end()
  })

  it('only a super admin invites; the address, pseudonym and skills are checked', async () => {
    const notOwner = { userId: owner.userId, isSuperAdmin: false, rater: null }
    await expect(m.invites.inviteRater(notOwner, { email: `a-${tag}@example.test`, pseudonym: `P${tag}a`, skills: ['transcribe'] }, deps())).rejects.toThrow(/Only the platform owner/)
    await expect(m.invites.inviteRater(owner, { email: 'not-an-email', pseudonym: `P${tag}b`, skills: ['transcribe'] }, deps())).rejects.toThrow(/not an email/)
    await expect(m.invites.inviteRater(owner, { email: `b-${tag}@example.test`, pseudonym: 'x', skills: ['transcribe'] }, deps())).rejects.toThrow(/pseudonym/)
    await expect(m.invites.inviteRater(owner, { email: `c-${tag}@example.test`, pseudonym: `P${tag}c`, skills: ['grade:all'] }, deps())).rejects.toThrow(/Unknown skills/)
  })

  it('invites: saves it, emails the sign-up link, writes the audit row; no second invitation for the same address or pseudonym', async () => {
    sent.length = 0
    const email = `Vol-${tag}@Example.test`
    const r = await m.invites.inviteRater(owner, { email, pseudonym: `Vol_${tag}`, skills: ['transcribe', 'mark:science'] }, deps())
    expect(r.emailSent).toBe(true)
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe(email.toLowerCase())
    expect(sent[0].html).toContain(encodeURIComponent(email.toLowerCase()))
    expect((await inviteRow(email.toLowerCase())).status).toBe('pending')
    const a = await audit('rater_invited', r.id)
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ actor_id: owner.userId })
    expect(a[0].new_value).toMatchObject({ email: email.toLowerCase(), pseudonym: `Vol_${tag}`, skills: ['mark:science', 'transcribe'] })
    await expect(m.invites.inviteRater(owner, { email: email.toUpperCase(), pseudonym: `Other_${tag}`, skills: ['transcribe'] }, deps())).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(m.invites.inviteRater(owner, { email: `new-${tag}@example.test`, pseudonym: `vol_${tag}`, skills: ['transcribe'] }, deps())).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('an address that already has an account is told to use "Add rater"', async () => {
    const u = await newUser('existing', { verified: true })
    await expect(m.invites.inviteRater(owner, { email: u.email, pseudonym: `Ex_${tag}`, skills: ['transcribe'] }, deps())).rejects.toThrow(/already has an account/)
  })

  it('when the email cannot be sent the invitation still exists and the link is handed back', async () => {
    const email = `nomail-${tag}@example.test`
    const r = await m.invites.inviteRater(owner, { email, pseudonym: `NoMail_${tag}`, skills: ['transcribe'] }, deps(false))
    expect(r.emailSent).toBe(false)
    expect(r.link).toContain('/sign-up?email=')
    expect((await inviteRow(email)).status).toBe('pending')
  })

  it('accepted when the address is verified, not before: the account becomes a rater with the invited pseudonym and skills', async () => {
    const email = `acc-${tag}@example.test`
    const inv = await m.invites.inviteRater(owner, { email, pseudonym: `Acc_${tag}`, skills: ['transcribe', 'adjudicate'] }, deps())
    // The person signs up (unverified account, role student: the default every sign-up gets).
    const u = await newUser('acc', { email: email.toUpperCase().replace('@EXAMPLE.TEST', '@Example.Test'), verified: false })
    expect(await m.invites.acceptRaterInvites({ id: u.id, email: u.email })).toEqual({ outcome: 'none' })
    expect((await inviteRow(email)).status).toBe('pending')
    expect(await m.only.isEvaluatorOnly(u.id)).toBe(false)

    await verify(u.id)
    const out = await m.invites.acceptRaterInvites({ id: u.id, email: u.email })
    expect(out.outcome).toBe('accepted')
    const rater = (await raw.query(`SELECT pseudonym, skills, active, created_by FROM hw_eval_rater WHERE user_id = $1`, [u.id])).rows[0]
    expect(rater).toMatchObject({ pseudonym: `Acc_${tag}`, skills: ['adjudicate', 'transcribe'], active: true, created_by: owner.userId })
    expect(await inviteRow(email)).toMatchObject({ status: 'accepted', accepted_user_id: u.id })
    expect((await audit('rater_invite_accepted', inv.id))[0]).toMatchObject({ actor_id: u.id })
    // The role stays the default; the account is evaluator-only, so every dashboard page turns it away.
    expect((await raw.query(`SELECT role FROM "user" WHERE id = $1`, [u.id])).rows[0].role).toBe('student')
    expect(await m.only.isEvaluatorOnly(u.id)).toBe(true)
    // Nothing more happens the second time.
    expect(await m.invites.acceptRaterInvites({ id: u.id, email: u.email })).toEqual({ outcome: 'none' })
  })

  it('an institution\'s student (or any account with a membership) is blocked, with the reason; no rater row', async () => {
    const email = `kid-${tag}@example.test`
    const inv = await m.invites.inviteRater(owner, { email, pseudonym: `Kid_${tag}`, skills: ['transcribe'] }, deps())
    const u = await newUser('kid', { email, verified: true })
    const org = `${tag}-org`
    await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org])
    ids.orgs.push(org)
    await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [`m-${tag}`, org, u.id])
    const out = await m.invites.acceptRaterInvites({ id: u.id, email })
    expect(out).toMatchObject({ outcome: 'blocked' })
    expect((out as { reason: string }).reason).toMatch(/student account of an institution/)
    expect(await inviteRow(email)).toMatchObject({ status: 'blocked' })
    expect((await raw.query(`SELECT count(*)::int AS n FROM hw_eval_rater WHERE user_id = $1`, [u.id])).rows[0].n).toBe(0)
    expect((await audit('rater_invite_blocked', inv.id))).toHaveLength(1)
    expect(await m.only.isEvaluatorOnly(u.id)).toBe(false)
  })

  it('an expired invitation is not accepted (and the list says expired)', async () => {
    const email = `old-${tag}@example.test`
    await m.invites.inviteRater(owner, { email, pseudonym: `Old_${tag}`, skills: ['transcribe'] }, deps())
    await raw.query(`UPDATE hw_eval_rater_invite SET expires_at = now() - interval '1 day' WHERE email = $1`, [email])
    expect((await m.invites.listInvites(owner)).find((i) => i.email === email)?.state).toBe('expired')
    const u = await newUser('old', { email, verified: true })
    const out = await m.invites.acceptRaterInvites({ id: u.id, email })
    expect(out).toMatchObject({ outcome: 'blocked', reason: 'The invitation had expired.' })
    expect((await raw.query(`SELECT count(*)::int AS n FROM hw_eval_rater WHERE user_id = $1`, [u.id])).rows[0].n).toBe(0)
  })

  it('a pseudonym taken in the meantime blocks the invitation instead of failing the sign-in', async () => {
    const email = `race-${tag}@example.test`
    await m.invites.inviteRater(owner, { email, pseudonym: `Race_${tag}`, skills: ['transcribe'] }, deps())
    const other = await newUser('race-other', { role: 'teacher', verified: true })
    await raw.query(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ($1, $2, '{transcribe}', $3)`, [`Race_${tag}`, other.id, owner.userId])
    const u = await newUser('race', { email, verified: true })
    const out = await m.invites.acceptRaterInvites({ id: u.id, email })
    expect(out).toMatchObject({ outcome: 'blocked' })
    expect((out as { reason: string }).reason).toMatch(/pseudonym was taken/)
  })

  it('a cancelled invitation can no longer be accepted', async () => {
    const email = `cancel-${tag}@example.test`
    const inv = await m.invites.inviteRater(owner, { email, pseudonym: `Cancel_${tag}`, skills: ['transcribe'] }, deps())
    await m.invites.cancelInvite(owner, inv.id, 'sent to the wrong person')
    expect((await audit('rater_invite_cancelled', inv.id))[0]).toMatchObject({ reason: 'sent to the wrong person' })
    await expect(m.invites.cancelInvite(owner, inv.id)).rejects.toThrow(/No pending invitation/)
    const u = await newUser('cancel', { email, verified: true })
    expect(await m.invites.acceptRaterInvites({ id: u.id, email })).toEqual({ outcome: 'none' })
  })

  it('"evaluator only" is narrow: a rater added by hand, a teacher, or a rater with a membership keeps their dashboards', async () => {
    const hand = await newUser('hand', { verified: true })
    await m.admin.createRater(owner, { email: hand.email, pseudonym: `Hand_${tag}`, skills: ['transcribe'] })
    expect(await m.only.isEvaluatorOnly(hand.id)).toBe(false) // no accepted invitation
    const teacher = await newUser('teacher', { role: 'teacher', verified: true })
    await m.admin.createRater(owner, { email: teacher.email, pseudonym: `Teach_${tag}`, skills: ['transcribe'] })
    expect(await m.only.isEvaluatorOnly(teacher.id)).toBe(false)
    expect(await m.only.isEvaluatorOnly(`${tag}-nobody`)).toBe(false)
  })

  it('the account rule: a parent is never a rater; a bare student account may be; an institution\'s student may not', async () => {
    const parent = await newUser('parent', { role: 'parent', verified: true })
    await expect(m.admin.createRater(owner, { email: parent.email, pseudonym: `Par_${tag}`, skills: ['transcribe'] })).rejects.toThrow(/parent account cannot be a rater/)
    const bare = await newUser('bare', { verified: true })
    await expect(m.admin.createRater(owner, { email: bare.email, pseudonym: `Bare_${tag}`, skills: ['transcribe'] })).resolves.toBeTruthy()
    const inst = await newUser('inst', { verified: true })
    const org = `${tag}-org2`
    await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [org, org, org])
    ids.orgs.push(org)
    await raw.query(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ($1, $2, $3, 'student', now())`, [`m2-${tag}`, org, inst.id])
    await expect(m.admin.createRater(owner, { email: inst.email, pseudonym: `Inst_${tag}`, skills: ['transcribe'] })).rejects.toThrow(/student account of an institution cannot be a rater/)
  })

  it('the audit trail cannot be changed or erased', async () => {
    await expect(raw.query(`UPDATE hw_admin_audit SET reason = 'edited' WHERE actor_id = $1`, [owner.userId])).rejects.toThrow(/append-only/)
    await expect(raw.query(`DELETE FROM hw_admin_audit WHERE actor_id = $1`, [owner.userId])).rejects.toThrow(/append-only/)
    expect((await raw.query(`SELECT count(*)::int AS n FROM hw_admin_audit WHERE actor_id = $1`, [owner.userId])).rows[0].n).toBeGreaterThan(0)
  })
})
