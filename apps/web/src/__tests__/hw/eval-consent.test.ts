/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Consent records (roadmap task 3.1) against a real Postgres with migrations 014, 015 and 022: recording and its refusals, withdrawal
// as one action, the audit trail, a student's dependence on a parent's record, and the gates (copy tasks, task creation).
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/eval-consent

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { newItemId, type EvalItem } from '@/lib/hw/eval/dataset'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] consent DB tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014, 015 and 022.')
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EVAL_TOOLS_ENABLED: 'true' })

function item(over: Partial<EvalItem> = {}): EvalItem {
  return {
    id: newItemId(), source: 'C', subject: 'Science', class: 'Class 9', board: 'CBSE', medium: 'English', language: 'en', questionType: 'short', mode: 'photo',
    question: { id: 'q1', text: 'Why do we need trees?', marks: 2 }, media: { photo: 'media/p1.png' }, truthTranscript: null,
    key: { source: 'textbook', keyId: 'f'.repeat(64), referenceAnswer: 'Trees give oxygen.', points: [{ id: 'p1', marks: 2, cites: ['c1'], text: 'Give oxygen' }] },
    referenceMarks: null, mutation: null, handwritingBand: 'unknown', device: 'phone', consent: { ref: null, deidentified: true },
    ...over,
  } as EvalItem
}

suite('consent records — database', () => {
  jest.setTimeout(60_000)
  const tag = randomUUID().slice(0, 8)
  const consentIds: string[] = []
  const userIds: string[] = []
  const datasetRefs: string[] = []
  let raw: Pool
  let m: {
    consent: typeof import('@/lib/hw/eval-tools/consent')
    admin: typeof import('@/lib/hw/eval-tools/admin')
    source: typeof import('@/lib/hw/eval-tools/source')
    config: typeof import('@/lib/hw/config')
    pool: import('pg').Pool
  }
  let owner: import('@/lib/hw/eval-tools/access').EvalActor
  const base = { formVersion: 'volunteer-v1', language: 'en' as const, signedAt: '2026-11-01', collectedBy: 'School office' }
  const audit = async (action: string, entityId: string) => (await raw.query(`SELECT actor_id, old_value, new_value, reason FROM hw_admin_audit WHERE action = $1 AND entity_id = $2`, [action, entityId])).rows

  async function newUser(label: string, role = 'student') {
    const id = `${tag}-${label}`
    await raw.query(`INSERT INTO "user" (id, name, email, role, email_verified) VALUES ($1, $2, $3, $4, true)`, [id, label, `${id}@example.test`, role])
    userIds.push(id)
    return { id, email: `${id}@example.test` }
  }
  const rec = async (over: Partial<import('@/lib/hw/eval-tools/consent').ConsentInput> & { pseudonym: string }) => {
    const r = await m.consent.recordConsent(owner, { subjectKind: 'teacher', sources: ['C'], uses: ['evaluation'], ...base, ...over })
    consentIds.push(r.id)
    return r.id
  }

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    m = {
      consent: await import('@/lib/hw/eval-tools/consent'),
      admin: await import('@/lib/hw/eval-tools/admin'),
      source: await import('@/lib/hw/eval-tools/source'),
      config: await import('@/lib/hw/config'),
      pool: db.getPool(),
    }
    m.config._resetHwConfig()
    const o = await newUser('owner', 'teacher')
    owner = { userId: o.id, isSuperAdmin: true, rater: null }
  })

  afterAll(async () => {
    for (const ref of datasetRefs) await raw.query(`DELETE FROM hw_eval_task WHERE dataset_ref = $1`, [ref])
    await raw.query(`DELETE FROM hw_eval_consent WHERE guardian_consent_id = ANY($1)`, [consentIds])
    await raw.query(`DELETE FROM hw_eval_consent WHERE id = ANY($1)`, [consentIds])
    await raw.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds])
    await raw.end()
    await m?.pool.end()
    m?.source._setEvalSource(null)
  })

  it('only a super admin records, lists or withdraws; the entries are checked', async () => {
    const notOwner = { userId: owner.userId, isSuperAdmin: false, rater: null }
    await expect(m.consent.recordConsent(notOwner, { subjectKind: 'teacher', pseudonym: `P${tag}0`, sources: ['C'], uses: ['evaluation'], ...base })).rejects.toThrow(/Only the platform owner/)
    await expect(m.consent.listConsents(notOwner)).rejects.toThrow(/Only the platform owner/)
    await expect(m.consent.withdrawConsent(notOwner, 'x', 'because')).rejects.toThrow(/Only the platform owner/)
    const bad = (over: object, msg: RegExp) => expect(m.consent.recordConsent(owner, { subjectKind: 'teacher', pseudonym: `P${tag}1`, sources: ['C'], uses: ['evaluation'], ...base, ...over } as never)).rejects.toThrow(msg)
    await bad({ pseudonym: 'Ravi Kumar' }, /pseudonym must be 3 to 40/) // a name is not a pseudonym
    await bad({ sources: [] }, /at least one source/)
    await bad({ uses: [] }, /at least one use/)
    await bad({ signedAt: '01/11/2026' }, /YYYY-MM-DD/)
    await bad({ signedAt: '2099-01-01' }, /in the future/)
    await bad({ collectedBy: ' ' }, /who collected/)
    await bad({ evidenceKey: 'somewhere/else.pdf' }, /must be stored under hw-assignments\/evals\/consent/)
    await bad({ guardianConsentId: 'x' }, /Only a student's record is linked/)
    await bad({ subjectKind: 'volunteer', sources: ['A'] }, /needs their account email/) // source A: the volunteer's own copy tasks are gated on it
    await bad({ subjectKind: 'student' }, /parent's consent first/)
  })

  it('records a volunteer\'s consent with the audit row, and one live record per person', async () => {
    const v = await newUser('vol')
    const id = await rec({ subjectKind: 'volunteer', pseudonym: `Vol_${tag}`, sources: ['A'], uses: ['evaluation', 'report'], subjectEmail: v.email, organizationId: null })
    const a = await audit('consent_recorded', id)
    expect(a).toHaveLength(1)
    expect(a[0].actor_id).toBe(owner.userId)
    expect(a[0].new_value).toMatchObject({ subjectKind: 'volunteer', pseudonym: `Vol_${tag}`, scope: ['source:A', 'use:evaluation', 'use:report'], collectedBy: 'School office', linkedAccount: true })
    // no names, no email in the audit value
    expect(JSON.stringify(a[0].new_value)).not.toContain(v.email)
    await expect(m.consent.recordConsent(owner, { subjectKind: 'volunteer', pseudonym: `vol_${tag}`, sources: ['A'], uses: ['evaluation'], subjectEmail: v.email, ...base })).rejects.toMatchObject({ code: 'CONFLICT' })
    const listed = (await m.consent.listConsents(owner)).find((c) => c.id === id)!
    expect(listed).toMatchObject({ status: 'active', pseudonym: `Vol_${tag}`, sources: ['A'], uses: ['evaluation', 'report'], accountEmail: v.email, collectedBy: 'School office' })
  })

  it('copy tasks need the volunteer\'s own live consent, and stop when it is withdrawn', async () => {
    const v = await newUser('copier')
    const actor = { userId: v.id, isSuperAdmin: false, rater: { id: randomUUID(), pseudonym: `Copier_${tag}`, skills: ['transcribe'] } }
    await expect(m.consent.requireVolunteerConsent(actor)).rejects.toThrow(/consent has not been recorded/)
    const id = await rec({ subjectKind: 'volunteer', pseudonym: `Copier_${tag}`, sources: ['A'], uses: ['evaluation'], subjectEmail: v.email })
    await expect(m.consent.requireVolunteerConsent(actor)).resolves.toBeUndefined()
    // a record that does not cover source A for evaluation does not open copy tasks
    const w = await newUser('copier-b')
    await rec({ subjectKind: 'volunteer', pseudonym: `CopierB_${tag}`, sources: ['C'], uses: ['evaluation'], subjectEmail: w.email })
    expect(await m.consent.volunteerHasConsent(w.id)).toBe(false)
    await m.consent.withdrawConsent(owner, id, 'asked to stop')
    await expect(m.consent.requireVolunteerConsent(actor)).rejects.toThrow(/consent has not been recorded/)
  })

  it('withdrawing is one action, with a reason, audited; nothing else about the record can then change', async () => {
    const id = await rec({ pseudonym: `Wd_${tag}`, sources: ['C', 'D'], uses: ['evaluation'] })
    await expect(m.consent.withdrawConsent(owner, id, ' ')).rejects.toThrow(/Say why/)
    const r = await m.consent.withdrawConsent(owner, id, 'asked to withdraw by phone')
    expect(r).toEqual({ withdrawn: 1, cancelledTasks: 0 })
    const a = await audit('consent_withdrawn', id)
    expect(a).toHaveLength(1)
    expect(a[0]).toMatchObject({ actor_id: owner.userId, reason: 'asked to withdraw by phone' })
    expect(a[0].old_value).toMatchObject({ status: 'active', scope: ['source:C', 'source:D', 'use:evaluation'] })
    await expect(m.consent.withdrawConsent(owner, id, 'again')).rejects.toThrow(/No live consent/)
    const row = (await raw.query(`SELECT withdrawn_at, withdrawn_by, withdrawn_reason FROM hw_eval_consent WHERE id = $1`, [id])).rows[0]
    expect(row.withdrawn_at).toBeTruthy()
    expect(row.withdrawn_by).toBe(owner.userId)
    // the database refuses every other change, and a second withdrawal
    await expect(raw.query(`UPDATE hw_eval_consent SET scope = '{source:A,use:report}' WHERE id = $1`, [id])).rejects.toThrow(/only the withdrawal may be set, once/)
    await expect(raw.query(`UPDATE hw_eval_consent SET withdrawn_reason = 'rewritten' WHERE id = $1`, [id])).rejects.toThrow(/only the withdrawal may be set, once/)
  })

  it('a student needs a live parent\'s record that covers the same ground; the parent withdrawing ends the student\'s too', async () => {
    const parent = await rec({ subjectKind: 'parent', pseudonym: `Parent_${tag}`, sources: ['C'], uses: ['evaluation'], organizationId: null })
    const narrow = await rec({ subjectKind: 'parent', pseudonym: `Narrow_${tag}`, sources: ['A'], uses: ['evaluation'] })
    const stu = (over: object) => m.consent.recordConsent(owner, { subjectKind: 'student', pseudonym: `Stu_${tag}`, sources: ['C'], uses: ['evaluation'], guardianConsentId: parent, ...base, ...over })
    await expect(stu({ guardianConsentId: randomUUID() })).rejects.toThrow(/not a parent's consent/)
    await expect(stu({ guardianConsentId: narrow })).rejects.toThrow(/does not cover: source:C/)
    await expect(stu({ sources: ['C', 'D'] })).rejects.toThrow(/does not cover: source:D/)
    const s = await stu({})
    consentIds.push(s.id)
    let listed = await m.consent.listConsents(owner)
    expect(listed.find((c) => c.id === s.id)).toMatchObject({ status: 'active', guardianConsentId: parent })
    // the parent withdraws: the student's record is now "parent's withdrawn", and its items stop being workable
    const r = await m.consent.withdrawConsent(owner, parent, 'the parent called the school')
    expect(r.withdrawn).toBe(2)
    listed = await m.consent.listConsents(owner)
    expect(listed.find((c) => c.id === s.id)?.status).toBe('parent_withdrawn')
    expect(listed.find((c) => c.id === parent)?.status).toBe('withdrawn')
    // a new student record cannot lean on a withdrawn parent's
    await expect(stu({ pseudonym: `Stu2_${tag}` })).rejects.toThrow(/has been withdrawn/)
  })

  it('task creation skips items without a live covering consent, and says how many', async () => {
    const live = await rec({ pseudonym: `Live_${tag}`, sources: ['C'], uses: ['evaluation'] })
    const gone = await rec({ pseudonym: `Gone_${tag}`, sources: ['C'], uses: ['evaluation'] })
    const wrongSource = await rec({ subjectKind: 'parent', pseudonym: `Wrong_${tag}`, sources: ['A'], uses: ['evaluation'] })
    await m.consent.withdrawConsent(owner, gone, 'withdrawn before the tasks were made')
    const ref = `consent-${tag}@v1`
    datasetRefs.push(ref)
    const items = [
      item({ consent: { ref: live, deidentified: true } }),
      item({ consent: { ref: gone, deidentified: true } }),
      item({ consent: { ref: wrongSource, deidentified: true } }),
      item({ consent: { ref: randomUUID(), deidentified: true } }),
      item({ source: 'B', consent: { ref: null, deidentified: true } }), // constructed: no person, no record needed
    ]
    m.source._setEvalSource({ items: async (r) => { if (r !== ref) throw new Error('unknown dataset'); return items }, media: async () => new Uint8Array([1]), key: async () => null })
    expect(await m.admin.createTasks(owner, { datasetRef: ref, kind: 'transcribe' })).toEqual({ created: 2, eligible: 2, skippedNoConsent: 3 })
    const targets = (await raw.query(`SELECT target_id FROM hw_eval_task WHERE dataset_ref = $1 ORDER BY target_id`, [ref])).rows.map((r) => r.target_id).sort()
    expect(targets).toEqual([items[0].id, items[4].id].sort())
  })

  it('withdrawing stops the open tasks on that person\'s items, and leaves everyone else\'s', async () => {
    const a = await rec({ pseudonym: `TaskA_${tag}`, sources: ['C'], uses: ['evaluation'] })
    const b = await rec({ pseudonym: `TaskB_${tag}`, sources: ['C'], uses: ['evaluation'] })
    const ref = `consent-${tag}-tasks@v1`
    datasetRefs.push(ref)
    const items = [item({ consent: { ref: a, deidentified: true } }), item({ consent: { ref: a, deidentified: true } }), item({ consent: { ref: b, deidentified: true } })]
    m.source._setEvalSource({ items: async () => items, media: async () => new Uint8Array([1]), key: async () => null })
    expect((await m.admin.createTasks(owner, { datasetRef: ref, kind: 'transcribe' })).created).toBe(3)
    const r = await m.consent.withdrawConsent(owner, a, 'asked to stop')
    expect(r.cancelledTasks).toBe(2)
    const status = async (id: string) => (await raw.query(`SELECT status FROM hw_eval_task WHERE dataset_ref = $1 AND target_id = $2`, [ref, id])).rows[0].status
    expect(await status(items[0].id)).toBe('cancelled')
    expect(await status(items[1].id)).toBe('cancelled')
    expect(await status(items[2].id)).toBe('open')
  })
})
