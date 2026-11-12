// Exam packages, phase 2: what a set and a package must be before they can be published. Pure, so the publish refusals are tested exactly; the
// builder (builder.ts) loads the rows, calls these, and only then flips the status. Once published, migration 034 freezes the content, so these
// checks are the last chance to catch a set whose questions do not add up to the paper.

export interface ItemFacts {
  id: string;
  number: number;
  marks: number;
  /** The bank's choice group (internal choice: "Q12 OR Q12"); alternatives in one group count once. */
  choiceGroup: string | null;
  /** For a bank item: the bank row's status now. Null for an authored item. */
  bankStatus: string | null;
}

export interface SetFacts {
  kind: 'pyq' | 'sqp' | 'mock_half' | 'mock_full' | 'pool' | 'practice';
  maxMarks: number;
  syllabusScope: string[];
}

export type SetProblem =
  | { code: 'no_items' }
  | { code: 'marks_mismatch'; total: number; maxMarks: number }
  | { code: 'bank_row_not_published'; itemId: string; number: number; status: string }
  | { code: 'number_gap'; missing: number[] }
  | { code: 'bank_row_not_offered'; number: number; why: string }
  | { code: 'no_scope' }
  /** From the board's blueprint (blueprint.ts): a mock question or scope on a topic the year-end paper does not test. */
  | { code: 'formative_chapter'; chapter: string; topic: string; numbers: string[]; session: string }
  | { code: 'formative_scope'; chapter: string; session: string };

/**
 * The marks a candidate can actually score: each choice group (or, without one, each question number) counts once, at its highest mark.
 * "Q12 (A) OR Q12 (B)" is one question of 3 marks, not two.
 */
export function attainableMarks(items: Pick<ItemFacts, 'number' | 'marks' | 'choiceGroup'>[]): number {
  const best = new Map<string, number>();
  for (const it of items) {
    const key = it.choiceGroup ? `g:${it.choiceGroup}` : `n:${it.number}`;
    best.set(key, Math.max(best.get(key) ?? 0, it.marks));
  }
  let total = 0;
  for (const m of best.values()) total += m;
  return Math.round(total * 2) / 2;
}

/** Everything wrong with a set, in one pass; an empty list means it may be published. */
export function setProblems(set: SetFacts, items: ItemFacts[]): SetProblem[] {
  const out: SetProblem[] = [];
  if (items.length === 0) return [{ code: 'no_items' }];
  const total = attainableMarks(items);
  if (total !== set.maxMarks) out.push({ code: 'marks_mismatch', total, maxMarks: set.maxMarks });
  for (const it of items) {
    // A bank row a learner will be marked against must be one the owner has published, not merely checked.
    if (it.bankStatus !== null && it.bankStatus !== 'published') out.push({ code: 'bank_row_not_published', itemId: it.id, number: it.number, status: it.bankStatus });
  }
  const numbers = new Set(items.map((i) => i.number));
  const top = Math.max(...numbers);
  const missing: number[] = [];
  for (let n = 1; n <= top; n++) if (!numbers.has(n)) missing.push(n);
  if (missing.length) out.push({ code: 'number_gap', missing });
  if (set.kind === 'mock_half' && set.syllabusScope.length === 0) out.push({ code: 'no_scope' });
  return out;
}

export type PackageProblem = { code: 'no_published_set' };

/** A package needs at least one published set to be worth opening. A zero price is allowed (trials, grants) and not flagged. */
export function packageProblems(sets: { status: string }[]): PackageProblem[] {
  return sets.some((s) => s.status === 'published') ? [] : [{ code: 'no_published_set' }];
}

const OFFER_WHY: Record<string, string> = {
  figure_missing: 'a figure in the question has no picture yet (attach it in the bank)',
  nothing_markable: 'nothing in it can be marked here (a drawing only)',
  unusable: 'its marking scheme cannot be used',
  not_published: 'its row is not published',
  visually_impaired: 'it is the visually-impaired version',
};

/** A readable line for each problem, for the super-admin screen and the CLI. */
export function describeSetProblem(p: SetProblem): string {
  switch (p.code) {
    case 'no_items': return 'The set has no questions.';
    case 'marks_mismatch': return `The questions add up to ${p.total} marks (each internal choice counted once), but the paper is out of ${p.maxMarks}.`;
    case 'bank_row_not_published': return `Q${p.number} comes from a board-paper row that is ${p.status}, not published.`;
    case 'number_gap': return `Question number${p.missing.length === 1 ? '' : 's'} ${p.missing.join(', ')} ${p.missing.length === 1 ? 'is' : 'are'} missing.`;
    case 'no_scope': return 'A half-syllabus mock must list the chapters it covers.';
    case 'bank_row_not_offered': return `Q${p.number} cannot be set from the board paper: ${OFFER_WHY[p.why] ?? p.why}.`;
    case 'formative_chapter': return `${p.numbers.join(', ')} ${p.numbers.length === 1 ? 'is' : 'are'} on ${p.chapter}, which the ${p.session} curriculum assesses only formatively${p.topic !== p.chapter ? ` (${p.topic})` : ''}: the board paper will not ask it. Take ${p.numbers.length === 1 ? 'it' : 'them'} out of the mock.`;
    case 'formative_scope': return `The syllabus scope includes ${p.chapter}, which the ${p.session} curriculum assesses only formatively: the board paper will not ask it.`;
  }
}

// ── an authored question ────────────────────────────────────────────────────

export interface AuthoredFacts {
  qtype: string;
  marks: number;
  options?: string[];
  correctOption?: string | null;
  parts?: { label?: unknown; marks?: unknown; value_points?: unknown }[];
}

const CHOICE_TYPES = new Set(['mcq', 'assertion_reason']);
const half = (n: number) => Math.round(n * 2) / 2;

/**
 * What is wrong with a question the super-admin typed. The marking path turns value-point verdicts into marks in code, so the points must add
 * up to their part and the parts (each alternative label counted once) to the question — otherwise a full answer could not earn full marks.
 */
export function authoredProblems(q: AuthoredFacts): string[] {
  if (CHOICE_TYPES.has(q.qtype)) {
    const out: string[] = [];
    if ((q.options ?? []).length !== 4) out.push('A multiple choice question needs exactly four options.');
    if (!q.correctOption) out.push('Say which option is right.');
    return out;
  }
  const parts = q.parts ?? [];
  if (!parts.length) return ['A written question needs at least one part with its value points.'];
  const out: string[] = [];
  const byLabel = new Map<string, number>();
  for (const [i, p] of parts.entries()) {
    const label = String(p.label ?? '');
    const name = label ? `Part (${label})` : parts.length > 1 ? `Part ${i + 1}` : 'The answer';
    const pm = Number(p.marks);
    const points = Array.isArray(p.value_points) ? (p.value_points as { marks?: unknown }[]) : [];
    if (!points.length) { out.push(`${name} has no value points.`); continue; }
    const sum = half(points.reduce((s, v) => s + Number(v.marks ?? 0), 0));
    if (sum !== pm) out.push(`${name}: the value points add up to ${sum}, but the part is worth ${pm}.`);
    byLabel.set(label, Math.max(byLabel.get(label) ?? 0, pm));
  }
  const total = half([...byLabel.values()].reduce((s, m) => s + m, 0));
  if (total !== q.marks) out.push(`The parts add up to ${total} marks, but the question is worth ${q.marks}.`);
  return out;
}
