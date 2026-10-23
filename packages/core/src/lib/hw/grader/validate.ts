// Checks the AI's marking in code before anything is saved. Pure.
//
// What it enforces, and records in validation_notes whenever it corrects something:
// - the output covers every answer and every current rubric item, exactly once;
// - every quote is really in that student's transcript, or the item becomes "missing" with
//   0 marks (this stops invented evidence);
// - "missing" gives 0; item marks stay within 0..item marks, in half-mark steps;
// - the total is recomputed from the items (the model's arithmetic is never used) and
//   capped at the question's marks.

import { z } from 'zod';
import type { HwAiGradeItem } from '@/db/hw-schema';
import { HwError } from '../errors';
import { quoteIsInTranscript } from '../text/normalise';
import { CONFIDENCE_VALUE } from '../reader/parse';
import type { GradeInput, GradeResult } from './types';

const GradeOutput = z.object({
  results: z.array(z.object({
    answer_id: z.string().min(1),
    items: z.array(z.object({
      rubric_item_id: z.string().min(1),
      verdict: z.enum(['met', 'partial', 'missing']),
      quote: z.string().max(5_000),
      marks: z.number().finite(),
      confidence: z.enum(['high', 'medium', 'low']),
    })),
  })),
});

const half = (n: number) => Math.round(n * 2) / 2;

export function validateGradeOutput(
  json: unknown,
  input: GradeInput,
  meta: { model: string; promptVersion: string },
): GradeResult[] {
  const parsed = GradeOutput.safeParse(json);
  if (!parsed.success) {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.',
      `grader output failed validation: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`);
  }

  const q = input.question;
  const transcripts = new Map(input.answers.map((a) => [a.answerId, a.transcript]));
  const byAnswer = new Map<string, (typeof parsed.data.results)[number]>();
  for (const r of parsed.data.results) {
    if (!transcripts.has(r.answer_id)) {
      throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `grader returned unknown answer id ${r.answer_id}`);
    }
    if (byAnswer.has(r.answer_id)) {
      throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `grader returned answer id ${r.answer_id} twice`);
    }
    byAnswer.set(r.answer_id, r);
  }
  const missing = input.answers.filter((a) => !byAnswer.has(a.answerId));
  if (missing.length) {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI marking output was unusable.', `grader returned no result for ${missing.length} answer(s)`);
  }

  return input.answers.map(({ answerId, transcript }) => {
    const raw = byAnswer.get(answerId)!;
    const notes: string[] = [];
    const given = new Map<string, (typeof raw.items)[number]>();
    for (const it of raw.items) {
      if (!q.rubric.some((r) => r.id === it.rubric_item_id)) {
        notes.push(`ignored unknown rubric item ${it.rubric_item_id}`);
        continue;
      }
      if (given.has(it.rubric_item_id)) {
        notes.push(`ignored a second judgement for rubric item ${it.rubric_item_id}`);
        continue;
      }
      given.set(it.rubric_item_id, it);
    }

    const items: HwAiGradeItem[] = q.rubric.map((r) => {
      const it = given.get(r.id);
      if (!it) {
        notes.push(`no judgement for rubric item ${r.id}; treated as missing`);
        return { rubric_item_id: r.id, verdict: 'missing', quote: '', marks: 0, confidence: CONFIDENCE_VALUE.low };
      }
      let { verdict, quote, marks } = it;
      const confidence = CONFIDENCE_VALUE[it.confidence];

      if (verdict !== 'missing' && !quoteIsInTranscript(quote, transcript)) {
        notes.push(`item ${r.id}: quote not found in the answer; downgraded from ${verdict} to missing`);
        verdict = 'missing';
        quote = '';
      }
      if (verdict === 'missing') {
        if (marks !== 0) notes.push(`item ${r.id}: missing must score 0 (model gave ${marks})`);
        marks = 0;
      } else {
        const bounded = half(Math.min(Math.max(marks, 0), r.marks));
        if (bounded !== marks) notes.push(`item ${r.id}: marks ${marks} corrected to ${bounded} (item is worth ${r.marks})`);
        marks = bounded;
      }
      return { rubric_item_id: r.id, verdict, quote, marks, confidence };
    });

    let total = items.reduce((s, i) => s + i.marks, 0);
    if (total > q.marks) {
      notes.push(`total ${total} capped at the question's ${q.marks} marks`);
      total = q.marks;
    }
    const confidence = items.length ? Math.min(...items.map((i) => i.confidence)) : CONFIDENCE_VALUE.low;

    return {
      answerId,
      model: meta.model,
      promptVersion: meta.promptVersion,
      rubricVersion: q.rubricVersion,
      items,
      suggestedMarks: total,
      confidence,
      validationNotes: notes,
    };
  });
}
