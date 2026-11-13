// The board-paper bank, phase 5, without a database: equations (the bank's own pairs, and a read-back from handwriting) and the evaluation export.

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cloneBank } from '@/test-support/hw/bank-fixture';
import { expandBank } from '@/lib/hw/bank/expand';
import { parseBankFile } from '@/lib/hw/bank/schema';
import { validateBank } from '@/lib/hw/bank/validate';
import { compareEquation, equationDisagreement, equationProblems, flattenLatex, flattenPlain, foldReading, summariseEquationReading } from '@/lib/hw/bank/equations';
import { equationItemsOf, equationPairs, evalQuestionsOf } from '@/lib/hw/bank/eval-export';
import { loadDataset, parseManifest, writeDatasetVersion } from '@/lib/hw/eval/dataset';
import { applyCopies } from '@/lib/hw/eval/reference';
import { latestRows, readRows } from '@/lib/hw/eval/runner';

describe('the two writings of a bank equation', () => {
  const agree: [string, string][] = [
    ['MgCl2 + 2AgNO3 -> 2AgCl + Mg(NO3)2', 'MgCl_2 + 2AgNO_3 \\rightarrow 2AgCl + Mg(NO_3)_2'],
    ['C2H5OH + CH3COOH --(conc. H2SO4)--> CH3COOC2H5 + H2O', 'C_2H_5OH + CH_3COOH \\xrightarrow{conc.\\ H_2SO_4} CH_3COOC_2H_5 + H_2O'],
    ['CH3CH2OH --(conc. H2SO4, 170 C)--> CH2=CH2 + H2O', 'CH_3CH_2OH \\xrightarrow{conc.\\ H_2SO_4,\\ 170\\ ^\\circ C} CH_2{=}CH_2 + H_2O'],
    ['CH2=CH2 + H2 --(Ni)--> CH3CH3', 'CH_2{=}CH_2 + H_2 \\xrightarrow{Ni} CH_3CH_3'],
    ['n21 = v1 / v2', 'n_{21} = \\frac{v_1}{v_2}'],
    ['m = hi/ho = v/u', 'm = \\frac{h_i}{h_o} = \\frac{v}{u}'],
    ['1/f = 1/v - 1/u', '\\frac{1}{f} = \\frac{1}{v} - \\frac{1}{u}'],
    ['R = rho L / A', 'R = \\frac{\\rho L}{A}'],
    ['B ~ I / r', 'B \\propto \\frac{I}{r}'],
    ['P = V x I', 'P = VI'],
    ['H = I^2 R t', 'H = I^2Rt'],
    ['V = I R', 'V = IR'],
    ['x^2 + 3x = 0', 'x^{2} + 3x = 0'],
  ];
  it.each(agree)('%s says what its LaTeX says', (plain, latex) => expect(equationDisagreement({ plain, latex })).toBeNull());

  it('catches a pair that differs, and says how', () => {
    expect(equationDisagreement({ plain: 'CH3CH2OH --(conc. H2SO4, 170 C)--> CH2=CH2 + H2O', latex: 'CH_3CH_2OH \\xrightarrow{conc.\\ H_2SO_4} CH_2{=}CH_2 + H_2O' }))
      .toBe('the plain form reads "CH3CH2OH->[conc.H2SO4,170C]CH2=CH2+H2O" and the LaTeX form reads "CH3CH2OH->[conc.H2SO4]CH2=CH2+H2O"');
    expect(equationDisagreement({ plain: '1/R = 1/R1 + 1/R2 (parallel)', latex: '\\frac{1}{R} = \\frac{1}{R_1} + \\frac{1}{R_2}' })).toMatch(/\(parallel\)/);
    // a different coefficient, a different sign, a different digit are all different equations
    expect(equationDisagreement({ plain: '2Al + 3H2SO4 -> Al2(SO4)3 + 3H2', latex: '2Al + 3H_2SO_4 \\rightarrow Al_2(SO_4)_3 + 2H_2' })).not.toBeNull();
    expect(equationDisagreement({ plain: '1/f = 1/v - 1/u', latex: '\\frac{1}{f} = \\frac{1}{v} + \\frac{1}{u}' })).not.toBeNull();
    expect(equationDisagreement({ plain: 'H = I^2 R t', latex: 'H = I^3Rt' })).not.toBeNull();
  });

  it('keeps case: Co is not CO', () => {
    expect(flattenPlain('Co + O2 -> CoO2')).not.toBe(flattenPlain('CO + O2 -> COO2'));
    expect(flattenLatex('CO_2')).toBe('CO2');
  });

  it('reports every problem of a question with its number, and an empty form', () => {
    const p = equationProblems('Q9', [{ plain: 'A = B', latex: 'A = C' }, { plain: '', latex: 'x' }, { plain: 'V = IR', latex: 'V = IR' }]);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatch(/^Q9: equation 1 \(A = B\)/);
    expect(p[1]).toBe('Q9: equation 2 has an empty plain or LaTeX form');
  });

  it('the importer refuses a bank file with such a pair', () => {
    const b = cloneBank();
    expect(validateBank(b)).toEqual([]);
    b.questions[3].equations = [{ plain: 'F = m a', latex: 'F = ma^2' }];
    expect(validateBank(b).join('\n')).toMatch(/Q4: equation 1 \(F = m a\): the plain form reads "F=ma"/);
  });
});

describe('an equation read back from handwriting', () => {
  it.each([
    ['CO2', 'CO₂'], ['H2O', 'H₂O'], ['I^2 R t', 'I²Rt'], ['MgCl2 + 2AgNO3 -> 2AgCl + Mg(NO3)2', 'MgCl₂ + 2AgNO₃ → 2AgCl + Mg(NO₃)₂'],
    ['1/f = 1/v - 1/u', '1/f = 1/v − 1/u'], ['P = V x I', 'P = V × I'], ['P = V x I', 'P = VI'], ['B ~ I / r', 'B~I/r'], ['R = rho L / A', 'R = ρL/A'],
    ['CH2=CH2 + H2 --(Ni)--> CH3CH3', 'CH₂=CH₂ + H₂ —(Ni)→ CH₃CH₃'], ['Cu^2+', 'Cu²⁺'], ['170 C', '170°C'], ['A + B <-> C', 'A + B ⇌ C'],
  ])('%s read as %s is the same equation', (truth, read) => expect(compareEquation(truth, read)).toBe('equivalent'));

  it('exact when nothing differs', () => {
    expect(compareEquation('V = I R', ' V = I R ')).toBe('exact');
  });

  it.each([
    ['2H2 + O2 -> 2H2O', 'H2 + O2 -> H2O'],     // a coefficient lost
    ['MgCl2 + 2AgNO3 -> 2AgCl + Mg(NO3)2', 'MgCl2 + 2AgNO3 -> 2AgCl + Mg(NO3)3'],
    ['1/f = 1/v - 1/u', '1/f = 1/v + 1/u'],      // a sign read wrong
    ['CO2', 'co2'],                              // case is chemistry
    ['H = I^2 R t', 'H = I R t'],                // a power lost
    ['V = I R', 'R = I V'],                      // the order of the equation
  ])('%s read as %s is NOT the same', (truth, read) => expect(compareEquation(truth, read)).toBe('different'));

  it('folds only a way of writing', () => {
    expect(foldReading('Cu²⁺ + 2e⁻ → Cu')).toBe('Cu^2++2e^-->Cu');
    expect(foldReading('x₁ + x₂')).toBe('x1+x2');
  });

  it('summarises a reading run: exact, equivalent, different, the rate and what was missed', () => {
    const s = summariseEquationReading([
      { truth: 'V = I R', read: 'V = I R' }, { truth: 'H2O', read: 'H₂O' }, { truth: '2H2 + O2 -> 2H2O', read: 'H2 + O2 -> H2O' }, { truth: 'P = V x I', read: 'P = VI' },
    ]);
    expect(s).toMatchObject({ n: 4, exact: 1, equivalent: 2, different: 1, rate: 0.75 });
    expect(s.misses).toEqual([{ truth: '2H2 + O2 -> 2H2O', read: 'H2 + O2 -> H2O', distance: expect.any(Number) }]);
    expect(s.misses[0].distance).toBeGreaterThan(0);
    expect(summariseEquationReading([])).toMatchObject({ n: 0, rate: null, misses: [] });
  });
});

describe('the evaluation export', () => {
  const paper = expandBank(cloneBank());

  it('exports the written rows a model would mark, as official references, and says why it skipped the others', () => {
    const { questions, skipped } = evalQuestionsOf(paper);
    expect(questions.map((q) => q.officialRef!.questionNo)).toEqual(['2A', '2B', '3C', '3D', '4']);
    expect(skipped.map((s) => s.row)).toEqual(['Q1', 'Q1-vi', 'Q2A-vi', 'Q2B-vi']);
    expect(skipped[0].why).toMatch(/marked by code/);
    expect(skipped[1].why).toMatch(/visually impaired/);
  });

  it('carries what the answer-key service needs, and the marks the app can give (a drawing is not counted)', () => {
    const q4 = evalQuestionsOf(paper).questions.find((q) => q.officialRef!.questionNo === '4')!;
    expect(q4).toMatchObject({ marks: 2, questionType: 'long', classLevel: '10', subject: 'Science', medium: 'English', board: 'TESTBOARD', questionOrigin: 'board_paper' });
    expect(q4.officialRef).toEqual({ kind: 'sqp', session: '2099-00', subjectCode: 'T-001', questionNo: '4', board: 'TESTBOARD', classLevel: 10 });
    expect(q4.questionText).toContain('Part i asks for a drawing');
  });

  it('uses the product\'s question types, so the evaluation groups are the groups learners are marked in', () => {
    const types = evalQuestionsOf(paper).questions.map((q) => q.questionType);
    expect(new Set(types)).toEqual(new Set(['very_short', 'long']));   // the case-based question is a long one
  });

  it('makes one copy-by-hand item per distinct equation, valid, stable, and naming where it is from', () => {
    const { items, rowsOf } = equationItemsOf(paper);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ source: 'A', mode: 'typed', questionType: 'very_short', truthTranscript: { text: 'F = m a', how: 'known_text' }, key: null, mutation: null });
    expect(items[0].id).toMatch(/^evitem_[a-z2-7]{16}$/);
    expect(rowsOf.get('F = m a')).toEqual(['Q4']);
    expect('items' in parseManifest(items.map((i) => JSON.stringify(i)).join('\n'))).toBe(true);
    expect(equationItemsOf(paper).items[0].id).toBe(items[0].id);
  });

  it('an equation used in two questions is one item', () => {
    const b = cloneBank();
    b.questions[2].equations = [{ plain: 'F = m a', latex: 'F = ma' }];
    const { items, rowsOf } = equationItemsOf(expandBank(b));
    expect(items).toHaveLength(1);
    expect(rowsOf.get('F = m a')).toEqual(['Q3', 'Q4']);
  });
});

describe('the equation reading loop, from the paper to the report', () => {
  it('a dataset of equations, copied by hand, read back, and summarised', () => {
    const root = mkdtempSync(join(tmpdir(), 'hw-eq-'));
    try {
      const b = cloneBank();
      b.questions[3].equations = [{ plain: 'F = m a', latex: 'F = ma' }, { plain: '2H2 + O2 -> 2H2O', latex: '2H_2 + O_2 \\rightarrow 2H_2O' }];
      const { items } = equationItemsOf(expandBank(b));
      expect(items).toHaveLength(2);
      writeDatasetVersion(root, 'eq-test@v1', items);
      const ds = loadDataset(root, 'eq-test@v1');

      // Two volunteers copy the sheets: the pad copies become ink items next to the typed originals.
      const copies = ds.items.flatMap((i) => ['r1', 'r2'].map((raterId) => ({ itemId: i.id, raterId, device: 'tablet', inkPath: `media/${i.id}/${raterId}.json.gz`, renderPath: `media/${i.id}/${raterId}.png` })));
      const v2 = applyCopies(ds.items, copies).items;
      expect(v2.filter((i) => i.mode === 'ink')).toHaveLength(4);
      expect(v2.filter((i) => i.mode === 'ink').every((i) => i.question.id.startsWith('eq_') && i.truthTranscript?.how === 'known_text')).toBe(true);

      // A reading run: the reader returns text for each ink item (a typed original is not read).
      const ink = v2.filter((i) => i.mode === 'ink');
      const reads = ['F = ma', 'F = m a', '2H₂ + O₂ → 2H₂O', 'H2 + O2 -> H2O'];
      const lines = ink.map((i, n) => JSON.stringify({ itemId: i.id, repeat: 0, status: 'ok', transcript: reads[n] }));
      lines.push(JSON.stringify({ itemId: ink[0].id, repeat: 0, status: 'ok', transcript: reads[0] }));   // a retried row: the latest wins
      lines.push(JSON.stringify({ itemId: 'evitem_unknownunknown1', repeat: 0, status: 'ok', transcript: 'not ours' }));
      lines.push(JSON.stringify({ itemId: ink[1].id, repeat: 1, status: 'failed', reason: 'x' }));
      const file = join(root, 'items.jsonl');
      writeFileSync(file, `${lines.join('\n')}\n`);

      const pairs = equationPairs(v2, latestRows(readRows(file)));
      expect(pairs).toHaveLength(4);
      const s = summariseEquationReading(pairs);
      expect(s).toMatchObject({ n: 4, exact: 1, equivalent: 2, different: 1, rate: 0.75 });
      expect(s.misses[0]).toMatchObject({ truth: '2H2 + O2 -> 2H2O', read: 'H2 + O2 -> H2O' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const realBank = join(__dirname, '../../../../../hw-evals/banks/cbse-x-science-sqp-2026-27/bank.json');
(existsSync(realBank) ? describe : describe.skip)('the CBSE Class X Science sample paper (local file)', () => {
  // jest runs a skipped block's body to collect its tests: read the file only when it is there
  const parsed = parseBankFile(existsSync(realBank) ? readFileSync(realBank, 'utf8') : '{}');
  const paper = parsed.ok ? expandBank(parsed.bank, { kind: 'sqp' }) : null;
  it('is still a valid bank file, with every equation\'s two writings agreeing', () => {
    expect(parsed.ok && validateBank(parsed.bank)).toEqual([]);
  });
  it('exports 28 written questions worth 89 marks, in the three groups, and 14 equations', () => {
    const { questions } = evalQuestionsOf(paper!);
    expect(questions).toHaveLength(28);
    expect(questions.reduce((s, q) => s + q.marks, 0)).toBe(89);
    expect(questions.filter((q) => q.questionType === 'very_short')).toHaveLength(8);
    expect(questions.filter((q) => q.questionType === 'short')).toHaveLength(8);
    expect(questions.filter((q) => q.questionType === 'long')).toHaveLength(12);
    expect(equationItemsOf(paper!).items).toHaveLength(14);
  });
});
