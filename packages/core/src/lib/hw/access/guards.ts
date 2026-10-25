// Loaders that fetch a row, check it belongs to the caller's institution, and apply the
// pure rules in ./policy.ts. Every endpoint goes through one of these; none trusts an id
// from the client on its own.

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { studentEnrollments } from '@/db/schema';
import { hwAssignment, hwClassTeacher, hwSubmission, hwTenantQuota } from '@/db/hw-schema';
import { HwError } from '../errors';
import { getHwConfig } from '../config';
import {
  canManageAssignment,
  canViewSubmission,
  studentCanSee,
  type AssignmentScope,
  type ClassTeacherLink,
  type Enrollment,
  type HwActor,
} from './policy';

export type AssignmentRow = typeof hwAssignment.$inferSelect;
export type SubmissionRow = typeof hwSubmission.$inferSelect;

/** Per-institution switch: the quota row, or HW_FEATURE_DEFAULT_ENABLED when there is none. */
export async function isHwEnabled(orgId: string): Promise<boolean> {
  const [row] = await db.select({ enabled: hwTenantQuota.enabled }).from(hwTenantQuota)
    .where(eq(hwTenantQuota.organizationId, orgId)).limit(1);
  return row ? row.enabled : getHwConfig().HW_FEATURE_DEFAULT_ENABLED;
}

export async function requireHwEnabled(actor: HwActor): Promise<void> {
  if (!(await isHwEnabled(actor.orgId))) {
    throw new HwError('FEATURE_DISABLED', 'Handwritten assignments are not switched on for this institution.');
  }
}

export async function teacherLinks(actor: HwActor): Promise<ClassTeacherLink[]> {
  if (actor.role !== 'teacher') return [];
  return db.select({ classId: hwClassTeacher.classId, sectionId: hwClassTeacher.sectionId, subject: hwClassTeacher.subject })
    .from(hwClassTeacher)
    .where(and(eq(hwClassTeacher.organizationId, actor.orgId), eq(hwClassTeacher.teacherId, actor.userId)));
}

export async function studentEnrollmentsOf(actor: HwActor): Promise<Enrollment[]> {
  if (actor.role !== 'student') return [];
  return db.select({ classId: studentEnrollments.classId, sectionId: studentEnrollments.sectionId })
    .from(studentEnrollments)
    .where(and(
      eq(studentEnrollments.organizationId, actor.orgId),
      eq(studentEnrollments.userId, actor.userId),
      eq(studentEnrollments.status, 'active'),
    ));
}

const scopeOf = (a: AssignmentRow): AssignmentScope => ({
  organizationId: a.organizationId,
  classId: a.classId,
  sectionId: a.sectionId,
  subject: a.subject,
  createdBy: a.createdBy,
  status: a.status,
});

async function loadAssignment(actor: HwActor, assignmentId: string): Promise<AssignmentRow> {
  const [a] = await db.select().from(hwAssignment)
    .where(and(eq(hwAssignment.id, assignmentId), eq(hwAssignment.organizationId, actor.orgId)))
    .limit(1);
  // Same answer for "missing" and "another institution's": never confirm another tenant's ids.
  if (!a) throw new HwError('NOT_FOUND', 'Assignment not found.');
  return a;
}

export async function assignmentForManage(actor: HwActor, assignmentId: string): Promise<AssignmentRow> {
  const a = await loadAssignment(actor, assignmentId);
  if (!canManageAssignment(actor, scopeOf(a), await teacherLinks(actor))) {
    throw new HwError('FORBIDDEN', 'You do not teach this class.');
  }
  return a;
}

export async function assignmentForStudent(actor: HwActor, assignmentId: string): Promise<AssignmentRow> {
  const a = await loadAssignment(actor, assignmentId);
  if (!studentCanSee(actor, scopeOf(a), await studentEnrollmentsOf(actor))) {
    throw new HwError('NOT_FOUND', 'Assignment not found.');
  }
  return a;
}

/** A submission plus its assignment, for its own student or a teacher/admin of that class. */
export async function submissionForView(actor: HwActor, submissionId: string): Promise<{ submission: SubmissionRow; assignment: AssignmentRow }> {
  const [s] = await db.select().from(hwSubmission)
    .where(and(eq(hwSubmission.id, submissionId), eq(hwSubmission.organizationId, actor.orgId)))
    .limit(1);
  if (!s) throw new HwError('NOT_FOUND', 'Submission not found.');
  const a = await loadAssignment(actor, s.assignmentId);
  if (!canViewSubmission(actor, s, scopeOf(a), await teacherLinks(actor))) {
    throw new HwError('NOT_FOUND', 'Submission not found.');
  }
  return { submission: s, assignment: a };
}

/** The caller's own submission, for writing to it. */
export async function ownSubmission(actor: HwActor, submissionId: string): Promise<{ submission: SubmissionRow; assignment: AssignmentRow }> {
  if (actor.role !== 'student') throw new HwError('FORBIDDEN', 'Only students submit answers.');
  const result = await submissionForView(actor, submissionId);
  if (result.submission.studentId !== actor.userId) throw new HwError('NOT_FOUND', 'Submission not found.');
  return result;
}

export function requireRole(actor: HwActor, ...roles: HwActor['role'][]): void {
  if (!roles.includes(actor.role)) throw new HwError('FORBIDDEN', 'You do not have access to this.');
}
