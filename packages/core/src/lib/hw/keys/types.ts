// Answer keys built from a source, never from a model's own knowledge
// (docs/hw-eval/stage1-design.md §2). Shared by the evals now and the product later.

import type { NCERTCitation } from '@/types/citations';
import type { TokenUsage } from '../cost/pricing';

export type Medium = 'English' | 'Hindi';

export type KeyQuestionType =
  | 'mcq' | 'assertion_reason' | 'very_short' | 'short' | 'long' | 'essay'
  | 'case_based' | 'source_based' | 'numerical' | 'competency' | 'reading';

/** Question types whose key comes from the passage printed with the question, never the textbook. */
export const PASSAGE_TYPES: ReadonlySet<KeyQuestionType> = new Set(['case_based', 'source_based', 'reading']);

export interface KeyRequest {
  questionText: string;
  questionType: KeyQuestionType;
  /** 0.5 steps. */
  marks: number;
  /** "Class 10", "10", "X" — normalised by scope.ts. */
  classLevel: string;
  subject: string;
  medium: Medium;
  bookHint?: { contentItemId?: string; title?: string; chapter?: string };
  officialRef?: { kind: 'sqp' | 'past_paper'; session: string; subjectCode: string; questionNo: string };
  competency?: string;
  passageText?: string;
  /**
   * Library hub scope (curriculum v2 node ids or codes, or work ids), used while LIBRARY_HUB_ENABLED is on. Absent, the
   * scope is the CBSE class and subject above. In hub mode `bookHint.contentItemId` is a hub work id.
   */
  library?: { nodeIds?: string[]; nodeCodes?: string[]; workIds?: string[] };
}

export type ValuePointKind = 'key_point' | 'step' | 'unit' | 'format' | 'competency';

export interface ValuePoint {
  id: string;
  text: string;
  marks: number;
  kind: ValuePointKind;
  /** Passage ids the point is taken from (chunk ids, or "given" for the question's own passage). */
  cites: string[];
  acceptedAlternatives: string[];
}

export interface AnswerKey {
  referenceAnswer: string;
  valuePoints: ValuePoint[];
}

/** One passage given to the writer: a textbook chunk, or the question's own passage. */
export interface KeyPassage {
  id: string;
  text: string;
  /** Dense cosine score against the question (textbook passages only). */
  score?: number;
  chapter?: string;
  contentItemId?: string;
}

export interface HwKeyCitation extends NCERTCitation {
  chunkId: string;
  contentItemId: string;
  isbn: string | null;
  edition: string | null;
  medium: Medium;
  pageStart: number;
  pageEnd: number;
  /** The book's printed-page mapping has been checked by a person (HW_KEY_PAGES_VERIFIED). */
  pagesVerified: boolean;
}

export type PointSupport = 'supported' | 'partial' | 'unsupported';

export interface PointVerification {
  pointId: string;
  support: PointSupport;
  reason: string;
}

/** One provider call made while building the key, with the provider's own counts. */
export interface KeyCallUsage {
  role: 'embed' | 'writer' | 'verifier';
  provider: 'gemini' | 'openrouter' | 'openai';
  model: string;
  usage: TokenUsage;
  costUsd?: number;
}

export type NoGroundingReason =
  | 'no_book'             // no book for this class / subject / medium
  | 'below_threshold'     // best passage under R_min
  | 'passages_missing'    // retrieved ids not found in the content tables
  | 'missing_passage'     // a passage-type question without its passage
  | 'unsupported_key';    // the verifier found a point the passages do not support

export type KeyInvalidReason = 'writer_output' | 'checks_failed' | 'verifier_output';

interface KeyMeta {
  /** Decisions taken on the way (exercise match, chapter anchor, dropped ids), for the run record. */
  notes: string[];
  calls: KeyCallUsage[];
  configHash: string;
  cacheKey?: string;
  fromCache: boolean;
}

export type KeyResult =
  | (KeyMeta & {
      status: 'grounded';
      source: 'official' | 'passage' | 'textbook';
      key: AnswerKey;
      passages: KeyPassage[];
      citations: HwKeyCitation[];
      verification: PointVerification[];
      /** Some point is only partly supported: usable only in runs that allow partial keys. */
      partial: boolean;
    })
  | (KeyMeta & { status: 'no_grounding'; reason: NoGroundingReason; detail: string })
  | (KeyMeta & { status: 'key_invalid'; reason: KeyInvalidReason; detail: string; problems: string[] });
