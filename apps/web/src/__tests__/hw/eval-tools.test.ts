/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// Virat Evaluator tools: payload rules (pure), and the full human flow against a real
// Postgres with migration 015 — create tasks, assign, two raters disagree, adjudicate,
// export, new dataset version. Dataset content comes from an in-memory source; nothing
// touches R2 or an AI provider.
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/eval-tools

import { Pool } from 'pg'
import { eligibleForTask, markDiff, outcomeOf, parsePayload, payloadsAgree, transcriptDiff } from '@/lib/hw/eval-tools/payloads'
import { applyCopies, applyReference } from '@/lib/hw/eval/reference'
import { newItemId, parseManifest, type EvalItem } from '@/lib/hw/eval/dataset'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] eval tools DB tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014 and 015.')
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EVAL_TOOLS_ENABLED: 'true' })

function item(over: Partial<EvalItem> = {}): EvalItem {
  return {
    id: newItemId(), source: 'C', subject: 'Science', class: 'Class 9', board: 'CBSE', medium: 'English', language: 'en',
    questionType: 'short', mode: 'photo',
    question: { id: 'q1', text: 'Why do we need trees?', marks: 2 },
    media: { photo: 'media/p1.png' },
    truthTranscript: null,
    key: { source: 'textbook', keyId: 'f'.repeat(64), referenceAnswer: 'Trees give oxygen and shade.', points: [
      { id: 'p1', marks: 1, cites: ['c1'], text: 'Give oxygen' }, { id: 'p2', marks: 1, cites: ['c1'], text: 'Give shade' },
    ] },
    referenceMarks: null, mutation: null, handwritingBand: 'unknown', device: 'phone',
    consent: { ref: 'consent_1', deidentified: true },
    ...over,
  }
}

describe('payload rules', () => {
  it('blind marks must cover every point within its marks, on the 0.5 grid', () => {
    const ctx = { points: [{ id: 'p1', marks: 1 }, { id: 'p2', marks: 1 }] }
    expect(parsePayload('blind_mark', { byPoint: { p1: 1, p2: 0.5 } }, ctx).ok).toBe(true)
    expect(parsePayload('blind_mark', { byPoint: { p1: 1 } }, ctx)).toMatchObject({ ok: false, problem: 'no marks for p2' })
    expect(parsePayload('blind_mark', { byPoint: { p1: 1.5, p2: 0 } }, ctx)).toMatchObject({ ok: false })
    expect(parsePayload('blind_mark', { byPoint: { p1: 0.3, p2: 0 } }, ctx)).toMatchObject({ ok: false })
    expect(parsePayload('blind_mark', { byPoint: { p1: 1, p2: 1, p9: 0 } }, ctx)).toMatchObject({ ok: false })
  })
  it('refuses unknown fields: nothing extra rides along', () => {
    expect(parsePayload('transcribe', { text: 'x', aiTranscript: 'y' }).ok).toBe(false)
  })
  it('key audits judge every point once; blanking needs regions inside the image', () => {
    const ctx = { points: [{ id: 'p1', marks: 1 }] }
    expect(parsePayload('key_audit', { points: [{ id: 'p1', verdict: 'correct' }], missing: [] }, ctx).ok).toBe(true)
    expect(parsePayload('key_audit', { points: [], missing: [] }, ctx).ok).toBe(false)
    expect(parsePayload('deidentify', { verdict: 'needs_blanking', regions: [] }).ok).toBe(false)
    expect(parsePayload('deidentify', { verdict: 'needs_blanking', regions: [{ x: 0.9, y: 0, w: 0.5, h: 0.1 }] }).ok).toBe(false)
  })
  it('agreement: transcripts after normalisation only; marks exactly', () => {
    expect(payloadsAgree('transcribe', { text: 'Trees  give\r\noxygen ' }, { text: 'Trees give\noxygen' })).toBe(true)
    expect(payloadsAgree('transcribe', { text: 'Trees give oxygen' }, { text: 'trees give oxygen' })).toBe(false)
    expect(outcomeOf('blind_mark', [{ byPoint: { p1: 1 } }, { byPoint: { p1: 0.5 } }])).toBe('needs_adjudication')
    expect(outcomeOf('key_audit', [{ points: [{ id: 'p1', verdict: 'wrong' }], missing: [] }])).toBe('needs_adjudication')
    expect(outcomeOf('deidentify', [{ verdict: 'clean', regions: [] }])).toBe('done')
  })
  it('diffs show only what differs', () => {
    expect(transcriptDiff('trees give oxygen', 'trees gave oxygen').filter((o) => o.op !== 'match')).toEqual([{ op: 'sub', out: 'gave', truth: 'give' }])
    expect(markDiff({ p1: 1, p2: 1 }, { p1: 1, p2: 0 })).toEqual([{ pointId: 'p2', a: 1, b: 0 }])
  })
  it('which items each kind is made from', () => {
    expect(eligibleForTask('deidentify', item())).toBe(true)
    expect(eligibleForTask('deidentify', item({ media: { render: 'media/r.png' }, mode: 'ink' }))).toBe(false)
    expect(eligibleForTask('blind_mark', item())).toBe(true)
  })
})

describe('new dataset versions from human work', () => {
  it('known text wins; by-construction marks stay; failed audits and unblanked pages are left out', () => {
    const a = item()
    const b = item({ id: newItemId() })
    const c = item({ id: newItemId(), key: { ...item().key!, keyId: 'e'.repeat(64) } })
    const r = applyReference([a, b, c], {
      datasetRef: 'demo@v1', exportedAt: 'now',
      transcripts: { [a.id]: { text: 'Trees give oxygen', how: 'adjudicated', raters: { Rater1: 'Trees give oxygen', Rater2: 'Trees gave oxygen' } } },
      marks: { [a.id]: { byPoint: { p1: 1, p2: 0 }, how: 'agreed', raters: { Rater1: { p1: 1, p2: 0 }, Rater2: { p1: 1, p2: 0 } } } },
      deidentification: { [b.id]: { verdict: 'needs_blanking', regions: [{ x: 0, y: 0, w: 0.2, h: 0.1 }] } },
      keyAudits: { ['e'.repeat(64)]: { points: [{ id: 'p1', verdict: 'wrong' }], missing: [], how: 'single' } },
    })
    expect(r.items.map((x) => x.id)).toEqual([a.id])
    expect(r.items[0].truthTranscript).toEqual({ text: 'Trees give oxygen', how: 'double_typed_adjudicated' })
    expect(r.items[0].referenceMarks).toEqual({ byPoint: { p1: 1, p2: 0 }, total: 1, how: 'double_marked' })
    expect(r.raters[a.id].Rater2).toEqual({ p1: 1, p2: 0 })
    expect(r.report).toMatchObject({ droppedNeedsBlanking: [b.id], droppedKeyFailedAudit: [c.id] })
    expect(parseManifest(r.items.map((x) => JSON.stringify(x)).join('\n'))).toHaveProperty('items')
  })
  it('pad copies become ink items; a variant points at the same writer’s copy of its parent', () => {
    const base = { source: 'B' as const, mode: 'typed' as const, media: {}, consent: { ref: null, deidentified: true } }
    const parent = item({ ...base, truthTranscript: { text: 'Trees give oxygen and shade.', how: 'known_text' }, referenceMarks: { byPoint: { p1: 1, p2: 1 }, total: 2, how: 'by_construction' }, mutation: { type: 'original', target: null, rule: 'full', parentItem: null } })
    const variant = item({ ...base, id: newItemId(), truthTranscript: { text: 'Trees give oxygen.', how: 'known_text' }, referenceMarks: { byPoint: { p1: 1, p2: 0 }, total: 1, how: 'by_construction' }, mutation: { type: 'remove_point', target: 'p2', rule: 'minus p2', parentItem: parent.id } })
    const rec = (itemId: string, raterId: string) => ({ itemId, raterId, device: 'pen', inkPath: `media/copies/${itemId}/${raterId}/ink.v1.json.gz`, renderPath: `media/copies/${itemId}/${raterId}/render.v1.png` })
    const r = applyCopies([parent, variant], [rec(parent.id, 'r1'), rec(variant.id, 'r1'), rec(variant.id, 'r2')])
    expect(r.items).toHaveLength(5)
    const v1 = r.items.find((x) => x.id === r.idOf.get(`${variant.id}|r1`))!
    const v2 = r.items.find((x) => x.id === r.idOf.get(`${variant.id}|r2`))!
    expect(v1.mutation!.parentItem).toBe(r.idOf.get(`${parent.id}|r1`))
    expect(v2.mutation!.parentItem).toBe(parent.id) // r2 did not copy the parent
    expect(v1).toMatchObject({ mode: 'ink', media: { render: expect.stringContaining('render.v1.png') } })
    expect(parseManifest(r.items.map((x) => JSON.stringify(x)).join('\n'))).toHaveProperty('items')
  })
})

describe('isolation', () => {
  const { readdirSync, readFileSync } = jest.requireActual<typeof import('node:fs')>('node:fs')
  const { join, resolve } = jest.requireActual<typeof import('node:path')>('node:path')
  const core = resolve(__dirname, '../../../../../packages/core/src')
  const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : /\.tsx?$/.test(e.name) ? [join(d, e.name)] : [])

  it('the tools never load AI output or eval run results (blind marking stays blind)', () => {
    for (const f of walk(join(core, 'lib/hw/eval-tools'))) {
      const src = readFileSync(f, 'utf8')
      expect({ f, hit: /from '\.\.\/(ai|grader|reader|eval\/runner|eval\/summary|eval\/live-deps)\b|hwAiGrade|hw_ai_grade|items\.jsonl/.exec(src)?.[0] ?? null }).toEqual({ f, hit: null })
    }
  })

  it('product code never reads shadow results', () => {
    const allowed = [/db[\\/]hw-eval-schema\.ts$/, /lib[\\/]db[\\/]migrations[\\/]/]
    const hits = walk(core).filter((f) => !allowed.some((a) => a.test(f)) && /hwEvalShadowResult|hw_eval_shadow_result/.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})

suite('evaluator tools against Postgres', () => {
  jest.setTimeout(60_000)
  let raw: Pool
  type Mods = {
    admin: typeof import('@/lib/hw/eval-tools/admin')
    work: typeof import('@/lib/hw/eval-tools/work')
    source: typeof import('@/lib/hw/eval-tools/source')
    config: typeof import('@/lib/hw/config')
    pool: import('pg').Pool
  }
  let m: Mods
  const ref = `itest-${Date.now().toString(36)}@v1`
  const items = [item(), item({ id: newItemId() })]
  const raterIds: string[] = []
  const actors: Record<string, import('@/lib/hw/eval-tools/access').EvalActor> = {}
  const admin = { userId: '', isSuperAdmin: true, rater: null }

  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL })
    const db = await import('@/lib/db/connection')
    m = {
      admin: await import('@/lib/hw/eval-tools/admin'),
      work: await import('@/lib/hw/eval-tools/work'),
      source: await import('@/lib/hw/eval-tools/source'),
      config: await import('@/lib/hw/config'),
      pool: db.getPool(),
    }
    m.config._resetHwConfig()
    m.source._setEvalSource({
      items: async (r) => { if (r !== ref) throw new Error('unknown dataset'); return items },
      media: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      key: async () => null,
    })
    // Three teacher accounts that are not raters yet.
    const { rows } = await raw.query(`SELECT u.id, u.email FROM "user" u WHERE u.role = 'teacher' AND NOT EXISTS (SELECT 1 FROM hw_eval_rater r WHERE r.user_id = u.id) ORDER BY u.id LIMIT 3`)
    if (rows.length < 3) throw new Error('hw_itest needs 3 teacher users that are not raters')
    admin.userId = rows[0].id
    const specs = [['ItestA', ['transcribe', 'mark:science']], ['ItestB', ['transcribe', 'mark:science']], ['ItestC', ['adjudicate', 'transcribe', 'mark:science']]] as const
    for (let i = 0; i < 3; i++) {
      const r = await m.admin.createRater(admin, { email: rows[i].email, pseudonym: `${specs[i][0]}${Date.now().toString(36).slice(-4)}`, skills: [...specs[i][1]] })
      raterIds.push(r.id)
      const { rows: [x] } = await raw.query(`SELECT pseudonym, skills FROM hw_eval_rater WHERE id = $1`, [r.id])
      actors[specs[i][0]] = { userId: rows[i].id, isSuperAdmin: false, rater: { id: r.id, pseudonym: x.pseudonym, skills: x.skills } }
    }
    // C must not be put on the transcription tasks, so it is free to adjudicate them.
    await raw.query(`UPDATE hw_eval_rater SET active = false WHERE id = $1`, [raterIds[2]])
  })

  afterAll(async () => {
    await raw.query(`DELETE FROM hw_eval_task WHERE dataset_ref = $1`, [ref])
    await raw.query(`DELETE FROM hw_eval_rater WHERE id = ANY($1)`, [raterIds])
    await raw.end()
    await m?.pool.end()
    m?.source._setEvalSource(null)
  })

  it('a student account cannot be added; only super admins manage raters', async () => {
    const { rows } = await raw.query(`SELECT email FROM "user" WHERE role = 'student' LIMIT 1`)
    await expect(m.admin.createRater(admin, { email: rows[0].email, pseudonym: 'KidRater1', skills: ['transcribe'] })).rejects.toThrow(/student account cannot be a rater/)
    await expect(m.admin.listRaters(actors.ItestA)).rejects.toThrow(/Only the platform owner/)
    await expect(m.admin.createRater(admin, { email: rows[0].email, pseudonym: 'KidRater2', skills: ['grade:all'] })).rejects.toThrow(/Unknown skills/)
  })

  it('transcription: two raters disagree, a third resolves, the export carries both and the decision', async () => {
    expect(await m.admin.createTasks(admin, { datasetRef: ref, kind: 'transcribe' })).toEqual({ created: 2, eligible: 2 })
    expect((await m.admin.createTasks(admin, { datasetRef: ref, kind: 'transcribe' })).created).toBe(0)
    const as = await m.admin.assignOpenTasks(admin, { datasetRef: ref })
    expect(as.assigned).toBe(4)

    const qa = await m.work.myQueue(actors.ItestA)
    const qb = await m.work.myQueue(actors.ItestB)
    expect(qa.pending).toHaveLength(2)
    const taskOf = async (assignmentId: string) => (await raw.query(`SELECT task_id FROM hw_eval_assignment WHERE id = $1`, [assignmentId])).rows[0].task_id as string
    const target = await taskOf(qa.pending[0].assignmentId)
    const aA = qa.pending[0].assignmentId
    let aB = ''
    for (const p of qb.pending) if (await taskOf(p.assignmentId) === target) aB = p.assignmentId

    const opened = await m.work.openAssignment(actors.ItestA, aA)
    expect(opened.view).toEqual({ kind: 'transcribe', image: `/api/hw-eval/media?assignment=${aA}`, language: 'en' })
    // B cannot open or see A's assignment, or its image.
    await expect(m.work.openAssignment(actors.ItestB, aA)).rejects.toThrow(/not found/i)
    await expect(m.work.taskMedia(actors.ItestB, { assignmentId: aA })).rejects.toThrow(/not found/i)
    expect((await m.work.taskMedia(actors.ItestA, { assignmentId: aA })).mime).toBe('image/png')

    expect(await m.work.submitAssignment(actors.ItestA, { assignmentId: aA, payload: { text: 'Trees give oxygen' }, timeMs: 5000 })).toEqual({ status: 'in_progress' })
    await expect(m.work.submitAssignment(actors.ItestA, { assignmentId: aA, payload: { text: 'again' }, timeMs: 1 })).rejects.toThrow(/already submitted/)
    expect(await m.work.submitAssignment(actors.ItestB, { assignmentId: aB, payload: { text: 'Trees gave oxygen' }, timeMs: 6000 })).toEqual({ status: 'needs_adjudication' })

    // A rater of the task never adjudicates it; C (who did not work on it) does.
    expect(await m.work.adjudicationQueue(actors.ItestA)).toEqual([])
    await raw.query(`UPDATE hw_eval_rater SET active = true WHERE id = $1`, [raterIds[2]])
    const cq = await m.work.adjudicationQueue(actors.ItestC)
    expect(cq.map((t) => t.id)).toContain(target)
    const adj = await m.work.openAdjudication(actors.ItestC, target)
    expect(adj.submissions.map((s) => s.label)).toEqual(['Rater A', 'Rater B'])
    expect(JSON.stringify(adj)).not.toContain(actors.ItestA.rater!.pseudonym)
    expect((adj.diff as { words: { op: string }[] }).words.filter((o) => o.op !== 'match')).toHaveLength(1)
    await expect(m.work.submitAdjudication(actors.ItestC, { taskId: target, payload: { text: 'Trees give oxygen' }, reason: ' ', timeMs: 1 })).rejects.toThrow(/why/)
    expect(await m.work.submitAdjudication(actors.ItestC, { taskId: target, payload: { text: 'Trees give oxygen' }, reason: 'second word is give', timeMs: 3000 })).toEqual({ status: 'done' })

    const exp = await m.admin.exportReference(admin, { datasetRef: ref })
    const itemId = (await raw.query(`SELECT target_id FROM hw_eval_task WHERE id = $1`, [target])).rows[0].target_id as string
    expect(exp.transcripts[itemId]).toEqual({ text: 'Trees give oxygen', how: 'adjudicated', raters: { [actors.ItestA.rater!.pseudonym]: 'Trees give oxygen', [actors.ItestB.rater!.pseudonym]: 'Trees gave oxygen' } })
  })

  it('blind marking: the view has the answer, question and key only; agreement finishes the task', async () => {
    await raw.query(`UPDATE hw_eval_rater SET active = false WHERE id = $1`, [raterIds[2]])
    await m.admin.createTasks(admin, { datasetRef: ref, kind: 'blind_mark' })
    await m.admin.assignOpenTasks(admin, { datasetRef: ref })
    const qa = await m.work.myQueue(actors.ItestA)
    const bm = qa.pending.find((p) => p.kind === 'blind_mark')!
    const v = await m.work.openAssignment(actors.ItestA, bm.assignmentId)
    expect(Object.keys(v.view).sort()).toEqual(['image', 'kind', 'points', 'question', 'referenceAnswer', 'typedText'])
    await expect(m.work.submitAssignment(actors.ItestA, { assignmentId: bm.assignmentId, payload: { byPoint: { p1: 1 } }, timeMs: 1 })).rejects.toThrow(/no marks for p2/)
    expect(await m.work.submitAssignment(actors.ItestA, { assignmentId: bm.assignmentId, payload: { byPoint: { p1: 1, p2: 0.5 } }, timeMs: 1 })).toEqual({ status: 'in_progress' })
    const taskId = (await raw.query(`SELECT task_id FROM hw_eval_assignment WHERE id = $1`, [bm.assignmentId])).rows[0].task_id
    const { rows: [b] } = await raw.query(`SELECT a.id FROM hw_eval_assignment a WHERE a.task_id = $1 AND a.rater_id = $2`, [taskId, raterIds[1]])
    expect(await m.work.submitAssignment(actors.ItestB, { assignmentId: b.id, payload: { byPoint: { p1: 1, p2: 0.5 } }, timeMs: 1 })).toEqual({ status: 'done' })
  })
})
