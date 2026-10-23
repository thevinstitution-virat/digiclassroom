// The handwriting reader contract. One call reads one submission: every answer image of
// one student, each labelled with an opaque answer id (never a name).

import type { HwLanguage } from '@/db/hw-schema';
import type { TokenUsage } from '../cost/pricing';

export interface ReadInputAnswer {
  answerId: string;
  languageHint: HwLanguage;
  png: Uint8Array;
  /** Default image/png (ink renders). Photos may be JPEG or WebP. */
  mimeType?: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface ReadInput {
  answers: ReadInputAnswer[];
}

export interface ReadAnswerResult {
  answerId: string;
  text: string;
  /** Counted from the text in code, never taken from the model. */
  unclearCount: number;
  /** 0..1, mapped from the model's high / medium / low. */
  confidence: number;
  language: HwLanguage | 'none';
  blank: boolean;
}

export interface ReadResult {
  answers: ReadAnswerResult[];
  usage: TokenUsage;
  rawUsage: Record<string, unknown>;
  model: string;
}

export interface HandwritingReader {
  /** e.g. "gemini:gemini-3.5-flash-lite" */
  id: string;
  tier: 1 | 2;
  read(input: ReadInput): Promise<ReadResult>;
}
