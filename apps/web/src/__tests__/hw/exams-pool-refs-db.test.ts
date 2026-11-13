/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// Exam questions carry their textbook reference, printed sources, choice group, pictures and the teacher's key check (migration 037;
// docs/hw-eval/board-bank-roadmap.md, phase 2): the pool importer (exam-pool/2), the draw, the builder and the learner's paper.

import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { drawPractice, type PoolItem } from '@/lib/hw/exams/practice';
import { examFigureKey } from '@/lib/hw/storage/keys';
import { aiCheckLine, authoredOf, autoCheckedBy, check, withAiCheck, type Pool as PoolFile } from '../../../../../scripts/hw-exam-pool-import';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '', HW_EXAMS_ENABLED: 'true' });

/** The smallest bytes the picture check accepts as a PNG of w x h (only the header is read). */
function png(w: number, h: number, salt = 0): Uint8Array {
  const b = new Uint8Array(40);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h);
  b[39] = salt;
  return b;
}

// ── the draw never takes two alternatives of one internal choice ─────────────

describe('drawPractice with internal choices', () => {
  const it2 = (id: string, topic: string, choiceGroup: string | null, position: number): PoolItem => ({ id, qtype: 'short', marks: 3, topic, chapter: 'Ch', position, choiceGroup });
  it('takes at most one alternative of a group, and fewer questions when only alternatives are left', () => {
    const pool = [it2('q1A', 'T', 'g1', 0), it2('q1B', 'T', 'g1', 1), it2('q2', 'T', null, 2)];
    for (let seed = 0; seed < 6; seed++) {
      const got = drawPractice(pool, { topics: [], types: [], count: 3 }, (n) => (seed + n) % n);
      expect(got.filter((g) => g.choiceGroup === 'g1')).toHaveLength(1);
      expect(got).toHaveLength(2);
    }
  });
  it('alternatives in different topics are still never both drawn', () => {
    const pool = [it2('a', 'T1', 'g', 0), it2('b', 'T2', 'g', 1)];
    expect(drawPractice(pool, { topics: [], types: [], count: 2 }, () => 0)).toHaveLength(1);
  });
});

// ── the pool file (exam-pool/2) ───────────────────────────────────────────────

const base = mkdtempSync(join(tmpdir(), 'pool-'));
mkdirSync(join(base, 'figures'));
writeFileSync(join(base, 'figures', 'q6.png'), png(300, 200));
writeFileSync(join(base, 'figures', 'tiny.png'), png(10, 10));

const poolFile = (items: PoolFile['items']): PoolFile => ({
  format: 'exam-pool/2', title: 'Chapter 13: Our Environment — test', board: 'TESTBOARD', classLevel: 10, subject: 'Science', subjectCode: '086',
  chapter: 'Our Environment', chapterNo: 13, book: 'NCERT Science Class X', topics: ['13.1.1 Food Chains and Webs'],
  ar_options: ['A', 'B', 'C', 'D'], items,
});
const mcq = (id: string, extra: Partial<PoolFile['items'][number]> = {}): PoolFile['items'][number] => ({
  id, qtype: 'mcq', marks: 1, topic: '13.1.1 Food Chains and Webs', sources: ['31/2/1 Q6', '31/2/2 Q7'], key: 'assistant', needsCheck: true,
  stem: 'In the given figure, which level has most of the harmful chemicals?', options: ['T1', 'T5', 'T4', 'T3'], correctOption: 'B',
  asked: 2, ncert: { section: '13.1.1', title: 'Food Chains and Webs', pages: '210-211' }, ...extra,
});
const writtenItem = (id: string, parts: { label: string; marks: number; drawing?: boolean; points: [string, number][] }[]): PoolFile['items'][number] => ({
  id, qtype: 'short', marks: parts.reduce((s, p) => s + p.marks, 0), topic: '13.1.1 Food Chains and Webs', sources: ['31/3/1 Q14A'], key: 'assistant', needsCheck: true,
  stem: 'Explain.', parts, choiceGroup: '31/3/1 Q14',
});

describe('pool importer (exam-pool/2)', () => {
  it('reads a picture, names it by its content, and keeps the question', () => {
    const r = check(poolFile([mcq('a', { figures: [{ image: 'figures/q6.png', description: 'Five stacked bars T1-T5', labels: ['T1', 'T5'] }] })]), base);
    expect(r.problems).toEqual([]);
    expect(r.leftOut).toEqual([]);
    const [f] = r.pictures.get('a')!;
    expect(f).toMatchObject({ mime: 'image/png', description: 'Five stacked bars T1-T5', labels: ['T1', 'T5'] });
    expect(f!.key).toMatch(/^hw-exams\/figures\/[0-9a-f]{64}\.png$/);
  });
  it('leaves out a question whose picture is missing, unusable or outside the folder, and one that is only a drawing', () => {
    const r = check(poolFile([
      mcq('missing', { figures: [{ image: 'figures/nope.png', description: 'x', labels: [] }] }),
      mcq('small', { figures: [{ image: 'figures/tiny.png', description: 'x', labels: [] }] }),
      mcq('escape', { figures: [{ image: '../../etc/passwd', description: 'x', labels: [] }] }),
      mcq('nopic', { figures: [{ image: null, description: 'x', labels: [] }] }),
      writtenItem('draw', [{ label: 'a', marks: 2, drawing: true, points: [['labels', 2]] }]),
    ]), base);
    expect(r.problems).toEqual([]);
    expect(Object.fromEntries(r.leftOut.map((l) => [l.id, l.why.join(' ')]))).toEqual({
      missing: expect.stringMatching(/missing/), small: expect.stringMatching(/at least 40 pixels/), escape: expect.stringMatching(/leaves the figures folder/),
      nopic: expect.stringMatching(/no picture/), draw: expect.stringMatching(/drawing/),
    });
  });
  it('a drawing part is shown but not AI-marked; the scheme text names the chapter and where it is taught', () => {
    const q = writtenItem('w', [{ label: 'a', marks: 1, points: [['point', 1]] }, { label: 'b', marks: 2, drawing: true, points: [['labels', 1], ['diagram', 1]] }]);
    const a = authoredOf(poolFile([q]), { ...q, ncert: { section: '13.1.1', title: 'Food Chains and Webs', pages: '210-211' } });
    expect(a.parts!.map((p) => p.answer_kind)).toEqual(['text', 'diagram']);
    expect(a.diagramParts).toEqual(['b']);
    expect(a.schemeText).toMatch(/^KEY TO CHECK: written by the assistant from NCERT Class X Science, chapter 13 \(Our Environment\)/);
    expect(a.schemeText).toContain('Taught in: NCERT 13.1.1 Food Chains and Webs, pages 210-211');
    expect(a).toMatchObject({ choiceGroup: '31/3/1 Q14', sources: ['31/3/1 Q14A'], ncert: { chapterNo: 13, section: '13.1.1', pages: '210-211' } });
  });
  it('refuses a key whose points do not add up', () => {
    const r = check(poolFile([writtenItem('bad', [{ label: 'a', marks: 2, points: [['one', 1]] }])]), base);
    expect(r.problems.join(' ')).toMatch(/bad: .*add up to 1/);
  });
});

describe('the AI check of an assistant key', () => {
  const auto = (status: 'approved' | 'disputed' | 'needs_person', why = 'Luna agrees (B): "the book line"') => ({ model: 'gpt-6-luna', at: '2026-11-14', status, why });
  it('goes in as the second line, so the key still says KEY TO CHECK first', () => {
    const a = authoredOf(poolFile([mcq('a')]), mcq('a', { autoCheck: auto('approved') }));
    const lines = a.schemeText!.split('\n');
    expect(lines[0]).toMatch(/^KEY TO CHECK/);
    expect(lines[1]).toBe('AI check (gpt-6-luna, 2026-11-14): confirmed from the textbook. Luna agrees (B): "the book line"');
  });
  it('only a confirmed key is stamped auto-checked; a disputed or unsure one waits for a teacher', () => {
    expect(autoCheckedBy(mcq('a', { autoCheck: auto('approved') }))).toBe('Auto-check: gpt-6-luna (2026-11-14)');
    expect(autoCheckedBy(mcq('a', { autoCheck: auto('disputed') }))).toBeNull();
    expect(autoCheckedBy(mcq('a', { autoCheck: auto('needs_person') }))).toBeNull();
    expect(autoCheckedBy(mcq('a'))).toBeNull();
    expect(aiCheckLine(mcq('a', { key: 'official', official: 'x', autoCheck: auto('approved') }))).toBeNull();
  });
  it('a new verdict replaces the old line instead of adding another', () => {
    const first = withAiCheck('KEY TO CHECK: x\nSource: y\nkey', aiCheckLine(mcq('a', { autoCheck: auto('needs_person', 'not confirmed for point 2') })));
    const again = withAiCheck(first, aiCheckLine(mcq('a', { autoCheck: auto('disputed', 'point 2: wrong equation') })));
    expect(again).toBe('KEY TO CHECK: x\nAI check (gpt-6-luna, 2026-11-14): DISPUTED. point 2: wrong equation\nSource: y\nkey');
    expect(withAiCheck(again, null)).toBe('KEY TO CHECK: x\nSource: y\nkey');
  });
});

// ── the database side ────────────────────────────────────────────────────────

let raw: Pool;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let b: typeof import('@/lib/hw/exams/builder');
let L: typeof import('@/lib/hw/exams/learner');
let P: typeof import('@/lib/hw/exams/practice');
const packageIds: string[] = [];
const userIds: string[] = [];
const publicOf = (p: Promise<unknown>) => p.then(() => 'resolved', (e: { publicMessage?: string; message: string }) => e.publicMessage ?? e.message);
const T0 = new Date('2099-03-01T09:00:00Z');
const FIG = examFigureKey('a'.repeat(64), 'png');
const sign = async (key: string) => `signed:${key}`;

const toCheck = (topic: string, choiceGroup: string | null = null) => ({
  marks: 3, qtype: 'short' as const, stem: `Explain (${topic}).`, chapter: 'Our Environment', topic, choiceGroup,
  schemeText: 'KEY TO CHECK: written by the assistant from NCERT Class X Science, chapter 13; a teacher must confirm it\nkey',
  parts: [{ label: '', marks: 3, answer_kind: 'text', value_points: [{ id: 'v1', text: 'the point', marks: 3, quote: '' }] }],
  ncert: { section: '13.1.1', title: 'Food Chains and Webs', pages: '210-211' }, sources: ['31/2/1 Q13'],
});
const official = { ...toCheck('Official'), schemeText: 'CBSE marking scheme: 31/4/1 Q11\nkey', choiceGroup: null };

suite('exam questions with references, pictures and key checks (037) — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    (await import('@/lib/hw/config'))._resetHwConfig();
    b = await import('@/lib/hw/exams/builder');
    L = await import('@/lib/hw/exams/learner');
    P = await import('@/lib/hw/exams/practice');
  });
  afterAll(async () => {
    const c = await raw.connect();
    try {
      await c.query(`SET session_replication_role = replica`);
      if (userIds.length) {
        await c.query(`DELETE FROM hw_exam_attempt WHERE user_id = ANY($1)`, [userIds]);
        await c.query(`DELETE FROM hw_exam_entitlement WHERE user_id = ANY($1)`, [userIds]);
      }
      if (packageIds.length) {
        await c.query(`DELETE FROM hw_exam_attempt WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set_item WHERE set_id IN (SELECT id FROM hw_exam_set WHERE package_id = ANY($1))`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_set WHERE package_id = ANY($1)`, [packageIds]);
        await c.query(`DELETE FROM hw_exam_package WHERE id = ANY($1)`, [packageIds]);
      }
      if (userIds.length) await c.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
    } finally { c.release(); }
    await raw?.end();
    await dbMod?.getPool().end();
  });

  async function draftPool() {
    const p = (await b.createPackage(database, 'owner', { board: 'TESTBOARD', classLevel: 10, examYear: 2099, slug: `r-${randomUUID().slice(0, 8)}`, title: 'Chapter practice' })).id;
    packageIds.push(p);
    const pool = (await b.addSet(database, p, { kind: 'pool', subject: 'Science', subjectCode: '086', title: 'Ch13 pool', maxMarks: 12, durationMinutes: 60, syllabusScope: ['Our Environment'] })).id;
    return { p, pool };
  }

  it('stores where a question is taught and printed, its choice group and its pictures; refuses a picture outside hw-exams/figures/', async () => {
    const { pool } = await draftPool();
    const { id } = await b.addAuthoredItem(database, pool, { ...toCheck('Food chains', 'g1'), figures: [{ key: FIG, description: 'bars', labels: ['T1'] }] });
    const row = (await raw.query(`SELECT ncert, sources, choice_group, figures, key_checked_by FROM hw_exam_set_item WHERE id = $1`, [id])).rows[0];
    expect(row).toEqual({ ncert: { section: '13.1.1', title: 'Food Chains and Webs', pages: '210-211' }, sources: ['31/2/1 Q13'], choice_group: 'g1', figures: [{ key: FIG, description: 'bars', labels: ['T1'] }], key_checked_by: null });
    // in code
    expect(await publicOf(b.addAuthoredItem(database, pool, { ...toCheck('x'), figures: [{ key: 'https://evil.test/a.png', description: 'x', labels: [] }] }))).toMatch(/refusing R2 key/);
    // and in the database, whatever the code does
    for (const key of ['hw-bank/a.png', 'hw-exams/figures/../x.png', 'hw-exams/figures//x.png']) {
      await expect(raw.query(`UPDATE hw_exam_set_item SET figures = $2 WHERE id = $1`, [id, JSON.stringify([{ key, description: 'x', labels: [] }])])).rejects.toThrow(/hw_exam_set_item_figure_keys/);
    }
    await expect(raw.query(`UPDATE hw_exam_set_item SET key_checked_by = ' ', key_checked_at = now() WHERE id = $1`, [id])).rejects.toThrow(/key_check_named/);
    await expect(raw.query(`UPDATE hw_exam_set_item SET key_checked_by = 'T' WHERE id = $1`, [id])).rejects.toThrow(/key_check_named/);
  });

  it('a pool with keys the assistant wrote cannot be published until a teacher has checked each one; changing a question takes its check back', async () => {
    const { pool } = await draftPool();
    const a = (await b.addAuthoredItem(database, pool, toCheck('Food chains'))).id;
    const c = (await b.addAuthoredItem(database, pool, toCheck('Ozone'))).id;
    const o = (await b.addAuthoredItem(database, pool, official)).id;
    await raw.query(`UPDATE hw_exam_set SET max_marks = 9 WHERE id = $1`, [pool]);
    const first = await b.publishSet(database, pool);
    expect(first).toMatchObject({ published: false, problems: [expect.stringMatching(/^2 keys written by the assistant are not checked/)] });
    expect((await b.getSet(database, pool)).problems).toContainEqual(expect.stringMatching(/^2 keys/));
    // an official key has nothing to check
    expect(await publicOf(b.checkItemKey(database, o, 'Teacher', true))).toMatch(/not one the assistant wrote/);
    expect(await publicOf(b.checkItemKey(database, a, '  ', true))).toMatch(/name/);
    await b.checkItemKey(database, a, 'Ms Teacher', true, T0);
    await b.checkItemKey(database, c, 'Ms Teacher', true, T0);
    const shown = (await b.getSet(database, pool, sign)).items;
    expect(shown.find((i) => i.id === a)).toMatchObject({ keyToCheck: true, keyCheckedBy: 'Ms Teacher', keyCheckedAt: T0 });
    expect(shown.find((i) => i.id === o)).toMatchObject({ keyToCheck: false, keyCheckedBy: null });
    // the content changes: the check goes; a number or chapter change keeps it
    await b.updateItem(database, c, { stem: 'Explain again.' });
    await b.updateItem(database, a, { chapter: 'Our Environment (13)' });
    const after = (await raw.query(`SELECT id, key_checked_by FROM hw_exam_set_item WHERE id = ANY($1)`, [[a, c]])).rows;
    expect(Object.fromEntries(after.map((r) => [r.id, r.key_checked_by]))).toEqual({ [a]: 'Ms Teacher', [c]: null });
    expect((await b.publishSet(database, pool)).problems).toEqual([expect.stringMatching(/^1 key written by the assistant is not checked/)]);
    await b.checkItemKey(database, c, 'Ms Teacher', true, T0);
    expect(await b.publishSet(database, pool)).toEqual({ published: true, problems: [] });
    // published: the check is frozen with the rest
    expect(await publicOf(b.checkItemKey(database, a, 'Someone', false))).toMatch(/cannot change/);
  });

  it('a practice test copies the references and pictures, draws one alternative of a choice, and the learner sees the pictures as links', async () => {
    const { p, pool } = await draftPool();
    for (const alt of ['A', 'B']) {
      const { id } = await b.addAuthoredItem(database, pool, { ...toCheck(`Choice ${alt}`, 'Q14'), topic: 'Food chains', sources: [`31/3/1 Q14${alt}`], figures: [{ key: FIG, description: `picture ${alt}`, labels: [] }] });
      await b.checkItemKey(database, id, 'T', true);
    }
    const lone = (await b.addAuthoredItem(database, pool, { ...toCheck('Ozone'), topic: 'Ozone' })).id;
    await b.checkItemKey(database, lone, 'T', true);
    await raw.query(`UPDATE hw_exam_set SET max_marks = 9 WHERE id = $1`, [pool]);
    expect(await b.publishSet(database, pool)).toEqual({ published: true, problems: [] });
    expect(await b.publishPackage(database, p)).toMatchObject({ published: true });
    const u = `rf-${randomUUID().slice(0, 8)}`;
    userIds.push(u);
    await raw.query(`INSERT INTO "user" (id, name, email, role) VALUES ($1, 'L', $2, 'student')`, [u, `${u}@example.test`]);
    await b.grantEntitlement(database, 'owner', { userId: u, packageId: p, attemptsPerSet: null, expiresAt: null });
    const made = await P.buildPractice(database, u, { poolSetId: pool, topics: [], types: [], count: 3 }, T0, () => 0);
    expect(made.questions).toBe(2); // one alternative of Q14, and the lone question
    const items = (await raw.query(`SELECT choice_group, sources, ncert, figures, key_checked_by FROM hw_exam_set_item WHERE set_id = $1 ORDER BY number`, [made.setId])).rows;
    expect(items.filter((i) => i.choice_group === 'Q14')).toHaveLength(1);
    expect(items.every((i) => i.ncert.section === '13.1.1' && i.key_checked_by === 'T')).toBe(true);
    const { attemptId } = await L.startAttempt(database, u, made.setId, T0);
    const view = await L.attemptView(database, u, attemptId, { now: T0, sign });
    const withPic = view.paper.find((q) => q.figures.length)!;
    expect(withPic.figures).toEqual([{ figureId: 'fig1', description: expect.stringMatching(/^picture [AB]$/), url: `signed:${FIG}` }]);
    // only one alternative is in this test, so it is not shown as "attempt either"
    expect(view.paper.every((q) => q.choiceGroup === null)).toBe(true);
    // and the learner's paper never carries the key, the scheme or the teacher's check
    expect(JSON.stringify(view.paper)).not.toMatch(/KEY TO CHECK|the point|scheme|keyChecked/);
  });
});
