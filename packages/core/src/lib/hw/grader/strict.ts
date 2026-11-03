// Strict marking: the model returns, per key point, a verdict and the verbatim words; CODE computes the marks.
//
// grade-strict.v1 (phase 1c): same_fact, different_fact, absent.
// grade-strict.v2 (phase 1d): the same plus right_idea_wrong_detail, whose marks come from the partial-credit rule
// (grader/partial-credit.ts; HW_PARTIAL_CREDIT_RULE, default zero = phase 1c's marks).
//
//   same_fact                -> the key point's full marks
//   right_idea_wrong_detail  -> partialCredit(rule, marks): 0, half or full
//   different_fact, absent   -> 0
//
// A credited verdict whose quote is not in that answer's own transcript is not credited and the point's confidence drops to
// low (the evidence rule). The model never returns a total, and never sees the marks. Every verdict is stored with its quote
// on the item (fact, claimed, evidence), so marks can be recomputed under another rule without a model call.
// Output is mapped onto the same GradeResult the rest of the pipeline uses, so nothing downstream changes.

import { z } from 'zod';
import type { HwAiGradeItem } from '@/db/hw-schema';
import { generate, routed, textPart, type AiCall, type AiResult, type CallOptions } from '../ai';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { CONFIDENCE_VALUE } from '../reader/parse';
import { STRICT_PROMPT_VERSION, STRICT_RESPONSE_SCHEMA, STRICT_SYSTEM_PROMPT, strictQuestionBlock } from '../prompts/grade-strict.v1';
import { STRICT_PROMPT_VERSION_V2, STRICT_RESPONSE_SCHEMA_V2, STRICT_SYSTEM_PROMPT_V2 } from '../prompts/grade-strict.v2';
import { gradeAnswersBlock } from '../prompts/grade.v1';
import { quoteIsInTranscript } from '../text/normalise';
import { FACT_VERDICTS, marksFor, ruleFor, type PartialRule } from './partial-credit';
import type { AnswerGrader, GradeInput, GradeResult } from './types';

const StrictOutput = z.object({
  results: z.array(z.object({
    answer_id: z.string().min(1),
    points: z.array(z.object({
      point_id: z.string().min(1),
      verdict: z.enum(FACT_VERDICTS),
      quote: z.string().max(5_000),
    })),
  })),
});

/** Confidence of a verdict backed by valid evidence. The model reports none; this is fixed, and low when evidence failed. */
export const STRICT_CONFIDENCE = 0.9;

export type StrictVersion = 1 | 2;

export function strictCall(model: string, input: GradeInput, options?: CallOptions, version: StrictVersion = 1): AiCall {
  return {
    model,
    systemInstruction: version === 2 ? STRICT_SYSTEM_PROMPT_V2 : STRICT_SYSTEM_PROMPT,
    schema: version === 2 ? STRICT_RESPONSE_SCHEMA_V2 : STRICT_RESPONSE_SCHEMA,
    parts: [
      textPart(strictQuestionBlock({ type: input.question.type, prompt: input.question.prompt, rubric: input.question.rubric.map((r) => ({ id: r.id, description: r.description })) })),
      textPart(gradeAnswersBlock(input.answers.map((a) => ({ id: a.answerId, transcript: a.transcript })))),
    ],
    ...(options ? { options: { staticPrefixParts: 1, ...options } } : {}),
  };
}

export interface StrictValidateOptions {
  /** The partial-credit rule. Default zero, which is phase 1c's behaviour. */
  rule?: PartialRule;
  /** Which prompt produced the output (recorded on the result). Default 1. */
  version?: StrictVersion;
}

export function validateStrictOutput(json: unknown, input: GradeInput, meta: { model: string }, opts: StrictValidateOptions = {}): GradeResult[] {
  const rule = opts.rule ?? 'zero';
  const promptVersion = opts.version === 2 ? STRICT_PROMPT_VERSION_V2 : STRICT_PROMPT_VERSION;
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
      const evidence = p.verdict === 'absent' ? true : quoteIsInTranscript(p.quote, transcript);
      const kept = { fact: p.verdict, claimed: p.quote, evidence } as const;
      if (p.verdict === 'absent') return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: STRICT_CONFIDENCE, ...kept };
      if (p.verdict === 'same_fact') {
        if (!evidence) {
          notes.push(`item ${r.id}: quote not found in the answer; downgraded from same_fact to missing`);
          return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: CONFIDENCE_VALUE.low, ...kept };
        }
        return { rubric_item_id: r.id, verdict: 'met', quote: p.quote, marks: r.marks, confidence: STRICT_CONFIDENCE, ...kept };
      }
      if (p.verdict === 'right_idea_wrong_detail') {
        const credit = marksFor('right_idea_wrong_detail', r.marks, rule);
        if (credit > 0) {
          if (!evidence) {
            notes.push(`item ${r.id}: quote not found in the answer; right idea with a wrong detail not credited`);
            return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: CONFIDENCE_VALUE.low, ...kept };
          }
          notes.push(`item ${r.id}: the right idea with a wrong detail; ${credit} of ${r.marks} marks under the "${rule}" rule`);
          return { rubric_item_id: r.id, verdict: 'partial', quote: p.quote, marks: credit, confidence: STRICT_CONFIDENCE, ...kept };
        }
        notes.push(`item ${r.id}: the right idea with a wrong detail; no marks under the "${rule}" rule`);
        return { rubric_item_id: r.id, verdict: 'missing', quote: evidence ? p.quote : '', marks: 0, confidence: evidence ? STRICT_CONFIDENCE : CONFIDENCE_VALUE.low, ...kept };
      }
      // different_fact: no credit. The words are kept for the teacher when they really are in the answer.
      notes.push(`item ${r.id}: the answer states a different fact from the key point`);
      return { rubric_item_id: r.id, verdict: 'missing', quote: evidence ? p.quote : '', marks: 0, confidence: evidence ? STRICT_CONFIDENCE : CONFIDENCE_VALUE.low, ...kept };
    });
    const total = Math.min(items.reduce((s, i) => s + i.marks, 0), q.marks);
    return {
      answerId, model: meta.model, promptVersion, rubricVersion: q.rubricVersion, items,
      suggestedMarks: total, confidence: items.length ? Math.min(...items.map((i) => i.confidence)) : CONFIDENCE_VALUE.low, validationNotes: notes,
    };
  });
}

export function strictResultsFrom(res: AiResult, input: GradeInput, opts?: StrictValidateOptions): GradeResult[] {
  return validateStrictOutput(res.json, input, { model: res.model }, opts);
}

export class StrictGrader implements AnswerGrader {
  lastCall: AiResult | null = null;
  /** `version` 2 is grade-strict.v2 (four verdicts). `rule` overrides HW_PARTIAL_CREDIT_RULE / HW_PARTIAL_CREDIT_BY_SUBJECT. */
  constructor(readonly model: string, readonly options?: CallOptions, readonly settings: { version?: StrictVersion; rule?: PartialRule } = {}) {}

  async grade(input: GradeInput): Promise<GradeResult[]> {
    const version = this.settings.version ?? 1;
    const res = await generate(routed(strictCall(this.model, input, this.options, version), 'grade'));
    this.lastCall = res;
    return strictResultsFrom(res, input, { version, rule: this.settings.rule ?? ruleFor(input.question.subject, getHwConfig()) });
  }
}
