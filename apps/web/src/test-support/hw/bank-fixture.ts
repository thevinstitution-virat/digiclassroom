// A small invented paper for the board-paper bank tests (the real CBSE bank lives outside git). It has every shape the importer must handle:
// a multiple-choice question with a visually impaired version, a whole-option choice, a sub-part choice, and a written question with a figure,
// an inferred mark split and a diagram answer. 10 marks.

import type { BankFile } from '@/lib/hw/bank/schema';

const vp = (id: string, text: string, marks: number, quote: string) => ({ id, text, marks, quote, required: true });
const part = (label: string, alternative: 'A' | 'B' | 'C' | 'D' | null, marks: number, answer_kind: string, points: ReturnType<typeof vp>[], extra: Record<string, unknown> = {}) =>
  ({ label, alternative, marks, answer_kind, official_answer_quote: null, value_points: points, any_n_of_m: null, marks_split_inferred: false, scheme_notes: '', confidence: 'high', ...extra });

export function makeBank(): BankFile {
  const bank = {
    format: 'cbse-paper-bank/2',
    paper: {
      title: 'TEST SCIENCE SAMPLE PAPER', board: 'TESTBOARD', klass: 10, subject: 'Science', code: 'T-001', year: '2099-00', kind: 'sqp', max_marks: 10, duration: '1 hour',
      source_files: ['paper.pdf', 'scheme.pdf'], sections: [{ id: 'A', name: 'All', questions: '1-4' }],
    },
    questions: [
      {
        number: 1, section: 'A', marks_total: 1, type: 'mcq',
        stem_raw: 'Which gas do plants take in?\nA. Oxygen\nB. Nitrogen\nC. Carbon dioxide\nD. Helium', scheme_raw: 'C. Carbon dioxide',
        stem: 'Which gas do plants take in?', options: [{ letter: 'A', text: 'Oxygen' }, { letter: 'B', text: 'Nitrogen' }, { letter: 'C', text: 'Carbon dioxide' }, { letter: 'D', text: 'Helium' }],
        correct_option: 'C', parts: [], choice: null, figures: [], diagram_answer_required: false, diagram_answer_parts: [], equations: [],
        variant_for_visually_impaired: {
          replaces_question: 1, stem_raw: 'Which gas do plants take in, read aloud?\nA. Oxygen\nB. Nitrogen\nC. Carbon dioxide\nD. Helium', scheme_raw: 'C. Carbon dioxide',
          stem: 'Which gas do plants take in, read aloud?', options: [{ letter: 'A', text: 'Oxygen' }, { letter: 'B', text: 'Nitrogen' }, { letter: 'C', text: 'Carbon dioxide' }, { letter: 'D', text: 'Helium' }], correct_option: 'C',
        },
      },
      {
        number: 2, section: 'A', marks_total: 2, type: 'very_short',
        stem_raw: 'Attempt either option A or B.\nA. Name the organ that pumps blood.\nOR\nB. Name the organ that filters blood.',
        scheme_raw: 'A. Heart (2)\nOR\nB. Kidney (1) it filters the blood (1)',
        stem: 'A. Name the organ that pumps blood.\nOR\nB. Name the organ that filters blood.', options: [], correct_option: null,
        parts: [
          part('A', 'A', 2, 'text', [vp('A.1', 'Heart', 2, 'Heart')]),
          part('B', 'B', 2, 'text', [vp('B.1', 'Kidney', 1, 'Kidney'), vp('B.2', 'It filters the blood', 1, 'it filters the blood')]),
        ],
        choice: { kind: 'option', alternatives: ['A', 'B'], common_text: '', alternatives_text: { A: 'A. Name the organ that pumps blood.', B: 'B. Name the organ that filters blood.' } },
        figures: [], diagram_answer_required: false, diagram_answer_parts: [], equations: [],
        variant_for_visually_impaired: {
          replaces_question: 2, stem_raw: 'Attempt either option A or B. (read aloud)\nA. Name the organ that pumps blood.\nOR\nB. Name the organ that filters blood.', scheme_raw: 'A. Heart (2)\nOR\nB. Kidney (1) it filters the blood (1)',
          parts: [
            part('A', 'A', 2, 'text', [vp('A.1', 'Heart', 2, 'Heart')]),
            part('B', 'B', 2, 'text', [vp('B.1', 'Kidney', 1, 'Kidney'), vp('B.2', 'It filters the blood', 1, 'it filters the blood')]),
          ],
          choice: { kind: 'option', alternatives: ['A', 'B'], common_text: '', alternatives_text: { A: 'A. Name the organ that pumps blood. (read aloud)', B: 'B. Name the organ that filters blood. (read aloud)' } },
        },
      },
      {
        number: 3, section: 'A', marks_total: 3, type: 'case_based',
        stem_raw: 'Read the passage about a pond.\n(a) Name one producer.\nAttempt either C or D.\nC. Name one consumer.\nOR\nD. Name one decomposer.',
        scheme_raw: '(a) Algae (1)\nC. Fish (2)\nOR\nD. Fungi (2)',
        stem: 'Read the passage about a pond.', options: [], correct_option: null,
        parts: [
          part('a', null, 1, 'text', [vp('a.1', 'Algae', 1, 'Algae')]),
          part('C', 'C', 2, 'text', [vp('C.1', 'Fish', 2, 'Fish')]),
          part('D', 'D', 2, 'text', [vp('D.1', 'Fungi', 2, 'Fungi')]),
        ],
        choice: { kind: 'subpart', alternatives: ['C', 'D'], common_text: 'Read the passage about a pond.\n(a) Name one producer.', alternatives_text: { C: 'C. Name one consumer.', D: 'D. Name one decomposer.' } },
        figures: [{ id: 'q3-fig1', description: 'A pond with algae, fish and fungi at the bottom.', labels: ['algae', 'fish', 'fungi'], confidence: 'high', needs_person_check: false }],
        diagram_answer_required: false, diagram_answer_parts: [], equations: [], variant_for_visually_impaired: null,
      },
      {
        number: 4, section: 'A', marks_total: 4, type: 'long',
        stem_raw: '(i) Draw a labelled diagram of a cell. (ii) State the formula of the force on a mass.',
        scheme_raw: '(i) Diagram with nucleus and membrane labelled (2) (ii) F = m a (2)',
        stem: '(i) Draw a labelled diagram of a cell. (ii) State the formula of the force on a mass.', options: [], correct_option: null,
        parts: [
          part('i', null, 2, 'diagram', [vp('i.1', 'Nucleus labelled', 1, 'nucleus'), vp('i.2', 'Membrane labelled', 1, 'membrane')], { marks_split_inferred: true }),
          part('ii', null, 2, 'equation', [vp('ii.1', 'F = m a', 2, 'F = m a')]),
        ],
        choice: null,
        figures: [{ id: 'q4-fig1', description: 'A blank circle to draw in.', labels: [], confidence: 'medium', needs_person_check: true, note: 'check the size' }],
        diagram_answer_required: true, diagram_answer_parts: ['i'], equations: [{ plain: 'F = m a', latex: 'F = ma' }], variant_for_visually_impaired: null,
      },
    ],
    scheme_issues: [{ q: 4, where: 'part ii', printed: 'F = m a', problem: 'Prints the symbol m twice.', final_answer_still_right: true }],
  };
  return bank as unknown as BankFile;
}

/** A fresh copy, so one test's edit never leaks into the next. */
export const cloneBank = (b: BankFile = makeBank()): BankFile => JSON.parse(JSON.stringify(b)) as BankFile;
