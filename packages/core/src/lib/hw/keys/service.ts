// Answer-key service (stage1-design.md §2). Resolution order, strictly:
//   1. official marking scheme   2. the question's own passage   3. textbook via Gyankosh
//   4. otherwise no_grounding, with the reason.
// There is no step where a model writes a key without a source, and no relaxed retry.
//
// Every dependency is passed in, so tests run without network, Qdrant or the trio database.

import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { textPart, type AiCall, type AiProvider, type AiResult } from '../ai';
import { KEY_WRITER_PROMPT_VERSION, KEY_WRITER_RESPONSE_SCHEMA, KEY_WRITER_SYSTEM_PROMPT, keyWriterUserText } from '../prompts/key-writer.v1';
import { KEY_VERIFIER_PROMPT_VERSION, KEY_VERIFIER_RESPONSE_SCHEMA, KEY_VERIFIER_SYSTEM_PROMPT, keyVerifierUserText } from '../prompts/key-verifier.v1';
import { cacheKeyOf, canonicalJson, sha256, type CachedKey, type KeyCache } from './cache';
import { checkKey, modelFamily, parseVerifierOutput, parseWriterOutput } from './checks';
import { buildCitation } from './citations';
import { bestExerciseMatch } from './exercise-match';
import { retrieveTextbookFromHub, type HubKeySource } from './hub-retrieval';
import type { Retriever, VectorHit } from './retriever';
import { qdrantFilter, scopeOf, type KeyScope } from './scope';
import type { TrioReader } from './trio';
import {
  PASSAGE_TYPES, type AnswerKey, type HwKeyCitation, type KeyCallUsage, type KeyPassage, type KeyRequest, type KeyResult,
} from './types';

/** Bumped whenever retrieval behaviour changes, so cached keys are not reused across it. */
export const KEY_RETRIEVAL_VERSION = 'dense-cosine-strict.v1';

export interface KeySettings {
  writer: { provider: AiProvider; model: string };
  verifier: { provider: AiProvider; model: string };
  /** Calibrated threshold; needed only for textbook keys (official and given-passage keys do not retrieve). */
  rMin: number | undefined;
  theta: number;
  topK: number;
  maxPassages: number;
  pagesVerified: ReadonlySet<string>;
}

export interface OfficialScheme {
  key: AnswerKey;
  /** Where the scheme came from, e.g. "CBSE SQP 2025-26, 086 Science, Q14 marking scheme". */
  label: string;
}

export interface KeyDeps {
  retriever: Retriever;
  /** Library hub (LIBRARY_HUB_ENABLED): textbook retrieval goes here instead of `retriever` and `trio`. */
  hub?: HubKeySource;
  trio: TrioReader;
  generate: (provider: AiProvider, call: AiCall) => Promise<AiResult>;
  cache?: KeyCache;
  /** Looks up a person-checked official scheme; absent until the question bank exists. */
  official?: (ref: NonNullable<KeyRequest['officialRef']>) => Promise<OfficialScheme | null>;
}

const NC = (detail: string) => new HwError('NOT_CONFIGURED', 'Answer keys are not configured.', detail);

/** Settings from the environment. Refuses to run uncalibrated or with one model family. */
export function keySettingsFromEnv(): KeySettings {
  const c = getHwConfig();
  if (!c.HW_KEY_WRITER_MODEL) throw NC('HW_KEY_WRITER_MODEL is not set');
  if (!c.HW_KEY_VERIFIER_MODEL) throw NC('HW_KEY_VERIFIER_MODEL is not set');
  const s: KeySettings = {
    writer: { provider: c.HW_KEY_WRITER_PROVIDER ?? c.HW_AI_PROVIDER, model: c.HW_KEY_WRITER_MODEL },
    verifier: { provider: c.HW_KEY_VERIFIER_PROVIDER, model: c.HW_KEY_VERIFIER_MODEL },
    rMin: c.HW_KEY_R_MIN,
    theta: c.HW_KEY_EXERCISE_THETA,
    topK: c.HW_KEY_TOP_K,
    maxPassages: c.HW_KEY_MAX_PASSAGES,
    pagesVerified: c.HW_KEY_PAGES_VERIFIED,
  };
  assertDifferentFamilies(s);
  return s;
}

export function assertDifferentFamilies(s: Pick<KeySettings, 'writer' | 'verifier'>): void {
  const a = modelFamily(s.writer.model);
  const b = modelFamily(s.verifier.model);
  if (a === b) throw NC(`writer (${s.writer.model}) and verifier (${s.verifier.model}) are both ${a}; the verifier must be another model family`);
}

export function keyConfigHash(s: KeySettings, indexId: string): string {
  return sha256(canonicalJson({
    writer: s.writer, verifier: s.verifier, rMin: s.rMin, theta: s.theta, topK: s.topK, maxPassages: s.maxPassages,
    prompts: [KEY_WRITER_PROMPT_VERSION, KEY_VERIFIER_PROMPT_VERSION], retrieval: KEY_RETRIEVAL_VERSION, indexId,
  }));
}

function validateRequest(req: KeyRequest): void {
  const bad = (d: string) => new HwError('BAD_REQUEST', 'The question cannot be keyed.', d);
  if (!req.questionText?.trim()) throw bad('questionText is empty');
  if (!(req.marks > 0) || Math.abs(req.marks * 2 - Math.round(req.marks * 2)) > 1e-9) throw bad(`marks ${req.marks} must be > 0 in 0.5 steps`);
}

const callOf = (role: 'writer' | 'verifier', provider: AiProvider, r: AiResult): KeyCallUsage =>
  ({ role, provider, model: r.model, usage: r.usage, costUsd: r.costUsd });

export async function buildKey(req: KeyRequest, deps: KeyDeps, settings: KeySettings): Promise<KeyResult> {
  validateRequest(req);
  assertDifferentFamilies(settings);
  const configHash = keyConfigHash(settings, deps.hub ? deps.hub.indexId : deps.retriever.indexId);
  const notes: string[] = [];
  const calls: KeyCallUsage[] = [];
  const meta = () => ({ notes, calls, configHash, fromCache: false });

  // 1. Official scheme: person-checked at import, used as it is.
  if (req.officialRef) {
    const official = deps.official ? await deps.official(req.officialRef) : null;
    if (official) {
      // An official scheme is its own source: its points cite nothing.
      const problems = checkKey(official.key, new Set(), req.marks, { requireCites: false });
      if (problems.length) return { ...meta(), status: 'key_invalid', reason: 'checks_failed', detail: `official scheme ${official.label}`, problems };
      notes.push(`official scheme: ${official.label}`);
      return { ...meta(), status: 'grounded', source: 'official', key: official.key, passages: [], citations: [], verification: [], partial: false };
    }
    const r = req.officialRef;
    notes.push(`official scheme not found (${r.kind} ${r.session} ${r.subjectCode} Q${r.questionNo})`);
  }

  // 2. The question's own passage: the only source for passage-based questions.
  if (req.passageText !== undefined || PASSAGE_TYPES.has(req.questionType)) {
    if (!req.passageText?.trim()) {
      return { ...meta(), status: 'no_grounding', reason: 'missing_passage', detail: `${req.questionType} question without its passage` };
    }
    const passages: KeyPassage[] = [{ id: 'given', text: req.passageText.trim() }];
    let citations: HwKeyCitation[] = [];
    // A numerical question's passage gives the data, rarely the formula or the unit: those come
    // from the textbook. Without it the verifier rejects those points, and the key is no_grounding.
    if (req.questionType === 'numerical') {
      if (settings.rMin === undefined) notes.push('numerical: textbook not searched for the formula (HW_KEY_R_MIN not set)');
      else {
        const tb = await retrieveTextbook(req, deps, settings, settings.rMin, notes, calls);
        if (tb.ok) {
          passages.push(...tb.passages);
          citations = tb.citations;
          notes.push(`numerical: ${tb.passages.length} textbook passage(s) added for the formula and unit`);
        } else notes.push(`numerical: no textbook passage for the formula (${tb.reason}: ${tb.detail})`);
      }
    }
    return writeAndVerify(req, deps, settings, 'passage', passages, citations, meta, calls, notes);
  }

  // 3. Textbook. Retrieval needs the calibrated threshold; there is no default to fall back on.
  if (settings.rMin === undefined) throw NC('HW_KEY_R_MIN is not set: calibrate it with scripts/hw-key-calibrate.ts before building textbook keys');
  const tb = await retrieveTextbook(req, deps, settings, settings.rMin, notes, calls);
  if (!tb.ok) return { ...meta(), status: 'no_grounding', reason: tb.reason, detail: tb.detail };
  return writeAndVerify(req, deps, settings, 'textbook', tb.passages, tb.citations, meta, calls, notes);
}

type Retrieved =
  | { ok: true; passages: KeyPassage[]; citations: HwKeyCitation[] }
  | { ok: false; reason: 'no_book' | 'below_threshold' | 'passages_missing'; detail: string };

/** Strict textbook retrieval for a question: scope, exercise anchor, R_min gate, content-table text. */
async function retrieveTextbook(req: KeyRequest, deps: KeyDeps, settings: KeySettings, rMin: number, notes: string[], calls: KeyCallUsage[]): Promise<Retrieved> {
  if (deps.hub) {
    try {
      return await retrieveTextbookFromHub(req, deps.hub, { rMin, theta: settings.theta, topK: settings.topK, maxPassages: settings.maxPassages, pagesVerified: settings.pagesVerified }, notes);
    } catch (e) {
      if (e instanceof HwError) throw e;
      // Hub down, wrong credentials, search off: a mechanism failure is an error, never "no book".
      throw new HwError('PROVIDER_ERROR', 'Textbook search failed.', `library hub: ${(e as Error).message}`);
    }
  }
  let scope: KeyScope;
  try {
    scope = scopeOf(req);
  } catch (e) {
    throw new HwError('BAD_REQUEST', 'The question cannot be keyed.', (e as Error).message);
  }
  const query = req.competency ? `${req.questionText}\n${req.competency}` : req.questionText;
  const { vector, call } = await deps.retriever.embed(query);
  calls.push(call);

  let hits = await deps.retriever.search(vector, qdrantFilter(scope), settings.topK);
  if (hits.length === 0) {
    return { ok: false, reason: 'no_book', detail: `no ${scope.medium}-medium book for ${scope.classLevel} ${req.subject}` };
  }

  // Exercise match: anchor to the chapter of the book's own matching exercise question.
  if (!scope.chapter) {
    const books = [...new Set(hits.map((h) => h.contentItemId))];
    const match = bestExerciseMatch(req.questionText, await deps.trio.practiceRows(books), settings.theta);
    if (match) {
      const anchored = await deps.retriever.search(vector, qdrantFilter({ ...scope, contentItemId: match.contentItemId }, match.chapter), settings.topK);
      if (anchored.length) {
        notes.push(`exercise match ${match.score.toFixed(2)} (row ${match.rowId}); anchored to "${match.chapter}"`);
        hits = anchored;
      } else {
        notes.push(`exercise match ${match.score.toFixed(2)} to "${match.chapter}", but that chapter has no reference passages; not anchored`);
      }
    }
  }

  const top = hits[0].score;
  if (top < rMin) {
    return { ok: false, reason: 'below_threshold', detail: `best passage ${top.toFixed(3)} < R_min ${rMin}` };
  }
  const kept: VectorHit[] = hits.filter((h) => h.score >= rMin).slice(0, settings.maxPassages);

  // Text and page numbers come from the content tables, not the vector payload.
  const rows = new Map((await deps.trio.chunks(kept.map((h) => h.id))).map((r) => [r.id, r]));
  const passages: KeyPassage[] = [];
  const citations: HwKeyCitation[] = [];
  for (const h of kept) {
    const row = rows.get(h.id);
    if (!row) { notes.push(`chunk ${h.id} is in the index but not in content.content_chunk; dropped`); continue; }
    if (row.lang && row.lang.toLowerCase() !== scope.medium.toLowerCase()) {
      notes.push(`chunk ${h.id} is ${row.lang} in the content tables but ${scope.medium} in the index; dropped`);
      continue;
    }
    const p: KeyPassage = { id: row.id, text: row.text, score: h.score, chapter: row.chapter ?? undefined, contentItemId: row.contentItemId };
    passages.push(p);
    citations.push(buildCitation(row, p, { classLevel: scope.classLevel, subject: req.subject, medium: scope.medium, pagesVerified: settings.pagesVerified }, citations.length));
  }
  if (!passages.length) {
    return { ok: false, reason: 'passages_missing', detail: 'no retrieved passage could be loaded from the content tables' };
  }
  return { ok: true, passages, citations };
}

async function writeAndVerify(
  req: KeyRequest, deps: KeyDeps, settings: KeySettings, source: 'passage' | 'textbook',
  passages: KeyPassage[], citations: HwKeyCitation[],
  meta: () => { notes: string[]; calls: KeyCallUsage[]; configHash: string; fromCache: boolean },
  calls: KeyCallUsage[], notes: string[],
): Promise<KeyResult> {
  const cacheKey = cacheKeyOf(req, meta().configHash, passages);
  const cached = deps.cache ? await deps.cache.get(cacheKey) : null;
  if (cached) return { ...cached, notes: [...notes, 'key from cache'], calls, cacheKey, fromCache: true };

  const writer = await deps.generate(settings.writer.provider, {
    model: settings.writer.model,
    systemInstruction: KEY_WRITER_SYSTEM_PROMPT,
    parts: [textPart(keyWriterUserText({
      questionText: req.questionText, questionType: req.questionType, marks: req.marks, classLevel: req.classLevel,
      subject: req.subject, medium: req.medium, competency: req.competency, passages,
    }))],
    schema: KEY_WRITER_RESPONSE_SCHEMA,
  });
  calls.push(callOf('writer', settings.writer.provider, writer));
  const parsed = parseWriterOutput(writer.json);
  if ('problems' in parsed) return { ...meta(), cacheKey, status: 'key_invalid', reason: 'writer_output', detail: 'writer output unusable', problems: parsed.problems };
  const problems = checkKey(parsed.key, new Set(passages.map((p) => p.id)), req.marks);
  if (problems.length) return { ...meta(), cacheKey, status: 'key_invalid', reason: 'checks_failed', detail: 'key failed code checks', problems };

  const verifier = await deps.generate(settings.verifier.provider, {
    model: settings.verifier.model,
    systemInstruction: KEY_VERIFIER_SYSTEM_PROMPT,
    parts: [textPart(keyVerifierUserText({
      questionText: req.questionText, passages,
      points: parsed.key.valuePoints.map((p) => ({ id: p.id, text: p.text, cites: p.cites })),
    }))],
    schema: KEY_VERIFIER_RESPONSE_SCHEMA,
  });
  calls.push(callOf('verifier', settings.verifier.provider, verifier));
  const verdicts = parseVerifierOutput(verifier.json, parsed.key.valuePoints.map((p) => p.id));
  if ('problems' in verdicts) return { ...meta(), cacheKey, status: 'key_invalid', reason: 'verifier_output', detail: 'verifier output unusable', problems: verdicts.problems };

  const unsupported = verdicts.verdicts.filter((v) => v.support === 'unsupported');
  if (unsupported.length) {
    return {
      ...meta(), cacheKey, status: 'no_grounding', reason: 'unsupported_key',
      detail: unsupported.map((v) => `${v.pointId}: ${v.reason}`).join('; '),
    };
  }

  const cited = new Set(parsed.key.valuePoints.flatMap((p) => p.cites));
  const result: CachedKey = {
    ...meta(), cacheKey, status: 'grounded', source, key: parsed.key, passages,
    citations: citations.filter((c) => cited.has(c.chunkId)),
    verification: verdicts.verdicts,
    partial: verdicts.verdicts.some((v) => v.support === 'partial'),
  };
  if (deps.cache) await deps.cache.set(cacheKey, result);
  return result;
}
