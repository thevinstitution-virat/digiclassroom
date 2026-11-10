// Exam packages: the board's blueprint (marks per unit, formative-only topics) and what it says about a mock (pure).

import { blueprintCheck, blueprintChapters, blueprintFor, fold, matchChapter, studyPriorities, unitMarks, type BlueprintItem } from '@/lib/hw/exams/blueprint';
import { describeSetProblem } from '@/lib/hw/exams/build-rules';

const bp = blueprintFor({ board: 'CBSE', classLevel: 10, examYear: 2027, subjectCode: '086' })!;
const q = (number: number, marks: number, chapter: string, over: Partial<BlueprintItem> = {}): BlueprintItem =>
  ({ number, marks, chapter, choiceGroup: null, alt: null, authoredText: null, ...over });
const full = { kind: 'mock_full', syllabusScope: [] as string[] };

/** A mock that matches the board's unit marks exactly: 25 / 25 / 12 / 13 / 5. */
const onBlueprint = (): BlueprintItem[] => [
  q(1, 10, 'Chemical Reactions and Equations'), q(2, 15, 'Carbon and its Compounds'),
  q(3, 20, 'Life Processes'), q(4, 5, 'Heredity'),
  q(5, 12, 'Light - Reflection and Refraction'),
  q(6, 13, 'Electricity'),
  q(7, 5, 'Our Environment'),
];

describe('the CBSE Class X Science 2026-27 blueprint', () => {
  it('is found for 2027 boards only, and says where it comes from', () => {
    expect(bp.session).toBe('2026-27');
    expect(bp.source.url).toMatch(/^https:\/\/cbseacademic\.nic\.in\//);
    expect(blueprintFor({ board: 'cbse ', classLevel: 10, examYear: 2027, subjectCode: ' 086' })).toBe(bp);
    expect(blueprintFor({ board: 'CBSE', classLevel: 10, examYear: 2028, subjectCode: '086' })).toBeNull();
    expect(blueprintFor({ board: 'CBSE', classLevel: 10, examYear: 2027, subjectCode: '041' })).toBeNull();
  });

  it('adds up to the paper and splits 30 / 25 / 25 over the 2026 paper sections', () => {
    expect(bp.units.reduce((s, u) => s + u.marks, 0)).toBe(80);
    const by = (sec: string) => bp.units.filter((u) => u.section === sec).reduce((s, u) => s + u.marks, 0);
    expect([by('Biology'), by('Chemistry'), by('Physics')]).toEqual([30, 25, 25]);
  });

  it('has no chapter name or alias twice', () => {
    const all = [...bp.units.flatMap((u) => u.chapters.flatMap((c) => [c.name, ...c.aliases])), ...bp.formativeOnly.flatMap((t) => (t.chapter ? [t.chapter.name, ...t.chapter.aliases] : []))].map(fold);
    expect(new Set(all).size).toBe(all.length);
    expect(blueprintChapters(bp)).toHaveLength(13);
  });
});

describe('matchChapter', () => {
  it('reads the usual ways of writing a chapter', () => {
    const unitOf = (c: string) => { const m = matchChapter(bp, c); return m.kind === 'unit' ? `${m.unit.id}:${m.chapter}` : m.kind; };
    expect(unitOf('Light – Reflection and Refraction')).toBe('III:Light - Reflection and Refraction');
    expect(unitOf('  acids, bases & salts ')).toBe('I:Acids, Bases and Salts');
    expect(unitOf('Heredity and Evolution')).toBe('II:Heredity');
    expect(unitOf('Magnetic effects of current')).toBe('IV:Magnetic Effects of Electric Current');
    expect(unitOf('Our environment')).toBe('V:Our Environment');
  });
  it('says when a chapter is only formative, and never guesses an unknown one', () => {
    expect(matchChapter(bp, 'Periodic Classification of Elements').kind).toBe('formative');
    expect(matchChapter(bp, 'Mendeleev’s periodic table').kind).toBe('unknown');
    expect(matchChapter(bp, 'Evolution').kind).toBe('formative');
    expect(matchChapter(bp, 'Sound').kind).toBe('unknown');
    expect(matchChapter(bp, '  ').kind).toBe('blank');
  });
});

describe('blueprintCheck', () => {
  it('leaves board papers alone', () => {
    const r = blueprintCheck(bp, { kind: 'pyq', syllabusScope: [] }, [q(1, 80, 'Periodic Classification of Elements')]);
    expect(r).toEqual({ problems: [], warnings: [] });
  });

  it('passes a full mock that follows the board’s unit marks', () => {
    expect(blueprintCheck(bp, full, onBlueprint())).toEqual({ problems: [], warnings: [] });
  });

  it('refuses a mock question on a formative-only chapter, naming it', () => {
    const r = blueprintCheck(bp, full, [...onBlueprint(), q(8, 3, 'Periodic Classification of Elements'), q(9, 2, 'periodic table', { alt: 'A' })]);
    expect(r.problems).toHaveLength(1);
    const line = describeSetProblem(r.problems[0]!);
    expect(line).toContain('Q8, Q9A are on Periodic Classification of Elements');
    expect(line).toContain('2026-27');
    expect(r.warnings).toContain('Marks per unit are checked against the board paper once every question has a curriculum chapter.');
  });

  it('warns about unit marks off the board paper, unit by unit', () => {
    const items = onBlueprint().map((x) => (x.number === 6 ? { ...x, marks: 8 } : x));
    items.push(q(8, 5, 'Light - Reflection and Refraction'));
    const r = blueprintCheck(bp, full, items);
    expect(r.problems).toEqual([]);
    expect(r.warnings).toEqual([
      'Unit III (Natural Phenomena) has 17 marks here; the board paper gives it 12.',
      'Unit IV (Effects of Current) has 8 marks here; the board paper gives it 13.',
    ]);
  });

  it('counts an internal choice once, at its bigger alternative', () => {
    const items = [...onBlueprint().filter((x) => x.number !== 7), q(7, 5, 'Our Environment', { choiceGroup: 'g7', alt: 'A' }), q(7, 5, 'Electricity', { choiceGroup: 'g7', alt: 'B' })];
    const v = unitMarks(bp, items).find((u) => u.unit === 'V')!;
    expect(v.marks).toBe(5);
    expect(unitMarks(bp, items).find((u) => u.unit === 'IV')!.marks).toBe(13);
  });

  it('flags formative topics in a question someone wrote, but not "motor neuron" or a board row', () => {
    const r = blueprintCheck(bp, full, [
      ...onBlueprint().filter((x) => x.number !== 6),
      q(6, 13, 'Magnetic Effects of Electric Current', { authoredText: 'Explain the principle of an electric generator.' }),
      q(3, 20, 'Control and Coordination', { authoredText: 'Trace the reflex arc: sensory neuron, relay neuron, motor neuron.' }),
      q(9, 0, 'Electricity', { authoredText: null }),
    ]);
    expect(r.warnings.filter((w) => w.includes('mentions'))).toEqual([
      'Q6 mentions "generator": Motor, Electromagnetic Induction, Electric Generator is assessed only formatively in 2026-27, so the board paper will not ask it.',
    ]);
  });

  it('warns about a chapter it cannot recognise instead of guessing', () => {
    const r = blueprintCheck(bp, full, [...onBlueprint(), q(8, 1, 'Sound')]);
    expect(r.problems).toEqual([]);
    expect(r.warnings[0]).toContain('Q8 ("Sound")');
  });

  it('checks a half-syllabus mock’s scope', () => {
    const r = blueprintCheck(bp, { kind: 'mock_half', syllabusScope: ['Electricity', 'Evolution', 'Gravitation'] }, [q(1, 5, 'Electricity')]);
    expect(r.problems.map(describeSetProblem)).toEqual(['The syllabus scope includes Evolution, which the 2026-27 curriculum assesses only formatively: the board paper will not ask it.']);
    expect(r.warnings).toEqual(['The syllabus scope names "Gravitation", which is not a chapter of the 2026-27 curriculum as written here.']);
  });
});

describe('studyPriorities', () => {
  it('ranks units by board marks at stake, not by the share lost alone', () => {
    const r = studyPriorities(bp, [
      { chapter: 'Our Environment', marks: 5, awarded: 0 },            // all lost, but the unit carries 5
      { chapter: 'Carbon and its Compounds', marks: 10, awarded: 5 },   // half lost of a 25-mark unit
      { chapter: 'Acids, Bases and Salts', marks: 10, awarded: 5 },
      { chapter: 'Electricity', marks: 10, awarded: 10 },
      { chapter: 'Sound', marks: 3, awarded: 0 },                       // not a curriculum chapter: left out
    ]);
    expect(r.map((x) => [x.unit, x.gainable])).toEqual([['I', 12.5], ['V', 5], ['IV', 0]]);
    expect(r[0]!.chapters).toEqual(['Carbon and its Compounds', 'Acids, Bases and Salts']);
    expect(r[0]!.section).toBe('Chemistry');
  });
  it('never counts more than full marks for a question', () => {
    expect(studyPriorities(bp, [{ chapter: 'Electricity', marks: 2, awarded: 3 }])[0]!.gainable).toBe(0);
  });
});
