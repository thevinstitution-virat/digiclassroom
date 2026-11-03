// AI marking: one call per chunk of answers to the same question. The question block is the
// same for every chunk, so it goes first (cacheable prefix); answers go last.

import { getHwConfig, requireModel } from '../config';
import { generate, routed, textPart, type AiCall as GeminiCall, type AiResult as GeminiResult, type CallOptions } from '../ai';
import {
  GRADE_PROMPT_VERSION,
  GRADE_RESPONSE_SCHEMA,
  GRADE_SYSTEM_PROMPT,
  gradeAnswersBlock,
  gradeQuestionBlock,
} from '../prompts/grade.v1';
import { validateGradeOutput } from './validate';
import type { AnswerGrader, GradeInput, GradeResult } from './types';

export function gradeCall(model: string, input: GradeInput, options?: CallOptions): GeminiCall {
  return {
    model,
    ...(options ? { options: { staticPrefixParts: 1, ...options } } : {}),
    systemInstruction: GRADE_SYSTEM_PROMPT,
    schema: GRADE_RESPONSE_SCHEMA,
    parts: [
      textPart(gradeQuestionBlock(input.question)),
      textPart(gradeAnswersBlock(input.answers.map((a) => ({ id: a.answerId, transcript: a.transcript })))),
    ],
  };
}

export function gradeResultsFrom(res: GeminiResult, input: GradeInput): GradeResult[] {
  return validateGradeOutput(res.json, input, { model: res.model, promptVersion: GRADE_PROMPT_VERSION }, { evidenceLowersConfidence: getHwConfig().HW_INSTRUCTION_GUARD_ENABLED });
}

/** Per-call options the environment asks for (HW_GRADE_REASONING_EFFORT); none when it is unset, so requests stay as they were. */
export function defaultGradeOptions(): CallOptions | undefined {
  const effort = getHwConfig().HW_GRADE_REASONING_EFFORT;
  return effort ? { reasoningEffort: effort.toLowerCase() } : undefined;
}

export class AiGrader implements AnswerGrader {
  lastCall: GeminiResult | null = null;

  constructor(readonly model: string = requireModel('grade'), readonly options: CallOptions | undefined = defaultGradeOptions()) {}

  async grade(input: GradeInput): Promise<GradeResult[]> {
    const res = await generate(routed(gradeCall(this.model, input, this.options), 'grade'));
    this.lastCall = res;
    return gradeResultsFrom(res, input);
  }
}
