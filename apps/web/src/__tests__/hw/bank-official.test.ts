// The board-paper bank, phase 3: a checked row as an official answer key, without a database (bank-official-db.test.ts has the lookup).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank, type ExpandedQuestion } from '@/lib/hw/bank/expand';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { validateBank } from '@/lib/hw/bank/validate';
import { planAnyN, type AnyNPart } from '@/lib/hw/bank/anyn';
import { choiceVerdict, markingPlanOf, parseQuestionNo, questionNoOf, type OfficialRow } from '@/lib/hw/bank/official';
import { checkKey } from '@/lib/hw/keys/checks';

const rowOf = (q: ExpandedQuestion): OfficialRow => ({
  number: q.number, alt: q.alt, variant: q.variant, qtype: q.qtype, marks: q.marks, options: q.options, correctOption: q.correctOption, parts: q.parts as OfficialRow['parts'],
});
const fixture = expandBank(cloneBank()).questions.map(rowOf);
const find = (n: number, alt: string | null = null, v: string | null = null) => fixture.find((r) => r.number === n && r.alt === alt && r.variant === v)!;
const planOf = (r: OfficialRow) => {
  const x = markingPlanOf(r);
  if (!x.ok) throw new Error(x.problems.join('; '));
  return x.plan;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('question numbers', () => {
  it.each([
    ['26', 26, null, null], ['Q26', 26, null, null], ['26A', 26, 'A', null], ['26 a', 26, 'A', null], ['q3c', 3, 'C', null],
    ['26A-vi', 26, 'A', 'vi'], ['26 (vi)', 26, null, 'vi'], ['1-vi', 1, null, 'vi'],
  ])('reads %s', (s, number, alt, variant) => expect(parseQuestionNo(s)).toEqual({ number, alt, variant }));
  it.each(['', 'A', '26E', '26-x', '2 6', 'question 4', '1000'])('refuses "%s"', (s) => expect(parseQuestionNo(s)).toBeNull());
  it('writes a row the way it is read back', () => {
    expect(questionNoOf({ number: 26, alt: 'A', variant: 'vi' })).toBe('26A-vi');
    expect(parseQuestionNo(questionNoOf({ number: 3, alt: 'D', variant: null }))).toEqual({ number: 3, alt: 'D', variant: null });
  });
});

describe('multiple choice, marked by code', () => {
  const plan = planOf(find(1));
  it('is an exact-match question with one point for all of its marks', () => {
    expect(plan).toMatchObject({ mode: 'exact', markableMarks: 1, excluded: [] });
    expect(plan.key!.valuePoints).toHaveLength(1);
    expect(plan.key!.valuePoints[0]).toMatchObject({ marks: 1, cites: [] });
    expect(plan.key!.referenceAnswer).toBe('C. Carbon dioxide');
    expect(checkKey(plan.key!, new Set(), 1, { requireCites: false })).toEqual([]);
  });
  it('accepts the right option in every form and none of the wrong options', () => {
    const acc = new Set(plan.acceptedAnswers.map((x) => x.toLowerCase()));
    expect(acc).toEqual(new Set(['c', '(c)', 'c.', 'c)', 'carbon dioxide', 'c. carbon dioxide']));
    expect(plan.wrongAnswers).toEqual(expect.arrayContaining(['A', '(b)', 'D.', 'Oxygen', 'D. Helium']));
    expect(plan.wrongAnswers.some((w) => acc.has(w.toLowerCase()))).toBe(false);
  });
  it.each(['C', 'c', '(c)', ' C. ', 'C)', 'carbon dioxide', 'Carbon Dioxide.', 'C. Carbon dioxide'])('"%s" is right', (t) => expect(choiceVerdict(plan, t)).toBe('right'));
  it.each(['A', '(b)', 'd.', 'oxygen', 'B. Nitrogen'])('"%s" is wrong', (t) => expect(choiceVerdict(plan, t)).toBe('wrong'));
  it.each(['', '   ', 'A or C', 'c d', 'the gas is carbon dioxide', 'co2', 'E'])('"%s" is unclear, never guessed', (t) => expect(choiceVerdict(plan, t)).toBe('unclear'));
  it('reads Devanagari digits and folds case like the rest of the code marking', () => {
    const p = planOf({ ...find(1), options: [{ letter: 'A', text: '१०' }, { letter: 'B', text: '20' }, { letter: 'C', text: '30' }, { letter: 'D', text: '40' }], correctOption: 'A' });
    expect(choiceVerdict(p, '10')).toBe('right');
    expect(choiceVerdict(p, '२०')).toBe('wrong');
  });
  it('options drawn in a figure can only be picked by letter', () => {
    const drawn = planOf({ ...find(1), options: ['A', 'B', 'C', 'D'].map((letter) => ({ letter, text: '' })), correctOption: 'B' });
    expect(drawn.acceptedAnswers).toEqual(['B', '(b)', 'B.', 'B)']);
    expect(choiceVerdict(drawn, 'b')).toBe('right');
    expect(choiceVerdict(drawn, 'c')).toBe('wrong');
    expect(drawn.key!.valuePoints[0].text).toMatch(/drawn in the figure/);
  });
  it('the visually impaired version is its own plan', () => {
    expect(planOf(find(1, null, 'vi')).mode).toBe('exact');
  });
  it('refuses a row with no correct option', () => {
    const r = markingPlanOf({ ...find(1), correctOption: null });
    expect(r.ok).toBe(false);
  });
});

describe('a written row as an official key', () => {
  it('turns the value points into the key, in order, adding up to the marks', () => {
    const p = planOf(find(2, 'B'));
    expect(p.mode).toBe('ai');
    expect(p.markableMarks).toBe(2);
    expect(p.key!.valuePoints.map((v) => [v.id, v.marks, v.text])).toEqual([['B.1', 1, 'Kidney'], ['B.2', 1, 'It filters the blood']]);
    expect(p.key!.valuePoints.every((v) => v.cites.length === 0)).toBe(true);
    expect(checkKey(p.key!, new Set(), 2, { requireCites: false })).toEqual([]);
  });
  it('an internal choice gives each alternative its own key (only its own parts)', () => {
    const c = planOf(find(3, 'C'));
    const d = planOf(find(3, 'D'));
    expect(c.key!.valuePoints.map((v) => v.text)).toEqual(['Algae', 'Fish']);
    expect(d.key!.valuePoints.map((v) => v.text)).toEqual(['Algae', 'Fungi']);
    expect([c.markableMarks, d.markableMarks]).toEqual([3, 3]);
  });
  it('leaves a drawing out: the question carries the other marks, and the drawing is reported', () => {
    const p = planOf(find(4));
    expect(find(4).marks).toBe(4);
    expect(p).toMatchObject({ mode: 'ai', markableMarks: 2, excluded: [{ label: 'i', marks: 2, why: 'drawing' }] });
    expect(p.key!.valuePoints.map((v) => v.id)).toEqual(['ii.1']);
    expect(p.key!.valuePoints[0].kind).toBe('step');
    // a question made with the row's full marks is refused by the key service's own check, loudly
    expect(checkKey(p.key!, new Set(), 4, { requireCites: false })[0]).toMatch(/points add up to 2, question is worth 4/);
    expect(checkKey(p.key!, new Set(), 2, { requireCites: false })).toEqual([]);
  });
  it('a row that is only a drawing has nothing the app can mark', () => {
    const r = find(4);
    const p = planOf({ ...r, parts: r.parts.filter((x) => x.answer_kind === 'diagram') });
    expect(p).toMatchObject({ mode: 'hand', markableMarks: 0, key: null, excluded: [{ label: 'i', marks: 2, why: 'drawing' }] });
  });
  it('keeps point ids unique when two parts reuse an id', () => {
    const r = find(4);
    const dup = { ...r, parts: [{ ...r.parts[1], label: 'x', value_points: [{ id: '1', text: 'one', marks: 1 }, { id: '2', text: 'two', marks: 1 }] }, { ...r.parts[1], label: 'y', value_points: [{ id: '1', text: 'uno', marks: 1 }, { id: '2', text: 'dos', marks: 1 }] }] };
    const ids = planOf(dup).key!.valuePoints.map((v) => v.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids.slice(0, 2)).toEqual(['1', '2']);
  });
});

describe('"any N of M" as N slots', () => {
  const part = (over: Partial<AnyNPart> = {}): AnyNPart => ({
    label: 'A',
    value_points: [
      { id: 'A.1', text: 'Mid-brain and hind-brain control actions without thinking', marks: 0.5 },
      { id: 'A.2', text: 'Such actions are called involuntary actions', marks: 0.5 },
      { id: 'A.3', text: 'Examples, any two: blood pressure, salivation, vomiting', marks: 1 },
    ],
    any_n_of_m: { n: 2, of: ['blood pressure', 'salivation', 'vomiting'] },
    ...over,
  });
  it('finds the point that lists the choices and shares its marks over the slots', () => {
    expect(planAnyN(part())).toEqual({ ok: true, pointIndex: 2, slots: 2, each: 0.5, of: ['blood pressure', 'salivation', 'vomiting'] });
  });
  it('takes the only point when a part has just one (the list is worded differently)', () => {
    const p = planAnyN({ label: 'D', value_points: [{ id: 'D.1', text: 'Increase the number of turns, reduce coil length, insert a core', marks: 2 }], any_n_of_m: { n: 2, of: ['increase the number of turns N of the coil', 'reduce coil length', 'insert a soft iron core'] } });
    expect(p).toMatchObject({ ok: true, pointIndex: 0, slots: 2, each: 1 });
  });
  it('is null for a part that is not any-N', () => expect(planAnyN(part({ any_n_of_m: null }))).toBeNull());
  it('does not guess which point to split', () => {
    expect(planAnyN(part({ any_n_of_m: { n: 2, of: ['xylophone', 'zebra'] } }))).toMatchObject({ ok: false, problem: expect.stringMatching(/no value point lists the choices/) });
    const two = part({ value_points: [{ id: 'a', text: 'blood pressure, salivation', marks: 1 }, { id: 'b', text: 'vomiting, blood pressure, salivation', marks: 1 }], any_n_of_m: { n: 2, of: ['blood pressure', 'salivation'] } });
    expect(planAnyN(two)).toMatchObject({ ok: false, problem: expect.stringMatching(/more than one value point/) });
  });
  it('refuses marks that do not share out in half marks', () => {
    expect(planAnyN(part({ value_points: [{ id: 'x', text: 'a, b, c', marks: 1 }], any_n_of_m: { n: 3, of: ['a', 'b', 'c'] } }))).toMatchObject({ ok: false, problem: expect.stringMatching(/cannot be shared over 3 slots/) });
  });

  it('the key has the slots in place of the point, and still adds up', () => {
    const r: OfficialRow = {
      number: 11, alt: 'A', variant: null, qtype: 'short', marks: 2, options: [], correctOption: null,
      parts: [{ label: 'A', alternative: 'A', marks: 2, answer_kind: 'text', value_points: part().value_points, any_n_of_m: part().any_n_of_m }],
    };
    const p = planOf(r);
    expect(p.key!.valuePoints.map((v) => [v.id, v.marks])).toEqual([['A.1', 0.5], ['A.2', 0.5], ['A.3#1', 0.5], ['A.3#2', 0.5]]);
    expect(p.key!.valuePoints[2].text).toBe('Slot 1 of 2: any one of: blood pressure; salivation; vomiting (a different one from the other slot)');
    expect(p.key!.valuePoints[2].acceptedAlternatives).toEqual(['blood pressure', 'salivation', 'vomiting']);
    expect(checkKey(p.key!, new Set(), 2, { requireCites: false })).toEqual([]);
  });

  it('validateBank refuses a bank file whose any-N part cannot be split', () => {
    const b = cloneBank();
    const q = b.questions[1];
    q.parts[0] = { ...q.parts[0], any_n_of_m: { n: 3, of: ['a', 'b', 'c'] } };
    expect(validateBank(b).join('\n')).toMatch(/Q2 part A: any 3 of 3: the point's 2 marks cannot be shared over 3 slots/);
    expect(validateBank(cloneBank())).toEqual([]);
  });
});

const realBank = join(__dirname, '../../../../../hw-evals/banks/cbse-x-science-sqp-2026-27/bank.json');
(existsSync(realBank) ? describe : describe.skip)('the CBSE Class X Science sample paper (local file)', () => {
  // jest runs a skipped block's body to collect its tests: read the file only when it is there
  const parsed = parseBankFile(existsSync(realBank) ? readFileSync(realBank, 'utf8') : '{}');
  const paper = parsed.ok ? expandBank(parsed.bank, { kind: 'sqp' }) : null;
  it('is still a valid bank file', () => { expect(parsed.ok && validateBank(parsed.bank)).toEqual([]); });
  it('every row has a marking plan whose key adds up to what the app can mark', () => {
    const modes: Record<string, number> = {};
    for (const q of paper!.questions) {
      const r = markingPlanOf(rowOf(q));
      if (!r.ok) throw new Error(r.problems.join('; '));
      modes[r.plan.mode] = (modes[r.plan.mode] ?? 0) + 1;
      if (r.plan.key) expect(checkKey(r.plan.key, new Set(), r.plan.markableMarks, { requireCites: false })).toEqual([]);
      expect(r.plan.markableMarks + sum(r.plan.excluded.map((e) => e.marks))).toBe(q.marks);
    }
    expect(modes.hand ?? 0).toBe(0);
    expect(modes.exact).toBeGreaterThanOrEqual(20);   // the 20 multiple-choice and assertion-reason questions, and their visually impaired versions
  });
  it('leaves out exactly the drawings: Q26 A(i), Q39 A-IV and B-IV', () => {
    const out = paper!.questions.flatMap((q) => { const r = markingPlanOf(rowOf(q)); return r.ok ? r.plan.excluded.map((e) => `${q.number}${q.alt ?? ''}${q.variant ? 'vi' : ''}:${e.label}:${e.marks}`) : []; });
    expect(out.sort()).toEqual(['26A:A-i:1', '39A:A-IV:2', '39B:B-IV:2']);
  });
  it('splits the two any-N points into slots', () => {
    const q11 = paper!.questions.find((q) => q.number === 11 && q.alt === 'A' && !q.variant)!;
    const p = markingPlanOf(rowOf(q11));
    expect(p.ok && p.plan.key!.valuePoints.filter((v) => v.id.includes('#')).length).toBe(2);
    const q38 = paper!.questions.find((q) => q.number === 38 && q.alt === 'D' && !q.variant)!;
    const p38 = markingPlanOf(rowOf(q38));
    expect(p38.ok && p38.plan.key!.valuePoints.filter((v) => v.id.includes('#')).map((v) => v.marks)).toEqual([1, 1]);
  });
});
