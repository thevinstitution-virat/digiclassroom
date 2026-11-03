// The instruction screen's record (phase 1d): which answers were flagged when marked, with the patterns that fired, and the
// teacher's one-tap "not an instruction". The ratio of the two, per pattern, is the screen's real false-positive rate on real
// writing. Used only while HW_INSTRUCTION_GUARD_ENABLED is on; needs migration 020.
//
// The record never decides anything about a mark. Marking must not fail because it could not be written, so writes at marking time
// run in a savepoint and a failure is logged. A failed read leaves the flag showing (the safe side).

import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { hwInstructionFlag } from '@/db/hw-cost-schema';
import { transcriptHash } from './grader/dedupe';
import { SCREEN_VERSION, screenInstructions } from './grader/instruction-screen';
import { HwError } from './errors';
import { db, type Exec } from './db';

/** Record every answer of a marked chunk that the screen flags (once per answer and transcript). */
export async function recordInstructionFlags(ex: Exec, orgId: string, answers: readonly { answerId: string; transcript: string }[]): Promise<void> {
  const rows = answers.flatMap((a) => {
    const s = screenInstructions(a.transcript);
    return s.flagged ? [{ organizationId: orgId, answerId: a.answerId, transcriptHash: transcriptHash(a.transcript), screenVersion: SCREEN_VERSION, patternIds: s.hits.map((h) => h.id) }] : [];
  });
  if (!rows.length) return;
  try {
    await ex.transaction(async (sp) => { await sp.insert(hwInstructionFlag).values(rows).onConflictDoNothing(); });
  } catch (e) {
    console.error('[hw] could not record instruction flags (is migration 020 applied?):', e instanceof Error ? e.message : e);
  }
}

/** The answers whose current transcript the teacher has said is not an instruction. */
export async function dismissedFlags(orgId: string, answers: readonly { id: string; transcript: string | null }[]): Promise<Set<string>> {
  if (!answers.length) return new Set();
  try {
    const rows = await db.select({ answerId: hwInstructionFlag.answerId, hash: hwInstructionFlag.transcriptHash }).from(hwInstructionFlag)
      .where(and(eq(hwInstructionFlag.organizationId, orgId), inArray(hwInstructionFlag.answerId, answers.map((a) => a.id)), isNotNull(hwInstructionFlag.dismissedAt)));
    const now = new Map(answers.map((a) => [a.id, transcriptHash(a.transcript ?? '')]));
    return new Set(rows.filter((r) => now.get(r.answerId) === r.hash).map((r) => r.answerId));
  } catch (e) {
    console.error('[hw] could not read instruction-flag dismissals (is migration 020 applied?):', e instanceof Error ? e.message : e);
    return new Set();
  }
}

/** The teacher says a flagged answer is not an instruction. Recorded with the patterns that fired, once. */
export async function dismissInstructionFlag(orgId: string, userId: string, answer: { id: string; transcript: string | null }): Promise<{ patterns: string[] }> {
  const text = answer.transcript ?? '';
  const s = screenInstructions(text);
  if (!s.flagged) throw new HwError('CONFLICT', 'This answer is not flagged.');
  const patternIds = s.hits.map((h) => h.id);
  const now = new Date();
  const h = transcriptHash(text);
  await db.insert(hwInstructionFlag).values({ organizationId: orgId, answerId: answer.id, transcriptHash: h, screenVersion: SCREEN_VERSION, patternIds, dismissedAt: now, dismissedBy: userId })
    .onConflictDoUpdate({ target: [hwInstructionFlag.answerId, hwInstructionFlag.transcriptHash], set: { dismissedAt: now, dismissedBy: userId }, setWhere: isNull(hwInstructionFlag.dismissedAt) });
  return { patterns: patternIds };
}
