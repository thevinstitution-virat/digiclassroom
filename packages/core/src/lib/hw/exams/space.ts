// The exam space: a system institution of its own for exam attempts' marking work, separate from InkBuddy's practice space. Work there is
// never charged to a learner's InkBuddy trial (that is keyed on the practice space), has its own monthly ceiling, and its cost is visible on
// its own line. Each learner gets a private section per class level, as in self-practice, which is what keeps their attempts private.

import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { organization, institutionClasses, institutionSections, studentEnrollments } from '@/db/schema';
import { hwTenantQuota } from '@/db/hw-schema';
import { getHwConfig } from '../config';
import type { Exec } from '../db';

export const EXAM_ORG_ID = 'vgp-exams';

export async function ensureExamSpace(x: Exec): Promise<void> {
  await x.insert(organization).values({
    id: EXAM_ORG_ID, name: 'Virat Gyankosh Exams', slug: EXAM_ORG_ID, createdAt: new Date(),
    settings: { system: true, purpose: 'exam packages: marking of timed attempts' },
  }).onConflictDoNothing();
  await x.insert(hwTenantQuota).values({
    organizationId: EXAM_ORG_ID, enabled: true, monthlyBudgetPaise: getHwConfig().HW_EXAMS_PLATFORM_BUDGET_PAISE,
  }).onConflictDoNothing();
}

export const examClassId = (level: number): string => `vge-class-${level}`;
export const examSectionId = (userId: string, level: number): string =>
  `vge-s-${createHash('sha256').update(userId).digest('hex').slice(0, 20)}-${level}`;

/** The learner's own class level and section in the exam space, and their enrollment in it. Safe to repeat. */
export async function ensureExamLearnerSpace(x: Exec, userId: string, level: number): Promise<{ classId: string; sectionId: string }> {
  const classId = examClassId(level);
  const sectionId = examSectionId(userId, level);
  await x.insert(institutionClasses).values({ id: classId, organizationId: EXAM_ORG_ID, name: `Class ${level}`, level }).onConflictDoNothing();
  await x.insert(institutionSections).values({ id: sectionId, organizationId: EXAM_ORG_ID, classId, name: 'Exam practice' }).onConflictDoNothing();
  const [e] = await x.select({ id: studentEnrollments.id }).from(studentEnrollments)
    .where(and(eq(studentEnrollments.organizationId, EXAM_ORG_ID), eq(studentEnrollments.userId, userId), eq(studentEnrollments.classId, classId), eq(studentEnrollments.sectionId, sectionId))).limit(1);
  if (!e) await x.insert(studentEnrollments).values({ organizationId: EXAM_ORG_ID, userId, classId, sectionId, status: 'active' });
  return { classId, sectionId };
}
