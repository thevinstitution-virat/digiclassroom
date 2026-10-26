/**
 * CASA verification over the library hub: does a library passage support the question's keyed answer? Scoped by the
 * question's node (its board, class and subject as curriculum v2 codes), never by a global search; the matched
 * passage's id is the question's `casa_anchor`, which survives a re-index of the book.
 *
 * Hub only: a CASA pass must not rest on the unscoped direct reader, so a hub outage is an error here.
 */
import { subjectValues } from '../hw/keys/scope';
import { classNodeCode } from './scope';
import { searchLibrary, type SearchDeps } from './search';

const slug = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export interface CasaQuestion {
  board: string | null;
  classLevel: number | null;
  subject: string | null;
}

/** `SCH.CBSE.C9.SCIENCE`-style codes for the question; the class code alone when it has no subject; null without a class. */
export function casaScopeCodes(q: CasaQuestion): string[] | null {
  const classCode = classNodeCode(q.board ?? 'CBSE', q.classLevel);
  if (!classCode) return null;
  if (!q.subject?.trim()) return [classCode];
  const slugs = new Set(subjectValues(q.subject).map(slug));
  if (q.classLevel === 10 && slugs.has('MATHEMATICS')) { slugs.add('MATHEMATICS_STANDARD'); slugs.add('MATHEMATICS_BASIC'); }
  return [...slugs].map((s) => `${classCode}.${s}`);
}

export interface CasaMatch {
  id: string;
  content: string;
  /** Dense cosine, comparable with CASA_VERIFY_THRESHOLD. */
  score: number;
  page: number | null;
  chapter: string | null;
}

/** The best library match for the claim, or null when nothing in scope has a comparable dense score. */
export async function casaTopMatch(claim: string, q: CasaQuestion, deps: SearchDeps = {}): Promise<CasaMatch | null> {
  const nodeCodes = casaScopeCodes(q);
  if (!nodeCodes) throw new Error('the question has no class to scope the verification by');
  const res = await searchLibrary({ query: claim, nodeCodes, limit: 5, window: 0 }, { ...deps, direct: null });
  const scored = res.results.filter((r) => r.score.dense !== null).sort((a, b) => b.score.dense! - a.score.dense!);
  const top = scored[0];
  return top
    ? { id: top.passage_id, content: top.text, score: top.score.dense!, page: top.page_start, chapter: `Chapter ${top.chapter_no}` }
    : null;
}
