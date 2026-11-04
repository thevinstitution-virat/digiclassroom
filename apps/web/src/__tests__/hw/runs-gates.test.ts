/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// "Runs & gates" tab (roadmap 5.5) against a real Postgres with migrations 014, 015, 023 and 024: the screen shows exactly what
// `npm run hw:eval:report` wrote. The report here is built by the same function the command uses (buildReport), written as the command
// writes it (JSON.stringify of the model) and read back, imported as `hw:eval:gates import` imports it, and read through the screen's service.
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/runs-gates.test

import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Pool } from 'pg'
import { buildReport, renderMarkdown } from '@/lib/hw/eval/report'
import type { RunRecord } from '@/lib/hw/eval/runner'
import { resultsFromReport, type ReportJson } from '@/lib/hw/eligibility/gate-import'
import { pairedRegressionChecks, regressionPasses } from '@/lib/hw/eval/regression'
import { row, world } from '@/test-support/hw/eval-world'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] runs-gates DB tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014, 015, 023 and 024.')
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', GEMINI_API_KEY: 'fake-key', HW_GRADE_MODEL: 'gemini-3.5-flash-lite', HW_ELIGIBILITY_ENFORCED: 'true', HW_FEATURE_DEFAULT_ENABLED: 'false' })

suite('runs & gates — the screen matches hw:eval:report', () => {
  jest.setTimeout(60_000)
  const tag = randomUUID().replace(/-/g, '').slice(0, 8)
  const datasetRef = `rgtest${tag}@v1`
  const owner = { userId: `owner-${tag}`, isSuperAdmin: true, rater: null }
  let raw: Pool
  let m: {
    reg: typeof import('@/lib/hw/eligibility/registry')
    store: typeof import('@/lib/hw/eligibility/gate-store')
    view: typeof import('@/lib/hw/eligibility/runs-view')
    pool: import('pg').Pool
  }

  /** What `hw:eval:report` does: build the model, write report.json, and (later) the importer reads that file. */
  function reportFile(tweak?: (model: ReturnType<typeof buildReport>) => void) {
    const w = world()
    const record = (mode: RunRecord['mode'], repeat: number): RunRecord => ({
      runId: `run_rg${tag}_${mode}${repeat}`, mode, dataset: { ref: datasetRef, manifestSha256: 'f'.repeat(64), items: w.items.length }, repeat, budgetPaise: 10_000,
      status: 'completed', startedAt: 'x', tokens: { input: 1000, cached: 0, output: 100 }, costPaise: 250, counts: { ok: 93, failed: 0, no_grounding: 0, skipped: 0 }, failures: [],
      meta: { configHash: 'c'.repeat(64), gitCommit: 'abcdef1234' },
    })
    const model = buildReport({
      title: 'Report', datasetRef, manifestSha256: 'f'.repeat(64), items: w.items,
      runs: [{ record: record('mark', 1), rows: w.rows }, { record: record('mark', 5), rows: w.repeatRows }],
      raters: w.raters, keyAudits: w.keyAudits, keySupport: w.keySupport,
    })
    tweak?.(model)
    const dir = mkdtempSync(join(tmpdir(), 'hw-report-'))
    const file = join(dir, 'report.json')
    writeFileSync(file, JSON.stringify(model, null, 2))
    const text = readFileSync(file, 'utf8')
    return { model, report: JSON.parse(text) as ReportJson, sha: createHash('sha256').update(text).digest('hex') }
  }
  async function importIt(r: ReturnType<typeof reportFile>) {
    const results = resultsFromReport(r.report, { schemeSource: 'teacher_rubric', parts: m.reg.runningConfig().parts })
    return m.store.importGateReport(r.report, results, { importedBy: 'cli:test', reportSha256: r.sha })
  }
  const VERDICT = { Eligible: 'eligible', 'Not yet': 'not_yet', 'Insufficient data': 'insufficient_data' } as const

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    m = { reg: await import('@/lib/hw/eligibility/registry'), store: await import('@/lib/hw/eligibility/gate-store'), view: await import('@/lib/hw/eligibility/runs-view'), pool: db.getPool() }
  })
  afterAll(async () => {
    await raw.query(`DELETE FROM hw_eligibility WHERE group_key = 'science|short|en|teacher_rubric' AND decided_by = 'system:gate-import'`)
    await raw.end()
    await m?.pool.end()
  })

  it('only the platform owner can open it', async () => {
    await expect(m.view.runsAndGates({ userId: 'x', isSuperAdmin: false, rater: null })).rejects.toThrow(/Only the platform owner/)
  })

  it('every run and every gate row on the screen is the report’s own row, and the Markdown report says the same', async () => {
    const r = reportFile()
    expect(r.model.gates.length).toBeGreaterThan(0)
    const out = await importIt(r)
    expect(out.runsAdded).toBe(2)
    const screen = await m.view.runsAndGates(owner)

    // Runs
    for (const run of r.model.runs) {
      const s = screen.runs.find((x) => x.runId === run.runId)!
      expect(s).toBeDefined()
      expect(s).toMatchObject({ mode: run.mode, status: run.status, datasetRef, configHash: run.configHash, gitCommit: run.gitCommit, repeat: run.repeat, costPaise: Math.round(run.costInr * 100), counts: run.counts })
    }
    // Datasets: one version, with its two runs
    expect(screen.datasets.find((d) => d.datasetRef === datasetRef)).toMatchObject({ runs: 2, manifestSha256: 'f'.repeat(64) })

    // Gate tables: the stored verdict and every check (name, state, wording) are the report's
    const md = renderMarkdown(r.model)
    for (const g of r.model.gates) {
      const key = `${g.subject.toLowerCase()}|${g.questionType}|${g.language}|teacher_rubric`
      const s = screen.gates.find((x) => x.groupKey === key)!
      expect(s).toBeDefined()
      expect(s.verdict).toBe(VERDICT[g.verdict])
      expect(s.checks).toEqual(g.checks.map((c) => ({ gate: c.gate, state: c.state, detail: c.detail })))
      expect(s.runIds).toEqual(r.model.runs.map((x) => x.runId))
      expect(s.datasetVersions).toEqual([datasetRef])
      // the same row in the report a person reads
      expect(md).toContain(`| ${g.subject} | ${g.questionType} | ${g.language} | **${g.verdict}** |`)
    }
  })

  it('it shows what the report says even if that differs from what would be recomputed: nothing is recalculated', async () => {
    const r = reportFile((model) => { model.gates[0].checks[0].detail = `edited in the file ${tag}`; model.gates[0].verdict = 'Not yet' })
    await importIt(r)
    const s = (await m.view.runsAndGates(owner)).gates.find((x) => x.groupKey === 'science|short|en|teacher_rubric')!
    expect(s.verdict).toBe('not_yet')
    expect(s.checks[0].detail).toBe(`edited in the file ${tag}`)
  })

  it('importing the same report again changes nothing; a new report is a new row and the older one is kept', async () => {
    const r = reportFile()
    const first = await importIt(r)
    const again = await importIt(r)
    expect(first.resultsAdded).toBe(1)
    expect(again).toMatchObject({ runsAdded: 0, resultsAdded: 0, resultsAlreadyThere: 1 })
    const n = (await raw.query(`SELECT count(*)::int AS n FROM hw_eval_gate_result WHERE group_key = 'science|short|en|teacher_rubric'`)).rows[0].n
    const screen = await m.view.runsAndGates(owner)
    expect(screen.gates.filter((x) => x.groupKey === 'science|short|en|teacher_rubric')).toHaveLength(1) // the newest, once
    expect(screen.gates.find((x) => x.groupKey === 'science|short|en|teacher_rubric')!.earlier).toBe(n - 1)
    await expect(raw.query(`UPDATE hw_eval_gate_result SET verdict = 'eligible' WHERE group_key = 'science|short|en|teacher_rubric'`)).rejects.toThrow()
    await expect(raw.query(`DELETE FROM hw_eval_run WHERE run_id = $1`, [r.model.runs[0].runId])).rejects.toThrow()
  })

  it('regression results: the screen shows the command’s own regression.json, a pass and a fail, once each, and never rewritten', async () => {
    const w = world()
    const real = w.items.filter((i) => i.source === 'D')
    const worse = w.rows.map((r) => (real.some((i) => i.id === r.itemId) ? row(real.find((i) => i.id === r.itemId)!, 0) : r)) // the candidate marks every real answer 0
    const make = (cand: typeof w.rows, candidate: string) => {
      const checks = pairedRegressionChecks(w.rows, cand, w.items)
      // what the command writes, then read back from the file as the importer does
      return JSON.parse(JSON.stringify({ baseline: `run_rg${tag}_base`, candidate, dataset: datasetRef, ok: regressionPasses(checks), checks }))
    }
    const pass = make(w.rows, `run_rg${tag}_same`)
    const fail = make(worse, `run_rg${tag}_worse`)
    expect(pass.ok).toBe(true)
    expect(fail.ok).toBe(false)
    for (const r of [pass, fail]) {
      const text = JSON.stringify(r, null, 2)
      const sha = createHash('sha256').update(text).digest('hex')
      expect((await m.store.importRegression(r, { importedBy: 'cli:test', sourceSha256: sha })).added).toBe(true)
      expect((await m.store.importRegression(r, { importedBy: 'cli:test', sourceSha256: sha })).added).toBe(false) // the same file is stored once
    }
    const screen = await m.view.runsAndGates(owner)
    for (const r of [pass, fail]) {
      const s = screen.regressions.find((x) => x.candidateRunId === r.candidate)!
      expect(s).toMatchObject({ baselineRunId: r.baseline, datasetRef: datasetRef, ok: r.ok })
      expect(s.checks).toEqual(r.checks) // every check, unchanged: nothing recomputed
    }
    await expect(m.store.importRegression({ ...pass, ok: undefined as never }, { importedBy: 'cli:test', sourceSha256: 'a'.repeat(64) })).rejects.toThrow(/not a regression.json/)
    await expect(raw.query(`UPDATE hw_eval_regression SET ok = true WHERE candidate_run_id = $1`, [fail.candidate])).rejects.toThrow()
    await expect(raw.query(`DELETE FROM hw_eval_regression WHERE candidate_run_id = $1`, [pass.candidate])).rejects.toThrow()
  })
})
