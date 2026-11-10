/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages, phase 4: the photo booklet against a real Postgres, with an in-memory page store — when pages may be added, what the server
// checks itself, duplicates, order, removal, handing in, and what happens when the upload window closes. Time is passed in, never waited for.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-pages-db     (needs migrations 032-034)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[exams-pages] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032-034.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true' });

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let P: typeof import('@/lib/hw/exams/pages');
let config: typeof import('@/lib/hw/config');
const packageIds: string[] = [];
const userIds: string[] = [];

const T0 = new Date('2099-04-01T09:00:00Z');
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);

const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const store = {
  put: async (key: string, bytes: Uint8Array, type: string) => { objects.set(key, { bytes, type }); },
  remove: async (key: string) => { objects.delete(key); },
  readUrl: async (key: string) => `test://${key}`,
};
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
/** A PNG the server can size from its header; `seed` makes each one a different file. */
const png = (w = 1240, h = 1754, seed = 1) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(w), ...be32(h), 8, 2, 0, 0, 0, ...new Array(64).fill(seed % 256), seed >> 8]);
const good = { sharpness: 0.9, brightness: 0.7, glare: 0.01, override: false };

async function learner() {
  const u = `ep-${randomUUID().slice(0, 8)}`;
  userIds.push(u);
  await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
  return u;
}
/** A learner with an attempt at a published 60-minute set (20 minutes to upload), started at T0. */
async function attempt() {
  const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `p-${randomUUID().slice(0, 8)}`, title: 'Pages test' })).id;
  packageIds.push(p);
  const s = (await b.addSet(database, p, { kind: 'mock_full', subject: 'Science', subjectCode: '086', title: 'Mock', maxMarks: 1, durationMinutes: 60, graceMinutes: 20 })).id;
  await b.addAuthoredItem(database, s, { marks: 1, qtype: 'mcq', stem: 'A plane mirror image is', options: ['real', 'virtual', 'inverted', 'magnified'], correctOption: 'B' });
  await b.publishSet(database, s);
  await b.publishPackage(database, p);
  const u = await learner();
  await b.grantEntitlement(database, 'owner', { userId: u, packageId: p });
  const { attemptId } = await L.startAttempt(database, u, s, at(0));
  return { u, attemptId };
}

suite('exam packages, the photo booklet — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    config = await import('@/lib/hw/config');
    config._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
    P = await import('@/lib/hw/exams/pages');
  });
  afterEach(() => { process.env.HW_EXAMS_ENABLED = 'true'; config._resetHwConfig(); });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`); // published content is undeletable by design; replica mode also turns off cascades
      if (userIds.length) {
        await c.query(`DELETE FROM hw_exam_page WHERE attempt_id IN (SELECT id FROM hw_exam_attempt WHERE user_id = ANY($1))`, [userIds]);
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

  it('no page while the learner is still writing', async () => {
    const { u, attemptId } = await attempt();
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(), good, at(10)))).toMatch(/after the writing time ends/);
  });

  it('after writing: a page is stored privately under hw-exams/, recorded with its size, and listed in order', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    const r1 = await P.addPage(database, store, u, attemptId, png(1240, 1754, 1), good, at(31));
    const r2 = await P.addPage(database, store, u, attemptId, png(1240, 1754, 2), good, at(32));
    expect([r1.position, r2.position]).toEqual([0, 1]);
    const row = (await one<{ image_key: string; mime_type: string; width_px: number; height_px: number }>(`SELECT image_key, mime_type, width_px, height_px FROM hw_exam_page WHERE id = $1`, [r1.pageId]))!;
    expect(row).toMatchObject({ mime_type: 'image/png', width_px: 1240, height_px: 1754 });
    expect(row.image_key).toBe(`hw-exams/${attemptId}/p${r1.pageId}.png`);
    expect(objects.get(row.image_key)?.type).toBe('image/png');
    const list = await P.bookletPages(database, store, attemptId);
    expect(list.map((p) => p.id)).toEqual([r1.pageId, r2.pageId]);
    expect(list[0]!.url).toBe(`test://${row.image_key}`);
  });

  it('also after the writing time simply runs out, without pressing finish', async () => {
    const { u, attemptId } = await attempt();
    await P.addPage(database, store, u, attemptId, png(), good, at(65));
    expect((await one(`SELECT status FROM hw_exam_attempt WHERE id = $1`, [attemptId]))!.status).toBe('time_up');
  });

  it('the server’s own checks: not a picture, too small, the same photo twice', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    expect(await publicOf(P.addPage(database, store, u, attemptId, new TextEncoder().encode('not a picture at all'), good, at(31)))).toMatch(/not a photo we can use/);
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(800, 600), good, at(31)))).toMatch(/too small to read/);
    await P.addPage(database, store, u, attemptId, png(1240, 1754, 7), good, at(31));
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(1240, 1754, 7), good, at(32)))).toMatch(/already in your booklet/);
  });

  it('a blurred photo is refused unless the learner chooses to use it anyway; the choice is recorded', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    const blurred = { ...good, sharpness: 0.1 };
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(), blurred, at(31)))).toMatch(/blurred/);
    const r = await P.addPage(database, store, u, attemptId, png(), { ...blurred, override: true }, at(31));
    expect(r.warning).toBe('too_blurred');
    expect((await one<{ quality: Record<string, unknown> }>(`SELECT quality FROM hw_exam_page WHERE id = $1`, [r.pageId]))!.quality).toMatchObject({ override: true, verdict: 'too_blurred', sharpness: 0.1 });
    // "too small" is not the learner's to override
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(800, 600, 3), { ...good, override: true }, at(31)))).toMatch(/too small/);
  });

  it('pages are reordered, removed (with their stored photo), and the booklet handed in; then it is closed', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    const ids = [];
    for (const n of [11, 12, 13]) ids.push((await P.addPage(database, store, u, attemptId, png(1240, 1754, n), good, at(31))).pageId);
    await P.reorderPages(database, u, attemptId, [ids[2]!, ids[0]!, ids[1]!], at(32));
    expect((await P.bookletPages(database, store, attemptId)).map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(await publicOf(P.reorderPages(database, u, attemptId, [ids[0]!], at(32)))).toMatch(/every page exactly once/);
    const key = (await one<{ image_key: string }>(`SELECT image_key FROM hw_exam_page WHERE id = $1`, [ids[1]]))!.image_key;
    await P.removePage(database, store, u, attemptId, ids[1]!, at(33));
    expect(objects.has(key)).toBe(false);
    expect(await P.submitBooklet(database, u, attemptId, at(34))).toEqual({ pages: 2 });
    expect(await one(`SELECT status, submitted_at FROM hw_exam_attempt WHERE id = $1`, [attemptId])).toEqual({ status: 'uploaded', submitted_at: at(34) });
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(1240, 1754, 14), good, at(35)))).toMatch(/no longer taking pages/);
    expect(await publicOf(P.removePage(database, store, u, attemptId, ids[0]!, at(35)))).toMatch(/no longer taking pages/);
  });

  it('an empty booklet cannot be handed in', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    expect(await publicOf(P.submitBooklet(database, u, attemptId, at(31)))).toMatch(/at least one page/);
  });

  it('when the upload window closes: with pages it is handed in at the deadline; no more pages are taken', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    await P.addPage(database, store, u, attemptId, png(1240, 1754, 21), good, at(70));
    const v = await L.attemptView(database, u, attemptId, { now: at(81) });
    expect(v.attempt.status).toBe('uploaded');
    expect(await one(`SELECT submitted_at FROM hw_exam_attempt WHERE id = $1`, [attemptId])).toEqual({ submitted_at: at(80) });
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(1240, 1754, 22), good, at(82)))).toMatch(/upload time for this attempt has ended|no longer taking pages/);
  });

  it('nobody else can add to, change or hand in a learner’s booklet', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    const r = await P.addPage(database, store, u, attemptId, png(1240, 1754, 31), good, at(31));
    const stranger = await learner();
    expect(await publicOf(P.addPage(database, store, stranger, attemptId, png(1240, 1754, 32), good, at(31)))).toMatch(/Not found/);
    expect(await publicOf(P.removePage(database, store, stranger, attemptId, r.pageId, at(31)))).toMatch(/Not found/);
    expect(await publicOf(P.submitBooklet(database, stranger, attemptId, at(31)))).toMatch(/Not found/);
  });

  it('is closed while HW_EXAMS_ENABLED is off', async () => {
    const { u, attemptId } = await attempt();
    await L.finishWriting(database, u, attemptId, at(30));
    process.env.HW_EXAMS_ENABLED = 'false';
    config._resetHwConfig();
    expect(await publicOf(P.addPage(database, store, u, attemptId, png(), good, at(31)))).toMatch(/not open yet/);
  });
});
