// Book scope for key retrieval (stage1-design.md §2.3 step 1). Pure.
//
// The Qdrant filter is built strictly: class, subject and medium must all match, only the
// global textbook base (no organisation's uploads), only reference text. There is no
// relaxed retry: an empty result means there is no book, and the caller says so.

import type { KeyRequest, Medium } from './types';

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

/** "10", "Class X", "class 10", "Grade 10" -> "Class 10" (the payload's form). Throws on anything else. */
export function normaliseClass(input: string): string {
  const s = input.trim().toLowerCase().replace(/^(class|grade|std\.?|standard)\s*/, '');
  const n = /^\d{1,2}$/.test(s) ? Number(s) : ROMAN[s];
  if (!n || n < 1 || n > 12) throw new Error(`unrecognised class level "${input}"`);
  return `Class ${n}`;
}

export function normaliseMedium(input: string): Medium {
  const s = input.trim().toLowerCase();
  if (s === 'english' || s === 'en') return 'English';
  if (s === 'hindi' || s === 'hi') return 'Hindi';
  throw new Error(`unrecognised medium "${input}"`);
}

/**
 * Payload `subject` values a subject covers. Books are ingested with the book's subject on
 * some chunks and the part's subject on others (Class 9 SST has "Social Science", "History",
 * "Geography" and "Economics" chunks), so a whole-book subject includes its parts. A part
 * stays a part: "History" does not widen to the whole SST book.
 */
const SUBJECT_PARTS: Record<string, string[]> = {
  'social science': ['Social Science', 'History', 'Geography', 'Economics', 'Political Science', 'Civics', 'Democratic Politics'],
  science: ['Science', 'Physics', 'Chemistry', 'Biology'],
  mathematics: ['Mathematics'],
  maths: ['Mathematics'],
  math: ['Mathematics'],
  'political science': ['Political Science', 'Civics', 'Democratic Politics'],
  civics: ['Political Science', 'Civics', 'Democratic Politics'],
};

const titleCase = (s: string) => s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

export function subjectValues(subject: string): string[] {
  const k = subject.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!k) throw new Error('subject is empty');
  return SUBJECT_PARTS[k] ?? [titleCase(k)];
}

/**
 * Two subjects are related when either covers the other ("Social Science" and "Geography",
 * "Science" and "Physics", or the same subject). Related books share content, so a question
 * from one is not an irrelevant query for the other.
 */
export function relatedSubjects(a: string, b: string): boolean {
  const sa = new Set(subjectValues(a));
  return subjectValues(b).some((x) => sa.has(x));
}

export interface KeyScope {
  classLevel: string;
  subjects: string[];
  medium: Medium;
  contentItemId?: string;
  chapter?: string;
}

export function scopeOf(req: KeyRequest): KeyScope {
  return {
    classLevel: normaliseClass(req.classLevel),
    subjects: subjectValues(req.subject),
    medium: normaliseMedium(req.medium),
    contentItemId: req.bookHint?.contentItemId,
    chapter: req.bookHint?.chapter,
  };
}

/** Qdrant filter for a scope. Every condition is a `must`; nothing is optional. */
export function qdrantFilter(scope: KeyScope, chapter?: string): { must: Record<string, unknown>[] } {
  const must: Record<string, unknown>[] = [
    { is_empty: { key: 'organization_id' } },
    { key: 'retrieval_class', match: { value: 'reference' } },
    { key: 'class', match: { value: scope.classLevel } },
    { key: 'subject', match: { any: scope.subjects } },
    { key: 'medium', match: { value: scope.medium } },
  ];
  if (scope.contentItemId) must.push({ key: 'content_item_id', match: { value: scope.contentItemId } });
  const ch = chapter ?? scope.chapter;
  if (ch) must.push({ key: 'chapter', match: { value: ch } });
  return { must };
}
