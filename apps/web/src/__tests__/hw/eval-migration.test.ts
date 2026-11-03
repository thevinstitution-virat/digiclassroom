// Migration 015 (and 021's relaxed rater account rule) against a real Postgres: every rule the database enforces, tried and refused.
// Each test runs in a transaction that is rolled back, so the database is left as it was.
//
//   HW_ITEST_DATABASE_URL=postgresql://postgres:...@127.0.0.1:5446/hw_itest npx jest src/__tests__/hw/eval-migration
// Without it the suite is skipped, and says so.

import { Pool, type PoolClient } from 'pg'

const DB_URL = process.env.HW_ITEST_DATABASE_URL
const suite = DB_URL ? describe : describe.skip
if (!DB_URL) console.warn('[hw] eval migration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 014 and 015.')

suite('migration 015 rules', () => {
  let pool: Pool
  let c: PoolClient
  let teacherId: string
  let teacher2Id: string
  let teacher3Id: string
  let n = 0

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_URL })
    const t = await pool.query(`SELECT id FROM "user" WHERE role = 'teacher' ORDER BY id LIMIT 3`)
    if (t.rows.length < 3) throw new Error('hw_itest needs 3 teacher users')
    ;[teacherId, teacher2Id, teacher3Id] = t.rows.map((r) => r.id)
  })
  afterAll(async () => { await pool?.end() })
  beforeEach(async () => { c = await pool.connect(); await c.query('BEGIN') })
  afterEach(async () => { await c.query('ROLLBACK'); c.release() })

  /** Runs in a savepoint so a refused statement does not end the test's transaction. */
  async function refused(sql: string, params: unknown[], msg: RegExp) {
    const sp = `sp${++n}`
    await c.query(`SAVEPOINT ${sp}`)
    await expect(c.query(sql, params)).rejects.toThrow(msg)
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`)
  }
  const one = async (sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows[0]
  const rater = (userId: string, pseudonym: string, skills: string[]) =>
    one(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ($1, $2, $3, $2) RETURNING id`, [pseudonym, userId, skills])
  const task = (kind: string, subject: string | null, required: number, target = `evitem_${'a'.repeat(19)}${'abcdefghijklmnopqrstuvwxyz234567'[++n % 32]}`) =>
    one(`INSERT INTO hw_eval_task (kind, dataset_ref, target_id, subject, required_raters, created_by) VALUES ($1, 'demo@v1', $2, $3, $4, $5) RETURNING id`, [kind, target, subject, required, teacherId])
  const assign = (taskId: string, raterId: string, order = 0) =>
    one(`INSERT INTO hw_eval_assignment (task_id, rater_id, order_index) VALUES ($1, $2, $3) RETURNING id`, [taskId, raterId, order])
  const submit = (assignmentId: string, payload: object = { text: 'x' }) =>
    one(`INSERT INTO hw_eval_submission (assignment_id, payload, time_ms) VALUES ($1, $2, 1000) RETURNING id`, [assignmentId, payload])

  it('a parent, or an institution\'s student, can never be a rater (a bare sign-up may: migration 021); skills must be well formed', async () => {
    await one(`INSERT INTO "user" (id, name, email, role) VALUES ('mig-parent', 'P', 'mig-parent@example.test', 'parent'), ('mig-kid', 'K', 'mig-kid@example.test', 'student'), ('mig-bare', 'B', 'mig-bare@example.test', 'student')`)
    await one(`INSERT INTO organization (id, name, slug, created_at) VALUES ('mig-org', 'mig-org', 'mig-org', now())`)
    await one(`INSERT INTO member (id, organization_id, user_id, role, created_at) VALUES ('mig-m', 'mig-org', 'mig-kid', 'student', now())`)
    await refused(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ('mig_parent', 'mig-parent', '{transcribe}', $1)`, [teacherId], /parent account cannot be a rater/)
    await refused(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ('mig_kid', 'mig-kid', '{transcribe}', $1)`, [teacherId], /student account of an institution cannot be a rater/)
    expect(await one(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ('mig_bare', 'mig-bare', '{transcribe}', $1) RETURNING id`, [teacherId])).toHaveProperty('id')
    await refused(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ('t1', $1, '{grade_everything}', $1)`, [teacherId], /hw_eval_rater_skills_check|check constraint/)
    await refused(`INSERT INTO hw_eval_rater (pseudonym, user_id, skills, created_by) VALUES ('a b', $1, '{}', $1)`, [teacherId], /pseudonym_check|check constraint/)
    expect(await rater(teacherId, 'Rater_01', ['transcribe', 'mark:science'])).toHaveProperty('id')
  })

  it('transcription and blind marking need exactly two raters; subjects where needed', async () => {
    await refused(`INSERT INTO hw_eval_task (kind, dataset_ref, target_id, required_raters, created_by) VALUES ('transcribe', 'demo@v1', 'evitem_${'b'.repeat(20)}', 1, $1)`, [teacherId], /check constraint/)
    await refused(`INSERT INTO hw_eval_task (kind, dataset_ref, target_id, required_raters, created_by) VALUES ('blind_mark', 'demo@v1', 'evitem_${'b'.repeat(20)}', 2, $1)`, [teacherId], /check constraint/)
    await refused(`INSERT INTO hw_eval_task (kind, dataset_ref, target_id, required_raters, created_by) VALUES ('transcribe', 'Demo', 'evitem_${'b'.repeat(20)}', 2, $1)`, [teacherId], /dataset_ref_check|check constraint/)
    await refused(`INSERT INTO hw_eval_task (kind, dataset_ref, target_id, required_raters, created_by) VALUES ('transcribe', 'demo@v1', 'Ravi Kumar', 2, $1)`, [teacherId], /target_id_check|check constraint/)
  })

  it('assignment needs the skill, an active rater, and no more raters than required', async () => {
    const r1 = await rater(teacherId, 'Rater1', ['transcribe'])
    const r2 = await rater(teacher2Id, 'Rater2', ['transcribe', 'mark:science'])
    const r3 = await rater(teacher3Id, 'Rater3', ['transcribe'])
    const t = await task('transcribe', null, 2)
    const bm = await task('blind_mark', 'Science', 2)
    await refused(`INSERT INTO hw_eval_assignment (task_id, rater_id, order_index) VALUES ($1, $2, 0)`, [bm.id, r1.id], /lacks skill mark:science/)
    await assign(bm.id, r2.id)
    await assign(t.id, r1.id)
    await refused(`INSERT INTO hw_eval_assignment (task_id, rater_id, order_index) VALUES ($1, $2, 1)`, [t.id, r1.id], /duplicate key|unique/)
    await assign(t.id, r2.id, 1)
    await refused(`INSERT INTO hw_eval_assignment (task_id, rater_id, order_index) VALUES ($1, $2, 2)`, [t.id, r3.id], /already has 2 raters/)
    await c.query(`UPDATE hw_eval_rater SET active = false WHERE id = $1`, [r3.id])
    const t2 = await task('transcribe', null, 2)
    await refused(`INSERT INTO hw_eval_assignment (task_id, rater_id, order_index) VALUES ($1, $2, 0)`, [t2.id, r3.id], /not active/)
  })

  it('submissions stamp the assignment, cannot be edited, and only one per assignment', async () => {
    const r1 = await rater(teacherId, 'Rater1', ['transcribe'])
    const t = await task('transcribe', null, 2)
    const a = await assign(t.id, r1.id)
    const s = await submit(a.id)
    const row = await one(`SELECT started_at, submitted_at FROM hw_eval_assignment WHERE id = $1`, [a.id])
    expect(row.submitted_at).not.toBeNull()
    expect(row.started_at).not.toBeNull()
    await refused(`UPDATE hw_eval_submission SET payload = '{"text":"changed"}' WHERE id = $1`, [s.id], /append-only/)
    await refused(`INSERT INTO hw_eval_submission (assignment_id, payload, time_ms) VALUES ($1, '{}', 1)`, [a.id], /duplicate key|unique/)
    await refused(`UPDATE hw_eval_assignment SET submitted_at = now() + interval '1 hour' WHERE id = $1`, [a.id], /only started_at and submitted_at may be set, once/)
    await refused(`UPDATE hw_eval_assignment SET rater_id = rater_id, order_index = 9 WHERE id = $1`, [a.id], /only started_at/)
    await refused(`INSERT INTO hw_eval_submission (assignment_id, payload, time_ms) VALUES ($1, '[]', 1)`, [a.id], /check constraint/)
  })

  it('the adjudicator is never one of the raters, needs the skill, and comes after all submissions', async () => {
    const r1 = await rater(teacherId, 'Rater1', ['transcribe', 'adjudicate'])
    const r2 = await rater(teacher2Id, 'Rater2', ['transcribe'])
    const r3 = await rater(teacher3Id, 'Rater3', ['adjudicate'])
    const t = await task('transcribe', null, 2)
    const a1 = await assign(t.id, r1.id)
    const a2 = await assign(t.id, r2.id, 1)
    await submit(a1.id)
    const adj = `INSERT INTO hw_eval_adjudication (task_id, adjudicator_rater_id, payload, reason, time_ms) VALUES ($1, $2, '{"text":"y"}', 'resolved line 2', 500)`
    await refused(adj, [t.id, r3.id], /1 of 2 submissions/)
    await submit(a2.id)
    await refused(adj, [t.id, r1.id], /was one of this task's raters/)
    await refused(adj, [t.id, r2.id], /cannot adjudicate/)
    await c.query(adj, [t.id, r3.id])
    await refused(`UPDATE hw_eval_adjudication SET reason = 'x' WHERE task_id = $1`, [t.id], /append-only/)
  })

  it('consent (015, and 022\'s scope and withdrawal rules): a student needs a parent consent; only the withdrawal may change, once', async () => {
    await refused(`INSERT INTO hw_eval_consent (subject_kind, form_version, language, scope, signed_at, recorded_by) VALUES ('student', 'v1', 'hi', '{source:C,use:evaluation}', '2026-10-01', $1)`, [teacherId], /check constraint/)
    const parent = await one(`INSERT INTO hw_eval_consent (subject_kind, form_version, language, scope, signed_at, recorded_by) VALUES ('parent', 'v1', 'hi', '{source:C,use:evaluation}', '2026-10-01', $1) RETURNING id`, [teacherId])
    const kid = await one(`INSERT INTO hw_eval_consent (subject_kind, form_version, language, scope, signed_at, recorded_by, guardian_consent_id) VALUES ('student', 'v1', 'hi', '{source:C,use:evaluation}', '2026-10-01', $1, $2) RETURNING id`, [teacherId, parent.id])
    await refused(`UPDATE hw_eval_consent SET scope = '{everything}' WHERE id = $1`, [kid.id], /only the withdrawal may be set, once/)
    await refused(`UPDATE hw_eval_consent SET withdrawn_at = now() WHERE id = $1`, [kid.id], /withdrawn_together/) // 022: who and why come with it
    await c.query(`UPDATE hw_eval_consent SET withdrawn_at = now(), withdrawn_by = $2, withdrawn_reason = 'asked to stop' WHERE id = $1`, [kid.id, teacherId])
    await refused(`UPDATE hw_eval_consent SET withdrawn_at = now() + interval '1 day' WHERE id = $1`, [kid.id], /only the withdrawal may be set, once/)
    await refused(`INSERT INTO hw_eval_consent (subject_kind, form_version, language, scope, signed_at, recorded_by) VALUES ('teacher', 'v1', 'en', '{handwriting_eval}', '2026-10-01', $1)`, [teacherId], /scope_known/) // 022: only known sources and uses
    await refused(`INSERT INTO hw_eval_consent (subject_kind, form_version, language, scope, signed_at, recorded_by, evidence_key) VALUES ('teacher', 'v1', 'en', '{source:A,use:report}', '2026-10-01', $1, 'other/form.pdf')`, [teacherId], /check constraint/)
  })

  it('shadow results: only the final-marks comparison may be filled in later', async () => {
    const ans = await one(`SELECT id, organization_id FROM hw_answer LIMIT 1`)
    if (!ans) return console.warn('[hw] no hw_answer rows in hw_itest; shadow test skipped (run the integration suite first)')
    const hash = 'a'.repeat(64)
    const s = await one(`INSERT INTO hw_eval_shadow_result (organization_id, answer_id, kind, candidate_config_hash, predicted_marks, status) VALUES ($1, $2, 'mark', $3, 1.5, 'ok') RETURNING id`, [ans.organization_id, ans.id, hash])
    await c.query(`UPDATE hw_eval_shadow_result SET final_marks = 2, compared_at = now() WHERE id = $1`, [s.id])
    await refused(`UPDATE hw_eval_shadow_result SET predicted_marks = 2 WHERE id = $1`, [s.id], /only final_marks and compared_at/)
    await refused(`INSERT INTO hw_eval_shadow_result (organization_id, answer_id, kind, candidate_config_hash, predicted_transcript, status) VALUES ($1, $2, 'mark', $3, 'x', 'ok')`, [ans.organization_id, ans.id, 'b'.repeat(64)], /check constraint/)
    await refused(`INSERT INTO hw_eval_shadow_result (organization_id, answer_id, kind, candidate_config_hash, status) VALUES ('other-org', $1, 'read', $2, 'ok')`, [ans.id, 'c'.repeat(64)], /foreign key/)
  })
})
