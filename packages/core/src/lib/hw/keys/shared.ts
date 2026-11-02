// The shared key library (HW_SHARED_KEYS_ENABLED).
//
// A key is reused across tenants only when BOTH hold:
//   1. its source is the official marking scheme or the textbook (never the question's own
//      passage, never a model's knowledge), and
//   2. the question text is public: a textbook exercise or a board paper.
// A teacher's own question (questionOrigin absent or "custom") is never read from or written to
// the library, whatever else matches.
//
// The library key covers everything that defines the key: the normalised question text and its
// type, marks, class, subject, medium and competency; the source and what it points at (book
// ISBN or work, edition, chapter, and a hash of the exact passages); the key-service version
// (prompts, code checks, retrieval); and the model configuration (writer, verifier, thresholds,
// index). A new book edition, passage text, prompt, check or model is a different key, so the old
// one is simply not found.

import { createHash } from 'node:crypto';
import { canonicalJson, sha256, type CachedKey } from './cache';
import { normaliseForMatch } from '../text/normalise';
import type { HwKeyCitation, KeyPassage, KeyRequest } from './types';

/** Public question origins: only these may use the library. */
export const PUBLIC_ORIGINS = ['textbook_exercise', 'board_paper'] as const;
export type PublicQuestionOrigin = (typeof PUBLIC_ORIGINS)[number];
export type QuestionOrigin = PublicQuestionOrigin | 'custom';

export const isPublicOrigin = (o: KeyRequest['questionOrigin']): o is PublicQuestionOrigin => o === 'textbook_exercise' || o === 'board_paper';

/**
 * Bumped (by hand) whenever the key prompts, the code checks or the way passages are chosen
 * change. Prompt versions and the retrieval version are read from their modules and joined here
 * by the caller, so a prompt bump already changes it; this suffix covers the checks.
 */
export const KEY_CHECKS_VERSION = 'key-checks.v1';

export const keyServiceVersion = (parts: { writerPrompt: string; verifierPrompt: string; retrieval: string }): string =>
  [parts.writerPrompt, parts.verifierPrompt, parts.retrieval, KEY_CHECKS_VERSION].join('+');

/** Question text as compared by the library: case, spacing, punctuation and Unicode forms folded. */
export const normaliseQuestion = (s: string): string => normaliseForMatch(s);

export interface SharedKeyId {
  cacheKey: string;
  questionHash: string;
  sourceRef: string;
}

/** What the key points at, in words a person can read in the table: "<isbn or work> | <edition> | <chapter(s)>". */
export function textbookSourceRef(citations: readonly HwKeyCitation[], passages: readonly KeyPassage[]): string {
  const books = [...new Set(citations.map((c) => `${c.isbn ?? c.contentItemId}|${c.edition ?? ''}`))].sort();
  const chapters = [...new Set(passages.map((p) => p.chapter ?? '').filter(Boolean))].sort();
  const text = sha256(canonicalJson(passages.map((p) => [p.id, sha256(p.text)]))).slice(0, 16);
  return `${books.join(',') || passages.map((p) => p.contentItemId ?? '').filter(Boolean).join(',')} | ${chapters.join(',')} | passages ${text}`;
}

export function sharedKeyId(
  req: KeyRequest, source: 'official' | 'textbook', sourceRef: string, keyServiceVer: string, configHash: string,
): SharedKeyId {
  const questionHash = createHash('sha256').update(normaliseQuestion(req.questionText), 'utf8').digest('hex');
  // Tenant, hint, and officialRef noise are deliberately not part of the id: the key is about the
  // question and its source, not about who asked.
  const cacheKey = sha256(canonicalJson({
    q: questionHash, type: req.questionType, marks: req.marks, class: req.classLevel, subject: req.subject, medium: req.medium,
    competency: req.competency ?? null, source, sourceRef, keyServiceVer, configHash,
  }));
  return { cacheKey, questionHash, sourceRef };
}

export interface SharedKeyStore {
  get(cacheKey: string): Promise<CachedKey | null>;
  put(entry: { id: SharedKeyId; origin: PublicQuestionOrigin; source: 'official' | 'textbook'; keyServiceVersion: string; configHash: string; key: CachedKey }): Promise<void>;
}

/** In memory: tests, and a way to see exactly what would be stored. */
export function memorySharedKeyStore(): SharedKeyStore & { rows: Map<string, { origin: PublicQuestionOrigin; source: string; sourceRef: string; key: CachedKey }>; reads: number } {
  const rows = new Map<string, { origin: PublicQuestionOrigin; source: string; sourceRef: string; key: CachedKey }>();
  const store = {
    rows,
    reads: 0,
    async get(cacheKey: string) { store.reads++; const r = rows.get(cacheKey); return r ? structuredClone(r.key) : null; },
    async put(e: Parameters<SharedKeyStore['put']>[0]) { rows.set(e.id.cacheKey, { origin: e.origin, source: e.source, sourceRef: e.id.sourceRef, key: structuredClone(e.key) }); },
  };
  return store;
}
