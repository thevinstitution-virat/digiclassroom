// Exam packages, phase 5: parsing the page reader's and the answer matcher's output, and turning page reads into one transcript per question
// (all pure).

import { parseAnswerMatch, parsePageRead, type PageRead } from '@/lib/hw/exams/page-reader';
import { assembleBooklet, type AssembleQuestion } from '@/lib/hw/exams/assemble';

describe('parsePageRead', () => {
  it('reads a well-formed page', () => {
    const r = parsePageRead({
      sheet: { code: 'c3f-245', page: 2 },
      grid: [{ number: 1, letter: 'b' }, { number: 2, letter: null }],
      segments: [{ box: ['Q4'], written_numbers: [{ number: 4, confidence: 'high' }], alternative: 'b', text: ' Light bends [?] here ', confidence: 'medium' }],
    });
    expect(r).toEqual({
      sheet: { code: 'C3F245', page: 2 },
      grid: [{ number: 1, letter: 'B' }, { number: 2, letter: null }],
      segments: [{ box: [4], numbersSeen: [{ number: 4, confidence: 0.95 }], alternative: 'B', text: 'Light bends [?] here', confidence: 0.75, unclearCount: 1 }],
    });
  });
  it('anything malformed becomes empty or low confidence, never an exception', () => {
    expect(parsePageRead(null)).toEqual({ sheet: null, grid: [], segments: [] });
    expect(parsePageRead({ sheet: { code: 'X', page: 0 }, grid: [{ number: 'one' }], segments: [{ text: 'hello', confidence: 'certain', box: 'Q1' }, 7, {}] }))
      .toEqual({ sheet: null, grid: [], segments: [{ box: [], numbersSeen: [], alternative: null, text: 'hello', confidence: 0.4, unclearCount: 0 }] });
  });
});

describe('parseAnswerMatch', () => {
  it('keeps only asked answers and questions on the paper, clamps scores, one score per question', () => {
    const m = parseAnswerMatch({ answers: [
      { id: 'a', matches: [{ number: 3, score: 0.8 }, { number: 3, score: 0.9 }, { number: 99, score: 1 }, { number: 1, score: 7 }] },
      { id: 'zzz', matches: [{ number: 1, score: 1 }] },
    ] }, ['a', 'b'], [1, 2, 3]);
    expect(m.get('a')).toEqual([{ number: 3, score: 0.9 }, { number: 1, score: 1 }]);
    expect(m.get('b')).toEqual([]);
    expect(m.has('zzz')).toBe(false);
  });
});

const Q = (answerId: string, number: number, over: Partial<AssembleQuestion> = {}): AssembleQuestion => ({ answerId, number, alt: null, choice: false, ...over });
const seg = (over: Partial<PageRead['segments'][number]> = {}): PageRead['segments'][number] =>
  ({ box: [], numbersSeen: [], alternative: null, text: 'some answer', confidence: 0.95, unclearCount: 0, ...over });
const page = (position: number, read: Partial<PageRead>) => ({ pageId: `page${position}`, position, read: { sheet: null, grid: [], segments: [], ...read } });
const base = { code: 'C3F245', sheetPageNumbers: new Map([[1, [1, 2, 3]], [2, [4]], [3, []]]), minConfidence: 0.7 };

describe('assembleBooklet', () => {
  const questions = [Q('a1', 1, { choice: true }), Q('a2A', 2, { alt: 'A' }), Q('a2B', 2, { alt: 'B' }), Q('a3', 3), Q('a4', 4)];

  it('a printed sheet: the grid gives the letter, boxes give the rest, the untaken alternative and an empty box are blank', () => {
    const r = assembleBooklet({ ...base, questions, pages: [
      page(0, { sheet: { code: 'C3F245', page: 1 }, grid: [{ number: 1, letter: 'B' }], segments: [seg({ box: [2], alternative: 'B', text: 'Kidney' }), seg({ box: [3], text: 'Grass is a producer' })] }),
    ] });
    expect(r.answers.get('a1')).toMatchObject({ status: 'done', text: 'B' });
    expect(r.answers.get('a2B')).toMatchObject({ status: 'done', text: 'Kidney' });
    expect(r.answers.get('a2A')).toMatchObject({ status: 'blank', note: 'not attempted' });
    expect(r.answers.get('a3')).toMatchObject({ status: 'done', text: 'Grass is a producer' });
    expect(r.answers.get('a4')).toMatchObject({ status: 'blank' });
    expect(r.needMatch).toEqual([]);
  });

  it('an answer continued on an extra page is joined to its question, in page order', () => {
    const r = assembleBooklet({ ...base, questions, pages: [
      page(1, { sheet: { code: 'C3F245', page: 3 }, segments: [seg({ numbersSeen: [{ number: 4, confidence: 0.95 }], text: 'second half' })] }),
      page(0, { sheet: { code: 'C3F245', page: 2 }, segments: [seg({ box: [4], text: 'first half' })] }),
    ] });
    expect(r.answers.get('a4')).toMatchObject({ status: 'done', text: 'first half\n\nsecond half' });
  });

  it('alternatives with no letter shown go to review, not to a guess', () => {
    const r = assembleBooklet({ ...base, questions, pages: [page(0, { sheet: { code: 'C3F245', page: 1 }, segments: [seg({ box: [2], text: 'Heart' })] })] });
    expect(r.review).toEqual([expect.objectContaining({ reason: 'alternative_unknown' })]);
    expect(r.answers.get('a2A')!.status).toBe('needs_review');
    expect(r.answers.get('a2B')!.status).toBe('needs_review');
  });

  it('plain paper without a number: asks for a match, then places the answer by it', () => {
    const pages = [page(0, { segments: [seg({ text: 'Producers make food from sunlight' })] })];
    const first = assembleBooklet({ ...base, questions, pages });
    expect(first.needMatch).toEqual([{ id: 'p0s0', text: 'Producers make food from sunlight' }]);
    expect(first.answers.get('a3')!.status).toBe('needs_review'); // unplaced writing: blanks are not trusted yet
    const second = assembleBooklet({ ...base, questions, pages, matches: new Map([['p0s0', [{ number: 3, score: 0.85 }, { number: 4, score: 0.3 }]]]) });
    expect(second.needMatch).toEqual([]);
    expect(second.answers.get('a3')).toMatchObject({ status: 'done', text: 'Producers make food from sunlight' });
    expect(second.answers.get('a4')).toMatchObject({ status: 'blank' });
  });

  it('writing that stays unplaced keeps every blank question in review', () => {
    const pages = [page(0, { segments: [seg({ text: 'something' })] })];
    const r = assembleBooklet({ ...base, questions, pages, matches: new Map([['p0s0', [{ number: 3, score: 0.5 }, { number: 4, score: 0.45 }]]]) });
    expect([...r.answers.values()].every((a) => a.status === 'needs_review')).toBe(true);
  });

  it('hard-to-read writing goes to a person even when it is placed', () => {
    const r = assembleBooklet({ ...base, questions, pages: [page(0, { sheet: { code: 'C3F245', page: 1 }, segments: [seg({ box: [3], text: 'scrawl [?] [?]', confidence: 0.4, unclearCount: 2 })] })] });
    expect(r.answers.get('a3')).toMatchObject({ status: 'needs_review', unclearCount: 2, confidence: 0.4 });
    expect(r.answers.get('a3')!.note).toMatch(/^hard to read/);
  });
});
