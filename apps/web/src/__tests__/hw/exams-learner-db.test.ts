/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages, phase 3: the learner's side against a real Postgres — the catalogue, starting a set against the server's clock, the clock settled
// on every read, finishing early, giving up, the allowance, and what of a question a learner may see. Time is passed in, never waited for.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-learner-db     (needs migrations 032-034)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[exams-learner] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032-034.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true' });

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let config: typeof import('@/lib/hw/config');
const packageIds: string[] = [];
const userIds: string[] = [];

const T0 = new Date('2099-03-01T09:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);
const SCHEME = 'SECRET-SCHEME bending of light (2)';

async function learner() {
  const u = `el-${randomUUID().slice(0, 8)}`;
  userIds.push(u);
  await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
  return u;
}

/** A published package (allowance `attempts`) with one published 3-mark, 60-minute set: a written question and a multiple choice. */
async function live(attempts = 5, status: 'published' | 'draft' = 'published') {
  const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `l-${randomUUID().slice(0, 8)}`, title: 'Learner test', attemptsPerSet: attempts })).id;
  packageIds.push(p);
  const s = (await b.addSet(database, p, { kind: 'mock_full', subject: 'Science', subjectCode: '086', title: 'Mock', maxMarks: 3, durationMinutes: 60, graceMinutes: 20 })).id;
  await b.addAuthoredItem(database, s, {
    marks: 2, qtype: 'short', stem: 'Why does a pencil look bent in water?', schemeText: SCHEME, chapter: 'Light',
    parts: [{ label: '', marks: 2, answer_kind: 'text', value_points: [{ id: 'v1', text: 'SECRET-POINT refraction', marks: 2, quote: '' }] }],
  });
  await b.addAuthoredItem(database, s, { marks: 1, qtype: 'mcq', stem: 'A plane mirror image is', options: ['real', 'virtual', 'inverted', 'magnified'], correctOption: 'B' });
  if (status === 'published') { await b.publishSet(database, s); await b.publishPackage(database, p); }
  return { p, s };
}
const grant = (u: string, p: string, over: { attemptsPerSet?: number; expiresAt?: Date } = {}) =>
  b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: over.attemptsPerSet ?? null, expiresAt: over.expiresAt ?? null });

suite('exam packages, the learner — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    config = await import('@/lib/hw/config');
    config._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
  });
  afterEach(() => { process.env.HW_EXAMS_ENABLED = 'true'; config._resetHwConfig(); });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`); // published content is undeletable by design; replica mode also turns off cascades
      if (userIds.length) {
        await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
      }
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('is closed while HW_EXAMS_ENABLED is off', async () => {
    process.env.HW_EXAMS_ENABLED = 'false';
    config._resetHwConfig();
    expect(await publicOf(L.catalogue(database, await learner()))).toMatch(/not open yet/);
  });

  it('the catalogue shows published packages with the learner’s access, never a draft', async () => {
    const pub = await live();
    const draft = await live(5, 'draft');
    const u = await learner();
    await grant(u, pub.p);
    const cat = await L.catalogue(database, u, at(0));
    expect(cat.find((c) => c.id === pub.p)).toMatchObject({ access: 'active', sets: 1, subjects: ['Science'] });
    expect(cat.find((c) => c.id === draft.p)).toBeUndefined();
    expect((await L.packageForLearner(database, u, pub.p, at(0))).sets[0]).toMatchObject({ questions: 2, maxMarks: 3, durationMinutes: 60 });
    const other = await learner();
    expect((await L.catalogue(database, other, at(0))).find((c) => c.id === pub.p)).toMatchObject({ access: 'none' });
  });

  it('starts on the server’s clock: expiry = start + duration, upload deadline = expiry + grace, stored', async () => {
    const { p, s } = await live();
    const u = await learner();
    expect(await publicOf(L.startAttempt(database, u, s, at(0)))).toMatch(/not part of your plan/);
    await grant(u, p);
    const r = await L.startAttempt(database, u, s, at(0));
    expect(r).toMatchObject({ attemptNo: 1, expiresAt: at(60) });
    expect(await one(`SELECT status, started_at, expires_at, upload_deadline_at FROM hw_exam_attempt WHERE id = $1`, [r.attemptId]))
      .toEqual({ status: 'started', started_at: at(0), expires_at: at(60), upload_deadline_at: at(80) });
    const v = await L.attemptView(database, u, r.attemptId, { now: at(15) });
    expect(v).toMatchObject({ remainingMs: 45 * 60_000, uploadRemainingMs: 65 * 60_000, serverNow: at(15) });
    expect(v.attempt.status).toBe('started');
  });

  it('one clock at a time: a second start while one is open is refused', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    await L.startAttempt(database, u, s, at(0));
    expect(await publicOf(L.startAttempt(database, u, s, at(1)))).toMatch(/Finish or give up the test you have open first/);
  });

  it('two starts at the same moment make exactly one attempt', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const rs = await Promise.allSettled([L.startAttempt(database, u, s, at(0)), L.startAttempt(database, u, s, at(0))]);
    expect(rs.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await one(`SELECT count(*)::int n FROM hw_exam_attempt WHERE user_id = $1`, [u])).toEqual({ n: 1 });
  });

  it('the clock is settled when read: time up at the expiry, abandoned once the upload window closes with no page', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const { attemptId } = await L.startAttempt(database, u, s, at(0));
    let v = await L.attemptView(database, u, attemptId, { now: at(61) });
    expect(v.attempt).toMatchObject({ status: 'time_up', endedAt: at(60) });
    expect(v.remainingMs).toBe(0);
    expect(v.uploadRemainingMs).toBe(19 * 60_000);
    v = await L.attemptView(database, u, attemptId, { now: at(81) });
    expect(v.attempt).toMatchObject({ status: 'abandoned', endedAt: at(60), failureReason: 'no_pages_uploaded' });
    // and the learner may start again
    expect((await L.startAttempt(database, u, s, at(82))).attemptNo).toBe(2);
  });

  it('an attempt with an accepted page is not abandoned when the upload window closes: it is handed in at the deadline', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const { attemptId } = await L.startAttempt(database, u, s, at(0));
    await L.finishWriting(database, u, attemptId, at(30));
    await raw.query(`INSERT INTO hw_exam_page (attempt_id, position, image_key, mime_type, width_px, height_px, bytes, sha256) VALUES ($1, 0, 'hw-exams/t.jpg', 'image/jpeg', 1200, 1600, 1000, $2)`, [attemptId, 'c'.repeat(64)]);
    const v = await L.attemptView(database, u, attemptId, { now: at(500) });
    expect(v.attempt).toMatchObject({ status: 'uploaded', pages: 1 });
    expect(await one(`SELECT submitted_at FROM hw_exam_attempt WHERE id = $1`, [attemptId])).toEqual({ submitted_at: at(80) });
    await raw.query(`DELETE FROM hw_exam_page WHERE attempt_id = $1`, [attemptId]);
  });

  it('finishing early stops the clock now; the upload deadline stays where it was set', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const { attemptId } = await L.startAttempt(database, u, s, at(0));
    await L.finishWriting(database, u, attemptId, at(40));
    expect(await one(`SELECT status, ended_at, upload_deadline_at FROM hw_exam_attempt WHERE id = $1`, [attemptId]))
      .toEqual({ status: 'time_up', ended_at: at(40), upload_deadline_at: at(80) });
    expect(await publicOf(L.finishWriting(database, u, attemptId, at(41)))).toMatch(/no longer being written/);
  });

  it('giving up counts as an attempt; the allowance then runs out', async () => {
    const { p, s } = await live(2);
    const u = await learner();
    await grant(u, p);
    for (const m of [0, 10]) {
      const { attemptId } = await L.startAttempt(database, u, s, at(m));
      await L.abandonAttempt(database, u, attemptId, at(m + 1));
    }
    expect(await publicOf(L.startAttempt(database, u, s, at(20)))).toMatch(/used all your attempts/);
    const pk = await L.packageForLearner(database, u, p, at(20));
    expect(pk.sets[0]).toMatchObject({ used: 2, allowed: 2, canStart: { ok: false, why: 'attempts_exhausted' } });
    expect(pk.sets[0]!.attempts.map((a) => a.status)).toEqual(['abandoned', 'abandoned']);
  });

  it('an entitlement’s own allowance and end date are honoured', async () => {
    const { p, s } = await live(1);
    const u = await learner();
    await grant(u, p, { attemptsPerSet: 2, expiresAt: at(30) });
    const a1 = await L.startAttempt(database, u, s, at(0));
    await L.abandonAttempt(database, u, a1.attemptId, at(1));
    expect((await L.packageForLearner(database, u, p, at(2))).sets[0]).toMatchObject({ allowed: 2, canStart: { ok: true, attemptNo: 2 } });
    expect(await publicOf(L.startAttempt(database, u, s, at(31)))).toMatch(/access to this package has ended/);
  });

  it('the paper shows the questions and never the marking scheme, value points or the right option', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const { attemptId } = await L.startAttempt(database, u, s, at(0));
    const v = await L.attemptView(database, u, attemptId, { now: at(1) });
    expect(v.paper.map((q) => [q.number, q.marks, q.qtype])).toEqual([[1, 2, 'short'], [2, 1, 'mcq']]);
    expect(v.paper[1]!.options).toEqual([{ letter: 'A', text: 'real' }, { letter: 'B', text: 'virtual' }, { letter: 'C', text: 'inverted' }, { letter: 'D', text: 'magnified' }]);
    const json = JSON.stringify(v);
    expect(json).not.toMatch(/SECRET-SCHEME|SECRET-POINT|value_points|correctOption|scheme/i);
  });

  it('someone else’s attempt is not there', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const { attemptId } = await L.startAttempt(database, u, s, at(0));
    const stranger = await learner();
    expect(await publicOf(L.attemptView(database, stranger, attemptId, { now: at(1) }))).toMatch(/Not found/);
    expect(await publicOf(L.abandonAttempt(database, stranger, attemptId, at(1)))).toMatch(/Not found/);
    expect((await one(`SELECT status FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!.status).toBe('started');
  });

  it('the answer sheet: numbers and boxes only, for learners with access; any set for the super admin', async () => {
    const { p, s } = await live();
    const u = await learner();
    expect(await publicOf(L.sheetForLearner(database, u, s))).toMatch(/not part of your plan/);
    await grant(u, p);
    const sh = await L.sheetForLearner(database, u, s);
    expect(sh.layout.code).toBe(s.replace(/-/g, '').slice(0, 6).toUpperCase());
    expect(sh.layout.pages[0]!.numbers).toEqual([1, 2]);
    expect(JSON.stringify(sh)).not.toMatch(/pencil|plane mirror|SECRET/);
    const draft = await live(5, 'draft');
    await grant(u, draft.p);
    expect(await publicOf(L.sheetForLearner(database, u, draft.s))).toMatch(/Not found/);
    expect((await L.sheetFor(database, draft.s)).layout.totalPages).toBeGreaterThan(0);
  });

  it('a retired test stays visible to those who sat it, and cannot be started again', async () => {
    const { p, s } = await live();
    const u = await learner();
    await grant(u, p);
    const { attemptId } = await L.startAttempt(database, u, s, at(0));
    await L.abandonAttempt(database, u, attemptId, at(1));
    await b.setSetOpen(database, s, false);
    const mine = await L.packageForLearner(database, u, p, at(2));
    expect(mine.sets[0]).toMatchObject({ id: s, used: 1, canStart: { ok: false, why: 'set_not_published' } });
    const other = await learner();
    await grant(other, p);
    expect((await L.packageForLearner(database, other, p, at(2))).sets).toEqual([]);
  });
});
