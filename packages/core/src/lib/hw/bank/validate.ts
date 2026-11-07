// Meaning checks on a parsed bank file: the things a shape check cannot see. Every problem is returned, with the question it is in; the importer
// refuses a file with any problem, because a paper whose marks do not add up would put a wrong total in front of a learner.

import type { BankFile, BankPartIn, BankQuestion, BankVariant } from './schema';
import { planAnyN } from './anyn';
import { equationProblems } from './equations';
import { normForQuote } from './norm';

const EPS = 1e-9;

export { normForQuote };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Marks a student can earn from these parts when one alternative is chosen: the common parts plus the chosen alternative's. */
export function marksFor(parts: BankPartIn[], alt: string | null): number {
  return sum(parts.filter((p) => p.alternative === null || p.alternative === alt).map((p) => p.marks));
}

export function alternativesOf(parts: BankPartIn[]): string[] {
  return [...new Set(parts.map((p) => p.alternative).filter((a): a is NonNullable<typeof a> => a !== null))];
}

function checkParts(label: string, parts: BankPartIn[], expected: number, schemeRaw: string | null, alternatives: readonly string[], out: string[]) {
  const alts = alternatives.length ? alternatives : [null];
  for (const a of alts) {
    const got = marksFor(parts, a);
    if (Math.abs(got - expected) > EPS) out.push(`${label}${a ? ` (alternative ${a})` : ''}: parts add to ${got}, the question carries ${expected}`);
  }
  const ids = new Set<string>();
  const nScheme = normForQuote(schemeRaw ?? '');
  for (const p of parts) {
    const where = `${label} part ${p.label || '-'}`;
    const vp = sum(p.value_points.map((v) => v.marks));
    if (Math.abs(vp - p.marks) > EPS) out.push(`${where}: value points add to ${vp}, the part carries ${p.marks}`);
    if (p.alternative !== null && alternatives.length && !alternatives.includes(p.alternative)) out.push(`${where}: belongs to alternative ${p.alternative}, which the question does not offer`);
    for (const v of p.value_points) {
      const key = `${p.alternative ?? ''}|${p.label}|${v.id}`;
      if (ids.has(key)) out.push(`${where}: value point id ${v.id} is used twice`);
      ids.add(key);
      if (v.quote && !nScheme.includes(normForQuote(v.quote))) out.push(`${where}: the quote for ${v.id} is not in the printed scheme: ${JSON.stringify(v.quote)}`);
    }
    if (p.official_answer_quote && !nScheme.includes(normForQuote(p.official_answer_quote))) out.push(`${where}: the official-answer quote is not in the printed scheme: ${JSON.stringify(p.official_answer_quote)}`);
    if (p.any_n_of_m && p.any_n_of_m.n > p.any_n_of_m.of.length) out.push(`${where}: asks for any ${p.any_n_of_m.n} of only ${p.any_n_of_m.of.length}`);
    // An "any N of M" part must be one the marking can turn into N slots (which point holds the list, and the marks share out in half marks).
    const slots = planAnyN(p);
    if (slots && !slots.ok) out.push(`${where}: ${slots.problem}`);
  }
}

function checkMcq(label: string, options: { letter: string; text: string }[], correct: string | null | undefined, hasFigure: boolean, out: string[]) {
  const letters = options.map((o) => o.letter).join('');
  if (letters !== 'ABCD') out.push(`${label}: options are ${letters || 'missing'}, expected A, B, C, D`);
  if (!correct) out.push(`${label}: no correct option`);
  else if (!options.some((o) => o.letter === correct)) out.push(`${label}: correct option ${correct} is not one of the options`);
  const empty = options.filter((o) => !o.text.trim()).length;
  if (empty && !hasFigure) out.push(`${label}: an option has no text and the question has no figure that shows the options`);
  if (empty && empty !== options.length) out.push(`${label}: some options are drawn and some are written`);
  const words = options.filter((o) => o.text.trim()).map((o) => normForQuote(o.text));
  if (new Set(words).size !== words.length) out.push(`${label}: two options have the same text`);
}

function checkChoice(label: string, choice: NonNullable<BankQuestion['choice']>, out: string[]) {
  const [a, b] = choice.alternatives;
  if (a === b) out.push(`${label}: the two alternatives are both ${a}`);
  for (const k of choice.alternatives) if (!choice.alternatives_text[k]?.trim()) out.push(`${label}: no text for alternative ${k}`);
  if (choice.kind === 'subpart' && !choice.common_text.trim()) out.push(`${label}: a sub-part choice needs the common text`);
  if (choice.kind === 'option' && choice.common_text.trim()) out.push(`${label}: a whole-option choice has no common text`);
}

function checkVariant(label: string, q: BankQuestion, v: BankVariant, out: string[]) {
  if (v.replaces_question !== q.number) out.push(`${label}: says it replaces question ${v.replaces_question}`);
  const isMcq = q.type === 'mcq' || q.type === 'assertion_reason';
  if (isMcq) {
    if (!v.stem) out.push(`${label}: no stem`);
    checkMcq(label, v.options ?? [], v.correct_option, q.figures.length > 0, out);
    return;
  }
  if (!v.parts?.length) { out.push(`${label}: no parts`); return; }
  if (q.choice && !v.choice) out.push(`${label}: the question has a choice but the visually impaired version does not say how it splits`);
  if (v.choice) checkChoice(label, v.choice, out);
  checkParts(label, v.parts, q.marks_total, v.scheme_raw, v.choice ? [...v.choice.alternatives] : alternativesOf(v.parts), out);
}

/** Problems with the file's meaning. Empty means the file is safe to import as a draft. */
export function validateBank(bank: BankFile): string[] {
  const out: string[] = [];
  const nums = bank.questions.map((q) => q.number);
  if (new Set(nums).size !== nums.length) out.push('a question number is used twice');
  nums.forEach((n, i) => { if (n !== i + 1) { if (!out.some((x) => x.startsWith('question numbers'))) out.push(`question numbers are not 1..${nums.length} in order (at position ${i + 1} there is ${n})`); } });

  // The paper total counts every question once: an internal choice carries the marks of one alternative.
  const total = sum(bank.questions.map((q) => q.marks_total));
  if (Math.abs(total - bank.paper.max_marks) > EPS) out.push(`questions add to ${total} marks, the paper says ${bank.paper.max_marks}`);
  if (bank.paper.sections) {
    for (const s of bank.paper.sections) {
      const inSection = bank.questions.filter((q) => q.section === s.id);
      if (!inSection.length) out.push(`section ${s.id} has no questions`);
    }
    const known = new Set(bank.paper.sections.map((s) => s.id));
    for (const q of bank.questions) if (!known.has(q.section)) out.push(`Q${q.number}: section ${q.section} is not one of the paper's sections`);
  }

  const issues = bank.scheme_issues;
  for (const s of issues) if (!bank.questions.some((q) => q.number === s.q)) out.push(`a scheme issue is about question ${s.q}, which is not in the paper`);

  for (const q of bank.questions) {
    const label = `Q${q.number}`;
    const isMcq = q.type === 'mcq' || q.type === 'assertion_reason';
    if (isMcq) {
      checkMcq(label, q.options, q.correct_option, q.figures.length > 0, out);
      if (q.parts.length) out.push(`${label}: a multiple-choice question has no parts`);
      if (q.choice) out.push(`${label}: a multiple-choice question has no internal choice`);
    } else {
      if (q.options.length || q.correct_option) out.push(`${label}: a written question has no options`);
      if (!q.parts.length) out.push(`${label}: no parts`);
      else checkParts(label, q.parts, q.marks_total, q.scheme_raw, q.choice ? [...q.choice.alternatives] : [], out);
    }
    if (q.choice) {
      checkChoice(label, q.choice, out);
      if (!q.parts.some((p) => p.alternative !== null)) out.push(`${label}: has a choice but no part says which alternative it belongs to`);
      if (q.choice.kind === 'option' && q.parts.some((p) => p.alternative === null)) out.push(`${label}: a whole-option choice has no common parts`);
      if (q.choice.kind === 'subpart' && !q.parts.some((p) => p.alternative === null)) out.push(`${label}: a sub-part choice has no common parts`);
    } else if (q.parts.some((p) => p.alternative !== null)) {
      out.push(`${label}: a part names an alternative but the question has no choice`);
    }

    const figIds = new Set<string>();
    for (const f of q.figures) {
      if (figIds.has(f.id)) out.push(`${label}: figure id ${f.id} is used twice`);
      figIds.add(f.id);
      if (!f.id.startsWith(`q${q.number}-`)) out.push(`${label}: figure id ${f.id} should start with q${q.number}-`);
      if (f.alt && !q.choice?.alternatives.includes(f.alt)) out.push(`${label}: figure ${f.id} belongs to alternative ${f.alt}, which the question does not offer`);
    }
    if (q.diagram_answer_required !== (q.diagram_answer_parts.length > 0)) out.push(`${label}: diagram_answer_required and diagram_answer_parts disagree`);
    if (q.diagram_answer_parts.length && !q.parts.some((p) => p.answer_kind === 'diagram')) out.push(`${label}: lists a diagram answer but no part has answer_kind diagram`);

    out.push(...equationProblems(label, q.equations));
    if (q.variant_for_visually_impaired) checkVariant(`${label} (visually impaired)`, q, q.variant_for_visually_impaired, out);
  }
  return out;
}
