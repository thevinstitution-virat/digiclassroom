// The board-paper bank, pure parts (no database): the file's shape and meaning, the expansion into rows a learner attempts, and the import plan.
// The paper is an invented one (bank-fixture.ts); the real CBSE bank is kept out of git. A second suite runs the real file if it is present.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseBankFile, bankFileSchema, type BankFile } from '@/lib/hw/bank/schema';
import { validateBank, normForQuote } from '@/lib/hw/bank/validate';
import { acceptedAnswersFor, canonicalJson, expandBank, hashContent, rowKey, type ExpandedPaper } from '@/lib/hw/bank/expand';
import { planImport, renderPlan, type StoredRow } from '@/lib/hw/bank/plan';
import { cloneBank, makeBank } from '@/test-support/hw/bank-fixture';

const problemsOf = (b: BankFile) => validateBank(b);
const rowOf = (p: ExpandedPaper, number: number, alt: string | null = null, variant: string | null = null) => {
  const r = p.questions.find((q) => q.number === number && q.alt === alt && q.variant === variant);
  if (!r) throw new Error(`no row ${number}${alt ?? ''}${variant ?? ''}`);
  return r;
};

describe('the file', () => {
  it('parses through the schema and has nothing wrong with it', () => {
    const r = parseBankFile(JSON.stringify(makeBank()));
    expect(r.ok).toBe(true);
    expect(problemsOf(makeBank())).toEqual([]);
  });

  it('reports every shape problem with its path, and bad JSON as one problem', () => {
    const b = cloneBank() as unknown as { questions: { marks_total: unknown; type: unknown }[] };
    b.questions[0].marks_total = 1.3;
    b.questions[1].type = 'essay';
    const r = parseBankFile(JSON.stringify(b));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems.some((p) => p.startsWith('questions.0.marks_total'))).toBe(true);
      expect(r.problems.some((p) => p.startsWith('questions.1.type'))).toBe(true);
    }
    expect(parseBankFile('{not json')).toMatchObject({ ok: false });
    expect(bankFileSchema.safeParse({ format: 'cbse-paper-bank/1' }).success).toBe(false);
  });
});

describe('meaning checks', () => {
  const edit = (f: (b: BankFile) => void) => { const b = cloneBank(); f(b); return problemsOf(b); };

  it('refuses a paper whose questions do not add up to its marks', () => {
    expect(edit((b) => { b.paper.max_marks = 11; }).join()).toMatch(/add to 10 marks, the paper says 11/);
  });

  it('refuses parts that do not add up to the question (and names the alternative)', () => {
    expect(edit((b) => { b.questions[1].parts[1].marks = 1; b.questions[1].parts[1].value_points[0].marks = 0.5; b.questions[1].parts[1].value_points[1].marks = 0.5; }).join()).toMatch(/Q2 \(alternative B\): parts add to 1/);
  });

  it('refuses value points that do not add up to their part', () => {
    expect(edit((b) => { b.questions[3].parts[0].value_points[0].marks = 0.5; }).join()).toMatch(/Q4 part i: value points add to 1.5/);
  });

  it('refuses a quote that is not in the printed scheme, whatever the line breaks', () => {
    expect(edit((b) => { b.questions[0].parts = []; b.questions[1].parts[0].value_points[0].quote = 'Lung'; }).join()).toMatch(/quote for A.1 is not in the printed scheme/);
    // a quote spread over lines and in other case still matches
    expect(normForQuote('It  filters\nthe BLOOD')).toBe(normForQuote('it filters the blood'));
    expect(edit((b) => { b.questions[1].parts[1].value_points[1].quote = 'IT FILTERS\nTHE blood'; })).toEqual([]);
  });

  it('refuses a repeated value point id, a repeated question number and a wrong option set', () => {
    expect(edit((b) => { b.questions[1].parts[1].value_points[1].id = 'B.1'; }).join()).toMatch(/B\.1 is used twice/);
    expect(edit((b) => { b.questions[1].number = 1; }).join()).toMatch(/used twice/);
    expect(edit((b) => { b.questions[0].correct_option = null; }).join()).toMatch(/no correct option/);
    expect(edit((b) => { b.questions[0].options[3].letter = 'C'; }).join()).toMatch(/options are ABCC/);
    expect(edit((b) => { b.questions[0].options[3].text = 'Oxygen'; }).join()).toMatch(/two options have the same text/);
  });

  it('allows drawn options (no words) only when a figure shows them', () => {
    expect(edit((b) => { b.questions[0].options.forEach((o) => { o.text = ''; }); b.questions[0].variant_for_visually_impaired = null; }).join()).toMatch(/no figure that shows the options/);
    expect(edit((b) => {
      b.questions[0].options.forEach((o) => { o.text = ''; });
      b.questions[0].variant_for_visually_impaired = null;
      b.questions[0].figures = [{ id: 'q1-figs', description: 'Four drawn options.', confidence: 'high', needs_person_check: false }];
    })).toEqual([]);
  });

  it('keeps choices consistent: parts name their alternative, a sub-part choice has common parts, figures belong to an offered alternative', () => {
    expect(edit((b) => { b.questions[3].parts[0].alternative = 'A'; }).join()).toMatch(/names an alternative but the question has no choice/);
    expect(edit((b) => { b.questions[2].parts[0].alternative = 'C'; }).join()).toMatch(/Q3/);
    expect(edit((b) => { b.questions[2].figures[0].alt = 'A'; }).join()).toMatch(/figure q3-fig1 belongs to alternative A/);
    expect(edit((b) => { b.questions[1].choice!.common_text = 'something'; }).join()).toMatch(/whole-option choice has no common text/);
  });

  it('keeps figures and diagram answers honest', () => {
    expect(edit((b) => { b.questions[3].figures[0].id = 'q9-fig1'; }).join()).toMatch(/should start with q4-/);
    expect(edit((b) => { b.questions[3].diagram_answer_parts = []; }).join()).toMatch(/diagram_answer_required and diagram_answer_parts disagree/);
  });

  it('checks the visually impaired version too', () => {
    expect(edit((b) => { b.questions[0].variant_for_visually_impaired!.correct_option = 'Z' as never; }).join()).toBeTruthy();
    expect(edit((b) => { b.questions[1].variant_for_visually_impaired!.parts![0].value_points[0].marks = 1; }).join()).toMatch(/visually impaired\) part A/);
    expect(edit((b) => { delete b.questions[1].variant_for_visually_impaired!.choice; }).join()).toMatch(/does not say how it splits/);
  });
});

describe('expansion into rows a learner attempts', () => {
  const paper = expandBank(makeBank());

  it('makes one row per alternative and one per visually impaired version', () => {
    expect(paper.questions.map((q) => rowKey(q)).sort()).toEqual([
      '1||', '1||vi', '2|A|', '2|A|vi', '2|B|', '2|B|vi', '3|C|', '3|D|', '4||',
    ].sort());
    expect(new Set(paper.questions.map(rowKey)).size).toBe(paper.questions.length);
  });

  it('gives every row the question\'s marks, so a total counts a choice once', () => {
    for (const q of paper.questions) {
      const own = q.parts.filter((p) => !q.alt || p.alternative === null || p.alternative === q.alt).reduce((a, p) => a + p.marks, 0);
      if (q.parts.length) expect(own).toBeCloseTo(q.marks, 9);
    }
    const main = paper.questions.filter((q) => !q.variant);
    const groups = new Map<string, number>();
    for (const q of main) groups.set(q.choiceGroup ?? `solo${q.number}`, q.marks);
    expect([...groups.values()].reduce((a, b) => a + b, 0)).toBe(paper.maxMarks);
  });

  it('shows each alternative its own text, with the common text for a sub-part choice', () => {
    expect(rowOf(paper, 2, 'A').stem).toBe('A. Name the organ that pumps blood.');
    expect(rowOf(paper, 2, 'B').stem).not.toMatch(/pumps/);
    const c = rowOf(paper, 3, 'C');
    expect(c.stem).toMatch(/Read the passage about a pond/);
    expect(c.stem).toMatch(/Name one consumer/);
    expect(c.stem).not.toMatch(/decomposer/);
    expect(c.parts.map((p) => p.label)).toEqual(['a', 'C']);
    expect(rowOf(paper, 3, 'D').parts.map((p) => p.label)).toEqual(['a', 'D']);
    expect(c.choiceGroup).toBe('Q3');
    expect(c.choiceKind).toBe('subpart');
    expect(rowOf(paper, 2, 'A', 'vi').choiceGroup).toBe('Q2-vi');
  });

  it('writes every way a student may give the right option of a multiple-choice question', () => {
    expect(rowOf(paper, 1).acceptedAnswers).toEqual(['C', '(c)', 'C.', 'C)', 'Carbon dioxide', 'C. Carbon dioxide']);
    expect(rowOf(paper, 1).correctOption).toBe('C');
    expect(rowOf(paper, 2, 'A').acceptedAnswers).toEqual([]);
    // drawn options have no words to accept
    expect(acceptedAnswersFor('B', [{ letter: 'A', text: '' }, { letter: 'B', text: '' }])).toEqual(['B', '(b)', 'B.', 'B)']);
    expect(acceptedAnswersFor('Q', [])).toEqual([]);
  });

  it('keeps figures off the visually impaired version and off the wrong alternative', () => {
    const b = cloneBank();
    b.questions[1].figures = [{ id: 'q2-figA', alt: 'A', description: 'Only for A.', confidence: 'low', needs_person_check: true }];
    const p = expandBank(b);
    expect(rowOf(p, 2, 'A').figures.map((f) => f.figureId)).toEqual(['q2-figA']);
    expect(rowOf(p, 2, 'B').figures).toEqual([]);
    expect(rowOf(p, 2, 'A', 'vi').figures).toEqual([]);
    expect(rowOf(paper, 3, 'C').figures.map((f) => f.figureId)).toEqual(['q3-fig1']);
    expect(rowOf(paper, 3, 'D').figures.map((f) => f.figureId)).toEqual(['q3-fig1']);
  });

  it('tells a person what to look at, and nothing for a clean row', () => {
    const q4 = rowOf(paper, 4);
    expect(q4.needsCheck.join('\n')).toMatch(/divides over the points/);
    expect(q4.needsCheck.join('\n')).toMatch(/figure q4-fig1/);
    expect(q4.needsCheck.join('\n')).toMatch(/i: the expected answer is a drawing/);
    expect(q4.needsCheck.join('\n')).toMatch(/Prints the symbol m twice/);
    expect(q4.needsCheck.join('\n')).toMatch(/equations/);
    expect(rowOf(paper, 1).needsCheck).toEqual([]);
    expect(rowOf(paper, 2, 'A').needsCheck).toEqual([]);
  });

  it('gives a diagram answer only to the alternative it belongs to', () => {
    const b = cloneBank();
    b.questions[1].parts[0].answer_kind = 'diagram';
    b.questions[1].diagram_answer_required = true;
    b.questions[1].diagram_answer_parts = ['A'];
    const p = expandBank(b);
    expect(rowOf(p, 2, 'A').diagramParts).toEqual(['A']);
    expect(rowOf(p, 2, 'B').diagramParts).toEqual([]);
  });

  it('needs a kind when the file does not say, and takes it from the caller', () => {
    const b = cloneBank();
    delete (b.paper as { kind?: string }).kind;
    expect(() => expandBank(b)).toThrow(/sample paper or a past paper/);
    expect(expandBank(b, { kind: 'past_paper' }).kind).toBe('past_paper');
  });

  it('refuses to expand parts that do not add up (validate first)', () => {
    const b = cloneBank();
    b.questions[3].parts[0].marks = 1;
    expect(() => expandBank(b)).toThrow(/do not add to the question's marks/);
  });
});

describe('the content hash', () => {
  const base = expandBank(makeBank());
  it('is the same for the same file, and does not depend on key order', () => {
    expect(expandBank(makeBank()).questions.map((q) => q.contentHash)).toEqual(base.questions.map((q) => q.contentHash));
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe(canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
    const r = rowOf(base, 4);
    const { contentHash: _h, needsCheck: _n, ...rest } = r;
    void _h; void _n;
    expect(hashContent(rest)).toBe(r.contentHash);
  });
  it('changes with anything a person checks, and not with what only they must look at', () => {
    const b = cloneBank();
    b.questions[3].parts[1].value_points[0].text = 'F equals m times a';
    expect(rowOf(expandBank(b), 4).contentHash).not.toBe(rowOf(base, 4).contentHash);
    expect(rowOf(expandBank(b), 1).contentHash).toBe(rowOf(base, 1).contentHash);
    const f = cloneBank();
    f.questions[3].figures[0].description = 'A different drawing.';
    expect(rowOf(expandBank(f), 4).contentHash).not.toBe(rowOf(base, 4).contentHash);
    const s = cloneBank();
    s.scheme_issues = [];
    expect(rowOf(expandBank(s), 4).contentHash).toBe(rowOf(base, 4).contentHash);
    expect(rowOf(expandBank(s), 4).needsCheck).not.toEqual(rowOf(base, 4).needsCheck);
  });
});

describe('the import plan', () => {
  const file = expandBank(makeBank());
  const sha = 'a'.repeat(64);
  const stored = (status: StoredRow['status'] = 'draft', mutate: (r: StoredRow, i: number) => StoredRow = (r) => r): { paper: NonNullable<Parameters<typeof planImport>[2]['paper']>; rows: StoredRow[] } => ({
    paper: { id: 'p1', status: 'draft', version: 1, sourceSha256: sha, title: file.title, maxMarks: file.maxMarks, duration: file.duration, sourceFiles: file.sourceFiles },
    rows: file.questions.map((q, i) => mutate({ id: `r${i}`, number: q.number, alt: q.alt, variant: q.variant, status, contentHash: q.contentHash, version: 1 }, i)),
  });

  it('a first import is all new', () => {
    const p = planImport(file, sha, { paper: null, rows: [] });
    expect(p.paper).toBe('new');
    expect(p.counts).toMatchObject({ new: 9, unchanged: 0, conflict: 0, total: 9 });
    expect(p.changes).toBe(true);
  });

  it('the same file again changes nothing, whatever the rows\' status', () => {
    for (const status of ['draft', 'checked', 'published', 'rejected'] as const) {
      const p = planImport(file, sha, stored(status));
      expect(p.counts.unchanged).toBe(9);
      expect(p.changes).toBe(false);
      expect(p.paper).toBe('unchanged');
    }
  });

  it('a changed draft is updated; a changed checked or published row is a conflict unless revise is set', () => {
    const change = (_r: StoredRow, i: number) => (i === 0 ? { ..._r, contentHash: 'b'.repeat(64) } : _r);
    expect(planImport(file, sha, stored('draft', change)).counts).toMatchObject({ update_draft: 1, unchanged: 8, conflict: 0 });
    expect(planImport(file, sha, stored('rejected', change)).counts.update_draft).toBe(1);
    for (const status of ['checked', 'published'] as const) {
      const p = planImport(file, sha, stored(status, change));
      expect(p.counts).toMatchObject({ conflict: 1, revise: 0 });
      expect(p.conflicts[0].note).toMatch(/not changed/);
      expect(renderPlan(file, p)).toMatch(/CONFLICT Q1/);
      const r = planImport(file, sha, stored(status, change), { revise: true });
      expect(r.counts).toMatchObject({ conflict: 0, revise: 1 });
      expect(r.rows[0].note).toMatch(/needs a new check/);
    }
  });

  it('reports rows the file no longer has, and never plans to delete them', () => {
    const s = stored('checked');
    s.rows.push({ id: 'old', number: 40, alt: null, variant: null, status: 'checked', contentHash: 'c'.repeat(64), version: 1 });
    const p = planImport(file, sha, s);
    expect(p.orphans).toEqual([{ key: '40||', status: 'checked' }]);
    expect(p.counts.orphans).toBe(1);
    expect(p.rows.every((r) => r.action === 'unchanged')).toBe(true);
  });

  it('notices a changed source file even when no row changed', () => {
    const p = planImport(file, 'd'.repeat(64), stored('draft'));
    expect(p.paper).toBe('update');
    expect(p.changes).toBe(true);
    expect(p.counts.unchanged).toBe(9);
  });
});

// The real CBSE bank is not in git; when it is on this machine, check it too.
const realBank = join(__dirname, '../../../../../hw-evals/banks/cbse-x-science-sqp-2026-27/bank.json');
(existsSync(realBank) ? describe : describe.skip)('the CBSE Class X Science sample paper (local file)', () => {
  // jest runs a skipped block's body to collect its tests: read the file only when it is there
  const parsed = parseBankFile(existsSync(realBank) ? readFileSync(realBank, 'utf8') : '{}');
  it('is valid and adds up to 80 marks', () => {
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(validateBank(parsed.bank)).toEqual([]);
    const p = expandBank(parsed.bank, { kind: 'sqp' });
    expect(p.maxMarks).toBe(80);
    expect(p.questions).toHaveLength(63);
    const main = p.questions.filter((q) => !q.variant);
    const groups = new Map<string, number>();
    for (const q of main) groups.set(q.choiceGroup ?? `solo${q.number}`, q.marks);
    expect([...groups.values()].reduce((a, b) => a + b, 0)).toBe(80);
    expect(new Set(p.questions.map(rowKey)).size).toBe(63);
  });
});
