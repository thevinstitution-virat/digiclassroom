/* eslint-disable no-restricted-syntax -- this test sets the environment the feature reads, before loading it */
// The board-paper bank, phase 4 against a real Postgres: figure pictures, publishing, what a learner is offered, and starting a question.
// R2 is a fake (a map); no provider is called and no key is built (it is only queued). The paper is an invented one (bank-fixture.ts).
//   HW_ITEST_DATABASE_URL=postgres://... npx jest src/__tests__/hw/bank-practice-db     (needs migrations 031, 032 and 033)

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, sha256 } from '@/lib/hw/bank/expand';
import { REVIEW_FORMAT, type VerdictFile, type VerdictIn } from '@/lib/hw/bank/review';

const DB_URL = process.env.HW_ITEST_DATABASE_URL;
const suite = DB_URL ? describe : describe.skip;
if (!DB_URL) console.warn('[bank-practice] integration tests SKIPPED: set HW_ITEST_DATABASE_URL to a throwaway Postgres with migrations 031 to 033.');

Object.assign(process.env, {
  DATABASE_URL: DB_URL ?? '',
  HW_SELF_PRACTICE_ENABLED: 'true',
  HW_SELF_PRACTICE_TRIAL_BUDGET_PAISE: '1000',
  HW_SELF_PRACTICE_MAX_ATTEMPTS: '3',
  HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP: 'true',
});

let store: typeof import('@/lib/hw/bank/store');
let rstore: typeof import('@/lib/hw/bank/review-store');
let fig: typeof import('@/lib/hw/bank/figures');
let paperMod: typeof import('@/lib/hw/practice/paper');
let trial: typeof import('@/lib/hw/practice/trial');
let pipeline: typeof import('@/lib/hw/pipeline');
let config: typeof import('@/lib/hw/config');
let database: typeof import('@/db')['db'];
let dbMod: typeof import('@/lib/db/connection');
let raw: Pool;
const codes: string[] = [];
const userIds: string[] = [];

const objects = new Map<string, { bytes: Uint8Array; type: string }>();
const put = async (key: string, bytes: Uint8Array, type: string) => { objects.set(key, { bytes, type }); };
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const png = (w = 120, h = 80) => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(w), ...be32(h), 8, 2, 0, 0, 0, ...new Array(40).fill(7)]);

const one = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows[0] as T | undefined;
const all = async <T = Record<string, unknown>>(sql: string, args: unknown[] = []) => (await raw.query(sql, args)).rows as T[];

const identOf = (code: string) => ({ board: 'TESTBOARD', klass: 10, code, year: '2099-00', kind: 'sqp' as const });

async function fresh(edit: (b: ReturnType<typeof cloneBank>) => void = () => {}, code = `P-${randomUUID().slice(0, 8)}`) {
  codes.push(code);
  const b = cloneBank();
  b.paper.code = code;
  edit(b);
  await store.importDraft(database, expandBank(b), { actor: 'importer', sourceSha256: sha256(JSON.stringify(b)) });
  return code;
}
const reimport = (code: string, edit: (b: ReturnType<typeof cloneBank>) => void, revise = false) => {
  const b = cloneBank();
  b.paper.code = code;
  edit(b);
  return store.importDraft(database, expandBank(b), { actor: 'importer', sourceSha256: sha256(JSON.stringify(b)), revise });
};
const rowOf = (code: string, n: number, alt: string | null = null, v: string | null = null) =>
  one<{ id: string; status: string; content_hash: string; needs_check: string[] }>(`SELECT q.* FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND COALESCE(q.alt,'') = $3 AND COALESCE(q.variant,'') = $4`, [code, n, alt ?? '', v ?? '']);
const everyVerdict = async (code: string, only?: (n: number) => boolean): Promise<VerdictIn[]> => {
  const rs = await all<{ number: number; alt: string | null; variant: string | null; content_hash: string; needs_check: string[] }>(`SELECT q.* FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.status = 'draft'`, [code]);
  return rs.filter((r) => !only || only(r.number)).map((r) => ({ q: r.number, alt: r.alt as VerdictIn['alt'], variant: r.variant as VerdictIn['variant'], content_hash: r.content_hash, verdict: 'ok' as const, confirmed: r.needs_check, note: '' }));
};
const checkAll = async (code: string) => {
  const f: VerdictFile = { format: REVIEW_FORMAT, paper: identOf(code), reviewer: 'Mrs Rao', verdicts: await everyVerdict(code) };
  return rstore.applyReview(database, f, { recordedBy: 'op' });
};
const paperStatus = async (code: string) => (await one<{ status: string }>(`SELECT status FROM hw_bank_paper WHERE subject_code = $1`, [code]))!.status;
const keyOf = async (code: string, n: number, alt: string | null = null) => (await one<{ storage_key: string | null }>(`SELECT f.storage_key FROM hw_bank_figure f JOIN hw_bank_question q ON q.id = f.question_id JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1 AND q.number = $2 AND COALESCE(q.alt,'') = $3 AND q.variant IS NULL LIMIT 1`, [code, n, alt ?? '']))!.storage_key;

/** A paper that is checked and published, with the pictures in place (or not). */
async function published(opts: { pictures?: boolean } = {}) {
  const code = await fresh();
  if (opts.pictures) { await fig.attachFigureImage(database, put, identOf(code), 'q3-fig1', png()); await fig.attachFigureImage(database, put, identOf(code), 'q4-fig1', png()); }
  await checkAll(code);
  await rstore.setPublished(database, identOf(code), true, { actor: 'owner' });
  return code;
}
const learner = async () => {
  const id = `bp-${randomUUID().slice(0, 8)}`;
  userIds.push(id);
  await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, 'Learner', $2, 'student', now())`, [id, `${id}@example.test`]);
  await trial.startTrial(id);
  return id;
};

suite('board-paper bank, phase 4 — integration', () => {
  jest.setTimeout(60_000);
  beforeAll(async () => {
    raw = new Pool({ connectionString: DB_URL });
    dbMod = await import('@/lib/db/connection');
    database = (await import('@/db')).db;
    config = await import('@/lib/hw/config');
    store = await import('@/lib/hw/bank/store');
    rstore = await import('@/lib/hw/bank/review-store');
    fig = await import('@/lib/hw/bank/figures');
    paperMod = await import('@/lib/hw/practice/paper');
    trial = await import('@/lib/hw/practice/trial');
    pipeline = await import('@/lib/hw/pipeline');
    config._resetHwConfig();
  });
  afterEach(() => { process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'true'; config._resetHwConfig(); });
  afterAll(async () => {
    for (const c of codes) await raw?.query(`DELETE FROM hw_bank_paper WHERE subject_code = $1`, [c]);
    await raw?.end();
    await dbMod?.getPool().end();
  });

  describe('figure pictures', () => {
    it('attaches one picture to every row that carries the figure, as private objects under hw-bank/', async () => {
      const code = await fresh();
      const r = await fig.attachFigureImage(database, put, identOf(code), 'q3-fig1', png(300, 200));
      expect(r.image).toMatchObject({ mime: 'image/png', width: 300, height: 200 });
      expect(r.rows.map((x) => x.question).sort()).toEqual(['Q3C', 'Q3D']);
      for (const x of r.rows) { expect(x.key).toMatch(/^hw-bank\/[0-9a-f-]+\.v1\.png$/); expect(objects.get(x.key)!.type).toBe('image/png'); }
      expect(await keyOf(code, 3, 'C')).toMatch(/^hw-bank\//);
      expect(await keyOf(code, 4)).toBeNull();
      // a new picture is a new version, never a replaced object
      const again = await fig.attachFigureImage(database, put, identOf(code), 'q3-fig1', png(310, 210));
      expect(again.rows[0].key).toMatch(/\.v2\.png$/);
    });

    it('refuses what is not a picture, a figure that is not there, and a paper that is not in the bank', async () => {
      const code = await fresh();
      await expect(fig.attachFigureImage(database, put, identOf(code), 'q3-fig1', new TextEncoder().encode('not a picture at all, just words'))).rejects.toThrow(/not a PNG, JPEG or WebP/);
      await expect(fig.attachFigureImage(database, put, identOf(code), 'q9-fig1', png())).rejects.toThrow(/no figure q9-fig1/);
      await expect(fig.attachFigureImage(database, put, identOf(`NOPE-${randomUUID().slice(0, 6)}`), 'q3-fig1', png())).rejects.toThrow(/not in the bank/);
      expect(await keyOf(code, 3, 'C')).toBeNull();
    });

    it('does not change the pictures of a row a person has checked', async () => {
      const code = await fresh();
      await checkAll(code);
      await expect(fig.attachFigureImage(database, put, identOf(code), 'q4-fig1', png())).rejects.toThrow(/Q4 is already checked/);
      expect(await keyOf(code, 4)).toBeNull();
    });

    it('lists every figure and whether it has its picture', async () => {
      const code = await fresh();
      await fig.attachFigureImage(database, put, identOf(code), 'q4-fig1', png());
      const s = await fig.figureStates(database, identOf(code));
      expect(s.map((f) => `${f.question}:${f.figureId}:${f.hasImage}`)).toEqual(['Q3C:q3-fig1:false', 'Q3D:q3-fig1:false', 'Q4:q4-fig1:true']);
    });

    it('keeps a picture when a row is re-imported with the same figure words, and drops it when the words change', async () => {
      const code = await fresh();
      await fig.attachFigureImage(database, put, identOf(code), 'q3-fig1', png());
      await fig.attachFigureImage(database, put, identOf(code), 'q4-fig1', png());
      const k4 = await keyOf(code, 4);
      // Q3's own text changes (its figure does not): the picture stays.
      await reimport(code, (b) => { b.questions[2].choice!.alternatives_text.C = 'C. Name one consumer in the pond.'; });
      expect(await keyOf(code, 3, 'C')).toMatch(/^hw-bank\//);
      // Q4's figure is described differently: the old picture may be the wrong one, so it goes.
      await reimport(code, (b) => { b.questions[3].figures[0].description = 'A circle, drawn larger.'; });
      expect(await keyOf(code, 4)).toBeNull();
      expect(k4).toMatch(/^hw-bank\//);
    });

    it('the review sheet shows the attached pictures beside their words', async () => {
      const code = await fresh();
      await fig.attachFigureImage(database, put, identOf(code), 'q4-fig1', png());
      const d = await rstore.loadSheetData(database, identOf(code), { readImage: async (k) => `data:image/png;base64,${Buffer.from(objects.get(k)!.bytes).toString('base64')}` });
      expect(d.rows.find((r) => r.number === 4)!.figures[0].imageDataUri).toMatch(/^data:image\/png;base64,/);
      expect(d.rows.find((r) => r.number === 3 && r.alt === 'C')!.figures[0].imageDataUri).toBeNull();
      const { renderReviewSheet } = await import('@/lib/hw/bank/review-sheet');
      expect(renderReviewSheet(d)).toContain('No picture is attached to this figure yet');
    });
  });

  describe('publishing a paper', () => {
    it('only a fully checked paper, by the owner; logged; and the way back', async () => {
      const code = await fresh();
      await expect(rstore.setPublished(database, identOf(code), true, { actor: 'owner' })).rejects.toThrow(/every question has been checked/);
      await checkAll(code);
      expect(await paperStatus(code)).toBe('checked');
      expect(await rstore.setPublished(database, identOf(code), true, { actor: 'owner' })).toEqual({ rows: 9 });
      expect(await paperStatus(code)).toBe('published');
      expect((await all(`SELECT DISTINCT q.status FROM hw_bank_question q JOIN hw_bank_paper p ON p.id = q.paper_id WHERE p.subject_code = $1`, [code]))).toEqual([{ status: 'published' }]);
      expect((await all(`SELECT actor, summary FROM hw_bank_import i JOIN hw_bank_paper p ON p.id = i.paper_id WHERE p.subject_code = $1 AND i.summary ->> 'event' = 'publish'`, [code]))).toEqual([{ actor: 'owner', summary: { event: 'publish', rows: 9 } }]);
      await expect(rstore.setPublished(database, identOf(code), true, { actor: 'owner' })).rejects.toThrow(/is published/);
      expect(await rstore.setPublished(database, identOf(code), false, { actor: 'owner' })).toEqual({ rows: 9 });
      expect(await paperStatus(code)).toBe('checked');
      await expect(rstore.setPublished(database, identOf(code), false, { actor: 'owner' })).rejects.toThrow(/not published/);
    });

    it('a changed or added row takes a published paper off offer until it is checked and published again', async () => {
      const code = await published();
      await reimport(code, (b) => { b.questions[0].stem = 'Which gas do green plants take in?'; }, true);
      expect(await paperStatus(code)).toBe('draft');
      expect((await rowOf(code, 1))!.status).toBe('draft');
      expect((await rowOf(code, 2, 'A'))!.status).toBe('published');   // the others keep their check
      expect(await paperMod.offeredPapers(database)).not.toEqual(expect.arrayContaining([expect.objectContaining({ subjectCode: code })]));
    });
  });

  describe('what a learner is offered', () => {
    const mine = async (code: string, who: 'learner' | 'teacher' = 'learner') => (await paperMod.offeredPapers(database, who)).find((p) => p.subjectCode === code);
    const labels = async (code: string, who: 'learner' | 'teacher' = 'learner') => {
      const p = await mine(code, who);
      return p ? (await paperMod.paperQuestions(database, p.paperId, who))!.questions.map((q) => q.label) : null;
    };

    it('nothing from a paper that is not published', async () => {
      const code = await fresh();
      await checkAll(code);
      expect(await mine(code)).toBeUndefined();
    });

    it('with no written marking yet: only multiple choice (by code), and never a visually impaired version', async () => {
      const code = await published({ pictures: true });
      expect(await labels(code)).toEqual(['1']);
      expect(await mine(code)).toMatchObject({ questions: 1, board: 'TESTBOARD', classLevel: 10, kind: 'sqp' });
    });

    it('a question whose figure has no picture is not offered, until it has one', async () => {
      process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'false'; config._resetHwConfig();
      const code = await published();
      expect(await labels(code)).toEqual(['1', '2A', '2B']);   // Q3 and Q4 have figures with no pictures
    });

    it('with written marking on and every picture attached: every question, alternatives knowing each other', async () => {
      process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'false'; config._resetHwConfig();
      const code = await published({ pictures: true });
      const p = (await mine(code))!;
      const qs = (await paperMod.paperQuestions(database, p.paperId))!.questions;
      expect(qs.map((q) => q.label)).toEqual(['1', '2A', '2B', '3C', '3D', '4']);
      expect(qs.find((q) => q.label === '2A')!.alsoOffered).toEqual(['2B']);
      expect(qs.find((q) => q.label === '4')).toMatchObject({ marks: 2, hasDrawing: true, figures: [{ figureId: 'q4-fig1' }] });
      expect(qs.find((q) => q.label === '1')).toMatchObject({ marks: 1, hasDrawing: false, figures: [] });
    });

    it('a teacher also sees the written ones without the eligibility rule, and the visually impaired versions', async () => {
      const code = await published({ pictures: true });
      expect(await labels(code, 'learner')).toEqual(['1']);
      expect(await labels(code, 'teacher')).toEqual(['1', '1-vi', '2A', '2B', '2A-vi', '2B-vi', '3C', '3D', '4']);
    });

    it('never tells a learner the answer: no options, no correct option, no scheme', async () => {
      process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'false'; config._resetHwConfig();
      const code = await published({ pictures: true });
      const json = JSON.stringify(await paperMod.paperQuestions(database, (await mine(code))!.paperId));
      for (const secret of ['Carbon dioxide', 'correctOption', 'Kidney', 'Heart', 'acceptedAnswers', 'parts', 'value_points']) expect(json).not.toContain(secret);
    });
  });

  describe('starting a question', () => {
    it('makes a published one-question assignment in the learner\'s own section, from the bank row, and queues its key', async () => {
      const code = await published({ pictures: true });
      const u = await learner();
      const row = (await rowOf(code, 1))!;
      const r = await paperMod.startPaperAttempt(u, row.id);
      expect(r.reused).toBe(false);
      const a = await one<{ organization_id: string; class_id: string; subject: string; status: string; title: string; total_marks: string }>(`SELECT * FROM hw_assignment WHERE id = $1`, [r.assignmentId]);
      expect(a).toMatchObject({ organization_id: 'virat-gyankosh-practice', class_id: 'vgp-class-10', subject: 'Science', status: 'published' });
      expect(a!.title).toBe('Practice: TESTBOARD Class 10 Science sample paper 2099-00, Q1');
      expect(Number(a!.total_marks)).toBe(1);
      const q = (await one<{ id: string; type: string; marks: string; prompt: string; origin: string; rubric_mode: string; accepted_answers: string[]; origin_ref: Record<string, string> }>(`SELECT * FROM hw_question WHERE assignment_id = $1`, [r.assignmentId]))!;
      expect(q).toMatchObject({ type: 'very_short', origin: 'board_paper', rubric_mode: 'key' });
      expect(Number(q.marks)).toBe(1);
      expect(q.prompt).toContain('C. Carbon dioxide');
      expect(q.prompt).toMatch(/Write the letter of the correct option\.$/);
      expect(q.accepted_answers).toEqual(expect.arrayContaining(['C', '(c)', 'Carbon dioxide']));
      expect(q.origin_ref).toEqual({ kind: 'sqp', session: '2099-00', subjectCode: code, questionNo: '1', board: 'TESTBOARD', classLevel: '10', bankRowId: row.id });
      expect((await one<{ status: string }>(`SELECT status FROM hw_question_key WHERE question_id = $1 AND superseded_at IS NULL`, [q.id]))!.status).toBe('building');
    });

    it('opens the same attempt when the same question is picked twice', async () => {
      const code = await published({ pictures: true });
      const u = await learner();
      const row = (await rowOf(code, 1))!;
      const a = await paperMod.startPaperAttempt(u, row.id);
      expect(await paperMod.startPaperAttempt(u, row.id)).toEqual({ assignmentId: a.assignmentId, reused: true });
    });

    it('a drawing\'s marks are not counted: Q4 is 2 marks here, and says so', async () => {
      process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'false'; config._resetHwConfig();
      const code = await published({ pictures: true });
      const u = await learner();
      const r = await paperMod.startPaperAttempt(u, (await rowOf(code, 4))!.id);
      const q = (await one<{ marks: string; prompt: string; type: string }>(`SELECT * FROM hw_question WHERE assignment_id = $1`, [r.assignmentId]))!;
      expect(Number(q.marks)).toBe(2);
      expect(q.prompt).toContain('Part i asks for a drawing');
    });

    it('refuses what is not on offer, in both languages, and never trusts the browser', async () => {
      const draft = await fresh();
      const u = await learner();
      const err = await paperMod.startPaperAttempt(u, (await rowOf(draft, 1))!.id).catch((e) => e);
      expect(err).toMatchObject({ code: 'NOT_FOUND' });
      expect(/[ऀ-ॿ]/.test(err.publicMessage)).toBe(true);
      await expect(paperMod.startPaperAttempt(u, randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' });
      const code = await published();   // no pictures: Q3 and Q4 are not on offer, and written is not ready
      await expect(paperMod.startPaperAttempt(u, (await rowOf(code, 4))!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(paperMod.startPaperAttempt(u, (await rowOf(code, 1, null, 'vi'))!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(paperMod.startPaperAttempt(u, (await rowOf(code, 2, 'A'))!.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('needs a started trial and respects the attempt limit', async () => {
      const code = await published({ pictures: true });
      const id = `bp-${randomUUID().slice(0, 8)}`;
      userIds.push(id);
      await raw.query(`INSERT INTO "user" (id, name, email, role, created_at) VALUES ($1, 'No Trial', $2, 'student', now())`, [id, `${id}@example.test`]);
      await expect(paperMod.startPaperAttempt(id, (await rowOf(code, 1))!.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      process.env.HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP = 'false'; config._resetHwConfig();
      const u = await learner();
      for (const [n, alt] of [[1, null], [2, 'A'], [2, 'B']] as const) await paperMod.startPaperAttempt(u, (await rowOf(code, n, alt))!.id);
      await expect(paperMod.startPaperAttempt(u, (await rowOf(code, 4))!.id)).rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
    });

    it('the grader marks the multiple-choice answer by code: right, wrong, unclear', async () => {
      const code = await published({ pictures: true });
      const u = await learner();
      const r = await paperMod.startPaperAttempt(u, (await rowOf(code, 1))!.id);
      const qid = (await one<{ id: string }>(`SELECT id FROM hw_question WHERE assignment_id = $1`, [r.assignmentId]))!.id;
      const { gradeWithoutAi } = await import('@/lib/hw/grader/exact-match');
      const q = (await pipeline.loadGradeQuestion(database, qid))!;
      expect(q.choice).toBeTruthy();
      q.rubric = [{ id: 'r1', kind: 'key_point', description: 'The correct option', marks: 1 }];
      expect(gradeWithoutAi(q, 'a', 'c')).toMatchObject({ suggestedMarks: 1 });
      expect(gradeWithoutAi(q, 'a', 'A. Oxygen')).toMatchObject({ suggestedMarks: 0, model: 'rule:choice_wrong' });
      expect(gradeWithoutAi(q, 'a', 'A or C')).toBeNull();
      // once the row is no longer checked, the question is just a question again
      await rstore.setPublished(database, identOf(code), false, { actor: 'owner' });
      await rstore.applyReview(database, { format: REVIEW_FORMAT, paper: identOf(code), reviewer: 'Mrs Rao', verdicts: [{ q: 1, alt: null, variant: null, content_hash: (await rowOf(code, 1))!.content_hash, verdict: 'fix', confirmed: [], note: 'option B is wrong' }] }, { recordedBy: 'op' });
      expect((await pipeline.loadGradeQuestion(database, qid))!.choice).toBeUndefined();
    });
  });
});
