// Exam packages, phase 2: the publish checks for a set and a package (pure).

import { attainableMarks, authoredProblems, describeSetProblem, packageProblems, setProblems, type ItemFacts } from '@/lib/hw/exams/build-rules';
import { durationFromPaper } from '@/lib/hw/exams/builder';

const item = (number: number, marks: number, over: Partial<ItemFacts> = {}): ItemFacts =>
  ({ id: `i${number}${over.choiceGroup ?? ''}${marks}`, number, marks, choiceGroup: null, bankStatus: null, ...over });
const full = { kind: 'mock_full' as const, maxMarks: 10, syllabusScope: [] };

describe('attainableMarks', () => {
  it('adds every question once', () => {
    expect(attainableMarks([item(1, 1), item(2, 2), item(3, 3), item(4, 4)])).toBe(10);
  });
  it('counts an internal choice once, at its highest mark', () => {
    expect(attainableMarks([item(1, 2), item(2, 3, { choiceGroup: 'g2' }), item(2, 3, { choiceGroup: 'g2' })])).toBe(5);
    expect(attainableMarks([item(5, 2, { choiceGroup: 'x' }), item(6, 3, { choiceGroup: 'x' })])).toBe(3);
  });
  it('alternatives without a group still count once, by question number', () => {
    expect(attainableMarks([item(1, 2), item(1, 2)])).toBe(2);
  });
  it('keeps half marks', () => {
    expect(attainableMarks([item(1, 0.5), item(2, 1.5)])).toBe(2);
  });
});

describe('setProblems', () => {
  it('a complete set has none', () => {
    expect(setProblems(full, [item(1, 1), item(2, 2), item(3, 3), item(4, 4)])).toEqual([]);
  });
  it('an empty set says only that', () => {
    expect(setProblems(full, [])).toEqual([{ code: 'no_items' }]);
  });
  it('marks that do not add up to the paper', () => {
    expect(setProblems(full, [item(1, 1), item(2, 2)])).toEqual([{ code: 'marks_mismatch', total: 3, maxMarks: 10 }]);
  });
  it('a bank row that is checked but not published', () => {
    const ps = setProblems(full, [item(1, 1), item(2, 2), item(3, 3, { bankStatus: 'checked' }), item(4, 4, { bankStatus: 'published' })]);
    expect(ps).toEqual([{ code: 'bank_row_not_published', itemId: expect.any(String), number: 3, status: 'checked' }]);
  });
  it('a gap in the numbering', () => {
    expect(setProblems(full, [item(1, 4), item(3, 6)])).toEqual([{ code: 'number_gap', missing: [2] }]);
  });
  it('a half-syllabus mock with no chapters', () => {
    expect(setProblems({ ...full, kind: 'mock_half' }, [item(1, 10)])).toEqual([{ code: 'no_scope' }]);
  });
  it('every problem has a readable line', () => {
    for (const p of [...setProblems(full, []), ...setProblems({ ...full, kind: 'mock_half' }, [item(2, 1, { bankStatus: 'draft' })])]) {
      expect(describeSetProblem(p)).toMatch(/\w/);
    }
    expect(describeSetProblem({ code: 'number_gap', missing: [2, 5] })).toBe('Question numbers 2, 5 are missing.');
  });
});

describe('packageProblems', () => {
  it('needs at least one published set', () => {
    expect(packageProblems([])).toEqual([{ code: 'no_published_set' }]);
    expect(packageProblems([{ status: 'draft' }, { status: 'retired' }])).toEqual([{ code: 'no_published_set' }]);
    expect(packageProblems([{ status: 'draft' }, { status: 'published' }])).toEqual([]);
  });
});

describe('durationFromPaper', () => {
  it.each([
    ['3 Hours', 180], ['3 hrs', 180], ['1 hour', 60], ['2½ hours', 150], ['2.5 hours', 150], ['90 minutes', 90], ['1 hour 30 minutes', 90], ['Time: 3 Hrs.', 180],
  ])('%s → %d', (t, m) => expect(durationFromPaper(t)).toBe(m));
  it.each([[null], [''], ['Max marks 80']])('%s → null', (t) => expect(durationFromPaper(t)).toBeNull());
});

describe('authoredProblems', () => {
  const vp = (marks: number) => ({ id: `v${marks}`, text: 'point', marks, quote: '' });
  it('a written question whose points add up has none', () => {
    expect(authoredProblems({ qtype: 'short', marks: 3, parts: [{ label: '', marks: 3, value_points: [vp(1), vp(2)] }] })).toEqual([]);
  });
  it('points that do not add up to their part', () => {
    expect(authoredProblems({ qtype: 'short', marks: 3, parts: [{ label: '', marks: 3, value_points: [vp(1), vp(1)] }] }))
      .toEqual(['The answer: the value points add up to 2, but the part is worth 3.']);
  });
  it('parts that do not add up to the question; an alternative label counts once', () => {
    expect(authoredProblems({ qtype: 'long', marks: 5, parts: [
      { label: 'a', marks: 2, value_points: [vp(2)] }, { label: 'b', marks: 3, value_points: [vp(3)] }, { label: 'b', marks: 3, value_points: [vp(3)] },
    ] })).toEqual([]);
    expect(authoredProblems({ qtype: 'long', marks: 5, parts: [{ label: 'a', marks: 2, value_points: [vp(2)] }] }))
      .toEqual(['The parts add up to 2 marks, but the question is worth 5.']);
  });
  it('a part with no points, and a written question with no parts', () => {
    expect(authoredProblems({ qtype: 'short', marks: 2, parts: [] })).toEqual(['A written question needs at least one part with its value points.']);
    expect(authoredProblems({ qtype: 'short', marks: 2, parts: [{ label: 'a', marks: 2, value_points: [] }] })[0]).toBe('Part (a) has no value points.');
  });
  it('a multiple choice needs four options and the right one', () => {
    expect(authoredProblems({ qtype: 'mcq', marks: 1, options: ['a', 'b', 'c', 'd'], correctOption: 'B' })).toEqual([]);
    expect(authoredProblems({ qtype: 'mcq', marks: 1, options: ['a', 'b'], correctOption: null }))
      .toEqual(['A multiple choice question needs exactly four options.', 'Say which option is right.']);
  });
});
