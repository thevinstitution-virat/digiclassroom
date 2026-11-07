// A checked bank row as an OFFICIAL answer key (phase 3). Pure: no database. The answer-key service takes an official key as it is and never asks a
// model to write one, so this is where the board's scheme is turned into value points, once, by rules a test can read:
//
//   * a multiple-choice or assertion-reason row is marked by code, not by a model: the right option's forms are accepted, the wrong options' forms are
//     wrong, anything else is unclear (and goes where an unclear answer goes today);
//   * a written row's value points become the key, and an "any N of M" point becomes N slots;
//   * a part whose answer is a DRAWING is left out: no model marks a drawing. The question made from the row carries only the marks the app can give
//     (`markableMarks`), and the drawing's marks are reported as excluded, never silently dropped.

import type { AnswerKey, ValuePoint } from '../keys/types';
import { normaliseForCodeMatch } from '../grader/code-marking';
import { acceptedAnswersFor } from './expand';
import { planAnyN } from './anyn';

export interface OfficialPart {
  label: string;
  alternative?: string | null;
  marks: number;
  answer_kind: string;
  value_points: { id: string; text: string; marks: number }[];
  any_n_of_m?: unknown;
}

/** The part of a stored bank row this needs. */
export interface OfficialRow {
  number: number;
  alt: string | null;
  variant: string | null;
  qtype: string;
  marks: number;
  options: { letter: string; text: string }[];
  correctOption: string | null;
  parts: OfficialPart[];
}

export type MarkingMode =
  /** Marked by code: a multiple-choice answer is the right option, a wrong one, or unclear. */
  | 'exact'
  /** Marked against the official value points (by a model, where the group is eligible, or by the teacher). */
  | 'ai'
  /** Nothing the app can mark: every part is a drawing. */
  | 'hand';

export interface ExcludedPart { label: string; marks: number; why: 'drawing' }

export interface MarkingPlan {
  mode: MarkingMode;
  /** What a learner can earn in the app: the row's marks less the drawings. A question made from this row must carry exactly this. */
  markableMarks: number;
  excluded: ExcludedPart[];
  /** The official key for what is markable; null for 'hand'. Its points add up to `markableMarks`. */
  key: AnswerKey | null;
  acceptedAnswers: string[];
  wrongAnswers: string[];
}

export type PlanResult = { ok: true; plan: MarkingPlan } | { ok: false; problems: string[] };

const MCQ = new Set(['mcq', 'assertion_reason']);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** The row's number as printed: "26", "26A" (an alternative), "26A-vi" (its visually impaired version). */
export function questionNoOf(r: { number: number; alt: string | null; variant: string | null }): string {
  return `${r.number}${r.alt ?? ''}${r.variant ? '-vi' : ''}`;
}

/** "26", "Q26a", "26 A", "26A-vi", "26 (vi)" -> the row it names, or null. */
export function parseQuestionNo(s: string): { number: number; alt: 'A' | 'B' | 'C' | 'D' | null; variant: 'vi' | null } | null {
  const m = /^\s*q?\s*(\d{1,3})\s*([a-d])?\s*(?:[-\s(]*(vi)\)?)?\s*$/i.exec(s);
  if (!m) return null;
  return { number: Number(m[1]), alt: m[2] ? (m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D') : null, variant: m[3] ? 'vi' : null };
}

function anyNOf(p: OfficialPart): { n: number; of: string[] } | null {
  const a = p.any_n_of_m as { n?: unknown; of?: unknown } | null | undefined;
  return a && typeof a.n === 'number' && Array.isArray(a.of) ? { n: a.n, of: a.of.filter((x): x is string => typeof x === 'string') } : null;
}

/** The value points of the parts the app can mark, in order, with an "any N of M" point as N slots. Ids are made unique across parts. */
function pointsOf(parts: OfficialPart[]): { points: ValuePoint[]; problems: string[] } {
  const problems: string[] = [];
  const points: ValuePoint[] = [];
  const used = new Set<string>();
  const unique = (label: string, id: string) => {
    let out = used.has(id) ? `${label || 'part'}/${id}` : id;
    for (let i = 2; used.has(out); i++) out = `${label || 'part'}/${id}~${i}`;
    used.add(out);
    return out;
  };
  for (const p of parts) {
    const kind: ValuePoint['kind'] = p.answer_kind === 'equation' ? 'step' : 'key_point';
    const plan = planAnyN({ label: p.label, value_points: p.value_points, any_n_of_m: anyNOf(p) });
    if (plan && !plan.ok) { problems.push(`part ${p.label || '-'}: ${plan.problem}`); continue; }
    p.value_points.forEach((v, i) => {
      if (plan && plan.ok && i === plan.pointIndex) {
        for (let s = 1; s <= plan.slots; s++) {
          points.push({
            id: unique(p.label, `${v.id}#${s}`), kind,
            text: `${plan.slots > 1 ? `Slot ${s} of ${plan.slots}: any one of` : 'Any one of'}: ${plan.of.join('; ')}${plan.slots > 1 ? ' (a different one from the other slot' + (plan.slots > 2 ? 's' : '') + ')' : ''}`,
            marks: plan.each, cites: [], acceptedAlternatives: plan.of,
          });
        }
      } else {
        points.push({ id: unique(p.label, v.id), kind, text: v.text, marks: v.marks, cites: [], acceptedAlternatives: [] });
      }
    });
  }
  return { points, problems };
}

export function markingPlanOf(row: OfficialRow): PlanResult {
  if (MCQ.has(row.qtype)) {
    const correct = row.options.find((o) => o.letter === row.correctOption);
    if (!correct || !row.correctOption) return { ok: false, problems: [`Q${questionNoOf(row)}: no correct option`] };
    const accepted = acceptedAnswersFor(row.correctOption, row.options);
    const accNorm = new Set(accepted.map(normaliseForCodeMatch));
    const wrong = [...new Set(row.options.filter((o) => o.letter !== row.correctOption).flatMap((o) => acceptedAnswersFor(o.letter, row.options)))]
      .filter((w) => !accNorm.has(normaliseForCodeMatch(w)));
    const text = correct.text.trim();
    return {
      ok: true,
      plan: {
        mode: 'exact', markableMarks: row.marks, excluded: [], acceptedAnswers: accepted, wrongAnswers: wrong,
        key: {
          referenceAnswer: text ? `${row.correctOption}. ${text}` : `Option ${row.correctOption}`,
          valuePoints: [{ id: 'correct-option', text: text ? `The correct option: ${row.correctOption}. ${text}` : `The correct option: ${row.correctOption} (drawn in the figure)`, marks: row.marks, kind: 'key_point', cites: [], acceptedAlternatives: accepted }],
        },
      },
    };
  }

  const excluded: ExcludedPart[] = row.parts.filter((p) => p.answer_kind === 'diagram').map((p) => ({ label: p.label, marks: p.marks, why: 'drawing' as const }));
  const markable = row.parts.filter((p) => p.answer_kind !== 'diagram');
  const markableMarks = sum(markable.map((p) => p.marks));
  if (!markable.length) return { ok: true, plan: { mode: 'hand', markableMarks: 0, excluded, key: null, acceptedAnswers: [], wrongAnswers: [] } };

  const { points, problems } = pointsOf(markable);
  if (problems.length) return { ok: false, problems: problems.map((p) => `Q${questionNoOf(row)}: ${p}`) };
  const got = sum(points.map((p) => p.marks));
  if (Math.abs(got - markableMarks) > 1e-9) return { ok: false, problems: [`Q${questionNoOf(row)}: the value points add to ${got}, the markable parts carry ${markableMarks}`] };
  const reference = markable.map((p) => `${p.label ? `${p.label}: ` : ''}${p.value_points.map((v) => v.text).join(' ')}`).join('\n');
  return { ok: true, plan: { mode: 'ai', markableMarks, excluded, key: { referenceAnswer: reference, valuePoints: points }, acceptedAnswers: [], wrongAnswers: [] } };
}

export type ChoiceVerdict = 'right' | 'wrong' | 'unclear';

/**
 * A multiple-choice answer, marked by code. 'right' and 'wrong' only when the whole answer is one of the option's forms (a letter, "(c)", the option's
 * words, "C. the words"), after folding case, spacing, punctuation and Devanagari digits. Anything else (two options, a sentence, a blank
 * that is not blank) is 'unclear': it is never guessed.
 */
export function choiceVerdict(plan: Pick<MarkingPlan, 'acceptedAnswers' | 'wrongAnswers'>, transcript: string): ChoiceVerdict {
  const a = normaliseForCodeMatch(transcript);
  if (!a) return 'unclear';
  const right = plan.acceptedAnswers.some((x) => normaliseForCodeMatch(x) === a);
  const wrong = plan.wrongAnswers.some((x) => normaliseForCodeMatch(x) === a);
  if (right && !wrong) return 'right';
  if (wrong && !right) return 'wrong';
  return 'unclear';
}
