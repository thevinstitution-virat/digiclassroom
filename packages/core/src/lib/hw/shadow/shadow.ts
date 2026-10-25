// Shadow mode (stage1-design.md §9.4): a sampled share of live answers is also read and/or
// marked with a CANDIDATE configuration, in the background, after production has finished
// with them. The results go only to hw_eval_shadow_result, where they are compared with
// production and, later, the teacher's final marks. They are never shown to anyone and never
// used in grading: nothing in the product reads that table (a test enforces it).
//
// Shadow calls count against the institution's AI quota and monthly cost, like any AI call.
// They run after the production transaction has committed, and every error is caught here:
// a shadow failure is a failed shadow row, never a failed production job.

import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { hwAiGrade, hwAnswer, hwQuestion } from '@/db/hw-schema';
import { hwEvalShadowResult } from '@/db/hw-eval-schema';
import { getHwConfig } from '../config';
import { db, newId } from '../db';
import { describeError } from '../errors';
import { quotaAllows, quotaState } from '../cost/quota';
import { costOf, recordUsage } from '../cost/usage';
import { usageFromError } from '../ai';
import { AiGrader } from '../grader/ai-grader';
import { gradeWithoutAi } from '../grader/exact-match';
import type { GradeQuestion } from '../grader/types';
import { decideAfterRead, type EscalationPolicy } from '../reader/escalation';
import { GeminiReader } from '../reader/gemini-reader';
import type { ReadInputAnswer } from '../reader/types';
import { READ_PROMPT_VERSION } from '../prompts/read.v1';
import { GRADE_PROMPT_VERSION } from '../prompts/grade.v1';
import { getHwObject } from '../storage/r2';
import type { TokenUsage } from '../cost/pricing';

const ShadowConfig = z.object({
  reader: z.object({ model: z.string().min(1), escalateModel: z.string().min(1).optional() }).strict().optional(),
  grader: z.object({ model: z.string().min(1) }).strict().optional(),
}).strict().refine((c) => c.reader || c.grader, 'needs a reader or a grader');

export type ShadowConfigT = z.infer<typeof ShadowConfig>;

export interface ShadowSettings {
  rate: number;
  config: ShadowConfigT;
  /** sha256 of everything that defines the candidate, stored on every row. */
  configHash: string;
}

/** Null when shadow mode is off; throws when it is on but misconfigured (so it is noticed). */
export function shadowSettings(): ShadowSettings | null {
  const c = getHwConfig();
  if (!c.HW_SHADOW_RATE) return null;
  if (!c.HW_SHADOW_CONFIG_JSON) throw new Error('HW_SHADOW_RATE is set but HW_SHADOW_CONFIG_JSON is not');
  const config = ShadowConfig.parse(JSON.parse(c.HW_SHADOW_CONFIG_JSON));
  const canonical = JSON.stringify({
    provider: c.HW_AI_PROVIDER, thinking: c.HW_THINKING_LEVEL, media: c.HW_READ_MEDIA_RESOLUTION,
    escalateBelow: c.HW_READ_ESCALATE_BELOW, unclearAbove: c.HW_UNCLEAR_ESCALATE_ABOVE,
    reader: config.reader ?? null, grader: config.grader ?? null, prompts: [READ_PROMPT_VERSION, GRADE_PROMPT_VERSION],
  });
  return { rate: c.HW_SHADOW_RATE, config, configHash: createHash('sha256').update(canonical).digest('hex') };
}

/** Deterministic sampling: the same answer is always in or out for one configuration. */
export function sampled(answerId: string, configHash: string, rate: number): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  const h = createHash('sha256').update(`${configHash}:${answerId}`).digest();
  return h.readUInt32BE(0) / 0x1_0000_0000 < rate;
}

async function alreadyDone(answerIds: string[], kind: 'read' | 'mark', configHash: string): Promise<Set<string>> {
  if (!answerIds.length) return new Set();
  const rows = await db.select({ id: hwEvalShadowResult.answerId }).from(hwEvalShadowResult)
    .where(and(inArray(hwEvalShadowResult.answerId, answerIds), eq(hwEvalShadowResult.kind, kind), eq(hwEvalShadowResult.candidateConfigHash, configHash)));
  return new Set(rows.map((r) => r.id));
}

type Row = typeof hwEvalShadowResult.$inferInsert;

async function save(orgId: string, rows: Row[], calls: { model: string; usage: TokenUsage; costUsd?: number }[], counts: { pagesRead?: number; answersGraded?: number }): Promise<void> {
  if (!rows.length) return;
  // Each row carries its share of the calls' tokens and cost.
  const share = (n: number) => Math.round(n / rows.length);
  const tokens = calls.reduce((t, c) => ({ input: t.input + c.usage.input, cached: t.cached + c.usage.cached, output: t.output + c.usage.output }), { input: 0, cached: 0, output: 0 });
  const paise = calls.reduce((s, c) => s + costOf({ model: c.model, usage: c.usage, batch: false, costUsd: c.costUsd }).paise, 0);
  await db.transaction(async (tx) => {
    for (const c of calls) {
      await recordUsage(tx, { jobId: null, orgId, model: c.model, usage: c.usage, costUsd: c.costUsd, batch: false, ...(c === calls[0] ? counts : {}) });
    }
    await tx.insert(hwEvalShadowResult).values(rows.map((r) => ({
      ...r, tokensIn: share(tokens.input), tokensCached: share(tokens.cached), tokensOut: share(tokens.output), costPaise: String(paise / rows.length),
    }))).onConflictDoNothing();
  });
}

async function saveFailures(orgId: string, answerIds: string[], kind: 'read' | 'mark', configHash: string, reason: string): Promise<void> {
  if (!answerIds.length) return;
  await db.insert(hwEvalShadowResult).values(answerIds.map((answerId) => ({
    id: newId(), organizationId: orgId, answerId, kind, candidateConfigHash: configHash, status: 'failed' as const, failureReason: reason.slice(0, 500),
  }))).onConflictDoNothing();
}

/** After production read and settled these answers (in one submission). Never throws. */
export async function shadowAfterRead(orgId: string, answerIds: string[]): Promise<void> {
  try {
    const s = shadowSettings();
    if (!s?.config.reader || !answerIds.length) return;
    const done = await alreadyDone(answerIds, 'read', s.configHash);
    const pick = answerIds.filter((id) => !done.has(id) && sampled(id, s.configHash, s.rate));
    if (!pick.length) return;
    const quota = await quotaState(db, orgId, 'read');
    if (!quotaAllows(quota, pick.length)) return saveFailures(orgId, pick, 'read', s.configHash, 'AI quota reached: not run');

    const rows = await db.select({ id: hwAnswer.id, renderKey: hwAnswer.renderKey, imageKey: hwAnswer.imageKey, transcript: hwAnswer.transcript, lang: hwQuestion.languageHint })
      .from(hwAnswer).innerJoin(hwQuestion, eq(hwQuestion.id, hwAnswer.questionId))
      .where(and(eq(hwAnswer.organizationId, orgId), inArray(hwAnswer.id, pick)));
    const withImage = rows.filter((r) => r.renderKey ?? r.imageKey);
    const answers: ReadInputAnswer[] = await Promise.all(withImage.map(async (r) => {
      const key = (r.renderKey ?? r.imageKey)!;
      const ext = key.split('.').pop()?.toLowerCase();
      return { answerId: r.id, languageHint: r.lang, png: await getHwObject(key), mimeType: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' as const : ext === 'webp' ? 'image/webp' as const : 'image/png' as const };
    }));
    if (!answers.length) return;

    const cfg = getHwConfig();
    const policy: EscalationPolicy = { escalateBelow: cfg.HW_READ_ESCALATE_BELOW, unclearAbove: cfg.HW_UNCLEAR_ESCALATE_ABOVE };
    const calls: { model: string; usage: TokenUsage; costUsd?: number }[] = [];
    try {
      const r1 = await new GeminiReader(s.config.reader.model, 1).read({ answers });
      calls.push({ model: r1.model, usage: r1.usage, costUsd: r1.costUsd });
      const final = new Map(r1.answers.map((a) => [a.answerId, a]));
      const doubtful = r1.answers.filter((a) => decideAfterRead(a, 1, policy).action === 'escalate').map((a) => a.answerId);
      if (doubtful.length && s.config.reader.escalateModel) {
        const r2 = await new GeminiReader(s.config.reader.escalateModel, 2).read({ answers: answers.filter((a) => doubtful.includes(a.answerId)) });
        calls.push({ model: r2.model, usage: r2.usage, costUsd: r2.costUsd });
        for (const a of r2.answers) final.set(a.answerId, a);
      }
      const prod = new Map(rows.map((r) => [r.id, r.transcript]));
      await save(orgId, [...final.values()].map((a) => ({
        id: newId(), organizationId: orgId, answerId: a.answerId, kind: 'read' as const, candidateConfigHash: s.configHash,
        predictedTranscript: a.text, productionTranscript: prod.get(a.answerId) ?? null, status: 'ok' as const,
      })), calls, { pagesRead: answers.length });
    } catch (e) {
      // Calls already made, and the failing one if the provider billed it, still count.
      const billed = usageFromError(e);
      for (const c of [...calls, ...(billed ? [billed] : [])]) await recordUsage(db, { jobId: null, orgId, model: c.model, usage: c.usage, costUsd: c.costUsd, batch: false });
      await saveFailures(orgId, answers.map((a) => a.answerId), 'read', s.configHash, describeError(e));
    }
  } catch (e) {
    console.error('[hw] shadow read failed (production unaffected):', e);
  }
}

/** After production suggested marks for these answers to one question. Never throws. */
export async function shadowAfterGrade(orgId: string, question: GradeQuestion, answers: { answerId: string; transcript: string }[]): Promise<void> {
  try {
    const s = shadowSettings();
    if (!s?.config.grader || !answers.length) return;
    const done = await alreadyDone(answers.map((a) => a.answerId), 'mark', s.configHash);
    const pick = answers.filter((a) => !done.has(a.answerId) && sampled(a.answerId, s.configHash, s.rate));
    if (!pick.length) return;
    // Answers marked by rule (blank, exact match) need no AI on either side; they are skipped.
    const forAi = pick.filter((a) => !gradeWithoutAi(question, a.answerId, a.transcript));
    if (!forAi.length) return;
    const quota = await quotaState(db, orgId, 'grade');
    if (!quotaAllows(quota, forAi.length)) return saveFailures(orgId, forAi.map((a) => a.answerId), 'mark', s.configHash, 'AI quota reached: not run');

    const grader = new AiGrader(s.config.grader.model);
    try {
      const results = await grader.grade({ question, answers: forAi });
      const call = grader.lastCall!;
      // Production's suggestion for the same answers: the latest hw_ai_grade of each.
      const prodRows = await db.select({ answerId: hwAiGrade.answerId, marks: hwAiGrade.suggestedMarks, at: hwAiGrade.createdAt })
        .from(hwAiGrade).where(inArray(hwAiGrade.answerId, forAi.map((a) => a.answerId)));
      const latest = new Map<string, { marks: string; at: Date }>();
      for (const r of prodRows) if (!latest.has(r.answerId) || latest.get(r.answerId)!.at < r.at) latest.set(r.answerId, r);
      await save(orgId, results.map((r) => ({
        id: newId(), organizationId: orgId, answerId: r.answerId, kind: 'mark' as const, candidateConfigHash: s.configHash,
        predictedMarks: String(r.suggestedMarks), predictedItems: r.items, productionMarks: latest.get(r.answerId)?.marks ?? null, status: 'ok' as const,
      })), [{ model: call.model, usage: call.usage, costUsd: call.costUsd }], { answersGraded: forAi.length });
    } catch (e) {
      // Output that failed validation was still billed (lastCall); a provider error may carry usage too.
      const billed = grader.lastCall ?? usageFromError(e);
      if (billed) await recordUsage(db, { jobId: null, orgId, model: billed.model, usage: billed.usage, costUsd: billed.costUsd, batch: false });
      await saveFailures(orgId, forAi.map((a) => a.answerId), 'mark', s.configHash, describeError(e));
    }
  } catch (e) {
    console.error('[hw] shadow marking failed (production unaffected):', e);
  }
}

/** Fill in the teacher's final marks on shadow marking rows once they exist. Returns rows updated. */
export async function fillShadowFinalMarks(): Promise<number> {
  const r = await db.execute(sql`
    UPDATE hw_eval_shadow_result s SET final_marks = g.marks, compared_at = now()
      FROM hw_grade g
     WHERE g.answer_id = s.answer_id AND s.kind = 'mark' AND s.status = 'ok' AND s.final_marks IS NULL`);
  return r.rowCount ?? 0;
}
