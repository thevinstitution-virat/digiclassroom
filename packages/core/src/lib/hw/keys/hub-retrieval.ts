// Textbook retrieval for answer keys over the library hub (Phase 7). Used instead of the Gyankosh Qdrant reads and the
// trio content tables when LIBRARY_HUB_ENABLED is on (defaultKeyDeps), so keys are built from the same library as the
// tutor and cite the same `passage_id`s.
//
// Same rules as service.ts's retrieveTextbook, nothing relaxed:
// - scope strictly: the learner/request's curriculum nodes and medium; an empty answer means there is no book;
// - R_min is a dense-cosine floor. The hub reports each hit's cosine (`score.dense`); a hit without one cannot be
//   compared with R_min and is dropped, never admitted;
// - a question that closely matches the book's own exercise takes that exercise's chapter as an anchor;
// - the passage text is the hub's `text` (the book's words only; authored descriptions never reach the writer);
// - the hub is the only source: there is no direct-read fallback here, because it cannot apply the scope.

import { normaliseClass, subjectValues } from './scope';
import { bestExerciseMatch, type PracticeRow } from './exercise-match';
import { buildCitation } from './citations';
import type { ChunkRow } from './trio';
import type { HubResult, HubSearchRequest, HubSearchResponse } from '../../library/hub-client';
import type { HwKeyCitation, KeyPassage, KeyRequest } from './types';

export interface HubKeySource {
  /** Goes into the key config hash, so keys built from another index are never reused. */
  readonly indexId: string;
  search(req: HubSearchRequest): Promise<HubSearchResponse>;
}

export interface HubKeySettings {
  rMin: number;
  theta: number;
  topK: number;
  maxPassages: number;
  pagesVerified: ReadonlySet<string>;
}

export type HubRetrieved =
  | { ok: true; passages: KeyPassage[]; citations: HwKeyCitation[] }
  | { ok: false; reason: 'no_book' | 'below_threshold' | 'passages_missing'; detail: string };

const HUB_MAX_LIMIT = 20;
const slug = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/** Node codes of a subject in a CBSE class, as curriculum v2 names them (`SCH.CBSE.C9.SCIENCE`). */
export function subjectNodeCodes(classLevel: string, subject: string): string[] {
  const n = Number(/\d+/.exec(normaliseClass(classLevel))![0]);
  const slugs = new Set(subjectValues(subject).map(slug));
  // Class 10 mathematics is two courses in the taxonomy.
  if (n === 10 && slugs.has('MATHEMATICS')) { slugs.add('MATHEMATICS_STANDARD'); slugs.add('MATHEMATICS_BASIC'); }
  return [...slugs].map((s) => `SCH.CBSE.C${n}.${s}`);
}

export type HubKeyScope = Pick<HubSearchRequest, 'nodeIds' | 'nodeCodes' | 'workIds' | 'medium'>;

export function keyScopeOf(req: KeyRequest): HubKeyScope {
  const medium: 'en' | 'hi' = req.medium === 'Hindi' ? 'hi' : 'en';
  const lib = req.library;
  if (lib && (lib.nodeIds?.length || lib.nodeCodes?.length || lib.workIds?.length)) return { ...lib, medium };
  // The old request carries class and subject only; the board has always been CBSE for keys.
  const scope: HubKeyScope = { nodeCodes: subjectNodeCodes(req.classLevel, req.subject), medium };
  // A book hint names a work (the hub's id) and a chapter ("Chapter 3: ...").
  if (req.bookHint?.contentItemId) scope.workIds = [req.bookHint.contentItemId];
  return scope;
}

const chapterNoOf = (label: string | undefined): number | null => {
  const m = label ? /^chapter\s+(\d+)/i.exec(label.trim()) : null;
  return m ? Number(m[1]) : null;
};

const dense = (r: HubResult): number | null => r.score.dense;

export async function retrieveTextbookFromHub(req: KeyRequest, hub: HubKeySource, s: HubKeySettings, notes: string[]): Promise<HubRetrieved> {
  const scope = keyScopeOf(req);
  const query = req.competency ? `${req.questionText}\n${req.competency}` : req.questionText;
  const limit = Math.min(s.topK, HUB_MAX_LIMIT);
  const search = (extra: Partial<HubSearchRequest>) => hub.search({ query, ...scope, limit, window: 0, ...extra });

  const first = await search({});
  for (const w of first.warnings) notes.push(`hub: ${w}`);
  let hits = first.results.filter((r) => r.retrieval_class === 'reference');
  if (hits.length === 0) {
    return { ok: false, reason: 'no_book', detail: `no ${scope.medium}-medium book for ${req.classLevel} ${req.subject}` };
  }

  // Exercise match: anchor to the chapter of the book's own matching exercise question.
  const hintChapter = chapterNoOf(req.bookHint?.chapter);
  if (hintChapter !== null) {
    hits = hits.filter((r) => r.chapter_no === hintChapter);
    notes.push(`chapter hint "${req.bookHint?.chapter}": ${hits.length} passage(s) in chapter ${hintChapter}`);
  } else if (req.bookHint?.chapter) {
    notes.push(`chapter hint "${req.bookHint.chapter}" has no chapter number; ignored`);
  } else {
    const practice = await search({ includePractice: true });
    const chapterOf = new Map<string, number>();
    const rows: PracticeRow[] = practice.results
      .filter((r) => r.retrieval_class === 'practice')
      .map((r) => { chapterOf.set(r.passage_id, r.chapter_no); return { id: r.passage_id, contentItemId: r.work_id, chapter: `Chapter ${r.chapter_no}`, text: r.text }; });
    const match = bestExerciseMatch(req.questionText, rows, s.theta);
    if (match) {
      const chapterNo = chapterOf.get(match.rowId)!;
      const anchored = await search({ workIds: [match.contentItemId], limit: HUB_MAX_LIMIT });
      const inChapter = anchored.results.filter((r) => r.retrieval_class === 'reference' && r.chapter_no === chapterNo);
      if (inChapter.length) {
        notes.push(`exercise match ${match.score.toFixed(2)} (${match.rowId}); anchored to chapter ${chapterNo}`);
        hits = inChapter;
      } else {
        notes.push(`exercise match ${match.score.toFixed(2)} to chapter ${chapterNo}, but it has no reference passages in the answer; not anchored`);
      }
    }
  }

  const comparable = hits.filter((r) => dense(r) !== null);
  if (comparable.length < hits.length) notes.push(`${hits.length - comparable.length} passage(s) without a dense score dropped (cannot be compared with R_min)`);
  if (!comparable.length) return { ok: false, reason: 'passages_missing', detail: 'the hub returned no passage with a dense score to compare with R_min' };
  const ranked = [...comparable].sort((a, b) => dense(b)! - dense(a)!);
  const top = dense(ranked[0])!;
  if (top < s.rMin) return { ok: false, reason: 'below_threshold', detail: `best passage ${top.toFixed(3)} < R_min ${s.rMin}` };

  const passages: KeyPassage[] = [];
  const citations: HwKeyCitation[] = [];
  for (const r of ranked.filter((x) => dense(x)! >= s.rMin).slice(0, s.maxPassages)) {
    const p: KeyPassage = { id: r.passage_id, text: r.text, score: dense(r)!, chapter: `Chapter ${r.chapter_no}`, contentItemId: r.work_id };
    const row: ChunkRow = {
      id: r.passage_id, contentItemId: r.work_id, chapter: p.chapter ?? null, pageStart: r.page_start, pageEnd: r.page_end,
      text: r.text, title: r.work_title, isbn: null, edition: null, lang: scope.medium ?? null,
    };
    passages.push(p);
    citations.push(buildCitation(row, p, { classLevel: normaliseClass(req.classLevel), subject: req.subject, medium: req.medium, pagesVerified: s.pagesVerified }, citations.length));
  }
  return { ok: true, passages, citations };
}
