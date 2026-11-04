/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Monitoring against a real Postgres with migrations 014, 015, 019 to 026 (roadmap 5.4): alerts from the per-group daily rows, the
// automatic demotion (reason, history row, audit row), the email to the platform owner, what is NOT counted (another marking setup, days
// before a promotion), the owner's and the institution admin's views. The roll-up from real marking is in integration.test.ts ("Monitoring").
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/monitoring.test

import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { parseGroupKey } from '@/lib/hw/eligibility/group'
import type { HwActor } from '@/lib/hw/access/policy'
import { addDays } from '@/lib/hw/monitoring/rules'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] monitoring DB tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014, 015, 019 to 026.')
Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '', GEMINI_API_KEY: 'fake-key', HW_GRADE_MODEL: 'gemini-3.5-flash-lite', HW_ELIGIBILITY_ENFORCED: 'true', HW_FEATURE_DEFAULT_ENABLED: 'false',
  // Explicit, so these tests do not depend on the defaults (which are the owner's provisional thresholds; see 'the defaults' below).
  HW_MONITOR_AUTODEMOTE: 'true', HW_MONITOR_MIN_ANSWERS: '30', HW_MONITOR_MIN_GROUP_SIZE: '10', HW_MONITOR_MAX_OVERRIDE_RATE: '0.5', HW_MONITOR_MAX_LARGE_OVERRIDE_RATE: '0.1',
})

// A fixed "today" far from the real one. The older roll-up and the roll-up test in integration.test.ts rewrite the real days for every institution in
// the shared test database, which would delete rows inserted here for the real today.
const BASE = '2031-03-14'
const NOW = new Date('2031-03-14T06:00:00Z') // 11:30 on BASE, India
const istDay = (offset = 0) => addDays(BASE, offset)

suite('monitoring — database', () => {
  jest.setTimeout(60_000)
  const tag = randomUUID().slice(0, 6).toLowerCase()
  let raw: Pool
  let m: {
    reg: typeof import('@/lib/hw/eligibility/registry')
    alerts: typeof import('@/lib/hw/monitoring/alerts')
    views: typeof import('@/lib/hw/monitoring/views')
    config: typeof import('@/lib/hw/config')
    pool: import('pg').Pool
  }
  const owner = { userId: `owner-${tag}`, isSuperAdmin: true, rater: null }
  const groups: string[] = []
  const orgs: string[] = []
  const ownerEmail = `owner-${tag}@example.test`
  const sent: { to: string; subject: string; html: string }[] = []
  const deps = () => ({ send: async (p: { to: string; subject: string; html: string }) => { sent.push(p); return { ok: true } }, now: () => new Date(), appUrl: () => 'https://app.test', recipients: async () => [ownerEmail] })
  const mine = () => sent.filter((s) => s.to === ownerEmail)

  const newGroup = (type = 'short') => { const k = `mon${tag}${groups.length}|${type}|en|teacher_rubric`; groups.push(k); return k }
  async function newOrg() {
    const id = `mon-${tag}-${orgs.length}`
    orgs.push(id)
    await raw.query(`INSERT INTO organization (id, name, slug, created_at) VALUES ($1, $2, $3, now())`, [id, `Org ${id}`, id])
    return id
  }
  async function daily(k: string, org: string, day: string, over: Record<string, number | string | null> = {}) {
    const p = parseGroupKey(k)!
    const v: Record<string, number | string | null> = {
      answers_marked: 40, suggestions_shown: 40, accepted_unchanged: 10, accepted_edited: 30, marked_by_hand: 0, marked_by_rule: 0, overrides: 30, large_overrides: 10, override_abs_sum: 30,
      config_hash: m.reg.runningConfig().hash, ...over,
    }
    const cols = Object.keys(v)
    await raw.query(
      `INSERT INTO hw_monitor_group_daily (day, organization_id, group_key, subject, question_type, language, scheme_source, ${cols.join(', ')})
       VALUES ($1, $2, $3, $4, $5, $6, $7, ${cols.map((_, i) => `$${i + 8}`).join(', ')})`,
      [day, org, k, p.subject, p.questionType, p.language, p.schemeSource, ...cols.map((c) => v[c])],
    )
  }
  async function eligibleGroup(k: string) {
    const p = parseGroupKey(k)!
    const id = randomUUID()
    await raw.query(
      `INSERT INTO hw_eval_gate_result (id, group_key, subject, question_type, language, scheme_source, verdict, checks, run_ids, dataset_versions, production_fingerprint, report_sha256, imported_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'eligible', '[]'::jsonb, ARRAY['run_x'], ARRAY['heldout-1d@v1'], $7, $8, 'itest')`,
      [id, k, p.subject, p.questionType, p.language, p.schemeSource, m.reg.runningConfig().hash, randomUUID().replace(/-/g, '').padEnd(64, '0')],
    )
    await m.reg.promote(owner, { groupKey: k, gateResultId: id, reason: 'Passed every gate on the held-out set.', confirm: true })
    // The promotion happened on BASE (the monitor judges only the days since it).
    await raw.query(`UPDATE hw_eligibility SET decided_at = $2 WHERE group_key = $1`, [k, NOW])
  }
  const status = async (k: string) => (await raw.query(`SELECT status FROM hw_eligibility WHERE group_key = $1`, [k])).rows[0]?.status
  const alertsOf = async (k: string) => (await raw.query(`SELECT code, severity, demoted, emailed_at, cleared_at FROM hw_monitor_alert WHERE group_key = $1 ORDER BY code`, [k])).rows

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    m = { reg: await import('@/lib/hw/eligibility/registry'), alerts: await import('@/lib/hw/monitoring/alerts'), views: await import('@/lib/hw/monitoring/views'), config: await import('@/lib/hw/config'), pool: db.getPool() }
  })
  beforeEach(() => { process.env.HW_MONITOR_AUTODEMOTE = 'true'; m.config._resetHwConfig() })
  afterAll(async () => {
    for (const k of groups) {
      await raw.query(`DELETE FROM hw_monitor_alert WHERE group_key = $1`, [k])
      await raw.query(`DELETE FROM hw_monitor_group_daily WHERE group_key = $1`, [k])
      await raw.query(`DELETE FROM hw_eligibility WHERE group_key = $1`, [k])
    }
    for (const o of orgs) await raw.query(`DELETE FROM organization WHERE id = $1`, [o])
    await raw.end()
    await m?.pool.end()
  })

  it('the owners’ addresses come from the super-admin accounts that have one', async () => {
    const list = await m.alerts.superAdminEmails((await import('@/db')).db as never)
    expect(Array.isArray(list)).toBe(true)
    const roles = (await raw.query(`SELECT email FROM "user" WHERE role = 'super_admin' AND email IS NOT NULL AND email <> ''`)).rows.map((r) => r.email).sort()
    expect([...list].sort()).toEqual(roles)
  })

  it('too few answers: nothing is raised, nothing is demoted, nothing is sent', async () => {
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay(), { answers_marked: 20, suggestions_shown: 20, accepted_unchanged: 0, accepted_edited: 20, overrides: 20, large_overrides: 20, override_abs_sum: 40 })
    const before = mine().length
    const run = await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(run.raised.filter((r) => r.groupKey === k)).toEqual([])
    expect(await status(k)).toBe('eligible')
    expect(await alertsOf(k)).toEqual([])
    expect(mine().length).toBe(before)
  })

  it('a breach with enough answers takes the group out of "eligible" automatically: reason, history, audit, and one email to the owner', async () => {
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay()) // 40 answers; 30 changed (75% > 50%), 10 of them largely (25% > 10%)
    const run = await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(run.demoted).toContain(k)
    expect(await status(k)).toBe('not_yet')
    expect((await alertsOf(k)).map((a) => [a.code, a.severity, a.demoted])).toEqual([['large_override_rate', 'demote', true], ['override_rate', 'demote', true]])

    const ev = (await raw.query(`SELECT from_status, to_status, actor_id, automatic, reason FROM hw_eligibility_event WHERE group_key = $1 ORDER BY at`, [k])).rows
    expect(ev.at(-1)).toMatchObject({ from_status: 'eligible', to_status: 'not_yet', actor_id: 'system:monitor', automatic: true })
    expect(ev.at(-1).reason).toMatch(/^Automatic: Teachers .*changed 75% of the AI suggestions.*limit 50%/)
    const au = (await raw.query(`SELECT actor_id, reason FROM hw_admin_audit WHERE action = 'eligibility_demoted_automatically' AND entity_id = $1`, [k])).rows
    expect(au).toHaveLength(1)
    expect(au[0].actor_id).toBe('system:monitor')

    expect(mine()).toHaveLength(1)
    expect(mine()[0].subject).toMatch(/demoted automatically/)
    expect(mine()[0].html).toMatch(/taken out of/)
    expect((await alertsOf(k)).every((a) => a.emailed_at !== null)).toBe(true)

    // The suggestions are off now (the product rule), and a second run neither emails nor demotes again.
    expect(await m.reg.eligibilityOfGroup((await import('@/db')).db as never, parseGroupKey(k)!)).toEqual({ eligible: false, reason: 'not_yet' })
    const again = await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(again.demoted).not.toContain(k)
    expect(mine()).toHaveLength(1)
  })

  it('with automatic demotion switched off the alert is raised and emailed but the group stays eligible', async () => {
    process.env.HW_MONITOR_AUTODEMOTE = 'false'; m.config._resetHwConfig()
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay())
    const before = mine().length
    const run = await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(run.demoted).not.toContain(k)
    expect(await status(k)).toBe('eligible')
    expect((await alertsOf(k)).map((a) => a.demoted)).toEqual([false, false])
    expect(mine().length).toBe(before + 1)
  })

  it('rows measured on another marking setup are not counted', async () => {
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay(), { config_hash: 'd'.repeat(64) })
    await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(await status(k)).toBe('eligible')
    expect(await alertsOf(k)).toEqual([])
  })

  it('days before the group was last promoted are not counted, so promoting again after a fix is not undone at once', async () => {
    const k = newGroup(); const org = await newOrg()
    await daily(k, org, istDay(-1)) // a bad day, before the (re-)promotion below
    await eligibleGroup(k)
    await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(await status(k)).toBe('eligible')
    expect(await alertsOf(k)).toEqual([])
    await daily(k, org, istDay()) // a bad day after it does count
    await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(await status(k)).toBe('not_yet')
  })

  it('an alert is cleared when the figures come back under the limit', async () => {
    process.env.HW_MONITOR_AUTODEMOTE = 'false'; m.config._resetHwConfig()
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay())
    await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect((await alertsOf(k)).every((a) => a.cleared_at === null)).toBe(true)
    await raw.query(`UPDATE hw_monitor_group_daily SET suggestions_shown = 40, accepted_unchanged = 38, accepted_edited = 2, overrides = 2, large_overrides = 0, override_abs_sum = 2 WHERE group_key = $1`, [k])
    const run = await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(run.cleared).toBeGreaterThanOrEqual(2)
    expect((await alertsOf(k)).every((a) => a.cleared_at !== null)).toBe(true)
  })

  it('failed jobs, transcript fixes and cost only warn: they email but never demote', async () => {
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay(), { suggestions_shown: 0, accepted_unchanged: 0, accepted_edited: 0, marked_by_hand: 40, overrides: 0, large_overrides: 0, override_abs_sum: 0, transcript_fixes: 20, jobs_total: 40, jobs_failed: 20 })
    await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(await status(k)).toBe('eligible')
    expect((await alertsOf(k)).map((a) => [a.code, a.severity, a.demoted])).toEqual([['failed_job_rate', 'warn', false], ['transcript_fix_rate', 'warn', false]])
  })

  it('an email that cannot be sent is tried again on the next run, and the group is demoted all the same', async () => {
    const k = newGroup(); const org = await newOrg()
    await eligibleGroup(k)
    await daily(k, org, istDay())
    const failing = { ...deps(), send: async () => ({ ok: false, error: 'mail is down' }) }
    const run = await m.alerts.runAlerts({ deps: failing, today: BASE })
    expect(await status(k)).toBe('not_yet')
    expect(run.emailError).toBe('mail is down')
    expect((await alertsOf(k)).every((a) => a.emailed_at === null)).toBe(true)
    const before = mine().length
    await m.alerts.runAlerts({ deps: deps(), today: BASE })
    expect(mine().length).toBe(before + 1)
    expect((await alertsOf(k)).every((a) => a.emailed_at !== null)).toBe(true)
  })

  it('the owner sees every group with today, the 7 days, the day-by-day list, the registry state and the alerts; nobody else does', async () => {
    const k = newGroup(); const org = await newOrg()
    await daily(k, org, istDay(), { answers_marked: 12, suggestions_shown: 10, accepted_unchanged: 6, accepted_edited: 4, marked_by_hand: 2, overrides: 4, large_overrides: 1, override_abs_sum: 6 })
    await daily(k, org, istDay(-2), { answers_marked: 8, suggestions_shown: 8, accepted_unchanged: 8, accepted_edited: 0, overrides: 0, large_overrides: 0, override_abs_sum: 0 })
    await expect(m.views.superMonitor({ userId: 'x', isSuperAdmin: false, rater: null })).rejects.toThrow(/Only the platform owner/)
    const v = await m.views.superMonitor(owner, { now: NOW })
    expect(v.days).toHaveLength(7)
    expect(v.days[6]).toBe(istDay())
    const g = v.groups.find((x) => x.groupKey === k)!
    expect(g.effective).toBe('no_record')
    expect(g.today.counts).toMatchObject({ answers: 12, shown: 10, unchanged: 6, edited: 4, overrides: 4, large: 1 })
    expect(g.today.rates.overrideRate).toBeCloseTo(0.4)
    expect(g.today.rates.meanOverride).toBeCloseTo(1.5)
    expect(g.last7.counts).toMatchObject({ answers: 20, shown: 18 })
    expect(g.byDay).toHaveLength(7)
    expect(g.byDay.find((d) => d.day === istDay(-2))!.counts.answers).toBe(8)
    expect(g.byDay.find((d) => d.day === istDay(-1))!.counts.answers).toBe(0)
    expect(v.thresholds).toMatchObject({ minAnswers: 30, maxOverrideRate: 0.5 })
  })

  it('an institution admin sees only their own institution, aggregates only, and no figures for a group under the minimum size', async () => {
    const mineOrg = await newOrg(); const other = await newOrg()
    const big = newGroup('long'); const small = newGroup('essay'); const theirs = newGroup('very_short')
    await daily(big, mineOrg, istDay(), { answers_marked: 12, suggestions_shown: 12, accepted_unchanged: 12, accepted_edited: 0, overrides: 0, large_overrides: 0, override_abs_sum: 0 })
    await daily(small, mineOrg, istDay(), { answers_marked: 5, suggestions_shown: 5, accepted_unchanged: 5, accepted_edited: 0, overrides: 0, large_overrides: 0, override_abs_sum: 0 })
    await daily(theirs, other, istDay()) // another institution's group must not appear at all
    const admin: HwActor = { userId: `a-${tag}`, orgId: mineOrg, role: 'admin', isPlatformStaff: false }
    const v = await m.views.institutionMonitor(admin, { now: NOW })
    expect(v.minGroupSize).toBe(10)
    expect(v.groups.map((g) => g.groupKey).sort()).toEqual([big, small].sort())
    const b = v.groups.find((g) => g.groupKey === big)!
    expect(b.suppressed).toBe(false)
    if (!b.suppressed) expect(b.last7.counts.answers).toBe(12)
    const s = v.groups.find((g) => g.groupKey === small)!
    expect(s).toMatchObject({ suppressed: true })
    expect(Object.keys(s).sort()).toEqual(['groupKey', 'label', 'minGroupSize', 'suppressed']) // not even a count
    expect(JSON.stringify(v)).not.toContain(theirs)
    // not for teachers, students, parents
    for (const role of ['teacher', 'student', 'parent'] as const) {
      await expect(m.views.institutionMonitor({ ...admin, role })).rejects.toThrow()
    }
  })
})
