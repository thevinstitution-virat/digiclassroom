// AI marking: one call per chunk of answers to the same question. The question block is the
// same for every chunk, so it goes first (cacheable prefix); answers go last.

import { requireModel } from '../config';
import { generate, textPart, type AiCall as GeminiCall, type AiResult as GeminiResult } from '../ai';
import {
  GRADE_PROMPT_VERSION,
  GRADE_RESPONSE_SCHEMA,
  GRADE_SYSTEM_PROMPT,
  gradeAnswersBlock,
  gradeQuestionBlock,
} from '../prompts/grade.v1';
import { validateGradeOutput } from './validate';
import type { AnswerGrader, GradeInput, GradeResult } from './types';

export function gradeCall(model: string, input: GradeInput): GeminiCall {
  return {
    model,
    systemInstruction: GRADE_SYSTEM_PROMPT,
    schema: GRADE_RESPONSE_SCHEMA,
    parts: [
      textPart(gradeQuestionBlock(input.question)),
      textPart(gradeAnswersBlock(input.answers.map((a) => ({ id: a.answerId, transcript: a.transcript })))),
    ],
  };
}

export function gradeResultsFrom(res: GeminiResult, input: GradeInput): GradeResult[] {
  return validateGradeOutput(res.json, input, { model: res.model, promptVersion: GRADE_PROMPT_VERSION });
}

export class AiGrader implements AnswerGrader {
  lastCall: GeminiResult | null = null;

  constructor(readonly model: string = requireModel('grade')) {}

  async grade(input: GradeInput): Promise<GradeResult[]> {
    const res = await generate(gradeCall(this.model, input));
    this.lastCall = res;
    return gradeResultsFrom(res, input);
  }
}
