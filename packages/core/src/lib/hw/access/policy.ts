// Who may do what. Pure functions over already-loaded rows, so every rule is unit-tested
// without a database. The loaders in ./guards.ts fetch the rows and call these.
//
// Roles come from the VERIFIED membership of the active institution (see ./actor.ts):
//   admin   = org owner / org_admin, or platform super_admin acting inside that org
//   teacher = org teacher; sees only assignments for classes linked to them in hw_class_teacher
//   student = org student; sees only their own submissions, in classes they are enrolled in
//   parent  = no access in Phase 1 (there is no parent <-> child link yet)

export type HwRole = 'admin' | 'teacher' | 'student' | 'parent' | 'none';

export interface HwActor {
  userId: string;
  orgId: string;
  role: HwRole;
  /** Platform super_admin acting inside an institution. */
  isPlatformStaff: boolean;
}

export interface AssignmentScope {
  organizationId: string;
  classId: string;
  sectionId: string | null;
  subject: string;
  createdBy: string;
  status: 'draft' | 'published' | 'closed';
}

export interface ClassTeacherLink {
  classId: string;
  sectionId: string | null;
  subject: string | null;
}

export interface Enrollment {
  classId: string;
  sectionId: string | null;
}

/** Better Auth member.role -> feature role. */
export function roleFromMember(raw: string | null | undefined): HwRole {
  switch (raw) {
    case 'owner':
    case 'org_admin':
    case 'admin':
      return 'admin';
    case 'teacher':
      return 'teacher';
    case 'parent':
    case 'parent_guardian':
      return 'parent';
    case 'student':
    case 'member':
      return 'student';
    default:
      return 'none';
  }
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A teacher link covers an assignment when class matches and section/subject match or are open. */
export function linkCovers(link: ClassTeacherLink, a: Pick<AssignmentScope, 'classId' | 'sectionId' | 'subject'>): boolean {
  if (link.classId !== a.classId) return false;
  if (link.sectionId !== null && link.sectionId !== a.sectionId) return false;
  if (link.subject !== null && !sameText(link.subject, a.subject)) return false;
  return true;
}

/** Create, edit, publish, mark. */
export function canManageAssignment(actor: HwActor, a: AssignmentScope, links: ClassTeacherLink[]): boolean {
  if (actor.orgId !== a.organizationId) return false;
  if (actor.role === 'admin') return true;
  if (actor.role !== 'teacher') return false;
  return links.some((l) => linkCovers(l, a));
}

/** May a teacher create an assignment for this class/section/subject at all? */
export function canCreateFor(actor: HwActor, target: Pick<AssignmentScope, 'classId' | 'sectionId' | 'subject'>, links: ClassTeacherLink[]): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role !== 'teacher') return false;
  return links.some((l) => linkCovers(l, target));
}

/** A student sees an assignment when it is published or closed and they are enrolled in its class (and section). */
export function studentCanSee(actor: HwActor, a: AssignmentScope, enrollments: Enrollment[]): boolean {
  if (actor.role !== 'student' || actor.orgId !== a.organizationId) return false;
  if (a.status === 'draft') return false;
  return enrollments.some((e) => e.classId === a.classId && (a.sectionId === null || e.sectionId === a.sectionId));
}

/** A submission's data: its own student, or someone who may manage the assignment. */
export function canViewSubmission(
  actor: HwActor,
  submission: { organizationId: string; studentId: string },
  a: AssignmentScope,
  links: ClassTeacherLink[],
): boolean {
  if (actor.orgId !== submission.organizationId) return false;
  if (actor.role === 'student') return submission.studentId === actor.userId;
  return canManageAssignment(actor, a, links);
}

/** Marks and feedback reach a student only after the teacher returns the work. */
export function studentCanSeeResult(actor: HwActor, submission: { studentId: string; status: string }): boolean {
  return actor.role === 'student' && submission.studentId === actor.userId && submission.status === 'returned';
}

export function canManageClassTeachers(actor: HwActor): boolean {
  return actor.role === 'admin';
}

/** Setting quotas and switching the feature on is platform staff only. */
export function canSetQuota(actor: HwActor): boolean {
  return actor.isPlatformStaff;
}
