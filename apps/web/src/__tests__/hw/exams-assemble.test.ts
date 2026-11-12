// Exam packages, phase 5: parsing the page reader's and the answer matcher's output, and turning page reads into one transcript per question
// (all pure).

import { parseAnswerMatch, parsePageRead, type PageRead } from '@/lib/hw/exams/page-reader';
import { assembleBooklet, choiceLetter, optionFromWords, withoutLabel, type AssembleQuestion } from '@/lib/hw/exams/assemble';

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

describe('choiceLetter', () => {
  it.each([['B', 'B'], ['(B) virtual', 'B'], ['b) virtual and erect', 'B'], ['C.', 'C'], ['Ans: D', 'D'], ['answer - (a)', 'A'], [' ( c ) ', 'C']])('%s -> %s', (t, l) => expect(choiceLetter(t)).toBe(l));
  it.each([['A virtual image'], ['Because light bends'], ['virtual'], ['E'], ['']])('%s -> no letter', (t) => expect(choiceLetter(t)).toBeNull());
});

describe('withoutLabel', () => {
  it.each([
    ['Q2. (B) virtual', 2, '(B) virtual'], ['q12 Light bends', 12, 'Light bends'], ['Question 4: F = ma', 4, 'F = ma'], ['Ans 7 - the cell', 7, 'the cell'],
    ['12) Light bends', 12, 'Light bends'], ['3 moles of gas', 3, '3 moles of gas'], ['Q13 is not this one', 1, 'Q13 is not this one'], ['Q2 (A) Heart', 2, '(A) Heart'],
  ])('%s (Q%d) -> %s', (t, n, out) => expect(withoutLabel(t, n)).toBe(out));
});

describe('unclear markers', () => {
  it('[??] counts as one unreadable stretch, like [?]', () => {
    expect(parsePageRead({ sheet: null, grid: [], segments: [{ box: [], written_numbers: [], alternative: null, text: '[?] the [??] end', confidence: 'low' }] }).segments[0]!.unclearCount).toBe(2);
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

  it('a multiple-choice answer written with words keeps only its letter; the words go in the note', () => {
    const r = assembleBooklet({ ...base, questions, pages: [page(0, { segments: [seg({ numbersSeen: [{ number: 1, confidence: 0.95 }], text: '(B) virtual and erect' })] })] });
    expect(r.answers.get('a1')).toMatchObject({ status: 'done', text: 'B' });
    expect(r.answers.get('a1')!.note).toMatch(/written: \(B\) virtual and erect$/);
  });

  it('the label the learner wrote is taken off; a choice answer that names no option goes to a person', () => {
    const r = assembleBooklet({ ...base, questions, pages: [page(0, { segments: [
      seg({ numbersSeen: [{ number: 1, confidence: 0.95 }], text: 'Q1. virtual' }),
      seg({ numbersSeen: [{ number: 3, confidence: 0.95 }], text: 'Q3. Grass is a producer' }),
    ] })] });
    expect(r.answers.get('a3')).toMatchObject({ status: 'done', text: 'Grass is a producer' });
    expect(r.answers.get('a1')).toMatchObject({ status: 'needs_review', text: 'virtual' });
    expect(r.answers.get('a1')!.note).toMatch(/^could not tell which option was chosen/);
  });

  it('hard-to-read writing goes to a person even when it is placed', () => {
    const r = assembleBooklet({ ...base, questions, pages: [page(0, { sheet: { code: 'C3F245', page: 1 }, segments: [seg({ box: [3], text: 'scrawl [?] [?]', confidence: 0.4, unclearCount: 2 })] })] });
    expect(r.answers.get('a3')).toMatchObject({ status: 'needs_review', unclearCount: 2, confidence: 0.4 });
    expect(r.answers.get('a3')!.note).toMatch(/^hard to read/);
  });
});

// Real handwriting (docs/hw-eval/real-handwriting-read-1.md): ticked letters and question numbers were misread at 0.95 confidence.
describe('the checks added after the real-handwriting measurement', () => {
  const opts = [
    { letter: 'A', text: 'Na2O and K2O' }, { letter: 'B', text: 'Al₂O₃ and MgO' },
    { letter: 'C', text: 'ZnO and CaO' }, { letter: 'D', text: 'Cytoplasm and oxygen-deficient muscle cells' },
  ];
  const ar = [
    { letter: 'A', text: 'Both A and R are true, and R is the correct explanation of A.' },
    { letter: 'B', text: 'Both A and R are true, and R is not the correct explanation of A.' },
    { letter: 'C', text: 'A is true but R is false.' }, { letter: 'D', text: 'A is false but R is true.' },
  ];

  describe('optionFromWords', () => {
    it('finds the option the words are, whatever the case, hyphens or subscripts', () => {
      expect(optionFromWords('Al2O3 and MgO', opts)).toBe('B');
      expect(optionFromWords('Cytoplasm and Oxygen deficient muscle cells', opts)).toBe('D');
      expect(optionFromWords('5', [{ letter: 'A', text: '3' }, { letter: 'B', text: '4' }, { letter: 'C', text: '5' }, { letter: 'D', text: '6' }])).toBe('C');
    });
    it('says nothing when the words do not clearly point at one option', () => {
      expect(optionFromWords('Both A and R are true, and R is the correct explanation of A', ar)).toBeNull(); // A and B differ by one word
      expect(optionFromWords('oxides', opts)).toBeNull();
      expect(optionFromWords('', opts)).toBeNull();
      expect(optionFromWords('anything', [{ letter: 'A', text: '' }, { letter: 'B', text: '' }])).toBeNull(); // options drawn in a figure
    });
  });

  it('a letter read as one option, with words that are another option, goes to a person', () => {
    const qs = [Q('m6', 6, { choice: true, options: opts }), Q('m8', 8, { choice: true, options: opts })];
    const r = assembleBooklet({ ...base, questions: qs, matches: new Map(), pages: [page(0, { segments: [
      seg({ numbersSeen: [{ number: 6, confidence: 0.95 }], text: '(A) Al₂O₃ and MgO' }),
      seg({ numbersSeen: [{ number: 8, confidence: 0.95 }], text: '(D) Cytoplasm and Oxygen deficient muscle cells' }),
    ] })] });
    expect(r.answers.get('m6')).toMatchObject({ status: 'needs_review', text: 'A' });
    expect(r.answers.get('m6')!.note).toContain("the letter was read as A but the words written are option B's");
    expect(r.answers.get('m8')).toMatchObject({ status: 'done', text: 'D' }); // words and letter agree
  });

  it('a letter the reader gave only in its "alternative" field is the answer; the words are still checked', () => {
    const qs = [Q('m1', 1, { choice: true, options: opts }), Q('m6', 6, { choice: true, options: opts }), Q('m7', 7, { choice: true })];
    const r = assembleBooklet({ ...base, questions: qs, matches: new Map(), pages: [page(0, { segments: [
      seg({ numbersSeen: [{ number: 1, confidence: 0.95 }], alternative: 'C', text: 'ZnO and CaO' }),
      seg({ numbersSeen: [{ number: 6, confidence: 0.95 }], alternative: 'A', text: 'Al₂O₃ and MgO' }),
      seg({ numbersSeen: [{ number: 7, confidence: 0.95 }], text: 'ZnO and CaO' }),
    ] })] });
    expect(r.answers.get('m1')).toMatchObject({ status: 'done', text: 'C' });
    expect(r.answers.get('m6')).toMatchObject({ status: 'needs_review', text: 'A' });
    expect(r.answers.get('m7')).toMatchObject({ status: 'needs_review', note: expect.stringContaining('could not tell which option was chosen') });
  });

  it('no options, a letter alone, or words that fit no option: no check, as before', () => {
    const qs = [Q('x1', 1, { choice: true }), Q('x2', 2, { choice: true, options: opts }), Q('x3', 3, { choice: true, options: opts })];
    const r = assembleBooklet({ ...base, questions: qs, matches: new Map(), pages: [page(0, { segments: [
      seg({ numbersSeen: [{ number: 1, confidence: 0.95 }], text: '(A) Al₂O₃ and MgO' }),
      seg({ numbersSeen: [{ number: 2, confidence: 0.95 }], text: '(C)' }),
      seg({ numbersSeen: [{ number: 3, confidence: 0.95 }], text: '(C) because it is amphoteric' }),
    ] })] });
    expect([...r.answers.values()].map((a) => [a.status, a.text])).toEqual([['done', 'A'], ['done', 'C'], ['done', 'C']]);
  });

  it('every answer placed by a written number is also sent to the answer-key matcher; one placed by a printed box is not', () => {
    const questions = [Q('a3', 3), Q('a4', 4)];
    const r = assembleBooklet({ ...base, questions, pages: [
      page(0, { sheet: { code: 'C3F245', page: 1 }, segments: [seg({ box: [3], text: 'Grass is a producer' })] }),
      page(1, { segments: [seg({ numbersSeen: [{ number: 4, confidence: 0.95 }], text: '2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O' })] }),
    ] });
    expect(r.needMatch).toEqual([{ id: 'p1s0', text: '2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O' }]);
    expect(r.answers.get('a4')).toMatchObject({ status: 'done' }); // placed by its number until the matcher says otherwise
  });

  it('"Q.26" read as 20: the answer reads like Q26, so a person decides instead of filing it under Q20', () => {
    const qs = [Q('q20', 20, { choice: true }), Q('q26', 26)];
    const pages = [page(0, { segments: [seg({ numbersSeen: [{ number: 20, confidence: 0.95 }], text: '(a) 2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O' })] })];
    const r = assembleBooklet({ ...base, questions: qs, pages, matches: new Map([['p0s0', [{ number: 26, score: 0.95 }, { number: 20, score: 0.05 }]]]) });
    expect(r.review).toEqual([expect.objectContaining({ reason: 'numbers_disagree', detail: 'numbered Q20 but reads like the answer to Q26' })]);
    expect(r.answers.get('q20')!.status).toBe('needs_review');
    expect(r.answers.get('q26')!.status).toBe('needs_review');
  });

  it('a written number the content agrees with is kept', () => {
    const qs = [Q('q20', 20, { choice: true }), Q('q26', 26)];
    const pages = [page(0, { segments: [seg({ numbersSeen: [{ number: 26, confidence: 0.95 }], text: '(a) 2HNO3 + Ca(OH)2 -> Ca(NO3)2 + 2H2O' })] })];
    const r = assembleBooklet({ ...base, questions: qs, pages, matches: new Map([['p0s0', [{ number: 26, score: 0.95 }, { number: 20, score: 0.05 }]]]) });
    expect(r.review).toEqual([]);
    expect(r.answers.get('q26')).toMatchObject({ status: 'done' });
    expect(r.answers.get('q20')).toMatchObject({ status: 'blank' });
  });
});
