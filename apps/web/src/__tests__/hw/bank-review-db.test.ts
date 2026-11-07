/* eslint-disable no-restricted-syntax -- this test sets the environment the database layer reads, before loading it */
// The board-paper bank, phase 2 (migration 033) against a real Postgres: recording a person's check, the refusals, the review log, and the guards
// in the database itself. The paper is an invented one (bank-fixture.ts), a new identity for every test.
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/bank-review-db     (needs migrations 032 and 033)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';
import { REVIEW_FORMAT, type VerdictFile, type VerdictIn } from '@/lib/hw/bank/review';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[bank-review] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 032 and 033.');
Object.assign(process.env, { DATABASE_URL: DB_URL ?? '' });

type Store = typeof import('@/lib/hw/bank/store');
type RStore = typeof import('@/lib/hw/bank/review-store');
let store: Store;
let rstore: RStore;
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let raw: Pool;
const codes: string[] = [];

interface Row { id: string; number: number; alt: string | null; variant: string | null; status: string; version: number; content_hash: string; needs_check: string[]; checked_by: string | null }

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
const all = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows as T[];

function bankOf(code: string, edit: (b: ReturnType<typeof cloneBank>) => void = () => {}) {
  const b = cloneBank();
  b.paper.code = code;
  edit(b);
  return { paper: expandBank(b), sha: sha256(JSON.stringify(b)) };
}

/** A paper of its own, imported as draft. */
async function fresh() {
  const code = `R-${randomUUID().slice(0, 8)}`;
  codes.push(code);
  const { paper, sha } = bankOf(code);
  const r = await store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha });
  return { code, paperId: r.paperId };
}
const rowOf = (code: string, number: number, alt: string | null = null, variant: string | null = null) =>
  one<Row>(`SELECT q.* FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND COALESCE(q.alt,'') = $3 AND COALESCE(q.variant,'') = $4`, [code, number, alt ?? '', variant ?? '']);
const paperStatus = async (code: string) => (await one<{ status: string }>(`SELECT status FROM hw_bank_paper WHERE subject_code = $1`, [code]))!.status;
const logCount = async (code: string) => Number((await one<{ n: string }>(`SELECT count(*) n FROM hw_bank_review r JOIN hw_bank_paper p ON p.id = r.paper_id WHERE p.subject_code = $1`, [code]))!.n);

/** What the sheet would hand back for a row: its hash, and every flagged item ticked. */
async function verdict(code: string, number: number, alt: string | null = null, variant: string | null = null, extra: Partial<VerdictIn> = {}): Promise<VerdictIn> {
  const r = (await rowOf(code, number, alt, variant))!;
  return { q: number, alt: alt as VerdictIn['alt'], variant: variant as VerdictIn['variant'], content_hash: r.content_hash, verdict: 'ok', confirmed: r.needs_check, note: '', ...extra };
}
const fileFor = (code: string, verdicts: VerdictIn[], reviewer = 'Mrs Rao'): VerdictFile =>
  ({ format: REVIEW_FORMAT, paper: { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' }, reviewer, verdicts });
const everyRow = async (code: string): Promise<VerdictIn[]> => {
  const rs = await all<Row>(`SELECT q.* FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 ORDER BY q.number, q.alt NULLS FIRST, q.variant NULLS FIRST`, [code]);
  return rs.map((r) => ({ q: r.number, alt: r.alt as VerdictIn['alt'], variant: r.variant as VerdictIn['variant'], content_hash: r.content_hash, verdict: 'ok' as const, confirmed: r.needs_check, note: '' }));
};

suite('board-paper bank review — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    store = await import('@/lib/hw/bank/store');
    rstore = await import('@/lib/hw/bank/review-store');
  });
  afterAll(async () => {
    for (const c of codes) await raw?.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [c]);
    await raw?.end();
    await dbMod?.getPool().end();
  });

  it('checks a row: status, checker and time on the row, one line in the log, the paper still a draft', async () => {
    const { code } = await fresh();
    const r = await rstore.applyReview(database, fileFor(code, [await verdict(code, 1)]), { recordedBy: 'operator' });
    expect(r.written).toBe(true);
    const q = await rowOf(code, 1);
    expect(q).toMatchObject({ status: 'checked', checked_by: 'Mrs Rao' });
    expect(await one(`SELECT checked_at FROM hw_bank_question WHERE id = $1`, [q!.id])).toMatchObject({ checked_at: expect.any(Date) });
    const log = await all<{ verdict: string; reviewer: string; recorded_by: string; question_version: number; content_hash: string }>(`SELECT r.* FROM hw_bank_review r JOIN hw_bank_paper p ON p.id = r.paper_id WHERE p.subject_code = $1`, [code]);
    expect(log).toEqual([expect.objectContaining({ verdict: 'ok', reviewer: 'Mrs Rao', recorded_by: 'operator', question_version: 1, content_hash: q!.content_hash })]);
    expect(await paperStatus(code)).toBe('draft');
    expect((await rowOf(code, 2, 'A'))!.status).toBe('draft');
  });

  it('is idempotent: the same file again records nothing', async () => {
    const { code } = await fresh();
    const f = fileFor(code, [await verdict(code, 1), await verdict(code, 2, 'A')]);
    expect((await rstore.applyReview(database, f, { recordedBy: 'op' })).written).toBe(true);
    const again = await rstore.applyReview(database, f, { recordedBy: 'op' });
    expect(again.written).toBe(false);
    expect(again.plan.counts.unchanged).toBe(2);
    expect(await logCount(code)).toBe(2);
  });

  it('refuses a flagged row that was not confirmed, and writes nothing', async () => {
    const { code } = await fresh();
    const q4 = await verdict(code, 4, null, null, { confirmed: [] });
    await expect(rstore.applyReview(database, fileFor(code, [await verdict(code, 1), q4]), { recordedBy: 'op' })).rejects.toThrow(/problem in the verdict file; nothing was recorded/);
    expect((await rowOf(code, 1))!.status).toBe('draft');   // the good verdict next to it was not applied either
    expect(await logCount(code)).toBe(0);
  });

  it('refuses a verdict for content that changed after the sheet was made', async () => {
    const { code } = await fresh();
    const stale = await verdict(code, 1);
    const { paper, sha } = bankOf(code, (b) => { b.questions[0].stem = 'Which gas do green plants take in?'; });
    await store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha });
    await expect(rstore.applyReview(database, fileFor(code, [stale]), { recordedBy: 'op' })).rejects.toBeInstanceOf(rstore.ReviewRefusedError);
    expect((await rowOf(code, 1))!.status).toBe('draft');
    // the verdict for the content as it is now is accepted
    expect((await rstore.applyReview(database, fileFor(code, [await verdict(code, 1)]), { recordedBy: 'op' })).written).toBe(true);
  });

  it('records a fix without checking the row, shows it as waiting, and notes it once', async () => {
    const { code } = await fresh();
    const fix = await verdict(code, 3, 'C', null, { verdict: 'fix', confirmed: [], note: 'C should say consumer of the pond' });
    const f = fileFor(code, [fix]);
    expect((await rstore.applyReview(database, f, { recordedBy: 'op' })).plan.counts.note_fix).toBe(1);
    expect((await rowOf(code, 3, 'C'))!.status).toBe('draft');
    expect((await rstore.applyReview(database, f, { recordedBy: 'op' })).written).toBe(false);
    expect(await logCount(code)).toBe(1);
    const st = await rstore.paperReviewStatus(database, { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' });
    expect(st.openFixes).toEqual([{ label: 'Q3C', note: 'C should say consumer of the pond', reviewer: 'Mrs Rao' }]);

    // the correction is made in the bank file and imported: new content, so the fix is no longer waiting and the old verdict cannot check it
    const { paper, sha } = bankOf(code, (b) => { b.questions[2].choice!.alternatives_text.C = 'C. Name one consumer of the pond.'; });
    await store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha });
    const st2 = await rstore.paperReviewStatus(database, { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' });
    expect(st2.openFixes.map((x) => x.label)).toEqual([]);
    await expect(rstore.applyReview(database, fileFor(code, [{ ...fix, verdict: 'ok', note: '' }]), { recordedBy: 'op' })).rejects.toBeInstanceOf(rstore.ReviewRefusedError);
    expect((await rstore.applyReview(database, fileFor(code, [await verdict(code, 3, 'C')]), { recordedBy: 'op' })).written).toBe(true);
  });

  it('checks the whole paper: the paper becomes checked only with the last row', async () => {
    const { code } = await fresh();
    const rs = await everyRow(code);
    expect(rs).toHaveLength(9);
    await rstore.applyReview(database, fileFor(code, rs.slice(1)), { recordedBy: 'op' });
    expect(await paperStatus(code)).toBe('draft');
    const last = await rstore.applyReview(database, fileFor(code, rs.slice(0, 1)), { recordedBy: 'op' });
    expect(last.plan.paperAfter).toBe('checked');
    expect(await paperStatus(code)).toBe('checked');
  });

  it('withdraws a check on a fix, and the paper goes back to draft', async () => {
    const { code } = await fresh();
    await rstore.applyReview(database, fileFor(code, await everyRow(code)), { recordedBy: 'op' });
    expect(await paperStatus(code)).toBe('checked');
    const r = await rstore.applyReview(database, fileFor(code, [await verdict(code, 1, null, null, { verdict: 'fix', confirmed: [], note: 'Option C is not in the scheme' })], 'Mr Iyer'), { recordedBy: 'op' });
    expect(r.plan.counts.withdraw).toBe(1);
    expect(await rowOf(code, 1)).toMatchObject({ status: 'draft', checked_by: null });
    expect(await paperStatus(code)).toBe('draft');
  });

  it('rejects a row, which keeps the paper from being checked', async () => {
    const { code } = await fresh();
    const rs = await everyRow(code);
    const bad = await verdict(code, 4, null, null, { verdict: 'reject', confirmed: [], note: 'The figure cannot be read' });
    await rstore.applyReview(database, fileFor(code, [...rs.filter((v) => v.q !== 4), bad]), { recordedBy: 'op' });
    expect(await rowOf(code, 4)).toMatchObject({ status: 'rejected', checked_by: null });
    expect(await paperStatus(code)).toBe('draft');
    // a rejected row cannot be passed as ok; it has to be corrected in the file and imported again
    await expect(rstore.applyReview(database, fileFor(code, [await verdict(code, 4)]), { recordedBy: 'op' })).rejects.toThrow(/nothing was recorded/);
  });

  it('a paper is checked again after a row changes: the importer sends it back to draft', async () => {
    const { code } = await fresh();
    await rstore.applyReview(database, fileFor(code, await everyRow(code)), { recordedBy: 'op' });
    const { paper, sha } = bankOf(code, (b) => { b.questions[0].stem = 'Which gas do green plants take in?'; });
    await expect(store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha })).rejects.toBeInstanceOf(store.ImportConflictError);
    await store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha, revise: true });
    expect(await rowOf(code, 1)).toMatchObject({ status: 'draft', checked_by: null, version: 2 });
    expect(await paperStatus(code)).toBe('draft');
  });

  it('a question added to a checked paper makes it a draft again (a new row is a draft)', async () => {
    const { code } = await fresh();
    await rstore.applyReview(database, fileFor(code, await everyRow(code)), { recordedBy: 'op' });
    expect(await paperStatus(code)).toBe('checked');
    const { paper, sha } = bankOf(code, (b) => {
      const extra = JSON.parse(JSON.stringify(b.questions[0]));
      extra.number = 5;
      extra.variant_for_visually_impaired = null;
      b.questions.push(extra);
      b.paper.max_marks = 11;
    });
    const r = await store.importDraft(database, paper, { actor: 'importer', sourceSha256: sha });
    expect(r.plan.counts).toMatchObject({ new: 1, unchanged: 9 });
    expect(await rowOf(code, 5)).toMatchObject({ status: 'draft' });
    expect(await paperStatus(code)).toBe('draft');
    expect((await rowOf(code, 1))!.status).toBe('checked');   // the rows that did not change keep their check
  });

  it('a paper is not found', async () => {
    await expect(rstore.applyReview(database, fileFor(`NOPE-${randomUUID().slice(0, 6)}`, [{ q: 1, alt: null, variant: null, content_hash: 'a'.repeat(64), verdict: 'ok', confirmed: [], note: '' }]), { recordedBy: 'op' }))
      .rejects.toBeInstanceOf(rstore.PaperNotFoundError);
  });

  it('two people recording the same file at once: one writes, the other finds it done', async () => {
    const { code } = await fresh();
    const f = fileFor(code, [await verdict(code, 1), await verdict(code, 2, 'A')]);
    const rs = await Promise.all([rstore.applyReview(database, f, { recordedBy: 'a' }), rstore.applyReview(database, f, { recordedBy: 'b' })]);
    expect(rs.filter((r) => r.written)).toHaveLength(1);
    expect(await logCount(code)).toBe(2);
  });

  it('builds the sheet from what is stored: paper order, figures, hashes, flags', async () => {
    const { code } = await fresh();
    const d = await rstore.loadSheetData(database, { board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' });
    expect(d.rows.map((r) => `${r.number}${r.alt ?? ''}${r.variant ? 'vi' : ''}`)).toEqual(['1', '1vi', '2A', '2B', '2Avi', '2Bvi', '3C', '3D', '4']);
    const q4 = d.rows.find((r) => r.number === 4)!;
    expect(q4.figures).toHaveLength(1);
    expect(q4.needsCheck.length).toBeGreaterThan(2);
    expect(q4.contentHash).toBe((await rowOf(code, 4))!.content_hash);
    expect(d.paper).toMatchObject({ code, status: 'draft', maxMarks: 10 });
  });

  describe('guards in the database itself', () => {
    it('refuses to mark a paper checked while a row is still draft, or when it has no rows', async () => {
      const { code, paperId } = await fresh();
      await expect(raw.query(`UPDATE hw_bank_paper SET status = 'checked' WHERE id = $1`, [paperId])).rejects.toThrow(/every question must be checked/);
      const empty = `R-${randomUUID().slice(0, 8)}`;
      codes.push(empty);
      await raw.query(`INSERT INTO hw_bank_paper (board, class_level, subject, subject_code, session, kind, title, max_marks, source_sha256, imported_by) VALUES ('TESTBOARD', 10, 'Science', $1, '2099-00', 'sqp', 'empty', 5, $2, 'x')`, [empty, 'a'.repeat(64)]);
      await expect(raw.query(`UPDATE hw_bank_paper SET status = 'checked' WHERE subject_code = $1`, [empty])).rejects.toThrow(/without questions/);
      void code;
    });

    it('keeps the review log append-only, but lets a deleted paper blank its references', async () => {
      const { code } = await fresh();
      await rstore.applyReview(database, fileFor(code, [await verdict(code, 1)]), { recordedBy: 'op' });
      const l = (await one<{ id: string }>(`SELECT r.id FROM hw_bank_review r JOIN hw_bank_paper p ON p.id = r.paper_id WHERE p.subject_code = $1`, [code]))!;
      await expect(raw.query(`UPDATE hw_bank_review SET note = 'changed' WHERE id = $1`, [l.id])).rejects.toThrow(/append-only/);
      await expect(raw.query(`UPDATE hw_bank_review SET verdict = 'reject', note = 'x' WHERE id = $1`, [l.id])).rejects.toThrow(/append-only/);
      await expect(raw.query(`UPDATE hw_bank_review SET paper_id = NULL WHERE id = $1`, [l.id])).rejects.toThrow(/append-only/);   // not through the foreign key
      await expect(raw.query(`DELETE FROM hw_bank_review WHERE id = $1`, [l.id])).rejects.toThrow(/append-only/);
      await raw.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [code]);
      expect(await one<{ paper_id: string | null; question_id: string | null; number: number }>(`SELECT paper_id, question_id, number FROM hw_bank_review WHERE id = $1`, [l.id]))
        .toEqual({ paper_id: null, question_id: null, number: 1 });
    });

    it('requires a note for a fix or a reject, and a named reviewer', async () => {
      const { code, paperId } = await fresh();
      const q = (await rowOf(code, 1))!;
      const ins = (verdictName: string, note: string, reviewer = 'Mrs Rao') => raw.query(
        `INSERT INTO hw_bank_review (paper_id, question_id, number, question_version, content_hash, verdict, note, reviewer, recorded_by) VALUES ($1, $2, 1, 1, $3, $4, $5, $6, 'x')`,
        [paperId, q.id, q.content_hash, verdictName, note, reviewer]);
      await expect(ins('fix', ' ')).rejects.toThrow(/hw_bank_review_note/);
      await expect(ins('reject', '')).rejects.toThrow(/hw_bank_review_note/);
      await expect(ins('ok', '', ' ')).rejects.toThrow(/reviewer/);
      await expect(ins('ok', '')).resolves.toBeTruthy();
    });
  });
});
