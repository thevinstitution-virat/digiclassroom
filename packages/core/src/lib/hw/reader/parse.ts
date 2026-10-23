// Validates the reader's JSON in code (the provider's schema enforcement is not trusted on
// its own) and turns it into per-answer results. Pure.

import { z } from 'zod';
import { HwError } from '../errors';
import { countUnclear } from '../text/normalise';
import type { ReadAnswerResult } from './types';

/** Model confidence words to numbers. Tuned by the evaluation script, not by intuition. */
export const CONFIDENCE_VALUE = { high: 0.95, medium: 0.75, low: 0.4 } as const;

const ReadOutput = z.object({
  answers: z.array(z.object({
    answer_id: z.string().min(1),
    text: z.string().max(50_000),
    language: z.enum(['en', 'hi', 'mixed', 'none']),
    confidence: z.enum(['high', 'medium', 'low']),
    blank: z.boolean(),
  })),
});

/**
 * Every requested answer must come back exactly once, and nothing else. A missing,
 * duplicated or unknown id fails the whole read rather than attaching text to the wrong answer.
 */
export function parseReadOutput(json: unknown, requestedIds: readonly string[]): ReadAnswerResult[] {
  const parsed = ReadOutput.safeParse(json);
  if (!parsed.success) {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The handwriting reader returned unusable output.',
      `reader output failed validation: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  }
  const wanted = new Set(requestedIds);
  const seen = new Set<string>();
  const out: ReadAnswerResult[] = [];
  for (const a of parsed.data.answers) {
    if (!wanted.has(a.answer_id)) {
      throw new HwError('INVALID_PROVIDER_OUTPUT', 'The handwriting reader returned unusable output.', `reader returned unknown answer id ${a.answer_id}`);
    }
    if (seen.has(a.answer_id)) {
      throw new HwError('INVALID_PROVIDER_OUTPUT', 'The handwriting reader returned unusable output.', `reader returned answer id ${a.answer_id} twice`);
    }
    seen.add(a.answer_id);
    const text = a.blank ? '' : a.text;
    out.push({
      answerId: a.answer_id,
      text,
      unclearCount: countUnclear(text),
      confidence: CONFIDENCE_VALUE[a.confidence],
      language: a.language,
      blank: a.blank || text.trim() === '',
    });
  }
  const missing = requestedIds.filter((id) => !seen.has(id));
  if (missing.length) {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The handwriting reader returned unusable output.', `reader returned no result for ${missing.length} answer(s)`);
  }
  return out;
}
