/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// The eligibility registry (roadmap 5.3) against a real Postgres with migrations 014, 015, 023 and 024: the default (not eligible), promotion
// only from a passing gate result for the running configuration, a change of configuration pausing it, demotion by a person and by the
// system, importing gate reports, and the history. The enforcement in marking is in integration.test.ts ("Eligibility").
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/eligibility.test

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { fingerprint } from '@/lib/hw/eligibility/fingerprint'
import { parseGroupKey } from '@/lib/hw/eligibility/group'
import { resultsFromReport, type ReportJson } from '@/lib/hw/eligibility/gate-import'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] eligibility DB tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014, 015, 023 and 024.')
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', GEMINI_API_KEY: 'fake-key', HW_GRADE_MODEL: 'gemini-3.5-flash-lite', HW_ELIGIBILITY_ENFORCED: 'true', HW_FEATURE_DEFAULT_ENABLED: 'false' })

suite('eligibility registry — database', () => {
  jest.setTimeout(60_000)
  const tag = randomUUID().slice(0, 6).toLowerCase()
  const subject = `subj${tag}`
  let raw: Pool
  let m: {
    reg: typeof import('@/lib/hw/eligibility/registry')
    store: typeof import('@/lib/hw/eligibility/gate-store')
    config: typeof import('@/lib/hw/config')
    pool: import('pg').Pool
    db: unknown
  }
  const owner = { userId: `owner-${tag}`, isSuperAdmin: true, rater: null }
  const key = (over: Partial<{ type: string; lang: string; src: string }> = {}) => `${subject}|${over.type ?? 'short'}|${over.lang ?? 'en'}|${over.src ?? 'teacher_rubric'}`
  const parts = (over: Partial<{ type: 'short' | 'long'; lang: 'en' | 'hi'; src: 'teacher_rubric' | 'textbook_key' }> = {}) => ({ subject, questionType: over.type ?? 'short', language: over.lang ?? 'en', schemeSource: over.src ?? 'teacher_rubric' }) as import('@/lib/hw/eligibility/group').GroupParts
  const setModel = (model: string) => { process.env.HW_GRADE_MODEL = model; m.config._resetHwConfig() }

  /** A stored gate result for the group, measured on the given setup (default: the one running now). */
  async function gateResult(k: string, over: { verdict?: string; fingerprint?: string | null; datasets?: string[] } = {}) {
    const p = parseGroupKey(k)!
    const id = randomUUID()
    const fp = over.fingerprint === undefined ? m.reg.runningConfig().hash : over.fingerprint
    await raw.query(
      `INSERT INTO hw_eval_gate_result (id, group_key, subject, question_type, language, scheme_source, verdict, checks, run_ids, dataset_versions, production_fingerprint, report_sha256, imported_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '[]'::jsonb, ARRAY['run_x'], $8, $9, $10, 'itest')`,
      [id, k, p.subject, p.questionType, p.language, p.schemeSource, over.verdict ?? 'eligible', over.datasets ?? ['heldout-1d@v1'], fp, randomUUID().replace(/-/g, '').padEnd(64, '0')],
    )
    return id
  }
  const events = async (k: string) => (await raw.query(`SELECT from_status, to_status, actor_id, automatic, reason, config_hash FROM hw_eligibility_event WHERE group_key = $1 ORDER BY at`, [k])).rows
  const audit = async (action: string, k: string) => (await raw.query(`SELECT actor_id, reason, old_value, new_value FROM hw_admin_audit WHERE action = $1 AND entity_id = $2`, [action, k])).rows

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    m = { reg: await import('@/lib/hw/eligibility/registry'), store: await import('@/lib/hw/eligibility/gate-store'), config: await import('@/lib/hw/config'), pool: db.getPool(), db: (await import('@/db')).db }
    setModel('gemini-3.5-flash-lite')
  })
  afterAll(async () => {
    setModel('gemini-3.5-flash-lite')
    await raw.query(`DELETE FROM hw_eligibility WHERE subject = $1`, [subject])
    await raw.end()
    await m?.pool.end()
  })

  it('the default: a group with no record is not eligible', async () => {
    expect(await m.reg.eligibilityOfGroup(m.db as never, parts())).toEqual({ eligible: false, reason: 'no_record' })
  })

  it('only a super admin lists, promotes or demotes', async () => {
    const nobody = { userId: 'x', isSuperAdmin: false, rater: null }
    await expect(m.reg.listEligibility(nobody)).rejects.toThrow(/Only the platform owner/)
    await expect(m.reg.promote(nobody, { groupKey: key(), gateResultId: 'g', reason: 'a long enough reason', confirm: true })).rejects.toThrow(/Only the platform owner/)
    await expect(m.reg.demote(nobody, { groupKey: key(), reason: 'because' })).rejects.toThrow(/Only the platform owner/)
  })

  it('promotion needs a typed reason, a confirmation, and a passing gate result for this group on the setup running now', async () => {
    const k = key()
    const ok = await gateResult(k)
    const base = { groupKey: k, gateResultId: ok, reason: 'Passed every gate on heldout-1d@v1 for this setup.', confirm: true }
    await expect(m.reg.promote(owner, { ...base, reason: 'ok' })).rejects.toThrow(/Write the reason/)
    await expect(m.reg.promote(owner, { ...base, confirm: false })).rejects.toThrow(/Confirm the promotion/)
    await expect(m.reg.promote(owner, { ...base, groupKey: 'not a key' })).rejects.toThrow(/not a group/)
    await expect(m.reg.promote(owner, { ...base, gateResultId: randomUUID() })).rejects.toThrow(/No gate result/)
    await expect(m.reg.promote(owner, { ...base, groupKey: key({ lang: 'hi' }) })).rejects.toThrow(/No gate result for this group/) // the result is for another group
    const failing = await gateResult(k, { verdict: 'not_yet' })
    await expect(m.reg.promote(owner, { ...base, gateResultId: failing })).rejects.toThrow(/not eligible/)
    const noFp = await gateResult(k, { fingerprint: null })
    await expect(m.reg.promote(owner, { ...base, gateResultId: noFp })).rejects.toThrow(/does not say which configuration/)
    const other = await gateResult(k, { fingerprint: 'e'.repeat(64) })
    await expect(m.reg.promote(owner, { ...base, gateResultId: other })).rejects.toThrow(/different marking setup/)
    expect(await m.reg.eligibilityOfGroup(m.db as never, parts())).toEqual({ eligible: false, reason: 'no_record' }) // nothing above changed anything
  })

  it('a promotion makes the group eligible for that setup, with the evidence, the history and the audit row', async () => {
    const k = key()
    const g = await gateResult(k, { datasets: ['heldout-1d@v1', 'heldout-1c@v1'] })
    const r = await m.reg.promote(owner, { groupKey: k, gateResultId: g, reason: 'Passed every gate on both held-out sets.', confirm: true })
    expect(r.status).toBe('eligible')
    expect(await m.reg.eligibilityOfGroup(m.db as never, parts())).toEqual({ eligible: true, reason: 'eligible' })
    const row = (await raw.query(`SELECT status, config_hash, gate_result_id, dataset_versions, decided_by, reason FROM hw_eligibility WHERE group_key = $1`, [k])).rows[0]
    expect(row).toMatchObject({ status: 'eligible', config_hash: m.reg.runningConfig().hash, gate_result_id: g, dataset_versions: ['heldout-1d@v1', 'heldout-1c@v1'], decided_by: owner.userId })
    expect(await events(k)).toMatchObject([{ from_status: 'none', to_status: 'eligible', actor_id: owner.userId, automatic: false, config_hash: row.config_hash }])
    expect((await audit('eligibility_promoted', k))[0]).toMatchObject({ actor_id: owner.userId, reason: 'Passed every gate on both held-out sets.' })
    // another group is untouched
    expect(await m.reg.eligibilityOfGroup(m.db as never, parts({ lang: 'hi' }))).toEqual({ eligible: false, reason: 'no_record' })
    expect(await m.reg.eligibilityOfGroup(m.db as never, parts({ src: 'textbook_key' }))).toEqual({ eligible: false, reason: 'no_record' })
  })

  it('a change of the marking setup pauses it ("configuration changed") until it is promoted again for the new setup', async () => {
    const k = key({ type: 'long' })
    await m.reg.promote(owner, { groupKey: k, gateResultId: await gateResult(k), reason: 'Passed every gate for this setup.', confirm: true })
    const p = parts({ type: 'long' })
    expect((await m.reg.eligibilityOfGroup(m.db as never, p)).eligible).toBe(true)
    setModel('gemini-3.6-flash') // the model changes
    expect(await m.reg.eligibilityOfGroup(m.db as never, p)).toEqual({ eligible: false, reason: 'config_changed' })
    const list = await m.reg.listEligibility(owner)
    expect(list.rows.find((r) => r.groupKey === k)).toMatchObject({ status: 'eligible', effective: 'config_changed' })
    expect(await m.reg.staleGroups()).toContain(k)
    // the old gate result measured the old setup: it cannot promote the new one
    const oldResult = (await raw.query(`SELECT id FROM hw_eval_gate_result WHERE group_key = $1`, [k])).rows[0].id
    await expect(m.reg.promote(owner, { groupKey: k, gateResultId: oldResult, reason: 'Trying the old result again.', confirm: true })).rejects.toThrow(/different marking setup/)
    // a result for the new setup does
    await m.reg.promote(owner, { groupKey: k, gateResultId: await gateResult(k), reason: 'Re-checked on the new model: all gates pass.', confirm: true })
    expect((await m.reg.eligibilityOfGroup(m.db as never, p)).eligible).toBe(true)
    // back to the first setup: paused again (the stored hash is the new model's)
    setModel('gemini-3.5-flash-lite')
    expect((await m.reg.eligibilityOfGroup(m.db as never, p)).reason).toBe('config_changed')
    expect((await events(k)).map((e) => e.to_status)).toEqual(['eligible', 'eligible'])
  })

  it('a person demotes with a reason; the system demotes without one; both are in the history, and "not yet" means no suggestions', async () => {
    const k = key({ lang: 'hi' })
    await m.reg.promote(owner, { groupKey: k, gateResultId: await gateResult(k), reason: 'Passed every gate for Hindi.', confirm: true })
    await expect(m.reg.demote(owner, { groupKey: k, reason: ' ' })).rejects.toThrow(/Write why/)
    await m.reg.demote(owner, { groupKey: k, reason: 'Teachers overrode too many marks this week.' })
    expect(await m.reg.eligibilityOfGroup(m.db as never, parts({ lang: 'hi' }))).toEqual({ eligible: false, reason: 'not_yet' })
    await expect(m.reg.demote(owner, { groupKey: k, reason: 'again' })).rejects.toThrow(/not eligible/)
    const row = (await raw.query(`SELECT status, config_hash, gate_result_id, dataset_versions FROM hw_eligibility WHERE group_key = $1`, [k])).rows[0]
    expect(row).toMatchObject({ status: 'not_yet', config_hash: null, gate_result_id: null, dataset_versions: [] })
    expect((await audit('eligibility_demoted', k))[0]).toMatchObject({ actor_id: owner.userId, reason: 'Teachers overrode too many marks this week.' })

    // the system
    await m.reg.promote(owner, { groupKey: k, gateResultId: await gateResult(k), reason: 'Promoted again after a fix.', confirm: true })
    expect(await m.reg.autoDemote({ groupKey: k, reason: 'Override rate 41% over 80 answers (limit 25%).' })).toBe(true)
    expect(await m.reg.autoDemote({ groupKey: k, reason: 'second time' })).toBe(false) // already not eligible: nothing to do
    const ev = await events(k)
    expect(ev.map((e) => [e.to_status, e.automatic, e.actor_id])).toEqual([['eligible', false, owner.userId], ['not_yet', false, owner.userId], ['eligible', false, owner.userId], ['not_yet', true, 'system:monitor']])
    expect((await audit('eligibility_demoted_automatically', k))[0]).toMatchObject({ actor_id: 'system:monitor' })
  })

  it('the history cannot be changed or erased', async () => {
    await expect(raw.query(`UPDATE hw_eligibility_event SET reason = 'edited' WHERE group_key LIKE $1`, [`${subject}|%`])).rejects.toThrow(/append-only/)
    await expect(raw.query(`DELETE FROM hw_eligibility_event WHERE group_key LIKE $1`, [`${subject}|%`])).rejects.toThrow(/append-only/)
  })

  describe('importing a gate report', () => {
    const run = `run_20261104_${tag.padEnd(8, 'a')}`
    const report = (verdict: 'Eligible' | 'Not yet' | 'Insufficient data', ds = 'itest-set@v1'): ReportJson => ({
      title: 't', generatedAt: '2026-11-04T00:00:00Z', datasetRef: ds, manifestSha256: 'f'.repeat(64),
      runs: [{ runId: run, mode: 'mark', status: 'completed', configHash: 'c', gitCommit: 'abc', repeat: 5, costInr: 3.5, counts: { ok: 100 } }],
      gates: [{ subject: `Subj${tag}`, questionType: 'essay', language: 'en', verdict, checks: [{ gate: 'QWK', state: verdict === 'Eligible' ? 'pass' : 'fail', detail: 'QWK 0.7' }] }],
    })
    const sha = () => randomUUID().replace(/-/g, '').padEnd(64, '1')
    const key = `${subject}|essay|en|teacher_rubric`

    it('stores the report\'s own rows, once, and records a group it has not seen as not yet; a passing result promotes nothing', async () => {
      const fp = m.reg.runningConfig().parts
      const s1 = sha()
      const out = await m.store.importGateReport(report('Not yet'), resultsFromReport(report('Not yet'), { schemeSource: 'teacher_rubric', parts: fp }), { importedBy: 'cli:test', reportSha256: s1 })
      expect(out).toMatchObject({ runsAdded: 1, resultsAdded: 1, resultsAlreadyThere: 0, recorded: [key], demoted: [] })
      const again = await m.store.importGateReport(report('Not yet'), resultsFromReport(report('Not yet'), { schemeSource: 'teacher_rubric', parts: fp }), { importedBy: 'cli:test', reportSha256: s1 })
      expect(again).toMatchObject({ runsAdded: 0, resultsAdded: 0, resultsAlreadyThere: 1 })
      expect((await raw.query(`SELECT status, decided_by FROM hw_eligibility WHERE group_key = $1`, [key])).rows[0]).toMatchObject({ status: 'not_yet', decided_by: 'system:gate-import' })
      expect((await raw.query(`SELECT cost_paise, dataset_ref FROM hw_eval_run WHERE run_id = $1`, [run])).rows[0]).toMatchObject({ cost_paise: '350', dataset_ref: 'itest-set@v1' })
      // a passing report is stored but does not promote
      await m.store.importGateReport(report('Eligible', 'itest-set@v2'), resultsFromReport(report('Eligible', 'itest-set@v2'), { schemeSource: 'teacher_rubric', parts: fp }), { importedBy: 'cli:test', reportSha256: sha() })
      expect((await raw.query(`SELECT status FROM hw_eligibility WHERE group_key = $1`, [key])).rows[0].status).toBe('not_yet')
    })

    it('a later failing result for the very setup a group is eligible for demotes it at once; one for another setup does not', async () => {
      const fp = m.reg.runningConfig().parts
      const passing = (await raw.query(`SELECT id FROM hw_eval_gate_result WHERE group_key = $1 AND verdict = 'eligible' LIMIT 1`, [key])).rows[0].id
      await m.reg.promote(owner, { groupKey: key, gateResultId: passing, reason: 'Passed every gate on itest-set@v2.', confirm: true })
      expect((await m.reg.eligibilityOfGroup(m.db as never, { subject, questionType: 'essay', language: 'en', schemeSource: 'teacher_rubric' })).eligible).toBe(true)
      // a failing result measured on a different setup: nothing happens
      const otherParts = { ...fp, chunkSize: fp.chunkSize + 5 }
      expect(fingerprint(otherParts)).not.toBe(fingerprint(fp))
      const o1 = await m.store.importGateReport(report('Not yet', 'itest-set@v3'), resultsFromReport(report('Not yet', 'itest-set@v3'), { schemeSource: 'teacher_rubric', parts: otherParts }), { importedBy: 'cli:test', reportSha256: sha() })
      expect(o1.demoted).toEqual([])
      expect((await raw.query(`SELECT status FROM hw_eligibility WHERE group_key = $1`, [key])).rows[0].status).toBe('eligible')
      // a failing result for the same setup: demoted, by the system, with the reason
      const o2 = await m.store.importGateReport(report('Not yet', 'itest-set@v4'), resultsFromReport(report('Not yet', 'itest-set@v4'), { schemeSource: 'teacher_rubric', parts: fp }), { importedBy: 'cli:test', reportSha256: sha() })
      expect(o2.demoted).toEqual([key])
      const last = (await events(key)).at(-1)!
      expect(last).toMatchObject({ to_status: 'not_yet', automatic: true, actor_id: 'system:gate-import' })
      expect(last.reason).toMatch(/newer gate result for the same marking setup/)
    })

    it('a report with an unknown language is refused before anything is stored', async () => {
      const bad = report('Eligible')
      bad.gates[0].language = 'fr'
      expect(() => resultsFromReport(bad, { schemeSource: 'teacher_rubric', parts: null })).toThrow(/unknown language/)
    })
  })
})
