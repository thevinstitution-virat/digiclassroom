/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam packages, phase 2: the super-admin builder against a real Postgres — a package, a mock assembled from bank rows and authored questions,
// a board paper turned into a set, the publish checks, and the database's own refusals coming back as readable errors.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/exams-builder-db     (needs migrations 032-034)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';
import { REVIEW_FORMAT, type VerdictFile, type VerdictIn } from '@/lib/hw/bank/review';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[exams-builder] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032-034.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' });

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let store: typeof import('@/lib/hw/bank/store');
let rstore: typeof import('@/lib/hw/bank/review-store');
let b: typeof import('@/lib/hw/exams/builder');
const packageIds: string[] = [];
const codes: string[] = [];
const userIds: string[] = [];

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
/** What the person sees: the HwError's public message (its .message is the internal one, for the logs). */
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);
const identOf = (code: string) => ({ board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' as const });

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const figPng = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(300), ...be32(200), 8, 2, 0, 0, 0, ...new Array(40).fill(9)]);

/** The fixture paper (Q1-Q4, 10 marks, 1 hour), imported, checked by a person and published; its figures get their pictures unless told not to. */
async function publishedPaper(opts: { pictures?: boolean } = {}): Promise<{ code: string; paperId: string }> {
  const code = `E-${randomUUID().slice(0, 8)}`;
  codes.push(code);
  const bank = cloneBank();
  bank.paper.code = code;
  const r = await store.importDraft(database, expandBank(bank), { actor: 'importer', sourceSha256: sha256(JSON.stringify(bank)) });
  if (opts.pictures !== false) {
    const fig = await import('@/lib/hw/bank/figures');
    for (const f of ['q3-fig1', 'q4-fig1']) await fig.attachFigureImage(database, async () => undefined, identOf(code), f, figPng);
  }
  const rows = (await raw.query(`SELECT q.number, q.alt, q.variant, q.content_hash, q.needs_check FROM hw_bank_question q WHERE q.paper_id = $1`, [r.paperId])).rows;
  const verdicts: VerdictIn[] = rows.map((x) => ({ q: x.number, alt: x.alt, variant: x.variant, content_hash: x.content_hash, verdict: 'ok', confirmed: x.needs_check, note: '' }));
  const f: VerdictFile = { format: REVIEW_FORMAT, paper: identOf(code), reviewer: 'Mrs Rao', verdicts };
  await rstore.applyReview(database, f, { recordedBy: 'op' });
  await rstore.setPublished(database, identOf(code), true, { actor: 'owner' });
  return { code, paperId: r.paperId };
}
async function newPackage() {
  const p = await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `b-${randomUUID().slice(0, 8)}`, title: 'Class 10 2099' });
  packageIds.push(p.id);
  return p.id;
}
const mock = (packageId: string, maxMarks = 10) =>
  b.addSet(database, packageId, { kind: 'mock_full', subject: 'Science', subjectCode: '086', title: 'Mock 1', maxMarks, durationMinutes: 60 });
const authored = (marks: number, over: Partial<import('@/lib/hw/exams/builder').AuthoredInput> = {}) => ({
  marks, qtype: 'short' as const, stem: 'Explain refraction.', schemeText: 'Bending of light (1)',
  parts: [{ label: '', marks, answer_kind: 'text', value_points: [{ id: 'v1', text: 'bending of light', marks, quote: '' }] }], ...over,
});

suite('exam packages, the builder — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    store = await import('@/lib/hw/bank/store');
    rstore = await import('@/lib/hw/bank/review-store');
    b = await import('@/lib/hw/exams/builder');
  });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`); // published content is undeletable by design; the throwaway DB bypasses that
      // replica mode switches off ON DELETE CASCADE too, so every child table is emptied by hand
      if (userIds.length) for (const t of ['hw_exam_report', 'hw_exam_page']) await c.query(`DELETE FROM ${t} WHERE attempt_id IN (SELECT id FROM hw_exam_attempt WHERE user_id = ANY($1))`, [userIds]);
      if (userIds.length) await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
      if (userIds.length) await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
      if (userIds.length) await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_attempt WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
      for (const code of codes) await c.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('turns a published board paper into a set with the paper’s marks and time, and publishes it', async () => {
    const { paperId } = await publishedPaper();
    const p = await newPackage();
    const s = await b.setFromPaper(database, p, paperId);
    const got = await b.getSet(database, s.id);
    expect(got.set).toMatchObject({ kind: 'sqp', maxMarks: 10, durationMinutes: 60, paperId, status: 'draft' });
    expect(got.items.length).toBe(s.items);
    expect(got.items.every((i) => i.bankQuestionId && i.stem)).toBe(true);
    expect(got.attainable).toBe(10);
    expect(got.problems).toEqual([]);
    expect(await b.publishSet(database, s.id)).toEqual({ published: true, problems: [] });
    expect(await b.publishPackage(database, p)).toEqual({ published: true, problems: [] });
    expect((await b.listPackages(database)).find((x) => x.id === p)).toMatchObject({ sets: 1, publishedSets: 1 });
    const pk = await b.getPackage(database, p);
    expect(pk.package.status).toBe('published');
    expect(pk.sets).toEqual([expect.objectContaining({ status: 'published', items: s.items, attainable: 10 })]);
  });

  it('refuses to publish a set whose board question a learner could not see in full (a figure with no picture)', async () => {
    const { paperId } = await publishedPaper({ pictures: false });
    const s = await b.setFromPaper(database, await newPackage(), paperId);
    const r = await b.publishSet(database, s.id);
    expect(r.published).toBe(false);
    expect(r.problems).toEqual(expect.arrayContaining([expect.stringMatching(/^Q3 cannot be set from the board paper: a figure in the question has no picture yet/)]));
    expect((await b.getSet(database, s.id)).problems).toEqual(r.problems);
  });

  it('refuses a paper that is not published', async () => {
    const code = `D-${randomUUID().slice(0, 8)}`;
    codes.push(code);
    const bank = cloneBank();
    bank.paper.code = code;
    const r = await store.importDraft(database, expandBank(bank), { actor: 'importer', sourceSha256: sha256(JSON.stringify(bank)) });
    expect(await publicOf(b.setFromPaper(database, await newPackage(), r.paperId))).toMatch(/Only a published board paper/);
  });

  it('assembles a mock from bank rows and authored questions; publish refuses until the marks add up', async () => {
    const { paperId } = await publishedPaper();
    const p = await newPackage();
    const s = await mock(p, 10);
    const q4 = (await one<{ id: string }>(`SELECT id FROM hw_bank_question WHERE paper_id = $1 AND number = 4 AND variant IS NULL LIMIT 1`, [paperId]))!;
    await b.addBankItem(database, s.id, q4.id, { chapter: 'Light' });                      // Q1, 4 marks
    await b.addAuthoredItem(database, s.id, authored(3, { chapter: 'Light' }));           // Q2, 3 marks
    let r = await b.publishSet(database, s.id);
    expect(r.published).toBe(false);
    expect(r.problems).toEqual(['The questions add up to 7 marks (each internal choice counted once), but the paper is out of 10.']);
    await b.addAuthoredItem(database, s.id, authored(3, { chapter: 'Electricity' }));     // Q3
    const got = await b.getSet(database, s.id);
    expect(got.items.map((i) => [i.number, i.marks, i.chapter])).toEqual([[1, 4, 'Light'], [2, 3, 'Light'], [3, 3, 'Electricity']]);
    r = await b.publishSet(database, s.id);
    expect(r).toEqual({ published: true, problems: [] });
  });

  it('a CBSE 2027 Science mock is checked against the board’s 2026-27 blueprint; a board paper is not', async () => {
    const pk = await b.createPackage(database, 'owner', { board: 'CBSE', classLevel: 10, examYear: 2027, slug: `bp-${randomUUID().slice(0, 8)}`, title: 'Class 10 2027' });
    packageIds.push(pk.id);
    const s = await mock(pk.id, 6);
    const q1 = await b.addAuthoredItem(database, s.id, authored(3, { chapter: 'Periodic Classification of Elements' }));
    await b.addAuthoredItem(database, s.id, authored(3, { chapter: 'Electricity', stem: 'How does an electric generator work?' }));
    let r = await b.publishSet(database, s.id);
    expect(r.published).toBe(false);
    expect(r.problems).toEqual([expect.stringMatching(/^Q1 is on Periodic Classification of Elements, which the 2026-27 curriculum assesses only formatively/)]);
    let got = await b.getSet(database, s.id);
    expect(got.problems).toEqual(r.problems);
    expect(got.blueprint).toMatchObject({ session: '2026-27', chapters: expect.arrayContaining(['Electricity', 'Our Environment']) });
    expect(got.warnings).toEqual(expect.arrayContaining([expect.stringContaining('Q2 mentions "generator"')]));
    expect((await b.getPackage(database, pk.id)).sets[0]!.problems).toEqual(r.problems);

    await b.updateItem(database, q1.id, { chapter: 'Our Environment' });
    got = await b.getSet(database, s.id);
    expect(got.problems).toEqual([]);
    expect(got.warnings).toContain('Unit I (Chemical Substances - Nature and Behaviour) has 0 marks here; the board paper gives it 25.');
    r = await b.publishSet(database, s.id);
    expect(r).toEqual({ published: true, problems: [] });
    expect((await b.getSet(database, s.id)).warnings).toEqual([]); // advice is for drafts only

    // the same package's board paper is the board's own: no blueprint check
    const { paperId } = await publishedPaper();
    const paperSet = await b.setFromPaper(database, pk.id, paperId);
    expect((await b.getSet(database, paperSet.id)).warnings).toEqual([]);
  });

  it('a published set refuses edits with a readable message, never a constraint name', async () => {
    const p = await newPackage();
    const s = await mock(p, 3);
    const it1 = await b.addAuthoredItem(database, s.id, authored(3));
    await b.publishSet(database, s.id);
    expect(await publicOf(b.updateSet(database, s.id, { durationMinutes: 90 }))).toMatch('A published set cannot change its paper, marks, duration or place');
    expect(await publicOf(b.addAuthoredItem(database, s.id, authored(1)))).toMatch('The questions of a published set cannot change');
    expect(await publicOf(b.removeItem(database, it1.id))).toMatch('The questions of a published set cannot change');
    expect(await publicOf(b.deleteSet(database, s.id))).toMatch(/Only a draft set can be deleted/);
    await b.updateSet(database, s.id, { title: 'Mock 1 — corrected' });
    await b.setSetOpen(database, s.id, false);
    expect((await b.getSet(database, s.id)).set.status).toBe('retired');
    expect(await publicOf(b.publishSet(database, s.id))).toMatch(/reopened, not published again/);
    await b.setSetOpen(database, s.id, true);
  });

  it('a package cannot be published without a published set', async () => {
    const p = await newPackage();
    await mock(p);
    expect(await b.publishPackage(database, p)).toEqual({ published: false, problems: ['Publish at least one set first.'] });
  });

  it('a published package keeps its allowance; a duplicate slug is a readable conflict', async () => {
    const p = await newPackage();
    const s = await mock(p, 3);
    await b.addAuthoredItem(database, s.id, authored(3));
    await b.publishSet(database, s.id);
    await b.publishPackage(database, p);
    expect(await publicOf(b.updatePackage(database, p, { attemptsPerSet: 9 }))).toMatch('A published package cannot change its identity or its attempt allowance');
    await b.updatePackage(database, p, { pricePaise: 49900, title: 'Renamed' });
    const slug = (await one<{ slug: string }>(`SELECT slug FROM hw_exam_package WHERE id = $1`, [p]))!.slug;
    expect(await publicOf(b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug, title: 'Again' })))
      .toBe('Creating the package: that already exists (a package with this board, class, exam year and slug).');
  });

  it('refuses an authored question whose value points do not add up, on add and on change', async () => {
    const s = await mock(await newPackage(), 6);
    const bad = authored(3, { parts: [{ label: '', marks: 3, answer_kind: 'text', value_points: [{ id: 'v1', text: 'x', marks: 2, quote: '' }] }] });
    expect(await publicOf(b.addAuthoredItem(database, s.id, bad))).toBe('The answer: the value points add up to 2, but the part is worth 3.');
    const ok = await b.addAuthoredItem(database, s.id, authored(3));
    expect(await publicOf(b.updateItem(database, ok.id, { marks: 4 }))).toBe('The parts add up to 3 marks, but the question is worth 4.');
    await b.updateItem(database, ok.id, { stem: 'Explain refraction of light.' });
  });

  it('reorders items and refuses an order that leaves one out', async () => {
    const s = await mock(await newPackage(), 6);
    const a = await b.addAuthoredItem(database, s.id, authored(1));
    const c = await b.addAuthoredItem(database, s.id, authored(2));
    const d = await b.addAuthoredItem(database, s.id, authored(3));
    await b.reorderItems(database, s.id, [d.id, a.id, c.id]);
    expect((await b.getSet(database, s.id)).items.map((i) => i.id)).toEqual([d.id, a.id, c.id]);
    expect(await publicOf(b.reorderItems(database, s.id, [d.id, a.id]))).toMatch(/exactly once/);
  });

  it('a bank item’s content is the bank’s; its chapter and number are the set’s', async () => {
    const { paperId } = await publishedPaper();
    const s = await mock(await newPackage(), 4);
    const q4 = (await one<{ id: string }>(`SELECT id FROM hw_bank_question WHERE paper_id = $1 AND number = 4 AND variant IS NULL LIMIT 1`, [paperId]))!;
    const it1 = await b.addBankItem(database, s.id, q4.id);
    expect(await publicOf(b.updateItem(database, it1.id, { stem: 'changed' }))).toMatch(/changed in the bank/);
    await b.updateItem(database, it1.id, { chapter: 'Light' });
    expect((await b.getSet(database, s.id)).items[0]).toMatchObject({ chapter: 'Light', number: 1 });
  });

  it('grants a package; granting again updates the same entitlement', async () => {
    const p = await newPackage();
    const u = `eb-${randomUUID().slice(0, 8)}`;
    userIds.push(u);
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
    const g1 = await b.grantEntitlement(database, 'owner', { userId: u, packageId: p });
    const g2 = await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: 7 });
    expect(g2.id).toBe(g1.id);
    expect(await one(`SELECT attempts_per_set, source, status FROM hw_exam_entitlement WHERE id = $1`, [g1.id])).toEqual({ attempts_per_set: 7, source: 'grant', status: 'active' });
  });
});
