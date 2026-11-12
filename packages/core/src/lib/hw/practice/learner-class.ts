// Which books InkBuddy offers a learner (owner, 13 Nov 2026): the books of THEIR class and medium only, as Virat Gyankosh does. The class comes
// from the learner's learning path (the goals chosen at onboarding: curriculum codes such as `SCH.CBSE.C10` or `SCH.CBSE.C10.SCIENCE`), else
// from the class saved on their profile (enhanced_user_profiles.grade_level, which saving a path also writes). Someone with no class gets no
// book and is asked to set it, never a guess.

import { eq } from 'drizzle-orm';
import { enhancedUserProfiles } from '@/db/schema';
import { getLearningPath, learningPathEnabled } from '../../learning-path/service';
import { mediumCode } from '../../library/scope';
import { db } from '../db';
import type { PracticeScope } from './catalog';

export interface LearnerClass {
  /** Class levels the learner studies (more than one when their path has goals in two classes). Empty = not set. */
  classLevels: number[];
  /** Their medium, or null when not set (then both mediums of their class are offered). */
  medium: 'en' | 'hi' | null;
  source: 'path' | 'profile' | null;
}

const NONE: LearnerClass = { classLevels: [], medium: null, source: null };
const CLASS_IN_CODE = /^SCH\.[A-Z0-9_]+\.C(\d{1,2})(\.|$)/;

/** A learning path's classes and medium. Pure. */
export function classFromPath(path: { goals: { code: string; gradeLevel: number | null }[]; medium: string | null; legacy?: { gradeLevel: number | null; medium: string | null } }): LearnerClass {
  const levels = new Set<number>();
  for (const g of path.goals) {
    const m = CLASS_IN_CODE.exec(g.code ?? '');
    const n = m ? Number(m[1]) : g.gradeLevel;
    if (n && Number.isInteger(n) && n >= 1 && n <= 12) levels.add(n);
  }
  if (!levels.size && path.legacy?.gradeLevel) levels.add(path.legacy.gradeLevel);
  return levels.size ? { classLevels: [...levels].sort((a, b) => a - b), medium: mediumCode(path.medium ?? path.legacy?.medium) ?? null, source: 'path' } : NONE;
}

/** The learner's class(es) and medium: the learning path first, then the profile. Never throws: an unreadable path falls back to the profile. */
export async function learnerClass(userId: string): Promise<LearnerClass> {
  if (learningPathEnabled()) {
    try {
      const fromPath = classFromPath(await getLearningPath(userId));
      if (fromPath.classLevels.length) return fromPath;
    } catch (e) {
      console.warn(`[hw] InkBuddy: learning path unavailable for ${userId}; using the profile (${(e as Error).message})`);
    }
  }
  const [p] = await db.select({ grade: enhancedUserProfiles.gradeLevel, medium: enhancedUserProfiles.medium }).from(enhancedUserProfiles)
    .where(eq(enhancedUserProfiles.userId, userId)).limit(1);
  const grade = p?.grade ?? null;
  if (!grade || grade < 1 || grade > 12) return NONE;
  return { classLevels: [grade], medium: mediumCode(p?.medium) ?? null, source: 'profile' };
}

/**
 * The scopes on offer narrowed to the learner: their classes, in their medium. A class whose books exist only in the other medium is still
 * offered in that medium (a Hindi-medium learner whose class has only an English book can practise it), rather than nothing. Pure.
 */
export function scopesForLearner(all: PracticeScope[], lc: LearnerClass): PracticeScope[] {
  const out: PracticeScope[] = [];
  for (const level of lc.classLevels) {
    const ofClass = all.filter((s) => s.classLevel === level);
    const inMedium = lc.medium ? ofClass.filter((s) => s.medium === lc.medium) : ofClass;
    // per subject: the learner's medium when the library has it, else whatever medium it has
    const subjects = new Set(ofClass.map((s) => s.subject.toLowerCase()));
    for (const subj of subjects) {
      const mine = inMedium.filter((s) => s.subject.toLowerCase() === subj);
      out.push(...(mine.length ? mine : ofClass.filter((s) => s.subject.toLowerCase() === subj)));
    }
  }
  return out;
}
