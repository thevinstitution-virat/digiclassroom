// Gemini implementation of the reader. Tier 1 and tier 2 are the same code with different
// models (HW_READ_MODEL / HW_ESCALATE_MODEL).

import { requireModel } from '../config';
import { generate, imagePart, textPart, type GeminiCall } from '../gemini/client';
import { READ_PROMPT_VERSION, READ_RESPONSE_SCHEMA, READ_SYSTEM_PROMPT, readAnswerLabel } from '../prompts/read.v1';
import { parseReadOutput } from './parse';
import type { HandwritingReader, ReadInput, ReadResult } from './types';

/** The request for one submission: each answer as a label followed by its image. */
export function readCall(model: string, input: ReadInput): GeminiCall {
  return {
    model,
    systemInstruction: READ_SYSTEM_PROMPT,
    schema: READ_RESPONSE_SCHEMA,
    parts: input.answers.flatMap((a) => [textPart(readAnswerLabel(a.answerId, a.languageHint)), imagePart(a.png, a.mimeType)]),
  };
}

export class GeminiReader implements HandwritingReader {
  readonly id: string;

  constructor(readonly model: string, readonly tier: 1 | 2) {
    this.id = `gemini:${model}:${READ_PROMPT_VERSION}`;
  }

  async read(input: ReadInput): Promise<ReadResult> {
    const res = await generate(readCall(this.model, input));
    return {
      answers: parseReadOutput(res.json, input.answers.map((a) => a.answerId)),
      usage: res.usage,
      rawUsage: res.rawUsage,
      model: res.model,
    };
  }
}

export function readerForTier(tier: 1 | 2): GeminiReader {
  return new GeminiReader(requireModel(tier === 1 ? 'read' : 'escalate'), tier);
}
