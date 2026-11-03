// Strict marking (phase 1c): the model returns, per key point, a verdict and the verbatim words; CODE computes the marks.
//
//   same_fact       -> the key point's full marks
//   different_fact  -> 0 (no partial credit: the rule for "right idea, wrong detail" is not set yet)
//   absent          -> 0
//
// A "same_fact" whose quote is not in that answer's own transcript is not credited and the answer's confidence drops to
// low (the evidence rule). The model never returns a total, and never sees the marks. Output is mapped onto the same
// GradeResult the rest of the pipeline uses, so nothing downstream changes.

import { z } from 'zod';
import type { HwAiGradeItem } from '@/db/hw-schema';
import { generate, routed, textPart, type AiCall, type AiResult, type CallOptions } from '../ai';
import { HwError } from '../errors';
import { CONFIDENCE_VALUE } from '../reader/parse';
import { STRICT_PROMPT_VERSION, STRICT_RESPONSE_SCHEMA, STRICT_SYSTEM_PROMPT, strictQuestionBlock } from '../prompts/grade-strict.v1';
import { gradeAnswersBlock } from '../prompts/grade.v1';
import { quoteIsInTranscript } from '../text/normalise';
import type { AnswerGrader, GradeInput, GradeResult } from './types';

const StrictOutput = z.object({
  results: z.array(z.object({
    answer_id: z.string().min(1),
    points: z.array(z.object({
      point_id: z.string().min(1),
      verdict: z.enum(['same_fact', 'different_fact', 'absent']),
      quote: z.string().max(5_000),
    })),
  })),
});

/** Confidence of a verdict backed by valid evidence. The model reports none; this is fixed, and low when evidence failed. */
export const STRICT_CONFIDENCE = 0.9;

export function strictCall(model: string, input: GradeInput, options?: CallOptions): AiCall {
  return {
    model,
    systemInstruction: STRICT_SYSTEM_PROMPT,
    schema: STRICT_RESPONSE_SCHEMA,
    parts: [
      textPart(strictQuestionBlock({ type: input.question.type, prompt: input.question.prompt, rubric: input.question.rubric.map((r) => ({ id: r.id, description: r.description })) })),
      textPart(gradeAnswersBlock(input.answers.map((a) => ({ id: a.answerId, transcript: a.transcript })))),
    ],
    ...(options ? { options: { staticPrefixParts: 1, ...options } } : {}),
  };
}

export function validateStrictOutput(json: unknown, input: GradeInput, meta: { model: string }): GradeResult[] {
  const parsed = StrictOutput.safeParse(json);
  if (!parsed.success) {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `strict grader output failed validation: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  }
  const q = input.question;
  const transcripts = new Map(input.answers.map((a) => [a.answerId, a.transcript]));
  const byAnswer = new Map<string, (typeof parsed.data.results)[number]>();
  for (const r of parsed.data.results) {
    if (!transcripts.has(r.answer_id)) throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `grader returned unknown answer id ${r.answer_id}`);
    if (byAnswer.has(r.answer_id)) throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `grader returned answer id ${r.answer_id} twice`);
    byAnswer.set(r.answer_id, r);
  }
  const missing = input.answers.filter((a) => !byAnswer.has(a.answerId));
  if (missing.length) throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `grader returned no result for ${missing.length} answer(s)`);

  return input.answers.map(({ answerId, transcript }) => {
    const raw = byAnswer.get(answerId)!;
    const notes: string[] = [];
    const given = new Map<string, (typeof raw.points)[number]>();
    for (const p of raw.points) {
      if (!q.rubric.some((r) => r.id === p.point_id)) { notes.push(`ignored unknown key point ${p.point_id}`); continue; }
      if (given.has(p.point_id)) { notes.push(`ignored a second judgement for key point ${p.point_id}`); continue; }
      given.set(p.point_id, p);
    }
    const items: HwAiGradeItem[] = q.rubric.map((r) => {
      const p = given.get(r.id);
      if (!p) {
        notes.push(`no judgement for key point ${r.id}; treated as absent`);
        return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: CONFIDENCE_VALUE.low };
      }
      if (p.verdict === 'absent') return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: STRICT_CONFIDENCE };
      const evidence = quoteIsInTranscript(p.quote, transcript);
      if (p.verdict === 'same_fact') {
        if (!evidence) {
          notes.push(`item ${r.id}: quote not found in the answer; downgraded from same_fact to missing`);
          return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: CONFIDENCE_VALUE.low };
        }
        return { rubric_item_id: r.id, verdict: 'met', quote: p.quote, marks: r.marks, confidence: STRICT_CONFIDENCE };
      }
      // different_fact: no credit. The words are kept for the teacher when they really are in the answer.
      notes.push(`item ${r.id}: the answer states a different fact from the key point`);
      return { rubric_item_id: r.id, verdict: 'missing', quote: evidence ? p.quote : '', marks: 0, confidence: evidence ? STRICT_CONFIDENCE : CONFIDENCE_VALUE.low };
    });
    const total = Math.min(items.reduce((s, i) => s + i.marks, 0), q.marks);
    return {
      answerId, model: meta.model, promptVersion: STRICT_PROMPT_VERSION, rubricVersion: q.rubricVersion, items,
      suggestedMarks: total, confidence: items.length ? Math.min(...items.map((i) => i.confidence)) : CONFIDENCE_VALUE.low, validationNotes: notes,
    };
  });
}

export function strictResultsFrom(res: AiResult, input: GradeInput): GradeResult[] {
  return validateStrictOutput(res.json, input, { model: res.model });
}

export class StrictGrader implements AnswerGrader {
  lastCall: AiResult | null = null;
  constructor(readonly model: string, readonly options?: CallOptions) {}

  async grade(input: GradeInput): Promise<GradeResult[]> {
    const res = await generate(routed(strictCall(this.model, input, this.options), 'grade'));
    this.lastCall = res;
    return strictResultsFrom(res, input);
  }
}
