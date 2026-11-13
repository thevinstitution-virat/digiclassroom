// The teacher's pen for InkBuddy (Phase 2 of docs/hw-eval/inkbuddy-teacher-roadmap.md), run by the job runner after the practice release:
// for each answer whose mark was just released, one call to the marking model for a teacher's remark and a few notes on the learner's
// own words (prompts/teacher-pen.v1.ts), checked in code, and saved with the answer (hw_answer.ink_stats.pen: no new table, no migration).
//
// It cannot change a mark: it runs after the mark is final and writes nowhere near hw_grade. Off unless HW_TEACHER_PEN_ENABLED. Each call
// is a finished job row (kind 'grade', payload {pen: true}) so its cost appears in the AI usage view and is charged to the learner's trial
// like every other step. An answer is tried at most twice; a learner whose trial cannot pay for another step is skipped.

import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { hwAiJob, hwRubricItem } from '@/db/hw-schema';
import { generate as aiGenerate, providerFor, routed, textPart, usageFromError, type AiResult, type AiCall } from '../ai';
import { getHwConfig, requireModel } from '../config';
import { db, newId, num } from '../db';
import { describeError } from '../errors';
import { recordUsage } from '../cost/usage';
import { bookAnswerOf } from '../services/submissions';
import { checkPen, teacherPenInput, TEACHER_PEN_PROMPT_VERSION, TEACHER_PEN_SCHEMA, TEACHER_PEN_SYSTEM_PROMPT, type PenResult } from '../prompts/teacher-pen.v1';
import { PRACTICE_ORG_ID } from './rules';
import { practiceRefusals } from './trial';

const MAX_TRIES = 2;

/** What is stored with the answer (hw_answer.ink_stats.pen). */
export interface StoredPen extends PenResult { v: string; model: string; at: string }

export function penCall(model: string, input: Parameters<typeof teacherPenInput>[0]): AiCall {
  return { model, systemInstruction: TEACHER_PEN_SYSTEM_PROMPT, schema: TEACHER_PEN_SCHEMA, parts: [textPart(teacherPenInput(input))] };
}

/** Write the teacher's pen for answers whose marks were released and have none yet. Returns how many were written. */
export async function runTeacherPen(deps: { generate?: (call: AiCall) => Promise<AiResult> } = {}, limit = 10): Promise<number> {
  const cfg = getHwConfig();
  if (!cfg.HW_TEACHER_PEN_ENABLED || !cfg.HW_SELF_PRACTICE_ENABLED) return 0;
  const generate = deps.generate ?? aiGenerate;
  const due = await db.execute<{
    answer_id: string; submission_id: string; question_id: string; transcript: string; confidence: string | null; tries: number | null;
    prompt: string; marks: string; language_hint: string; active_key_id: string | null; item_marks: { rubric_item_id: string; marks: number }[]; ai_grade_id: string | null;
  }>(sql`
    SELECT a.id AS answer_id, a.submission_id, a.question_id, a.transcript, a.transcript_confidence AS confidence, (a.ink_stats ->> 'penTries')::int AS tries,
           q.prompt, q.marks, q.language_hint, q.active_key_id, g.item_marks, g.ai_grade_id
      FROM hw_answer a
      JOIN hw_submission s ON s.id = a.submission_id
      JOIN hw_question q ON q.id = a.question_id
      JOIN hw_grade g ON g.answer_id = a.id
     WHERE a.organization_id = ${PRACTICE_ORG_ID} AND s.status = 'returned' AND coalesce(a.transcript, '') <> ''
       AND NOT (a.ink_stats ? 'pen') AND coalesce((a.ink_stats ->> 'penTries')::int, 0) < ${MAX_TRIES}
     ORDER BY s.submitted_at DESC NULLS LAST
     LIMIT ${limit}`);
  let written = 0;
  for (const r of due.rows) {
    const note = async (patch: Record<string, unknown>) =>
      db.execute(sql`UPDATE hw_answer SET ink_stats = ink_stats || ${JSON.stringify(patch)}::jsonb WHERE id = ${r.answer_id}`);
    // the learner's trial pays for this step too; one that cannot is not written (and not tried again)
    if ((await practiceRefusals(db, PRACTICE_ORG_ID, [r.answer_id])).size) { await note({ penTries: MAX_TRIES, penSkipped: 'trial' }); continue; }

    const items = await db.select().from(hwRubricItem).where(and(eq(hwRubricItem.questionId, r.question_id), isNull(hwRubricItem.retiredAt))).orderBy(asc(hwRubricItem.position));
    const earned = new Map((r.item_marks ?? []).map((m) => [m.rubric_item_id, num(m.marks)]));
    const book = await bookAnswerOf(r.active_key_id);
    const language = r.language_hint === 'hi' ? 'hi' : 'en';
    const input = {
      question: r.prompt, marks: num(r.marks), language: language as 'en' | 'hi', bookAnswer: book?.text ?? null, answer: r.transcript,
      points: items.map((it) => ({ text: it.description, earned: earned.get(it.id) ?? 0, outOf: num(it.marks) })),
    };
    let result: AiResult | null = null;
    let problem: string | null = null;
    try {
      result = await generate(routed(penCall(requireModel('grade'), input), 'grade'));
    } catch (e) {
      problem = describeError(e);
      const billed = usageFromError(e);
      if (billed) result = { json: null, usage: billed.usage, rawUsage: {}, model: billed.model, costUsd: billed.costUsd } as AiResult;
    }
    // language notes only on a confident reading: the reader's own slip must never be shown as the learner's spelling mistake
    const confident = r.confidence !== null && num(r.confidence) >= cfg.HW_HIGH_CONFIDENCE;
    const pen = result && !problem ? checkPen(result.json, r.transcript, { languageNotes: confident }) : null;
    await db.transaction(async (tx) => {
      if (result) {
        const jobId = newId();
        await tx.insert(hwAiJob).values({
          id: jobId, organizationId: PRACTICE_ORG_ID, kind: 'grade', status: 'done', submissionId: r.submission_id, questionId: r.question_id,
          provider: providerFor('grade'), model: result.model, attempts: 1, startedAt: new Date(), finishedAt: new Date(),
          payloadRef: JSON.stringify({ pen: true, prompt: TEACHER_PEN_PROMPT_VERSION }), error: problem ? `teacher pen failed: ${problem}` : 'teacher pen',
        });
        await recordUsage(tx, { jobId, orgId: PRACTICE_ORG_ID, model: result.model, usage: result.usage, batch: false, costUsd: result.costUsd });
      }
      const stored: StoredPen | null = pen ? { ...pen, v: TEACHER_PEN_PROMPT_VERSION, model: result!.model, at: new Date().toISOString() } : null;
      const patch = stored ? { pen: stored } : { penTries: (r.tries ?? 0) + 1, penError: problem ?? 'no usable remark' };
      await tx.execute(sql`UPDATE hw_answer SET ink_stats = ink_stats || ${JSON.stringify(patch)}::jsonb WHERE id = ${r.answer_id}`);
    });
    if (pen) written++;
    else console.warn(`[hw] teacher pen: answer ${r.answer_id} not written (${problem ?? 'no usable remark'})`);
  }
  return written;
}

