// Parent / guardian view (roadmap-remaining.md workstream A, policy proposal P1). Off unless HW_PARENT_VIEW_ENABLED is set.
//
// A parent sees only the RETURNED work of a child an institution admin has linked to them: the assignment, whether it was handed in and
// whether late, and once the teacher has returned it the marks, the teacher's comment and the marking points. Never an AI suggestion, a
// transcript, a student flag, another child's work, or anything before the teacher returns it. Every function checks, in this order:
// the feature is on, the caller is a parent (or the institution admin, for linking), the link is live, and the institution is the caller's.
// The student functions are reused with the CHILD as the actor, so the rules for what a student may see stay in one place.

import { and, eq, sql } from 'drizzle-orm';
import { member, user } from '@/db/schema';
import { requireRole, requireHwEnabled } from '../access/guards';
import type { HwActor } from '../access/policy';
import { roleFromMember } from '../access/policy';
import { writeAudit } from '../admin-audit';
import { getHwConfig } from '../config';
import { db, type Exec } from '../db';
import { HwError } from '../errors';
import { myAssignments, myResult } from './submissions';

export function requireParentViewOn(): void {
  if (!getHwConfig().HW_PARENT_VIEW_ENABLED) throw new HwError('FEATURE_DISABLED', 'The parent view is not switched on.');
}

type LinkRow = { id: string; guardian_user_id: string; student_user_id: string; created_at: Date; ended_at: Date | null }

// ── Institution admin: make and end links ────────────────────────────────────

/** Parents and students of this institution, for the link form. */
export async function linkOptions(actor: HwActor) {
  requireParentViewOn();
  requireRole(actor, 'admin');
  const rows = await db.select({ id: user.id, name: user.name, email: user.email, role: member.role }).from(member)
    .innerJoin(user, eq(user.id, member.userId)).where(eq(member.organizationId, actor.orgId)).orderBy(user.name).limit(2000);
  return {
    parents: rows.filter((r) => roleFromMember(r.role) === 'parent').map(({ id, name, email }) => ({ id, name, email })),
    students: rows.filter((r) => roleFromMember(r.role) === 'student').map(({ id, name, email }) => ({ id, name, email })),
  };
}

export async function listLinks(actor: HwActor) {
  requireParentViewOn();
  requireRole(actor, 'admin');
  const r = await db.execute<LinkRow & { guardian_name: string; student_name: string }>(sql`
    SELECT l.id, l.guardian_user_id, l.student_user_id, l.created_at, l.ended_at, g.name AS guardian_name, s.name AS student_name
      FROM hw_guardian_link l JOIN "user" g ON g.id = l.guardian_user_id JOIN "user" s ON s.id = l.student_user_id
     WHERE l.organization_id = ${actor.orgId} ORDER BY (l.ended_at IS NULL) DESC, l.created_at DESC LIMIT 500`);
  return r.rows.map((x) => ({ id: x.id, guardianId: x.guardian_user_id, guardianName: x.guardian_name, studentId: x.student_user_id, studentName: x.student_name, createdAt: x.created_at, endedAt: x.ended_at }));
}

async function memberRoleOf(x: Exec, orgId: string, userId: string): Promise<string | null> {
  const [m] = await x.select({ role: member.role }).from(member).where(and(eq(member.organizationId, orgId), eq(member.userId, userId))).limit(1);
  return m?.role ?? null;
}

export async function linkGuardian(actor: HwActor, input: { guardianId: string; studentId: string }) {
  requireParentViewOn();
  requireRole(actor, 'admin');
  return db.transaction(async (tx) => {
    // Both must belong to THIS institution, in the right roles: an admin cannot link someone from another institution.
    if (roleFromMember(await memberRoleOf(tx, actor.orgId, input.guardianId)) !== 'parent') throw new HwError('BAD_REQUEST', 'That person is not a parent or guardian of this institution.');
    if (roleFromMember(await memberRoleOf(tx, actor.orgId, input.studentId)) !== 'student') throw new HwError('BAD_REQUEST', 'That person is not a student of this institution.');
    const exists = await tx.execute(sql`SELECT 1 FROM hw_guardian_link WHERE organization_id = ${actor.orgId} AND guardian_user_id = ${input.guardianId} AND student_user_id = ${input.studentId} AND ended_at IS NULL`);
    if (exists.rows.length) throw new HwError('CONFLICT', 'This parent is already linked to this student.');
    const ins = await tx.execute<{ id: string }>(sql`
      INSERT INTO hw_guardian_link (organization_id, guardian_user_id, student_user_id, created_by) VALUES (${actor.orgId}, ${input.guardianId}, ${input.studentId}, ${actor.userId}) RETURNING id`);
    const id = ins.rows[0].id;
    await writeAudit(tx, { actorId: actor.userId, action: 'guardian_linked', entity: 'guardian_link', entityId: id, newValue: { organizationId: actor.orgId, guardianId: input.guardianId, studentId: input.studentId } });
    return { id };
  });
}

export async function unlinkGuardian(actor: HwActor, linkId: string) {
  requireParentViewOn();
  requireRole(actor, 'admin');
  await db.transaction(async (tx) => {
    const r = await tx.execute<{ id: string }>(sql`
      UPDATE hw_guardian_link SET ended_at = now(), ended_by = ${actor.userId}
       WHERE id = ${linkId} AND organization_id = ${actor.orgId} AND ended_at IS NULL RETURNING id`);
    if (!r.rows.length) throw new HwError('NOT_FOUND', 'No active link with that id in this institution.');
    await writeAudit(tx, { actorId: actor.userId, action: 'guardian_unlinked', entity: 'guardian_link', entityId: linkId });
  });
}

// ── Parent ───────────────────────────────────────────────────────────────────

/** The caller's live links in this institution. The only way into a child's work. */
async function myChildLinks(actor: HwActor) {
  requireParentViewOn();
  requireRole(actor, 'parent');
  await requireHwEnabled(actor);
  const r = await db.execute<{ student_user_id: string; name: string }>(sql`
    SELECT l.student_user_id, s.name FROM hw_guardian_link l JOIN "user" s ON s.id = l.student_user_id
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

