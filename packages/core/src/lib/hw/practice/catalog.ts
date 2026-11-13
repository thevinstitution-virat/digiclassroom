// Self-practice, phase 2: the textbook questions a learner can pick (docs/hw-eval/self-practice.md).
//
// The library hub is the only source. Its search returns the book's own exercise rows ("practice" rows, several numbered questions each);
// they are split into single questions here. A question is only ever offered, and only ever accepted, if the hub returns it for the learner's
// class, subject and medium: the server never trusts question text from the browser.

import { libraryHubEnabled, searchLibrary } from '../../library/search';
import { publishedPlacements, readerConfigured } from '../../library/db';
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
import { learnerClass, scopesForLearner, type LearnerClass } from './learner-class';

export interface PracticeScope { classLevel: number; subject: string; medium: 'en' | 'hi' }

export interface CatalogQuestion {
  /** `passageId:index`: stable while the book is unchanged. */
  ref: string;
  /** The library work (book) the question is from. */
  workId: string;
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
export async function schemeGroupEligible(x: Exec, scheme: 'textbook_key' | 'board_scheme_key'): Promise<boolean> {
  let hash: string;
  try { hash = runningConfig().hash; } catch { return false; }
  const rows = await x.select({ n: sql<number>`count(*)::int` }).from(hwEligibility)
    .where(and(eq(hwEligibility.schemeSource, scheme), eq(hwEligibility.status, 'eligible'), eq(hwEligibility.configHash, hash)));
  return (rows[0]?.n ?? 0) > 0;
}

export const textbookGroupEligible = (x: Exec): Promise<boolean> => schemeGroupEligible(x, 'textbook_key');

/** Can a WRITTEN board-paper answer be marked? An eligible board-scheme group (the AI check passed its gates), unless the owner relaxed that rule. Multiple choice needs neither. */
export async function paperWrittenReady(x: Exec): Promise<boolean> {
  if (!getHwConfig().HW_SELF_PRACTICE_REQUIRE_ELIGIBLE_GROUP) return true;
  return schemeGroupEligible(x, 'board_scheme_key');
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

/**
 * A list of scopes written as `class:Subject:medium` (HW_SELF_PRACTICE_SCOPES). Since 13 Nov 2026 this is only an optional LIMIT: unset, the
 * classes and subjects on offer are whatever the library has published (offeredScopes). The default here is kept for that parser's callers.
 */
export function practiceScopes(raw: string | undefined = getHwConfig().HW_SELF_PRACTICE_SCOPES): PracticeScope[] {
  const out: PracticeScope[] = [];
  for (const part of (raw && raw.trim() ? raw : '9:Science:en').split(',')) {
    const [c, subject, m] = part.split(':').map((x) => x.trim());
    const classLevel = Number(c);
    if (Number.isInteger(classLevel) && classLevel >= 1 && classLevel <= 12 && subject && (m === 'en' || m === 'hi')) out.push({ classLevel, subject, medium: m });
  }
  return out;
}

const titleWords = (slug: string) => slug.split('_').filter(Boolean).map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join(' ');
const mediumOf = (m: string): 'en' | 'hi' | null => {
  const k = m.trim().toLowerCase();
  return k === 'en' || k.startsWith('eng') ? 'en' : k === 'hi' || k.startsWith('hin') ? 'hi' : null;
};

/**
 * The library's published books as practice scopes: a CBSE subject placement `SCH.CBSE.C10.SCIENCE` in English becomes Class 10 Science (en).
 * Class-level placements (no subject) and other boards are left out (answer keys are CBSE); Class 10's two mathematics courses are one
 * "Mathematics". Sorted by class, subject, medium. Pure.
 */
export function scopesFromPlacements(rows: { node_code: string; medium: string }[]): PracticeScope[] {
  const seen = new Map<string, PracticeScope>();
  for (const r of rows) {
    const m = /^SCH\.CBSE\.C(\d{1,2})\.([A-Z0-9_]+)$/.exec(r.node_code.trim());
    const medium = mediumOf(r.medium);
    if (!m || !medium) continue;
    const classLevel = Number(m[1]);
    if (classLevel < 1 || classLevel > 12) continue;
    const subject = titleWords(m[2]!.replace(/^MATHEMATICS_(STANDARD|BASIC)$/, 'MATHEMATICS'));
    seen.set(`${classLevel}|${subject.toLowerCase()}|${medium}`, { classLevel, subject, medium });
  }
  return [...seen.values()].sort((a, b) => a.classLevel - b.classLevel || a.subject.localeCompare(b.subject) || a.medium.localeCompare(b.medium));
}

const SCOPE_CACHE_MS = 10 * 60_000;
let scopeCache: { at: number; scopes: PracticeScope[] } | null = null;
export const _resetScopeCache = () => { scopeCache = null; };

/**
 * The classes and subjects InkBuddy offers: every book the library has published (re-read every 10 minutes), so a new book is on offer
 * without touching the server's settings. HW_SELF_PRACTICE_SCOPES, when set, limits that list to its entries (an emergency brake, normally
 * unset). If the library cannot be listed, the last list read is kept; with none, nothing is offered rather than a guess. A server with no
 * library reader configured (tests, a bare local setup) offers the HW_SELF_PRACTICE_SCOPES list itself, as before 13 Nov 2026.
 */
export async function offeredScopes(deps: { list?: () => Promise<{ node_code: string; medium: string }[]>; now?: number } = {}): Promise<PracticeScope[]> {
  const raw = getHwConfig().HW_SELF_PRACTICE_SCOPES;
  const list = deps.list ?? (readerConfigured() ? publishedPlacements : null);
  if (!list) return practiceScopes(raw);
  const now = deps.now ?? Date.now();
  if (!scopeCache || now - scopeCache.at > SCOPE_CACHE_MS) {
    try {
      scopeCache = { at: now, scopes: scopesFromPlacements(await list()) };
    } catch (e) {
      console.error(`[hw] InkBuddy could not list the library's books: ${(e as Error).message}`);
      scopeCache = { at: now, scopes: scopeCache?.scopes ?? [] };
    }
  }
  if (!raw || !raw.trim()) return scopeCache.scopes;
  const limit = practiceScopes(raw);
  return scopeCache.scopes.filter((s) => limit.some((l) => sameScope(l, s)));
}

const sameScope = (a: PracticeScope, b: PracticeScope) => a.classLevel === b.classLevel && a.medium === b.medium && a.subject.toLowerCase() === b.subject.toLowerCase();

/** What one learner is offered: the library's books of their own class, in their medium (learner-class.ts), as Virat Gyankosh does. */
export async function offeredScopesFor(userId: string, deps?: Parameters<typeof offeredScopes>[0] & { learner?: LearnerClass }): Promise<{ scopes: PracticeScope[]; learner: LearnerClass }> {
  const learner = deps?.learner ?? await learnerClass(userId);
  return { scopes: scopesForLearner(await offeredScopes(deps), learner), learner };
}

/**
 * Refuses a class, subject and medium the library has no book for on offer, so a question is never keyed from another subject's book; with
 * a learner, also anything outside their own class.
 */
export async function requireOfferedScope(scope: PracticeScope, deps?: Parameters<typeof offeredScopes>[0] & { userId?: string; learner?: LearnerClass }): Promise<void> {
  const on = deps?.userId ? (await offeredScopesFor(deps.userId, deps)).scopes : await offeredScopes(deps);
  if (!on.some((s) => sameScope(s, scope))) throw new HwError('BAD_REQUEST', `${PRACTICE_TEXT.scopeOff.en} / ${PRACTICE_TEXT.scopeOff.hi}`);
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
      out.push({ ref, passageId: r.passage_id, index, text, book: r.work_title, workId: r.work_id, chapter: r.chapter_no, page: r.page_start, shape: questionShape(matchWords(text).length) });
    });
  }
  return out;
}

/** Book exercise questions about a topic the learner typed, most relevant first. */
export async function searchPracticeQuestions(scope: PracticeScope, rawQuery: string, hub: HubLike | null = defaultHub(), userId?: string): Promise<{ available: boolean; questions: CatalogQuestion[]; warnings: string[]; message?: { en: string; hi: string } }> {
  const query = rawQuery.trim().replace(/\s+/g, ' ');
  if (query.length < 2 || query.length > 200) throw new HwError('BAD_REQUEST', 'Type a topic of 2 to 200 characters.');
  if (!hub) return { available: false, questions: [], warnings: [], message: PRACTICE_TEXT.libraryOff };
  await requireOfferedScope(scope, userId ? { userId } : undefined);
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
