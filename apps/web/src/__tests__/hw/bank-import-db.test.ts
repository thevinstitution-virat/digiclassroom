/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// The board-paper bank (migration 032) against a real Postgres: the importer's draft-only writes, its idempotence, the refusal to change a row a
// person has checked, the guards in the database itself, and the import log. The paper is an invented one (bank-fixture.ts).
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/bank-import-db

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256, type ExpandedPaper } from '@/lib/hw/bank/expand';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[bank] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migration 032.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' });

type Store = typeof import('@/lib/hw/bank/store');
let store: Store;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let raw: Pool;

/** A paper identity no other test or run shares, so the suite can run against a database that already holds the real bank. */
const code = `T-${randomUUID().slice(0, 8)}`;
function paperOf(edit: (b: ReturnType<typeof cloneBank>) => void = () => {}): { paper: ExpandedPaper; sha: string } {
  const b = cloneBank();
  b.paper.code = code;
  edit(b);
  return { paper: expandBank(b), sha: sha256(JSON.stringify(b)) };
}
const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
const rows = async (sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows as Record<string, unknown>[];
const paperRow = () => one<{ id: string; version: number; status: string; source_sha256: string }>(`SELECT * FROM hw_bank_paper WHERE subject_code = $1`, [code]);
const questionRow = async (number: number, alt: string | null, variant: string | null) =>
  one<{ id: string; status: string; version: number; content_hash: string; checked_by: string | null }>(
    `SELECT q.* FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND COALESCE(q.alt,'') = $3 AND COALESCE(q.variant,'') = $4`,
    [code, number, alt ?? '', variant ?? '']);
const check = (id: string, who = 'Mrs Rao') => raw.query(`UPDATE hw_bank_question SET status = 'checked', checked_by = $2, checked_at = now() WHERE id = $1`, [id, who]);
const count = async (table: 'hw_bank_paper' | 'hw_bank_question' | 'hw_bank_figure') => {
  const where = {
    hw_bank_paper: `subject_code = $1`,
    hw_bank_question: `paper_id IN (SELECT id FROM hw_bank_paper WHERE subject_code = $1)`,
    hw_bank_figure: `question_id IN (SELECT q.id FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1)`,
  }[table];
  return Number((await one<{ n: string }>(`SELECT count(*) AS n FROM ${table} WHERE ${where}`, [code]))!.n);
};

suite('board-paper bank — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    store = await import('@/lib/hw/bank/store');
  });
  afterAll(async () => {
    await raw?.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code]);
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('imports a paper as draft rows with their figures, and logs the import', async () => {
    const { paper, sha } = paperOf();
    expect((await store.dryRun(database, paper, sha)).counts.new).toBe(9);
    expect(await paperRow()).toBeUndefined();   // a dry run writes nothing

    const r = await store.importDraft(database, paper, { actor: 'tester', sourceSha256: sha });
    expect(r.written).toBe(true);
    expect(r.plan.counts).toMatchObject({ new: 9, total: 9 });
    expect(await count('hw_bank_question')).toBe(9);
    expect(await rows(`SELECT DISTINCT status FROM hw_bank_question WHERE paper_id = $1`, [r.paperId])).toEqual([{ status: 'draft' }]);
    expect(await count('hw_bank_figure')).toBe(3);   // q3 figure on C and D, q4 figure
    const p = await paperRow();
    expect(p).toMatchObject({ version: 1, status: 'draft', source_sha256: sha });
    const log = await rows(`SELECT actor, summary FROM hw_bank_import WHERE paper_id = $1`, [r.paperId]);
    expect(log).toHaveLength(1);
    expect(log[0].actor).toBe('tester');
    expect((log[0].summary as { counts: { new: number } }).counts.new).toBe(9);

    const c = await questionRow(3, 'C', null);
    expect(c).toBeTruthy();
    const mcq = await one<{ correct_option: string; accepted_answers: string[]; options: unknown[] }>(`SELECT correct_option, accepted_answers, options FROM hw_bank_question WHERE id = $1`, [(await questionRow(1, null, null))!.id]);
    expect(mcq!.correct_option).toBe('C');
    expect(mcq!.accepted_answers).toContain('(c)');
    expect(mcq!.options).toHaveLength(4);
  });

  it('is idempotent: the same file again writes nothing, not even a log row', async () => {
    const { paper, sha } = paperOf();
    const before = await paperRow();
    const r = await store.importDraft(database, paper, { actor: 'tester', sourceSha256: sha });
    expect(r.written).toBe(false);
    expect(r.plan.counts.unchanged).toBe(9);
    expect(await paperRow()).toEqual(before);
    expect(await count('hw_bank_question')).toBe(9);
    expect((await rows(`SELECT 1 FROM hw_bank_import WHERE paper_id = $1`, [before!.id])).length).toBe(1);
  });

  it('updates a draft row whose content changed: a new version, its figures replaced, the paper a new version', async () => {
    const before = await questionRow(4, null, null);
    const { paper, sha } = paperOf((b) => { b.questions[3].figures[0].description = 'A circle with a ruler beside it.'; });
    const r = await store.importDraft(database, paper, { actor: 'tester', sourceSha256: sha });
    expect(r.plan.counts).toMatchObject({ update_draft: 1, unchanged: 8 });
    const after = await questionRow(4, null, null);
    expect(after!.version).toBe(before!.version + 1);
    expect(after!.content_hash).not.toBe(before!.content_hash);
    expect((await one<{ description: string }>(`SELECT description FROM hw_bank_figure WHERE question_id = $1`, [after!.id]))!.description).toMatch(/ruler/);
    expect(await count('hw_bank_figure')).toBe(3);
    expect((await paperRow())!.version).toBe(2);
    expect((await questionRow(1, null, null))!.version).toBe(1);
  });

  it('never changes a row a person has checked: it refuses, writes nothing, and says which rows', async () => {
    const q2a = (await questionRow(2, 'A', null))!;
    await check(q2a.id);
    const edited = paperOf((b) => { b.questions[1].parts[0].value_points[0].text = 'The heart, a muscular pump'; });
    const versionBefore = (await paperRow())!.version;
    const rowsBefore = await count('hw_bank_question');
    await expect(store.importDraft(database, edited.paper, { actor: 'tester', sourceSha256: edited.sha })).rejects.toBeInstanceOf(store.ImportConflictError);
    // Q2A and Q2A-vi share nothing, so exactly one row conflicts
    const dry = await store.dryRun(database, edited.paper, edited.sha);
    expect(dry.conflicts.map((c) => c.key)).toEqual(['2|A|']);
    const stillThere = await questionRow(2, 'A', null);
    expect(stillThere).toMatchObject({ status: 'checked', version: q2a.version, content_hash: q2a.content_hash, checked_by: 'Mrs Rao' });
    expect((await paperRow())!.version).toBe(versionBefore);
    expect(await count('hw_bank_question')).toBe(rowsBefore);
    // and an unrelated edit in the same file is not applied either (all or nothing)
    expect((await questionRow(1, null, null))!.version).toBe(1);
  });

  it('sends a checked row back to draft only on revise: a new version, no checker, the paper a draft again', async () => {
    const q2a = (await questionRow(2, 'A', null))!;
    const edited = paperOf((b) => { b.questions[1].parts[0].value_points[0].text = 'The heart, a muscular pump'; });
    const r = await store.importDraft(database, edited.paper, { actor: 'tester', sourceSha256: edited.sha, revise: true });
    expect(r.plan.counts.revise).toBe(1);
    const after = (await questionRow(2, 'A', null))!;
    expect(after).toMatchObject({ status: 'draft', checked_by: null, version: q2a.version + 1 });
    expect(after.content_hash).not.toBe(q2a.content_hash);
    expect((await paperRow())!.status).toBe('draft');
  });

  it('keeps a re-import of a checked row with unchanged content as it was', async () => {
    const same = paperOf((b) => { b.questions[1].parts[0].value_points[0].text = 'The heart, a muscular pump'; });
    const q1 = (await questionRow(1, null, null))!;
    await check(q1.id);
    const r = await store.importDraft(database, same.paper, { actor: 'tester', sourceSha256: same.sha });
    expect(r.written).toBe(false);
    expect(await questionRow(1, null, null)).toMatchObject({ status: 'checked', checked_by: 'Mrs Rao' });
  });

  it('reports a stored row the file no longer has, and leaves it', async () => {
    const other = paperOf((b) => { b.questions = b.questions.slice(0, 3); b.paper.max_marks = 6; });
    const dry = await store.dryRun(database, other.paper, other.sha);
    expect(dry.orphans.map((o) => o.key)).toEqual(['4||']);
    const r = await store.importDraft(database, other.paper, { actor: 'tester', sourceSha256: other.sha });
    expect(r.plan.counts.orphans).toBe(1);
    expect(await questionRow(4, null, null)).toBeTruthy();   // not deleted
    // put the full paper back for the later tests
    const full = paperOf((b) => { b.questions[1].parts[0].value_points[0].text = 'The heart, a muscular pump'; });
    await store.importDraft(database, full.paper, { actor: 'tester', sourceSha256: full.sha });
  });

  describe('the guards in the database itself', () => {
    it('refuses a content change to a checked row, whoever asks', async () => {
      const q = (await questionRow(1, null, null))!;
      await expect(raw.query(`UPDATE hw_bank_question SET marks = 2 WHERE id = $1`, [q.id])).rejects.toThrow(/cannot change; send it back to draft/);
      await expect(raw.query(`UPDATE hw_bank_question SET correct_option = 'A' WHERE id = $1`, [q.id])).rejects.toThrow(/cannot change/);
      await expect(raw.query(`UPDATE hw_bank_question SET stem = 'other' WHERE id = $1`, [q.id])).rejects.toThrow(/cannot change/);
      // sending it back to draft is how it can change
      await raw.query(`UPDATE hw_bank_question SET status = 'draft', checked_by = NULL, checked_at = NULL, stem = 'other' WHERE id = $1`, [q.id]);
      expect((await questionRow(1, null, null))!.status).toBe('draft');
    });

    it('refuses to move a question within its paper', async () => {
      const q = (await questionRow(3, 'C', null))!;
      await expect(raw.query(`UPDATE hw_bank_question SET number = 9 WHERE id = $1`, [q.id])).rejects.toThrow(/place in the paper/);
      await expect(raw.query(`UPDATE hw_bank_question SET alt = 'D' WHERE id = $1`, [q.id])).rejects.toThrow(/place in the paper|duplicate key/);
    });

    it('wants a named checker for a checked row, and none for a draft', async () => {
      const q = (await questionRow(4, null, null))!;
      await expect(raw.query(`UPDATE hw_bank_question SET status = 'checked' WHERE id = $1`, [q.id])).rejects.toThrow(/hw_bank_question_checked_by/);
      await expect(raw.query(`UPDATE hw_bank_question SET checked_by = 'x', checked_at = now() WHERE id = $1`, [q.id])).rejects.toThrow(/hw_bank_question_checked_by/);
    });

    it('wants four options for a multiple-choice row, none for a written one, and a choice kind with its group', async () => {
      const p = (await paperRow())!;
      const base = `INSERT INTO hw_bank_question (paper_id, number, section, marks, qtype, stem, stem_raw, options, correct_option, content_hash, choice_group, choice_kind) VALUES ($1, $2, 'A', 1, $3, 's', 's', $4::jsonb, $5, $6, $7, $8)`;
      const h = 'f'.repeat(64);
      await expect(raw.query(base, [p.id, 50, 'mcq', '[]', null, h, null, null])).rejects.toThrow(/hw_bank_question_mcq_shape/);
      await expect(raw.query(base, [p.id, 51, 'short', '[{"letter":"A","text":"x"}]', null, h, null, null])).rejects.toThrow(/hw_bank_question_mcq_shape/);
      await expect(raw.query(base, [p.id, 52, 'short', '[]', null, h, 'Q52', null])).rejects.toThrow(/hw_bank_question_choice_together/);
      await expect(raw.query(base, [p.id, 53, 'short', '[]', null, h, null, 'option'])).rejects.toThrow(/hw_bank_question_choice_together/);
      await expect(raw.query(`${base.replace("'A', 1,", "'A', 1.3,")}`, [p.id, 54, 'short', '[]', null, h, null, null])).rejects.toThrow(/marks/);
    });

    it('keeps one row per paper, number, alternative and variant', async () => {
      const p = (await paperRow())!;
      await expect(raw.query(`INSERT INTO hw_bank_question (paper_id, number, alt, section, marks, qtype, stem, stem_raw, content_hash) VALUES ($1, 3, 'C', 'A', 1, 'short', 's', 's', $2)`, [p.id, 'f'.repeat(64)])).rejects.toThrow(/hw_bank_question_identity/);
      await expect(raw.query(`INSERT INTO hw_bank_paper (board, class_level, subject, subject_code, session, kind, title, max_marks, source_sha256, imported_by) VALUES ('TESTBOARD', 10, 'Science', $1, '2099-00', 'sqp', 't', 10, $2, 'x')`, [code, 'f'.repeat(64)])).rejects.toThrow(/hw_bank_paper_identity/);
    });

    it('keeps the import log append-only', async () => {
      await expect(raw.query(`UPDATE hw_bank_import SET actor = 'someone else' WHERE paper_id = $1`, [(await paperRow())!.id])).rejects.toThrow(/append-only/);
      await expect(raw.query(`DELETE FROM hw_bank_import WHERE paper_id = $1`, [(await paperRow())!.id])).rejects.toThrow(/append-only/);
    });

    it('lets a paper be deleted with its rows and figures; its log entries stay, without the paper', async () => {
      const own = paperOf((b) => { b.paper.code = `${code}-del`; });
      const r = await store.importDraft(database, own.paper, { actor: 'tester', sourceSha256: own.sha });
      expect((await rows(`SELECT 1 FROM hw_bank_question WHERE paper_id = $1`, [r.paperId])).length).toBe(9);
      await raw.query(`DELETE FROM hw_bank_paper WHERE id = $1`, [r.paperId]);
      expect((await rows(`SELECT 1 FROM hw_bank_question WHERE paper_id = $1`, [r.paperId])).length).toBe(0);
      expect((await rows(`SELECT 1 FROM hw_bank_figure WHERE question_id IN (SELECT id FROM hw_bank_question WHERE paper_id = $1)`, [r.paperId])).length).toBe(0);
      const log = await rows(`SELECT paper_id FROM hw_bank_import WHERE source_sha256 = $1`, [own.sha]);
      expect(log).toEqual([{ paper_id: null }]);
      await raw.query(`DELETE FROM hw_bank_import WHERE source_sha256 = $1`, [own.sha]).catch(() => undefined);
    });
  });

  it('two imports of the same new paper at once end with one paper and one set of rows', async () => {
    const racing = paperOf((b) => { b.paper.code = `${code}-race`; });
    const settled = await Promise.allSettled([
      store.importDraft(database, racing.paper, { actor: 'a', sourceSha256: racing.sha }),
      store.importDraft(database, racing.paper, { actor: 'b', sourceSha256: racing.sha }),
    ]);
    expect(settled.filter((s) => s.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM hw_bank_paper WHERE subject_code = $1`, [`${code}-race`]))!.n)).toBe(1);
    expect(Number((await one<{ n: string }>(`SELECT count(*) AS n FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1`, [`${code}-race`]))!.n)).toBe(9);
    await raw.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [`${code}-race`]);
  });
});
