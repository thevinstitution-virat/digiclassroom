// Self-practice, phase 2: the textbook questions a learner can pick (docs/hw-eval/self-practice.md).
//
// The library hub is the only source. Its search returns the book's own exercise rows ("practice" rows, several numbered questions each);
// they are split into single questions here. A question is only ever offered, and only ever accepted, if the hub returns it for the learner's
// class, subject and medium: the server never trusts question text from the browser.

import { libraryHubEnabled, searchLibrary } from '../../library/search';
import { HubError, type HubSearchRequest, type HubSearchResponse } from '../../library/hub-client';
import { and, eq, sql } from 'drizzle-orm';
import { hwEligibility } from '@/db/hw-control-schema';
import { getHwConfig } from '../config';
import type { Exec } from '../db';
import { runningConfig } from '../eligibility/registry';
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
 * different families, a calibrated R_min, and an API key for the provider of each). Until then the tab says "coming soon" and does not offer the trial, because starting it starts the clock.
 */
/**
 * Is at least one textbook-key group eligible for AI marks under the marking setup running now? Without one a learner would get their handwriting read and
 * no mark. Needs a grade model; false otherwise.
 */
export async function textbookGroupEligible(x: Exec): Promise<boolean> {
  let hash: string;
  try { hash = runningConfig().hash; } catch { return false; }
  const rows = await x.select({ n: sql<number>`count(*)::int` }).from(hwEligibility)
    .where(and(eq(hwEligibility.schemeSource, 'textbook_key'), eq(hwEligibility.status, 'eligible'), eq(hwEligibility.configHash, hash)));
  return (rows[0]?.n ?? 0) > 0;
}

/** Ready for learners: the library and the answer keys are wired, and (unless the owner turned that off) a textbook-key group can be marked by AI. */
export async function practiceReady(x: Exec): Promise<boolean> {
  if (!practiceLibraryReady()) return false;
  return getHwConfig().HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP ? textbookGroupEligible(x) : true;
}

export function practiceLibraryReady(): boolean {
  if (!libraryHubEnabled()) return false;
  try {
    const k = keySettingsFromEnv();
    const c = getHwConfig();
    const keyFor = { gemini: c.GEMINI_API_KEY, openrouter: c.OPENROUTER_API_KEY, openai: c.OPENAI_API_KEY } as const;
    return k.rMin !== undefined && Boolean(keyFor[k.writer.provider]) && Boolean(keyFor[k.verifier.provider]);
  } catch { return false; }
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

/** The books on offer (HW_SELF_PRACTICE_SCOPES; default Class 9 Science, English). */
export function practiceScopes(raw: string | undefined = getHwConfig().HW_SELF_PRACTICE_SCOPES): PracticeScope[] {
  const out: PracticeScope[] = [];
  for (const part of (raw && raw.trim() ? raw : '9:Science:en').split(',')) {
    const [c, subject, m] = part.split(':').map((x) => x.trim());
    const classLevel = Number(c);
    if (Number.isInteger(classLevel) && classLevel >= 1 && classLevel <= 12 && subject && (m === 'en' || m === 'hi')) out.push({ classLevel, subject, medium: m });
  }
  return out;
}

/** Refuses a class, subject and medium the library has no book for on offer, so a question is never keyed from another subject's book. */
export function requireOfferedScope(scope: PracticeScope): void {
  const ok = practiceScopes().some((s) => s.classLevel === scope.classLevel && s.medium === scope.medium && s.subject.toLowerCase() === scope.subject.toLowerCase());
  if (!ok) throw new HwError('BAD_REQUEST', `${PRACTICE_TEXT.scopeOff.en} / ${PRACTICE_TEXT.scopeOff.hi}`);
}

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
  requireOfferedScope(scope);
  // The word "questions" pulls the book's exercise rows forward: the hub ranks them with the explanatory text, and a topic alone often returns none (measured on the live book).
  const res = await searchHub(hub, requestOf(scope, `${query} questions`));
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
