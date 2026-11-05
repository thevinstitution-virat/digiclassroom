// The eligibility registry (roadmap 5.3): which groups may have AI marking suggestions, for which marking configuration. The rule itself is
// in decision.ts; this file reads and writes hw_eligibility / hw_eligibility_event (migration 024) and the gate results they rest on
// (hw_eval_gate_result, migration 023). Every change writes the append-only event and an audit row, in one transaction.
//
// Promotion needs a PASSING gate result for the group whose configuration fingerprint equals the one running now. Demotion is manual (with
// a reason) or automatic (monitoring, or a newer failing gate run for the same configuration). The default for every group is "not eligible".

import { randomUUID } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { hwAssignment, hwQuestion } from '@/db/hw-schema';
import { hwEligibility, hwEligibilityEvent, hwEvalGateResult } from '@/db/hw-control-schema';
import { writeAudit } from '../admin-audit';
import { getHwConfig, requireModel } from '../config';
import { HwError } from '../errors';
import { requireSuperAdmin, type EvalActor } from '../eval-tools/access';
import { markPromptVersion } from '../grader/mark-mode';
import type { Exec } from '../db';
import { enqueueGrade } from '../jobs/queue';
import { checkKeyForMarking } from '../keys/product';
import { AI_OFF_PREFIX, decide, type EligibilityDecision } from './decision';
import { fingerprint, runningParts, type FingerprintParts } from './fingerprint';
import { groupKey, parseGroupKey, type GroupParts } from './group';

/** The marking configuration in force now. Throws NOT_CONFIGURED when no grade model is set (then no AI marking runs at all). */
export function runningConfig(): { parts: FingerprintParts; hash: string } {
  const parts = runningParts(getHwConfig(), requireModel('grade'), markPromptVersion());
  return { parts, hash: fingerprint(parts) };
}

/** The running hash, or null when no grade model is configured (nothing can be eligible for a configuration that does not exist). */
function runningHashOrNull(): string | null {
  try { return runningConfig().hash; } catch { return null; }
}

export async function groupOfQuestion(x: Exec, questionId: string): Promise<GroupParts | null> {
  const [r] = await x.select({ subject: hwAssignment.subject, type: hwQuestion.type, language: hwQuestion.languageHint, source: hwQuestion.schemeSource })
    .from(hwQuestion).innerJoin(hwAssignment, eq(hwAssignment.id, hwQuestion.assignmentId)).where(eq(hwQuestion.id, questionId)).limit(1);
  return r ? { subject: r.subject, questionType: r.type, language: r.language, schemeSource: r.source } : null;
}

export async function eligibilityOfGroup(x: Exec, parts: GroupParts): Promise<EligibilityDecision> {
  const enforced = getHwConfig().HW_ELIGIBILITY_ENFORCED;
  if (!enforced) return decide(null, '', false);
  const [rec] = await x.select({ status: hwEligibility.status, configHash: hwEligibility.configHash }).from(hwEligibility).where(eq(hwEligibility.groupKey, groupKey(parts))).limit(1);
  const hash = runningHashOrNull();
  // No grade model: no configuration to be eligible for.
  return hash === null ? { eligible: false, reason: rec ? 'config_changed' : 'no_record' } : decide(rec ?? null, hash, true);
}

/**
 * May AI suggestions be created or shown for this question? Two things must hold (roadmap 5.2 and 5.3): the question's answer key must be usable now
 * (keys/product.ts: the backstop), and its group must be eligible for the marking setup running now. A question that cannot be found is not eligible.
 * With HW_ELIGIBILITY_ENFORCED off neither is checked (tests, and the owner's emergency switch).
 */
export async function eligibilityOfQuestion(x: Exec, questionId: string, opts: { rebuild?: boolean } = {}): Promise<EligibilityDecision> {
  if (!getHwConfig().HW_ELIGIBILITY_ENFORCED) return decide(null, '', false);
  const [q] = await x.select().from(hwQuestion).where(eq(hwQuestion.id, questionId)).limit(1);
  if (!q) return { eligible: false, reason: 'no_record' };
  const key = await checkKeyForMarking(x, q, { rebuild: opts.rebuild });
  if (!key.ok) return { eligible: false, reason: key.reason };
  const parts = await groupOfQuestion(x, questionId);
  return parts ? eligibilityOfGroup(x, parts) : { eligible: false, reason: 'no_record' };
}

export interface EligibilityRow {
  groupKey: string; subject: string; questionType: string; language: string; schemeSource: string;
  status: 'insufficient_data' | 'not_yet' | 'eligible';
  /** What applies now: eligible only while the stored configuration is the running one. */
  effective: 'insufficient_data' | 'not_yet' | 'eligible' | 'config_changed';
  configHash: string | null; gateResultId: string | null; datasetVersions: string[]; decidedBy: string; decidedAt: Date; reason: string;
}

export async function listEligibility(a: EvalActor): Promise<{ runningHash: string | null; rows: EligibilityRow[] }> {
  requireSuperAdmin(a);
  const rows = await db.select().from(hwEligibility).orderBy(hwEligibility.groupKey);
  const hash = runningHashOrNull();
  return {
    runningHash: hash,
    rows: rows.map((r) => ({
      groupKey: r.groupKey, subject: r.subject, questionType: r.questionType, language: r.language, schemeSource: r.schemeSource, status: r.status,
      effective: r.status === 'eligible' && r.configHash !== hash ? 'config_changed' : r.status,
      configHash: r.configHash, gateResultId: r.gateResultId, datasetVersions: r.datasetVersions, decidedBy: r.decidedBy, decidedAt: r.decidedAt, reason: r.reason,
    })),
  };
}

export async function eligibilityHistory(a: EvalActor, key: string) {
  requireSuperAdmin(a);
  return db.select().from(hwEligibilityEvent).where(eq(hwEligibilityEvent.groupKey, key)).orderBy(desc(hwEligibilityEvent.at)).limit(100);
}

export async function listGateResults(a: EvalActor, key?: string) {
  requireSuperAdmin(a);
  return db.select().from(hwEvalGateResult).where(key ? eq(hwEvalGateResult.groupKey, key) : undefined).orderBy(desc(hwEvalGateResult.importedAt)).limit(200);
}

export async function promote(a: EvalActor, input: { groupKey: string; gateResultId: string; reason: string; confirm: boolean }) {
  requireSuperAdmin(a);
  const parts = parseGroupKey(input.groupKey);
  if (!parts) throw new HwError('BAD_REQUEST', 'That is not a group.');
  const reason = input.reason.trim();
  if (reason.length < 10) throw new HwError('BAD_REQUEST', 'Write the reason for promoting this group (a sentence): it is kept in the history.');
  if (!input.confirm) throw new HwError('BAD_REQUEST', 'Confirm the promotion.');
  const [g] = await db.select().from(hwEvalGateResult).where(eq(hwEvalGateResult.id, input.gateResultId)).limit(1);
  if (!g || g.groupKey !== input.groupKey) throw new HwError('NOT_FOUND', 'No gate result for this group with that id.');
  if (g.verdict !== 'eligible') throw new HwError('CONFLICT', `That gate result says "${g.verdict.replace('_', ' ')}", not eligible. A group is promoted only from a passing gate run.`);
  let running: { hash: string };
  try { running = runningConfig(); } catch { throw new HwError('NOT_CONFIGURED', 'No marking model is configured, so there is no configuration to promote for.'); }
  if (!g.productionFingerprint) throw new HwError('CONFLICT', 'That gate result does not say which configuration it measured, so it cannot be promoted. Import it again with the run configuration.');
  if (g.productionFingerprint !== running.hash) {
    throw new HwError('CONFLICT', 'That gate run measured a different marking setup (model, prompt or options) from the one running now. Run the gates on the setup that is running, or change the running setup back.');
  }
  const result = await db.transaction(async (tx) => {
    const [prev] = await tx.select({ status: hwEligibility.status }).from(hwEligibility).where(eq(hwEligibility.groupKey, input.groupKey)).for('update').limit(1);
    const values = {
      groupKey: input.groupKey, subject: parts.subject, questionType: parts.questionType, language: parts.language, schemeSource: parts.schemeSource,
      status: 'eligible' as const, configHash: running.hash, gateResultId: g.id, datasetVersions: g.datasetVersions, decidedBy: a.userId, decidedAt: new Date(), reason,
    };
    await tx.insert(hwEligibility).values(values).onConflictDoUpdate({ target: hwEligibility.groupKey, set: values });
    await tx.insert(hwEligibilityEvent).values({ id: randomUUID(), groupKey: input.groupKey, fromStatus: prev?.status ?? 'none', toStatus: 'eligible', configHash: running.hash, gateResultId: g.id, datasetVersions: g.datasetVersions, actorId: a.userId, automatic: false, reason });
    await writeAudit(tx, { actorId: a.userId, action: 'eligibility_promoted', entity: 'eligibility', entityId: input.groupKey, reason, oldValue: { status: prev?.status ?? 'none' }, newValue: { status: 'eligible', configHash: running.hash, gateResultId: g.id, datasetVersions: g.datasetVersions } });
    return { groupKey: input.groupKey, status: 'eligible' as const };
  });
  // Answers that were left for the teacher only because the group was not eligible are marked now.
  const requeued = await requeueAfterPromotion(parts);
  return { ...result, requeuedQuestions: requeued };
}

/** Questions in the group whose answers wait with the "AI is off" reason: clear it and queue marking again. Returns how many questions. */
export async function requeueAfterPromotion(parts: GroupParts): Promise<number> {
  const res = await db.execute(sql`
    SELECT DISTINCT q.id AS question_id, ans.organization_id AS org
      FROM hw_answer ans
      JOIN hw_question q ON q.id = ans.question_id
      JOIN hw_assignment s ON s.id = q.assignment_id
     WHERE lower(btrim(regexp_replace(replace(s.subject, '|', ' '), '\\s+', ' ', 'g'))) = ${parts.subject}
       AND q.type = ${parts.questionType} AND q.language_hint = ${parts.language} AND q.scheme_source = ${parts.schemeSource}
       AND ans.failure_reason LIKE ${`${AI_OFF_PREFIX}%`}`);
  const rows = ((res as unknown as { rows?: { question_id: string; org: string }[] }).rows ?? (res as unknown as { question_id: string; org: string }[]));
  for (const r of rows) {
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE hw_answer SET failure_reason = NULL WHERE question_id = ${r.question_id} AND failure_reason LIKE ${`${AI_OFF_PREFIX}%`}`);
      await enqueueGrade(tx, r.org, r.question_id, 0);
    });
  }
  return rows.length;
}

/** Writes the demotion inside a transaction; returns false when the group was not eligible. */
async function demoteIn(tx: Exec, input: { groupKey: string; reason: string; actorId: string; automatic: boolean }): Promise<boolean> {
  const [cur] = await tx.select().from(hwEligibility).where(eq(hwEligibility.groupKey, input.groupKey)).for('update').limit(1);
  if (!cur || cur.status !== 'eligible') return false;
  await tx.update(hwEligibility).set({ status: 'not_yet', configHash: null, gateResultId: null, datasetVersions: [], decidedBy: input.actorId, decidedAt: new Date(), reason: input.reason })
    .where(eq(hwEligibility.groupKey, input.groupKey));
  await tx.insert(hwEligibilityEvent).values({ id: randomUUID(), groupKey: input.groupKey, fromStatus: 'eligible', toStatus: 'not_yet', configHash: cur.configHash, gateResultId: cur.gateResultId, datasetVersions: cur.datasetVersions, actorId: input.actorId, automatic: input.automatic, reason: input.reason });
  await writeAudit(tx, { actorId: input.actorId, action: input.automatic ? 'eligibility_demoted_automatically' : 'eligibility_demoted', entity: 'eligibility', entityId: input.groupKey, reason: input.reason, oldValue: { status: 'eligible', configHash: cur.configHash, gateResultId: cur.gateResultId }, newValue: { status: 'not_yet' } });
  return true;
}

export async function demote(a: EvalActor, input: { groupKey: string; reason: string }) {
  requireSuperAdmin(a);
  const reason = input.reason.trim();
  if (reason.length < 3) throw new HwError('BAD_REQUEST', 'Write why this group is being demoted: it is kept in the history.');
  const done = await db.transaction((tx) => demoteIn(tx, { groupKey: input.groupKey, reason, actorId: a.userId, automatic: false }));
  if (!done) throw new HwError('CONFLICT', 'That group is not eligible, so there is nothing to demote.');
  return { groupKey: input.groupKey, status: 'not_yet' as const };
}

/** The monitor, or a newer failing gate run, demotes without a person. Returns whether anything changed. */
export async function autoDemote(input: { groupKey: string; reason: string; actor?: string }): Promise<boolean> {
  return db.transaction((tx) => demoteIn(tx, { groupKey: input.groupKey, reason: input.reason, actorId: input.actor ?? 'system:monitor', automatic: true }));
}

/** Groups promoted for a configuration that is no longer the running one (suggestions are already off for them). */
export async function staleGroups(): Promise<string[]> {
  const hash = runningHashOrNull();
  const rows = await db.select({ key: hwEligibility.groupKey, hash: hwEligibility.configHash }).from(hwEligibility).where(eq(hwEligibility.status, 'eligible'));
  return rows.filter((r) => r.hash !== hash).map((r) => r.key);
}

