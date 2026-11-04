// Parent / guardian view (roadmap-remaining.md workstream A, policy proposal P1). Off unless HW_PARENT_VIEW_ENABLED is set.
//
// A parent sees only the RETURNED work of a child linked to them through a guardian invitation (lib/guardian/onboarding.ts): the assignment, whether it was handed in and
// whether late, and once the teacher has returned it the marks, the teacher's comment and the marking points. Never an AI suggestion, a
// transcript, a student flag, another child's work, or anything before the teacher returns it. Every function checks, in this order:
// the feature is on, the caller is a parent (or the institution admin, for linking), the link is live, and the institution is the caller's.
// The student functions are reused with the CHILD as the actor, so the rules for what a student may see stay in one place.

import { sql } from 'drizzle-orm';
import { requireRole, requireHwEnabled } from '../access/guards';
import type { HwActor } from '../access/policy';
import { getHwConfig } from '../config';
import { db } from '../db';
import { HwError } from '../errors';
import { myAssignments, myResult } from './submissions';

export function requireParentViewOn(): void {
  if (!getHwConfig().HW_PARENT_VIEW_ENABLED) throw new HwError('FEATURE_DISABLED', 'The parent view is not switched on.');
}

// ── Parent ───────────────────────────────────────────────────────────────────

/** The caller's live links in this institution. The only way into a child's work. */
async function myChildLinks(actor: HwActor) {
  requireParentViewOn();
  requireRole(actor, 'parent');
  await requireHwEnabled(actor);
  const r = await db.execute<{ student_user_id: string; name: string }>(sql`
    SELECT l.student_user_id, s.name FROM guardian_link l JOIN "user" s ON s.id = l.student_user_id
     WHERE l.organization_id = ${actor.orgId} AND l.guardian_user_id = ${actor.userId} AND l.ended_at IS NULL ORDER BY s.name`);
  return r.rows;
}

export async function myChildren(actor: HwActor) {
  return (await myChildLinks(actor)).map((c) => ({ id: c.student_user_id, name: c.name }));
}

/** The child as a student actor, only for a child this parent is linked to. */
async function childActor(actor: HwActor, studentId: string): Promise<HwActor> {
  const links = await myChildLinks(actor);
  if (!links.some((l) => l.student_user_id === studentId)) throw new HwError('NOT_FOUND', 'Student not found.'); // not "forbidden": nothing about other children is confirmed
  return { userId: studentId, orgId: actor.orgId, role: 'student', isPlatformStaff: false };
}

export async function childAssignments(actor: HwActor, studentId: string) {
  const child = await childActor(actor, studentId);
  const rows = await myAssignments(child);
  // What a parent needs: what was set, when it was due, whether it was handed in and whether late, and whether it has been returned.
  return rows.map((a) => ({
    id: a.id, title: a.title, subject: a.subject, dueAt: a.dueAt, totalMarks: a.totalMarks,
    handedIn: !!a.submission && a.submission.status !== 'draft', isLate: a.submission?.isLate ?? false,
    returned: a.submission?.status === 'returned', submissionId: a.submission?.status === 'returned' ? a.submission.id : null,
  }));
}

/** A returned result: marks, the teacher's comment and the marking points. Not the transcript, not before it is returned. */
export async function childResult(actor: HwActor, studentId: string, submissionId: string) {
  const child = await childActor(actor, studentId);
  const res = await myResult(child, submissionId); // refuses unless it is the child's own and returned
  return {
    assignment: res.assignment, total: res.total,
    questions: res.questions.map((q) => ({
      id: q.id, position: q.position, type: q.type, prompt: q.prompt, passage: q.passage, marks: q.marks, awarded: q.awarded, comment: q.comment, keyPoints: q.keyPoints,
    })),
  };
}

