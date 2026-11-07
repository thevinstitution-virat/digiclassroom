// From the bank file to what a learner can attempt: one row per thing answered. An internal choice becomes one row per alternative (the same
// choice_group, so a total never counts both), a "for visually impaired students" version is its own row, and a multiple-choice row carries every
// way a student may write the right answer. Pure: no database, no clock, no randomness, so the same file always gives the same rows and hashes.

import { createHash } from 'node:crypto';
import type { BankFile, BankFigureIn, BankPartIn, BankQuestion, BankVariant } from './schema';
import { marksFor } from './validate';

export interface ExpandedFigure {
  figureId: string;
  side: 'paper' | 'scheme';
  description: string;
  labels: unknown[];
  readings: unknown | null;
  confidence: 'high' | 'medium' | 'low';
  needsPersonCheck: boolean;
  note: string | null;
}

export interface ExpandedQuestion {
  number: number;
  alt: 'A' | 'B' | 'C' | 'D' | null;
  variant: 'vi' | null;
  section: string;
  marks: number;
  qtype: BankQuestion['type'];
  stem: string;
  stemRaw: string;
  options: { letter: string; text: string }[];
  correctOption: string | null;
  acceptedAnswers: string[];
  choiceGroup: string | null;
  choiceKind: 'option' | 'subpart' | null;
  parts: BankPartIn[];
  schemeText: string;
  equations: { plain: string; latex: string }[];
  diagramParts: string[];
  /** What a person has to look at before this row can be checked. Not part of the content hash. */
  needsCheck: string[];
  figures: ExpandedFigure[];
  contentHash: string;
}

export interface ExpandedPaper {
  board: string;
  classLevel: number;
  subject: string;
  subjectCode: string;
  session: string;
  kind: 'sqp' | 'past_paper';
  title: string;
  maxMarks: number;
  duration: string | null;
  sourceFiles: string[];
  questions: ExpandedQuestion[];
}

/** The ways a student may write the answer to a multiple-choice question, for the exact-match marker (letter, "(c)", the option's own words...). */
export function acceptedAnswersFor(correct: string, options: { letter: string; text: string }[]): string[] {
  const o = options.find((x) => x.letter === correct);
  if (!o) return [];
  const t = o.text.trim();
  // Drawn options have no words: the learner can only pick by letter.
  const out = [correct, `(${correct.toLowerCase()})`, `${correct}.`, `${correct})`, ...(t ? [t, `${correct}. ${t}`] : [])];
  return [...new Set(out.filter(Boolean))];
}

/** Stable JSON: object keys sorted, so a hash does not depend on the order a script happened to write them. */
export function canonicalJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** The part of a row a person checks and a learner sees: change any of it and the row needs a new check. */
export function hashContent(r: Omit<ExpandedQuestion, 'contentHash' | 'needsCheck'>): string {
  return sha256(canonicalJson({
    marks: r.marks, qtype: r.qtype, stem: r.stem, options: r.options, correctOption: r.correctOption, acceptedAnswers: r.acceptedAnswers,
    choiceGroup: r.choiceGroup, choiceKind: r.choiceKind, parts: r.parts, schemeText: r.schemeText, equations: r.equations, diagramParts: r.diagramParts,
    figures: r.figures,
  }));
}

function figureOf(f: BankFigureIn): ExpandedFigure {
  return {
    figureId: f.id,
    side: f.id.includes('-ms-') ? 'scheme' : 'paper',
    description: f.description,
    labels: f.labels ?? [],
    readings: f.values ?? null,
    confidence: f.confidence,
    needsPersonCheck: f.needs_person_check,
    note: f.note ?? null,
  };
}

/** A diagram-answer part belongs to the alternative its label starts with ("A(i)" to A); a label of no alternative belongs to every row. */
function diagramFor(parts: string[], alt: string | null, alternatives: readonly string[]): string[] {
  if (!alt) return parts;
  return parts.filter((p) => !alternatives.includes(p.charAt(0)) || p.charAt(0) === alt);
}

function needsCheckFor(parts: BankPartIn[], figures: ExpandedFigure[], diagram: string[], q: BankFile['scheme_issues'], hasEquations: boolean, drawnOptions: boolean): string[] {
  const n: string[] = [];
  for (const p of parts) if (p.marks_split_inferred) n.push(`part ${p.label || '-'}: the scheme prints a total but not how it divides over the points`);
  for (const f of figures) if (f.needsPersonCheck) n.push(`figure ${f.figureId}: read with ${f.confidence} confidence`);
  for (const d of diagram) n.push(`${d}: the expected answer is a drawing`);
  for (const s of q) if (s.status !== 'closed') n.push(`printed scheme: ${s.where}: ${s.problem}`);
  if (hasEquations) n.push('equations: read-back of the written forms');
  if (drawnOptions) n.push('options are drawn in the figure: the learner picks by letter, and the figure must be shown');
  return n;
}

function build(paperQ: BankQuestion, v: BankVariant | null, issues: BankFile['scheme_issues'], alt: 'A' | 'B' | 'C' | 'D' | null): ExpandedQuestion {
  const choice = v ? v.choice ?? null : paperQ.choice;
  const isMcq = paperQ.type === 'mcq' || paperQ.type === 'assertion_reason';
  const alternatives = choice?.alternatives ?? [];

  let stem: string;
  if (isMcq) stem = (v ? v.stem : paperQ.stem) ?? '';
  else if (choice && alt) {
    const own = choice.alternatives_text[alt] ?? '';
    stem = choice.kind === 'subpart' ? `${choice.common_text}\n${own}`.trim() : own;
  }
  else stem = (v ? v.stem_raw : paperQ.stem) ?? '';
  const stemRaw = (v ? v.stem_raw : paperQ.stem_raw) ?? '';

  const options = isMcq ? ((v ? v.options : paperQ.options) ?? []) : [];
  const correct = isMcq ? ((v ? v.correct_option : paperQ.correct_option) ?? null) : null;
  const allParts = isMcq ? [] : ((v ? v.parts : paperQ.parts) ?? []);
  const parts = alt ? allParts.filter((p) => p.alternative === null || p.alternative === alt) : allParts;
  if (parts.length && Math.abs(marksFor(parts, alt) - paperQ.marks_total) > 1e-9) throw new Error(`Q${paperQ.number}${alt ?? ''}: parts do not add to the question's marks (validate first)`);

  // A visually impaired version is text only: the figures are what it replaces.
  const figures = v ? [] : paperQ.figures.filter((f) => !f.alt || f.alt === alt).map(figureOf);
  const diagram = v ? [] : diagramFor(paperQ.diagram_answer_parts, alt, alternatives);
  const equations = v ? [] : paperQ.equations;
  const myIssues = issues.filter((s) => s.q === paperQ.number);

  const base: Omit<ExpandedQuestion, 'contentHash' | 'needsCheck'> = {
    number: paperQ.number, alt, variant: v ? 'vi' : null, section: paperQ.section, marks: paperQ.marks_total, qtype: paperQ.type,
    stem, stemRaw, options, correctOption: correct,
    acceptedAnswers: correct ? acceptedAnswersFor(correct, options) : [],
    choiceGroup: choice ? `Q${paperQ.number}${v ? '-vi' : ''}` : null,
    choiceKind: choice ? choice.kind : null,
    parts, schemeText: (v ? v.scheme_raw : paperQ.scheme_raw) ?? '', equations, diagramParts: diagram, figures,
  };
  return { ...base, needsCheck: needsCheckFor(parts, figures, diagram, myIssues, equations.length > 0, options.length > 0 && options.every((o) => !o.text.trim())), contentHash: hashContent(base) };
}

/** Expands a validated bank file into the rows the importer stores. `kind` fills in for a file that does not say. */
export function expandBank(bank: BankFile, opts: { kind?: 'sqp' | 'past_paper' } = {}): ExpandedPaper {
  const kind = bank.paper.kind ?? opts.kind;
  if (!kind) throw new Error('the file does not say whether this is a sample paper or a past paper: pass kind sqp or past_paper');
  const questions: ExpandedQuestion[] = [];
  for (const q of bank.questions) {
    const alts = q.choice ? q.choice.alternatives : [null];
    for (const a of alts) questions.push(build(q, null, bank.scheme_issues, a));
    const v = q.variant_for_visually_impaired;
    if (v) for (const a of v.choice ? v.choice.alternatives : [null]) questions.push(build(q, v, bank.scheme_issues, a));
  }
  return {
    board: bank.paper.board, classLevel: bank.paper.klass, subject: bank.paper.subject, subjectCode: bank.paper.code, session: bank.paper.year, kind,
    title: bank.paper.title, maxMarks: bank.paper.max_marks, duration: bank.paper.duration ?? null, sourceFiles: bank.paper.source_files, questions,
  };
}

/** The key a row is found by, in the paper and in the database. */
export const rowKey = (r: { number: number; alt: string | null; variant: string | null }) => `${r.number}|${r.alt ?? ''}|${r.variant ?? ''}`;
