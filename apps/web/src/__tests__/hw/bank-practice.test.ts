// The board-paper bank, phase 4: the rules of practising from a paper, without a database (bank-practice-db.test.ts has the database side).

import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank } from '@/lib/hw/bank/expand';
import { MAX_FIGURE_BYTES, sniffImage } from '@/lib/hw/bank/figures';
import { markingPlanOf } from '@/lib/hw/bank/official';
import { answerLinesOf, attemptTitle, hwTypeOf, offerVerdict, originRefOf, promptOf, type PaperHeader, type PaperRowLike } from '@/lib/hw/practice/paper-rules';
import { assertHwKey, bankFigureKey, keyVersion } from '@/lib/hw/storage/keys';
import { gradeWithoutAi, CHOICE_WRONG_MODEL, EXACT_MATCH_MODEL } from '@/lib/hw/grader/exact-match';
import { isRuleModel } from '@/lib/hw/eligibility/decision';
import type { GradeQuestion } from '@/lib/hw/grader/types';

// ── pictures ─────────────────────────────────────────────────────────────────
const bytes = (head: number[], total = 64) => Uint8Array.from([...head, ...new Array(Math.max(0, total - head.length)).fill(0)]);
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const png = (w: number, h: number) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(w), ...be32(h), 8, 2, 0, 0, 0]);
const jpeg = (w: number, h: number) => bytes([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3]);
const webpX = (w: number, h: number) => bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0, 0, 0, 0, (w - 1) & 255, ((w - 1) >> 8) & 255, 0, (h - 1) & 255, ((h - 1) >> 8) & 255, 0]);

describe('figure pictures', () => {
  it('reads the type and size from the bytes', () => {
    expect(sniffImage(png(320, 200))).toEqual({ mime: 'image/png', ext: 'png', width: 320, height: 200, bytes: 64 });
    expect(sniffImage(jpeg(640, 480))).toMatchObject({ mime: 'image/jpeg', ext: 'jpg', width: 640, height: 480 });
    expect(sniffImage(webpX(300, 150))).toMatchObject({ mime: 'image/webp', ext: 'webp', width: 300, height: 150 });
  });
  it('is not fooled by a name: a GIF, a PDF or text is refused', () => {
    expect(sniffImage(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toEqual({ problem: expect.stringMatching(/not a PNG, JPEG or WebP/) });
    expect(sniffImage(bytes([0x25, 0x50, 0x44, 0x46]))).toEqual({ problem: expect.stringMatching(/not a PNG/) });
    expect(sniffImage(new TextEncoder().encode('<svg onload=alert(1)>'.padEnd(40)))).toEqual({ problem: expect.stringMatching(/not a PNG/) });
  });
  it('refuses empty, too big, too small and too large pictures, saying why', () => {
    expect(sniffImage(new Uint8Array())).toEqual({ problem: 'the file is empty' });
    expect(sniffImage(new Uint8Array(MAX_FIGURE_BYTES + 1))).toEqual({ problem: expect.stringMatching(/MB; the limit is 3 MB/) });
    expect(sniffImage(png(20, 200))).toEqual({ problem: expect.stringMatching(/at least 40 pixels/) });
    expect(sniffImage(png(5000, 200))).toEqual({ problem: expect.stringMatching(/at most 4000 pixels/) });
    expect(sniffImage(png(0, 0))).toEqual({ problem: expect.stringMatching(/size of the picture/) });
  });
  it('keeps figure pictures under their own private prefix, and still refuses anything else', () => {
    const k = bankFigureKey('3f2a-9b', 2, 'png');
    expect(k).toBe('hw-bank/3f2a-9b.v2.png');
    expect(assertHwKey(k)).toBe(k);
    expect(keyVersion(k)).toBe(2);
    expect(() => assertHwKey('hw-bank/../hw-assignments/x')).toThrow(/refusing/);
    expect(() => assertHwKey('other-app/x.png')).toThrow(/refusing/);
    expect(() => bankFigureKey('a/b', 1, 'png')).toThrow(/unsafe/);
    expect(() => bankFigureKey('ok', 0, 'png')).toThrow(/version/);
  });
});

// ── which rows are offered ───────────────────────────────────────────────────
const rows: PaperRowLike[] = expandBank(cloneBank()).questions.map((q, i) => ({
  id: `row-${i}`, number: q.number, alt: q.alt, variant: q.variant, section: q.section, qtype: q.qtype, marks: q.marks, stem: q.stem, options: q.options,
  correctOption: q.correctOption, parts: q.parts as PaperRowLike['parts'], status: 'published',
}));
const find = (n: number, alt: string | null = null, v: string | null = null) => rows.find((r) => r.number === n && r.alt === alt && r.variant === v)!;
const header: PaperHeader = { board: 'TESTBOARD', classLevel: 10, subject: 'Science', subjectCode: 'T-001', session: '2099-00', kind: 'sqp' };

describe('which rows a learner is offered', () => {
  it('a published multiple-choice row, always (it is marked by code)', () => {
    const v = offerVerdict(find(1), [], false);
    expect(v).toMatchObject({ ok: true, plan: { mode: 'exact', markableMarks: 1 } });
  });
  it('a published written row only when written answers can be marked', () => {
    expect(offerVerdict(find(2, 'B'), [], false)).toEqual({ ok: false, why: 'written_not_ready' });
    expect(offerVerdict(find(2, 'B'), [], true)).toMatchObject({ ok: true, plan: { mode: 'ai', markableMarks: 2 } });
  });
  it('not a draft, checked or rejected row, and not the visually impaired version', () => {
    for (const status of ['draft', 'checked', 'rejected'] as const) expect(offerVerdict({ ...find(1), status }, [], true)).toEqual({ ok: false, why: 'not_published' });
    expect(offerVerdict(find(1, null, 'vi'), [], true)).toEqual({ ok: false, why: 'visually_impaired' });
    expect(offerVerdict(find(1, null, 'vi'), [], true, { allowVisuallyImpaired: true })).toMatchObject({ ok: true });
  });
  it('not while a figure the question shows has no picture; a figure of the marking scheme does not matter', () => {
    expect(offerVerdict(find(3, 'C'), [{ side: 'paper', hasImage: false }], true)).toEqual({ ok: false, why: 'figure_missing' });
    expect(offerVerdict(find(3, 'C'), [{ side: 'paper', hasImage: true }], true)).toMatchObject({ ok: true });
    expect(offerVerdict(find(3, 'C'), [{ side: 'scheme', hasImage: false }], true)).toMatchObject({ ok: true });
  });
  it('not a row that is only a drawing', () => {
    const r = find(4);
    expect(offerVerdict({ ...r, parts: r.parts.filter((p) => p.answer_kind === 'diagram') }, [], true)).toEqual({ ok: false, why: 'nothing_markable' });
  });
  it('says when a row cannot be turned into a key', () => {
    expect(offerVerdict({ ...find(1), correctOption: null }, [], true)).toMatchObject({ ok: false, why: 'unusable' });
  });
});

describe('the question made from a row', () => {
  const plan = (r: PaperRowLike) => { const x = markingPlanOf(r); if (!x.ok) throw new Error(x.problems.join('; ')); return x.plan; };
  it('a multiple-choice question lists its options and asks for the letter', () => {
    expect(promptOf(find(1), plan(find(1)))).toBe('Which gas do plants take in?\n\nA. Oxygen\nB. Nitrogen\nC. Carbon dioxide\nD. Helium\n\nWrite the letter of the correct option.');
  });
  it('options drawn in a figure are not listed', () => {
    const drawn = { ...find(1), options: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, text: '' })) };
    expect(promptOf(drawn, plan(drawn))).toBe('Which gas do plants take in?\n\nThe options A, B, C and D are shown in the figure.\n\nWrite the letter of the correct option.');
  });
  it('a drawing the app does not mark is said plainly, and its marks are not counted', () => {
    const p = promptOf(find(4), plan(find(4)));
    expect(p).toContain('(Part i asks for a drawing. Draw it on paper: it is not marked here, and the marks for it are not counted.)');
    expect(plan(find(4)).markableMarks).toBe(2);
  });
  it('a written question is the paper\'s own words and nothing else', () => {
    expect(promptOf(find(2, 'B'), plan(find(2, 'B')))).toBe('B. Name the organ that filters blood.');
  });
  it('types, lines, title and the reference the key is looked up by', () => {
    expect(['mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based'].map(hwTypeOf)).toEqual(['very_short', 'very_short', 'very_short', 'short', 'long', 'long']);
    expect([hwTypeOf('mcq'), hwTypeOf('short'), hwTypeOf('long')].map(answerLinesOf)).toEqual([3, 6, 12]);
    expect(attemptTitle(header, find(3, 'C'))).toBe('Practice: TESTBOARD Class 10 Science sample paper 2099-00, Q3C');
    expect(originRefOf(header, find(3, 'C'))).toEqual({ kind: 'sqp', session: '2099-00', subjectCode: 'T-001', questionNo: '3C', board: 'TESTBOARD', classLevel: '10', bankRowId: find(3, 'C').id });
  });
});

// ── marking a multiple-choice answer by code ─────────────────────────────────
describe('a multiple-choice answer is marked by code', () => {
  const p = markingPlanOf(find(1));
  const q = (over: Partial<GradeQuestion> = {}): GradeQuestion => ({
    id: 'q', type: 'very_short', prompt: 'x', marks: 1, modelAnswer: null, acceptedAnswers: [], rubricVersion: 1,
    rubric: [{ id: 'r1', kind: 'key_point', description: 'The correct option', marks: 1 }],
    choice: p.ok ? { acceptedAnswers: p.plan.acceptedAnswers, wrongAnswers: p.plan.wrongAnswers } : undefined, ...over,
  });
  it('the right option gets full marks, by rule', () => {
    const r = gradeWithoutAi(q(), 'a1', '(c)')!;
    expect(r).toMatchObject({ model: EXACT_MATCH_MODEL, suggestedMarks: 1, items: [{ rubric_item_id: 'r1', verdict: 'met', marks: 1 }] });
    expect(gradeWithoutAi(q(), 'a1', 'Carbon dioxide.')!.suggestedMarks).toBe(1);
  });
  it('a wrong option gets 0, by rule, with no model', () => {
    const r = gradeWithoutAi(q(), 'a1', 'B. Nitrogen')!;
    expect(r).toMatchObject({ model: CHOICE_WRONG_MODEL, suggestedMarks: 0, items: [{ verdict: 'missing', marks: 0 }] });
    expect(gradeWithoutAi(q(), 'a1', 'a')!.suggestedMarks).toBe(0);
    expect(isRuleModel(CHOICE_WRONG_MODEL)).toBe(true);
  });
  it('anything unclear is not guessed: it goes on as any other answer', () => {
    for (const t of ['A or C', 'I think the gas is carbon dioxide', 'E']) expect(gradeWithoutAi(q(), 'a1', t)).toBeNull();
  });
  it('a blank answer is still blank, and a question that is not from the bank is untouched', () => {
    expect(gradeWithoutAi(q(), 'a1', '  ')).toMatchObject({ model: 'rule:blank', suggestedMarks: 0 });
    expect(gradeWithoutAi(q({ choice: undefined }), 'a1', 'B')).toBeNull();
  });
});
