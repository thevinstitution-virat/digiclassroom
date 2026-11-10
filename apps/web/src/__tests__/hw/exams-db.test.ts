/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages, phase 1 (migration 034) against a real Postgres: the guards live in the database, so they are tested there, not only in rules.ts.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-db     (needs migrations 032, 033 and 034)
// Everything here is raw SQL on purpose: phase 1 has no store yet, and these are the rules no code path may skip.

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[exams-db] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032-034.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' });

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let store: typeof import('@/lib/hw/bank/store');
const userIds: string[] = [];
const packageIds: string[] = [];
const codes: string[] = [];

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
const refused = (p: Promise<unknown>, msg: RegExp) => expect(p).rejects.toThrow(msg);

const learner = async () => {
  const id = `ex-${randomUUID().slice(0, 8)}`;
  userIds.push(id);
  await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'Learner', $2, 'student')`, [id, `${id}@example.test`]);
  return id;
};

async function pkg(over: { attempts?: number } = {}) {
  const r = await one<{ id: string }>(
    `INSERT INTO hw_exam_package (board, class_level, exam_year, slug, title, attempts_per_set, created_by)
     VALUES ('TESTBOARD', 10, 2099, $1, 'Test package', $2, 'owner') RETURNING id`,
    [`t-${randomUUID().slice(0, 8)}`, over.attempts ?? 5]);
  packageIds.push(r!.id);
  return r!.id;
}
async function set(packageId: string, position = 0) {
  const r = await one<{ id: string }>(
    `INSERT INTO hw_exam_set (package_id, position, kind, subject, subject_code, title, max_marks, duration_minutes)
     VALUES ($1, $2, 'mock_full', 'Science', '086', 'Mock 1', 80, 180) RETURNING id`, [packageId, position]);
  return r!.id;
}
const authored = (setId: string, position: number) => raw.query(
  `INSERT INTO hw_exam_set_item (set_id, position, number, marks, qtype, stem, parts, scheme_text)
   VALUES ($1, $2, $3, 2, 'short', 'Why is the sky blue?', '[{"label":"a"}]', 'Scattering of light (1); shorter wavelengths scatter more (1)')`,
  [setId, position, position + 1]);
const publishSet = (id: string) => raw.query(`UPDATE hw_exam_set SET status = 'published' WHERE id = $1`, [id]);
const publishPkg = (id: string) => raw.query(`UPDATE hw_exam_package SET status = 'published', published_at = now() WHERE id = $1`, [id]);
const entitle = (userId: string, packageId: string, attempts: number | null = null) => raw.query(
  `INSERT INTO hw_exam_entitlement (user_id, package_id, source, granted_by, attempts_per_set) VALUES ($1, $2, 'grant', 'owner', $3)`,
  [userId, packageId, attempts]);
const attempt = (userId: string, setId: string, n: number) => one<{ id: string }>(
  `INSERT INTO hw_exam_attempt (user_id, set_id, attempt_no, expires_at, upload_deadline_at, max_marks)
   VALUES ($1, $2, $3, now() + interval '3 hours', now() + interval '200 minutes', 80) RETURNING id`, [userId, setId, n]);

/** A published package with one published set of two authored questions. */
async function live(attempts = 5) {
  const p = await pkg({ attempts });
  const s = await set(p);
  await authored(s, 0);
  await authored(s, 1);
  await publishSet(s);
  await publishPkg(p);
  return { p, s };
}

suite('exam packages, migration 034 — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    store = await import('@/lib/hw/bank/store');
  });
  afterAll(async () => {
    // Published content is deliberately undeletable; the throwaway database lets the test bypass its own guards to clean up.
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`);
      // replica mode switches off ON DELETE CASCADE too, so every child table is emptied by hand
      if (userIds.length) for (const t of ['hw_exam_report', 'hw_exam_page']) await c.query(`DELETE FROM ${t} WHERE attempt_id IN (SELECT id FROM hw_exam_attempt WHERE user_id = ANY($1))`, [userIds]);
      if (userIds.length) await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
      if (userIds.length) await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
      if (userIds.length) await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
      for (const code of codes) await c.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  describe('the attempt allowance', () => {
    it('allows the package allowance and refuses one more', async () => {
      const { p, s } = await live(5);
      const u = await learner();
      await entitle(u, p);
      for (let n = 1; n <= 5; n++) await attempt(u, s, n);
      await refused(attempt(u, s, 6), /past the allowance of 5/);
    });

    it("an entitlement's own allowance overrides the package's", async () => {
      const { p, s } = await live(2);
      const u = await learner();
      await entitle(u, p, 3);
      await attempt(u, s, 3);
      await refused(attempt(u, s, 4), /past the allowance of 3/);
    });

    it('the same attempt number cannot be taken twice', async () => {
      const { p, s } = await live();
      const u = await learner();
      await entitle(u, p);
      await attempt(u, s, 1);
      await refused(attempt(u, s, 1), /hw_exam_attempt_no/);
    });

    it('no attempt can start on a draft set or a draft package', async () => {
      const p = await pkg();
      const s = await set(p);
      await authored(s, 0);
      const u = await learner();
      await entitle(u, p);
      await refused(attempt(u, s, 1), /not published/);
      await publishSet(s);
      await refused(attempt(u, s, 1), /not published/);
      await publishPkg(p);
      await attempt(u, s, 1);
    });
  });

  describe('the clock', () => {
    it('cannot be rewritten once the attempt exists; the status can move', async () => {
      const { p, s } = await live();
      const u = await learner();
      await entitle(u, p);
      const a = (await attempt(u, s, 1))!;
      await refused(raw.query(`UPDATE hw_exam_attempt SET expires_at = expires_at + interval '1 hour' WHERE id = $1`, [a.id]), /clock cannot be changed/);
      await refused(raw.query(`UPDATE hw_exam_attempt SET upload_deadline_at = upload_deadline_at + interval '1 minute' WHERE id = $1`, [a.id]), /clock cannot be changed/);
      await refused(raw.query(`UPDATE hw_exam_attempt SET started_at = started_at - interval '1 minute' WHERE id = $1`, [a.id]), /clock cannot be changed/);
      await refused(raw.query(`UPDATE hw_exam_attempt SET attempt_no = 2 WHERE id = $1`, [a.id]), /cannot move/);
      await raw.query(`UPDATE hw_exam_attempt SET status = 'time_up', ended_at = now() WHERE id = $1`, [a.id]);
      expect(await one(`SELECT status FROM hw_exam_attempt WHERE id = $1`, [a.id])).toEqual({ status: 'time_up' });
    });

    it('an upload deadline before the expiry is refused at insert', async () => {
      const { p, s } = await live();
      const u = await learner();
      await entitle(u, p);
      await refused(raw.query(
        `INSERT INTO hw_exam_attempt (user_id, set_id, attempt_no, expires_at, upload_deadline_at, max_marks)
         VALUES ($1, $2, 1, now() + interval '3 hours', now() + interval '1 hour', 80)`, [u, s]), /hw_exam_attempt_clock/);
    });
  });

  describe('published content is frozen', () => {
    it('a published set keeps its marks, duration and questions', async () => {
      const { s } = await live();
      await refused(raw.query(`UPDATE hw_exam_set SET duration_minutes = 200 WHERE id = $1`, [s]), /published set cannot change/);
      await refused(raw.query(`UPDATE hw_exam_set SET max_marks = 70 WHERE id = $1`, [s]), /published set cannot change/);
      await refused(authored(s, 2), /questions of a published set cannot change/);
      await refused(raw.query(`DELETE FROM hw_exam_set_item WHERE set_id = $1`, [s]), /questions of a published set cannot change/);
      await refused(raw.query(`UPDATE hw_exam_set_item SET marks = 3 WHERE set_id = $1`, [s]), /questions of a published set cannot change/);
      // the title may still be corrected
      await raw.query(`UPDATE hw_exam_set SET title = 'Mock 1 (corrected)' WHERE id = $1`, [s]);
    });

    it('a published set or package cannot go back to draft (which would unfreeze it)', async () => {
      const { p, s } = await live();
      await refused(raw.query(`UPDATE hw_exam_set SET status = 'draft' WHERE id = $1`, [s]), /back to draft/);
      await refused(raw.query(`UPDATE hw_exam_package SET status = 'draft', published_at = NULL WHERE id = $1`, [p]), /back to draft/);
      // retiring, and bringing back, are allowed
      await raw.query(`UPDATE hw_exam_set SET status = 'retired' WHERE id = $1`, [s]);
      await raw.query(`UPDATE hw_exam_set SET status = 'published' WHERE id = $1`, [s]);
      await raw.query(`UPDATE hw_exam_package SET status = 'retired' WHERE id = $1`, [p]);
    });

    it('a published package keeps its identity and allowance', async () => {
      const { p } = await live();
      await refused(raw.query(`UPDATE hw_exam_package SET attempts_per_set = 9 WHERE id = $1`, [p]), /published package cannot change/);
      await refused(raw.query(`UPDATE hw_exam_package SET exam_year = 2098 WHERE id = $1`, [p]), /published package cannot change/);
      await raw.query(`UPDATE hw_exam_package SET price_paise = 49900 WHERE id = $1`, [p]);
    });

    it("a set with learners' attempts cannot be deleted, so their history cannot vanish", async () => {
      const { p, s } = await live();
      const u = await learner();
      await entitle(u, p);
      await attempt(u, s, 1);
      await refused(raw.query(`DELETE FROM hw_exam_set WHERE id = $1`, [s]), /violates foreign key|questions of a published set/);
      expect(await one(`SELECT count(*)::int n FROM hw_exam_attempt WHERE set_id = $1`, [s])).toEqual({ n: 1 });
    });

    it('a draft package is deleted with its sets and items', async () => {
      const p = await pkg();
      const s = await set(p);
      await authored(s, 0);
      await raw.query(`DELETE FROM hw_exam_package WHERE id = $1`, [p]);
      expect(await one(`SELECT count(*)::int n FROM hw_exam_set_item WHERE set_id = $1`, [s])).toEqual({ n: 0 });
    });
  });

  describe('items', () => {
    it('only a checked bank question can go in a set; a draft one is refused', async () => {
      const code = `X-${randomUUID().slice(0, 8)}`;
      codes.push(code);
      const b = cloneBank();
      b.paper.code = code;
      await store.importDraft(database, expandBank(b), { actor: 'importer', sourceSha256: sha256(JSON.stringify(b)) });
      const q = (await one<{ id: string }>(`SELECT q.id FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 LIMIT 1`, [code]))!;
      const s = await set(await pkg());
      await refused(raw.query(`INSERT INTO hw_exam_set_item (set_id, position, number, marks, qtype, bank_question_id) VALUES ($1, 0, 1, 1, 'mcq', $2)`, [s, q.id]),
        /is draft; only a checked or published question/);
    });

    it('an item is a bank question or an authored one, never both and never neither', async () => {
      const s = await set(await pkg());
      await refused(raw.query(`INSERT INTO hw_exam_set_item (set_id, position, number, marks, qtype) VALUES ($1, 0, 1, 1, 'short')`, [s]), /hw_exam_set_item_(source|authored_shape)/);
      await refused(raw.query(`INSERT INTO hw_exam_set_item (set_id, position, number, marks, qtype, stem) VALUES ($1, 0, 1, 1, 'short', 'x')`, [s]), /hw_exam_set_item_authored_shape/);
      await refused(raw.query(`INSERT INTO hw_exam_set_item (set_id, position, number, marks, qtype, stem, options, correct_option) VALUES ($1, 0, 1, 1, 'mcq', 'x', '["a","b","c"]', 'A')`, [s]),
        /hw_exam_set_item_authored_shape/);
      await refused(raw.query(`INSERT INTO hw_exam_set_item (set_id, position, number, marks, qtype, stem, parts, scheme_text) VALUES ($1, 0, 1, 1.3, 'short', 'x', '[{}]', 'y')`, [s]), /check constraint/);
    });

    it('a board set must name its paper; a mock must not', async () => {
      const p = await pkg();
      await refused(raw.query(`INSERT INTO hw_exam_set (package_id, position, kind, subject, subject_code, title, max_marks, duration_minutes) VALUES ($1, 0, 'pyq', 'Science', '086', 'PYQ', 80, 180)`, [p]),
        /hw_exam_set_paper_shape/);
      await refused(raw.query(`INSERT INTO hw_exam_set (package_id, position, kind, subject, subject_code, title, max_marks, duration_minutes) VALUES ($1, 0, 'mock_half', 'Science', '086', 'Half', 40, 90)`, [p]),
        /hw_exam_set_scope/);
    });
  });

  describe('pages and reports', () => {
    it('a rejected page says why; a page lives under hw-exams/ and cannot be uploaded twice', async () => {
      const { p, s } = await live();
      const u = await learner();
      await entitle(u, p);
      const a = (await attempt(u, s, 1))!;
      const page = (pos: number, sha: string, status = 'accepted', reason: string | null = null, key = 'hw-exams/x.jpg') => raw.query(
        `INSERT INTO hw_exam_page (attempt_id, position, image_key, mime_type, width_px, height_px, bytes, sha256, status, reject_reason)
         VALUES ($1, $2, $3, 'image/jpeg', 1200, 1600, 300000, $4, $5, $6)`, [a.id, pos, key, sha.repeat(64), status, reason]);
      await page(0, 'a');
      await refused(page(1, 'a'), /hw_exam_page_once/);
      await refused(page(1, 'b', 'rejected'), /hw_exam_page_reject/);
      await refused(page(1, 'b', 'accepted', null, 'hw-bank/x.jpg'), /check constraint/);
      await page(1, 'b', 'rejected', 'too_blurred');
    });

    it('a report is written once and never edited', async () => {
      const { p, s } = await live();
      const u = await learner();
      await entitle(u, p);
      const a = (await attempt(u, s, 1))!;
      const r = (await one<{ id: string }>(
        `INSERT INTO hw_exam_report (attempt_id, marks_awarded, max_marks, per_question, reader_model, grader_model, prompt_version)
         VALUES ($1, 61.5, 80, '[]', 'r', 'g', 'v1') RETURNING id`, [a.id]))!;
      await refused(raw.query(`UPDATE hw_exam_report SET marks_awarded = 70 WHERE id = $1`, [r.id]), /append-only/);
      await refused(raw.query(
        `INSERT INTO hw_exam_report (attempt_id, marks_awarded, max_marks, per_question, reader_model, grader_model, prompt_version)
         VALUES ($1, 70, 80, '[]', 'r', 'g', 'v2')`, [a.id]), /hw_exam_report_one/);
    });
  });
});
