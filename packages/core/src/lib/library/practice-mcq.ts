/**
 * The book's own multiple-choice questions as Practest rows (Phase 7).
 *
 * Source: `library.practice_item` rows whose printed form is `Choices: a-d` (an exercise or in-text question that
 * prints lettered options), their passage text, and, only where the evaluator role is configured, the printed answer
 * from `library.answer`. Nothing is guessed: a question whose options cannot be read back out of the printed text as
 * the labelled range, or whose answer is not a single option letter, comes out as a problem the admin sees, and an
 * imported question is always a DRAFT a person approves (practest/import).
 *
 * `casa_anchor` is the block's passage id and CASA verification re-checks it against the hub; the book's page and
 * edition travel with it.
 */
import { TEMPLATE_COLUMNS } from '../practest/import';

export interface PracticeMcqSource {
  passage_id: string;
  chapter_no: number;
  page_start: number;
  /** The block's text exactly as the library stores it (the book's words). */
  text: string;
  /** `a-d`: the printed range of option labels. */
  choices: string;
  answer_printed: boolean;
  work_title: string;
  edition: string;
  /** The printed answer, when the evaluator role is configured; null otherwise. */
  answer_text: string | null;
}

export interface ParsedMcq {
  stem: string;
  options: { label: string; text: string }[];
}

/** Letters of an `a-d` range, or null for a range that is not a plain lettered one of two to eight options. */
export function labelRange(choices: string): string[] | null {
  const m = /^([a-z])-([a-z])$/.exec(choices);
  if (!m) return null;
  const [from, to] = [m[1].charCodeAt(0), m[2].charCodeAt(0)];
  const n = to - from + 1;
  if (n < 2 || n > 8) return null;
  return Array.from({ length: n }, (_, i) => String.fromCharCode(from + i));
}

/**
 * The stem and options out of the block text: the labels must all be found, in order, each as `(a)`, `a)` or `a.`
 * at the start of the text or after whitespace. Anything else returns null (the admin sees it as not parsed).
 */
export function parseMcq(text: string, choices: string): ParsedMcq | null {
  const labels = labelRange(choices);
  if (!labels) return null;
  const marks: { label: string; start: number; end: number }[] = [];
  let from = 0;
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\s)(?:\\(${label}\\)|${label}\\)|${label}\\.)\\s+`, 'gi');
    re.lastIndex = from;
    const m = re.exec(text);
    if (!m) return null;
    const start = m.index + (m[0].length - m[0].trimStart().length);
    marks.push({ label, start, end: m.index + m[0].length });
    from = m.index + m[0].length;
  }
  const stem = text.slice(0, marks[0].start).trim();
  if (!stem) return null;
  const options = marks.map((mk, i) => ({
    label: mk.label,
    text: text.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim(),
  }));
  if (options.some((o) => !o.text)) return null;
  return { stem, options };
}

/** The option letter an answer names (`(b)`, `b`, `b.`, `(b) Mg`), or null when it is not a single option. */
export function answerLetter(answer: string | null, labels: string[]): string | null {
  if (!answer) return null;
  const m = /^\s*\(?([a-z])\)?(?:[\s.:,-]|$)/i.exec(answer.trim());
  const letter = m?.[1].toLowerCase();
  return letter && labels.includes(letter) ? letter : null;
}

export interface McqRow {
  passage_id: string;
  csv: Record<string, string>;
}

export interface McqProblem {
  passage_id: string;
  reason: string;
}

export interface PracticestScope {
  board: string;
  classLevel: number;
  subject: string;
  language: 'English' | 'Hindi';
}

export function toPracticestRows(items: PracticeMcqSource[], scope: PracticestScope): { rows: McqRow[]; problems: McqProblem[] } {
  const rows: McqRow[] = [];
  const problems: McqProblem[] = [];
  for (const it of items) {
    const labels = labelRange(it.choices);
    const parsed = parseMcq(it.text, it.choices);
    if (!labels || !parsed) {
      problems.push({ passage_id: it.passage_id, reason: `the options ${it.choices} could not be read back out of the printed text` });
      continue;
    }
    // Practest's option model is A-D.
    if (labels.length > 4) {
      problems.push({ passage_id: it.passage_id, reason: `${labels.length} options; Practest takes four` });
      continue;
    }
    const letter = answerLetter(it.answer_text, labels);
    // Practest needs the correct option: a question without a readable answer is listed, not imported.
    if (!letter) {
      const why = !it.answer_printed ? 'the book prints no answer for this question'
        : it.answer_text === null ? 'the printed answer was not read (no evaluator access)'
        : 'the printed answer is not a single option letter';
      problems.push({ passage_id: it.passage_id, reason: why });
      continue;
    }
    const opt = (l: string) => parsed.options.find((o) => o.label === l)?.text ?? '';
    rows.push({
      passage_id: it.passage_id,
      csv: {
        external_id: it.passage_id,
        board: scope.board,
        language: scope.language,
        class: String(scope.classLevel),
        subject: scope.subject,
        chapter: `Chapter ${it.chapter_no}`,
        topic: '',
        subtopic: '',
        difficulty: 'MEDIUM',
        bloom: 'UNDERSTAND',
        type: 'MCQ',
        question: parsed.stem,
        optionA: opt('a'),
        optionB: opt('b'),
        optionC: opt('c'),
        optionD: opt('d'),
        correct: letter.toUpperCase(),
        explanation: '',
        marks: '1',
        casa_book: it.work_title,
        casa_edition: it.edition,
        casa_page: String(it.page_start),
        casa_anchor: it.passage_id,
      },
    });
  }
  return { rows, problems };
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** The rows as the template CSV Practest's importer reads, so its validation and de-duplication apply unchanged. */
export function toImportCsv(rows: McqRow[]): string {
  const lines = [TEMPLATE_COLUMNS.join(',')];
  for (const r of rows) lines.push(TEMPLATE_COLUMNS.map((c) => csvCell(r.csv[c] ?? '')).join(','));
  return lines.join('\n');
}

const titleCase = (code: string) => code.toLowerCase().split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

/**
 * Board, class and subject from a work's placement codes: the first subject-level school placement
 * (`SCH.CBSE.C9.SCIENCE` -> CBSE, 9, Science). Null when the work has none; the admin then names them.
 */
export function scopeFromPlacements(placements: string[], medium: string): PracticestScope | null {
  for (const code of [...placements].sort()) {
    const m = /^SCH\.([A-Z0-9]+)\.C(\d{1,2})\.([A-Z0-9_]+)$/.exec(code);
    if (m) return { board: m[1], classLevel: Number(m[2]), subject: titleCase(m[3]), language: medium === 'hi' ? 'Hindi' : 'English' };
  }
  return null;
}
