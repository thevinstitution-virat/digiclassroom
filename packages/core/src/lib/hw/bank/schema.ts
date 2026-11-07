// The board-paper bank file (format "cbse-paper-bank/2"): one official paper and its official marking scheme, structured by hand and by script and
// then checked by a person (docs/hw-eval/board-paper-importer.md). This file only describes the SHAPE; whether the numbers add up and the quotes
// are really in the scheme is validate.ts.
//
// The files themselves stay out of git (hw-evals/ is ignored): the papers are board documents, and the structuring work is the school's.

import { z } from 'zod';

export const BANK_FORMAT = 'cbse-paper-bank/2';

const half = z.number().nonnegative().refine((x) => Math.abs(x * 2 - Math.round(x * 2)) < 1e-9, 'not in 0.5 steps');
const positiveHalf = half.refine((x) => x > 0, 'must be more than 0');
const text = z.string().min(1);
const letter = z.enum(['A', 'B', 'C', 'D']);

export const QUESTION_TYPES = ['mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const ANSWER_KINDS = ['text', 'numeric', 'equation', 'diagram', 'choice_letter'] as const;

const valuePoint = z.object({
  id: text,
  text,
  marks: positiveHalf,
  /** A short stretch of the printed scheme that this point rests on; validate.ts checks it is really there. */
  quote: z.string(),
  required: z.boolean().optional(),
}).passthrough();

const part = z.object({
  /** '' for a question without lettered parts; otherwise the printed label ('A', 'B', 'C', 'A(i)'...). */
  label: z.string(),
  /** The alternative this part belongs to; null for a part every student answers. */
  alternative: letter.nullable(),
  marks: positiveHalf,
  answer_kind: z.enum(ANSWER_KINDS),
  official_answer_quote: z.string().nullable().optional(),
  value_points: z.array(valuePoint).min(1),
  any_n_of_m: z.object({ n: z.number().int().positive(), of: z.array(z.string()).min(2) }).nullable().optional(),
  marks_split_inferred: z.boolean().optional(),
  scheme_notes: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
}).passthrough();

/** An option's words. Empty only when the options are drawn (a figure shows them): validate.ts requires a figure then. */
const option = z.object({ letter, text: z.string() });

const figure = z.object({
  id: text,
  /** The alternative the figure belongs to, for a choice question; null/absent when it serves every alternative. */
  alt: letter.nullable().optional(),
  description: text,
  labels: z.array(z.unknown()).optional(),
  values: z.unknown().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  needs_person_check: z.boolean(),
  note: z.string().optional(),
});

const choice = z.object({
  /** 'option': the whole question is A or B. 'subpart': a common part, then C or D. */
  kind: z.enum(['option', 'subpart']),
  alternatives: z.tuple([letter, letter]),
  /** What every student reads before choosing (empty for a whole-option choice). */
  common_text: z.string(),
  /** What each alternative shows the student. */
  alternatives_text: z.record(letter, text),
});

const variant = z.object({
  replaces_question: z.number().int().positive(),
  stem_raw: z.string().nullable(),
  scheme_raw: z.string().nullable(),
  stem: z.string().optional(),
  options: z.array(option).optional(),
  correct_option: letter.nullable().optional(),
  parts: z.array(part).optional(),
  choice: choice.optional(),
});

const equation = z.object({ plain: z.string(), latex: z.string() });

const question = z.object({
  number: z.number().int().positive(),
  section: z.string().min(1),
  marks_total: positiveHalf,
  type: z.enum(QUESTION_TYPES),
  stem_raw: text,
  scheme_raw: z.string(),
  stem: text,
  options: z.array(option),
  correct_option: letter.nullable(),
  parts: z.array(part),
  choice: choice.nullable(),
  figures: z.array(figure),
  diagram_answer_required: z.boolean(),
  diagram_answer_parts: z.array(z.string()),
  equations: z.array(equation),
  variant_for_visually_impaired: variant.nullable(),
});

const schemeIssue = z.object({
  q: z.number().int().positive(),
  where: z.string(),
  printed: z.string(),
  problem: z.string(),
  final_answer_still_right: z.boolean(),
  status: z.string().optional(),
});

export const bankFileSchema = z.object({
  format: z.literal(BANK_FORMAT),
  paper: z.object({
    title: text,
    board: text,
    klass: z.number().int().min(1).max(12),
    subject: text,
    code: text,
    year: text,
    /** 'sqp' (sample question paper) or 'past_paper'. Absent in older files: the importer then needs --kind. */
    kind: z.enum(['sqp', 'past_paper']).optional(),
    max_marks: positiveHalf,
    duration: z.string().optional(),
    source_files: z.array(z.string()).default([]),
    sections: z.array(z.object({ id: text, name: z.string(), questions: z.string() })).optional(),
  }).passthrough(),
  questions: z.array(question).min(1),
  scheme_issues: z.array(schemeIssue).default([]),
}).passthrough();

export type BankFile = z.infer<typeof bankFileSchema>;
export type BankQuestion = BankFile['questions'][number];
export type BankPartIn = z.infer<typeof part>;
export type BankFigureIn = z.infer<typeof figure>;
export type BankVariant = z.infer<typeof variant>;
export type BankSchemeIssue = z.infer<typeof schemeIssue>;

/** Parses a bank file's JSON text. Every problem is returned (not just the first), each with the path it is at. */
export function parseBankFile(jsonText: string): { ok: true; bank: BankFile } | { ok: false; problems: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch (e) { return { ok: false, problems: [`not valid JSON: ${e instanceof Error ? e.message : String(e)}`] }; }
  const r = bankFileSchema.safeParse(raw);
  if (r.success) return { ok: true, bank: r.data };
  return { ok: false, problems: r.error.issues.slice(0, 50).map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`) };
}
