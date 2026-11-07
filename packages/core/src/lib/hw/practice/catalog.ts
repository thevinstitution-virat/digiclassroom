// Self-practice, phase 2: the textbook questions a learner can pick (docs/hw-eval/self-practice.md).
//
// The library hub is the only source. Its search returns the book's own exercise rows ("practice" rows, several numbered questions each);
// they are split into single questions here. A question is only ever offered, and only ever accepted, if the hub returns it for the learner's
// class, subject and medium: the server never trusts question text from the browser.

import { libraryHubEnabled, searchLibrary } from '../../library/search';
import { HubError, type HubSearchRequest, type HubSearchResponse } from '../../library/hub-client';
import { HwError } from '../errors';
import { exerciseQuestions, jaccard, matchWords, shingles } from '../keys/exercise-match';
import { subjectNodeCodes } from '../keys/hub-retrieval';
import { keySettingsFromEnv } from '../keys/service';
import { normaliseClass } from '../keys/scope';
import { PRACTICE_TEXT, questionShape, type PracticeQuestionType } from './rules';

export interface PracticeScope { classLevel: number; subject: string; medium: 'en' | 'hi' }

export interface CatalogQuestion {
  /** `passageId:index`: stable while the book is unchanged. */
  ref: string;
  passageId: string;
  index: number;
  text: string;
  book: string;
  chapter: number;
  page: number;
  shape: { type: PracticeQuestionType; marks: number };
}

export interface HubLike { search(req: HubSearchRequest): Promise<HubSearchResponse> }

/**
 * Can a learner start a trial and get something out of it? The library hub is on, and the answer-key service is configured (writer and verifier of
 * different families, and a calibrated R_min). Until then the tab says "coming soon" and does not offer the trial, because starting it starts the clock.
 */
export function practiceLibraryReady(): boolean {
  if (!libraryHubEnabled()) return false;
  try { return keySettingsFromEnv().rMin !== undefined; } catch { return false; }
}

/** The real hub, or null while the library hub is off (then no textbook question can be offered or accepted). */
export const defaultHub = (): HubLike | null => (libraryHubEnabled() ? { search: (req) => searchLibrary(req, { direct: null }) } : null);

export function parseScope(input: { classLevel: string | number; subject: string; medium: string }): PracticeScope {
  let level: number;
  try { level = Number(/\d+/.exec(normaliseClass(String(input.classLevel)))![0]); } catch { throw new HwError('BAD_REQUEST', 'Choose a class from 1 to 12.'); }
  const subject = String(input.subject ?? '').trim().replace(/\s+/g, ' ');
  if (subject.length < 2 || subject.length > 60) throw new HwError('BAD_REQUEST', 'Choose a subject.');
  const medium = String(input.medium ?? '').trim().toLowerCase();
  if (medium !== 'en' && medium !== 'hi') throw new HwError('BAD_REQUEST', 'Choose English or Hindi medium.');
  return { classLevel: level, subject, medium };
}

const MAX_LISTED = 30;

function requestOf(scope: PracticeScope, query: string): HubSearchRequest {
  return { query, nodeCodes: subjectNodeCodes(`Class ${scope.classLevel}`, scope.subject), medium: scope.medium, includePractice: true, limit: 20, window: 0 };
}

async function searchHub(hub: HubLike, req: HubSearchRequest): Promise<HubSearchResponse> {
  try { return await hub.search(req); } catch (e) {
    if (e instanceof HubError) throw new HwError('PROVIDER_ERROR', 'The textbook library is not reachable right now. Please try again in a little while.', e.message);
    throw e;
  }
}

function questionsOf(res: HubSearchResponse): CatalogQuestion[] {
  const out: CatalogQuestion[] = [];
  const seen = new Set<string>();
  for (const r of res.results) {
    if (r.retrieval_class !== 'practice') continue;
    exerciseQuestions(r.text).forEach((text, index) => {
      const ref = `${r.passage_id}:${index}`;
      if (seen.has(ref) || text.length < 8) return;
      seen.add(ref);
      out.push({ ref, passageId: r.passage_id, index, text, book: r.work_title, chapter: r.chapter_no, page: r.page_start, shape: questionShape(matchWords(text).length) });
    });
  }
  return out;
}

/** Book exercise questions about a topic the learner typed, most relevant first. */
export async function searchPracticeQuestions(scope: PracticeScope, rawQuery: string, hub: HubLike | null = defaultHub()): Promise<{ available: boolean; questions: CatalogQuestion[]; warnings: string[]; message?: { en: string; hi: string } }> {
  const query = rawQuery.trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 200) throw new HwError('BAD_REQUEST', 'Type a topic of 2 to 200 characters.');
  if (!hub) return { available: false, questions: [], warnings: [], message: PRACTICE_TEXT.libraryOff };
  const res = await searchHub(hub, requestOf(scope, query));
  const q = shingles(query, 1);
  const ranked = questionsOf(res)
    .map((c, i) => ({ c, i, s: jaccard(q, shingles(c.text, 1)) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, MAX_LISTED)
    .map(({ c }) => c);
  return { available: true, questions: ranked, warnings: res.warnings };
}

const norm = (s: string) => matchWords(s).join(' ');

/**
 * Is this exactly one of the book's own exercise questions for this class, subject and medium? Asks the hub again with the question's own
 * words and accepts only a practice row with this passage id whose numbered question matches. Returns the question as the hub has it.
 */
export async function verifyCatalogQuestion(scope: PracticeScope, claim: { passageId: string; index: number; text: string }, hub: HubLike | null = defaultHub()): Promise<CatalogQuestion | null> {
  if (!hub) throw new HwError('FEATURE_DISABLED', `${PRACTICE_TEXT.libraryOff.en} / ${PRACTICE_TEXT.libraryOff.hi}`);
  if (!Number.isInteger(claim.index) || claim.index < 0 || claim.index > 99 || claim.text.length < 8 || claim.text.length > 2000) return null;
  const res = await searchHub(hub, requestOf(scope, claim.text.trim().slice(0, 200)));
  const found = questionsOf(res).find((c) => c.passageId === claim.passageId && c.index === claim.index && norm(c.text) === norm(claim.text));
  return found ?? null;
}
