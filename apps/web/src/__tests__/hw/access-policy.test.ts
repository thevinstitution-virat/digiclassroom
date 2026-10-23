// Handwritten Assignments: who may see and change what. Pure rules, no database.

import {
  canCreateFor,
  canManageAssignment,
  canSetQuota,
  canViewSubmission,
  studentCanSee,
  studentCanSeeResult,
  type AssignmentScope,
  roleFromMember,
  type HwActor,
} from '@/lib/hw/access/policy';

const assignment: AssignmentScope = { organizationId: 'orgA', classId: 'c9', sectionId: 'sA', subject: 'English', createdBy: 't1', status: 'published' };
const teacher: HwActor = { userId: 't1', orgId: 'orgA', role: 'teacher', isPlatformStaff: false };
const otherTeacher: HwActor = { userId: 't2', orgId: 'orgA', role: 'teacher', isPlatformStaff: false };
const admin: HwActor = { userId: 'ad', orgId: 'orgA', role: 'admin', isPlatformStaff: false };
const foreignAdmin: HwActor = { userId: 'ad2', orgId: 'orgB', role: 'admin', isPlatformStaff: false };
const student: HwActor = { userId: 's1', orgId: 'orgA', role: 'student', isPlatformStaff: false };
const parent: HwActor = { userId: 'p1', orgId: 'orgA', role: 'parent', isPlatformStaff: false };
const english9A = [{ classId: 'c9', sectionId: 'sA', subject: 'english' }];

describe('teachers', () => {
  it('manage assignments of a class, section and subject linked to them', () => {
    expect(canManageAssignment(teacher, assignment, english9A)).toBe(true);
  });
  it('a link with no section or subject covers the whole class', () => {
    expect(canManageAssignment(teacher, assignment, [{ classId: 'c9', sectionId: null, subject: null }])).toBe(true);
  });
  it('cannot manage another section, subject or class', () => {
    expect(canManageAssignment(otherTeacher, assignment, [{ classId: 'c9', sectionId: 'sB', subject: null }])).toBe(false);
    expect(canManageAssignment(otherTeacher, assignment, [{ classId: 'c9', sectionId: 'sA', subject: 'Maths' }])).toBe(false);
    expect(canManageAssignment(otherTeacher, assignment, [{ classId: 'c10', sectionId: null, subject: null }])).toBe(false);
    expect(canManageAssignment(otherTeacher, assignment, [])).toBe(false);
  });
  it('cannot create for a class they do not teach', () => {
    expect(canCreateFor(teacher, { classId: 'c10', sectionId: null, subject: 'English' }, english9A)).toBe(false);
    expect(canCreateFor(teacher, { classId: 'c9', sectionId: 'sA', subject: 'English' }, english9A)).toBe(true);
  });
});

describe('institutions', () => {
  it('admins manage everything in their own institution', () => {
    expect(canManageAssignment(admin, assignment, [])).toBe(true);
  });
  it('nobody manages another institution’s assignment, whatever their role or links', () => {
    expect(canManageAssignment(foreignAdmin, assignment, [])).toBe(false);
    expect(canManageAssignment({ ...teacher, orgId: 'orgB' }, assignment, english9A)).toBe(false);
  });
  it('a teacher cannot read another institution’s submission', () => {
    expect(canViewSubmission({ ...teacher, orgId: 'orgB' }, { organizationId: 'orgA', studentId: 's1' }, assignment, english9A)).toBe(false);
  });
});

describe('students', () => {
  const enrolled = [{ classId: 'c9', sectionId: 'sA' }];
  it('see published work for their class and section only', () => {
    expect(studentCanSee(student, assignment, enrolled)).toBe(true);
    expect(studentCanSee(student, assignment, [{ classId: 'c9', sectionId: 'sB' }])).toBe(false);
    expect(studentCanSee(student, { ...assignment, sectionId: null }, [{ classId: 'c9', sectionId: 'sB' }])).toBe(true);
  });
  it('never see drafts', () => {
    expect(studentCanSee(student, { ...assignment, status: 'draft' }, enrolled)).toBe(false);
  });
  it('can read only their own submission', () => {
    expect(canViewSubmission(student, { organizationId: 'orgA', studentId: 's1' }, assignment, [])).toBe(true);
    expect(canViewSubmission(student, { organizationId: 'orgA', studentId: 's2' }, assignment, [])).toBe(false);
  });
  it('see marks only after the work is returned', () => {
    expect(studentCanSeeResult(student, { studentId: 's1', status: 'graded' })).toBe(false);
    expect(studentCanSeeResult(student, { studentId: 's1', status: 'returned' })).toBe(true);
    expect(studentCanSeeResult(student, { studentId: 's2', status: 'returned' })).toBe(false);
  });
});

describe('parents and platform', () => {
  it('parents have no access in Phase 1', () => {
    expect(canManageAssignment(parent, assignment, english9A)).toBe(false);
    expect(canViewSubmission(parent, { organizationId: 'orgA', studentId: 's1' }, assignment, [])).toBe(false);
    expect(studentCanSee(parent, assignment, [{ classId: 'c9', sectionId: 'sA' }])).toBe(false);
  });
  it('only platform staff set quotas', () => {
    expect(canSetQuota(admin)).toBe(false);
    expect(canSetQuota({ ...admin, isPlatformStaff: true })).toBe(true);
  });
});

describe('member roles', () => {
  it.each([
    ['owner', 'admin'], ['org_admin', 'admin'], ['admin', 'admin'], ['teacher', 'teacher'],
    ['student', 'student'], ['member', 'student'], ['parent', 'parent'], ['something', 'none'], [null, 'none'],
  ])('%s -> %s', (raw, role) => {
    expect(roleFromMember(raw as string | null)).toBe(role);
  });
});
