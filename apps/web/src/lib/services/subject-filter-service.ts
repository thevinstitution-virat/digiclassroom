/**
 * Subject Filter Service
 * Provides user-specific subject filtering based on profile and subscription
 */

import {
  getAvailableSubjects,
  getCoreSubjectsForStream,
  getOptionalSubjects,
  type Medium,
  type Stream,
} from '@/config/subject-matrix';

// ============================================================================
// Type Definitions
// ============================================================================

export interface UserProfileForSubjectFiltering {
  classLevel: number;
  medium: Medium;
  stream?: Stream;
  selectedOptionalSubjects?: string[];
  purchasedSubjects?: string[];
  subscriptionPlan?: 'starter' | 'pro' | 'enterprise';
}

export interface SubjectFilterResult {
  availableSubjects: string[];
  coreSubjects?: string[];
  optionalSubjects?: string[];
  selectedOptionalSubjects?: string[];
  restrictedSubjects?: string[];
}

// ============================================================================
// Subject Filtering Functions
// ============================================================================

/**
 * Get filtered subjects for a user based on their profile and subscription
 */
export function getFilteredSubjectsForUser(
  userProfile: UserProfileForSubjectFiltering
): SubjectFilterResult {
  const { classLevel, medium, stream, selectedOptionalSubjects, purchasedSubjects } = userProfile;

  // Get base available subjects from subject matrix
  let availableSubjects = getAvailableSubjects(
    classLevel,
    medium,
    stream,
    selectedOptionalSubjects
  );

  // For Classes 11-12, separate core and optional subjects
  let coreSubjects: string[] | undefined;
  let optionalSubjects: string[] | undefined;

  if (classLevel === 11 || classLevel === 12) {
    if (stream) {
      coreSubjects = getCoreSubjectsForStream(classLevel, stream);
      optionalSubjects = getOptionalSubjects(classLevel);
    }
  }

  // Apply subscription-based filtering if needed
  let restrictedSubjects: string[] = [];

  // If user has purchased specific subjects, filter to only those
  if (purchasedSubjects && purchasedSubjects.length > 0) {
    restrictedSubjects = availableSubjects.filter(
      (subject) => !purchasedSubjects.includes(subject)
    );
    availableSubjects = availableSubjects.filter((subject) =>
      purchasedSubjects.includes(subject)
    );
  }

  return {
    availableSubjects,
    coreSubjects,
    optionalSubjects,
    selectedOptionalSubjects,
    restrictedSubjects,
  };
}

/**
 * Check if a user has access to a specific subject
 */
export function hasAccessToSubject(
  userProfile: UserProfileForSubjectFiltering,
  subjectName: string
): boolean {
  const { availableSubjects } = getFilteredSubjectsForUser(userProfile);
  return availableSubjects.includes(subjectName);
}

/**
 * Get subjects that require purchase/upgrade
 */
export function getRestrictedSubjects(
  userProfile: UserProfileForSubjectFiltering
): string[] {
  const { restrictedSubjects } = getFilteredSubjectsForUser(userProfile);
  return restrictedSubjects || [];
}

/**
 * Filter content by subject availability
 */
export function filterContentBySubjectAccess<T extends { subject: string }>(
  content: T[],
  userProfile: UserProfileForSubjectFiltering
): T[] {
  const { availableSubjects } = getFilteredSubjectsForUser(userProfile);
  return content.filter((item) => availableSubjects.includes(item.subject));
}

/**
 * Get subject access summary for a user
 */
export function getSubjectAccessSummary(userProfile: UserProfileForSubjectFiltering): {
  totalAvailable: number;
  totalRestricted: number;
  coreSubjectsCount?: number;
  optionalSubjectsCount?: number;
  accessPercentage: number;
} {
  const { availableSubjects, coreSubjects, optionalSubjects, restrictedSubjects } =
    getFilteredSubjectsForUser(userProfile);

  const totalAvailable = availableSubjects.length;
  const totalRestricted = restrictedSubjects?.length || 0;
  const totalSubjects = totalAvailable + totalRestricted;

  return {
    totalAvailable,
    totalRestricted,
    coreSubjectsCount: coreSubjects?.length,
    optionalSubjectsCount: optionalSubjects?.length,
    accessPercentage: totalSubjects > 0 ? (totalAvailable / totalSubjects) * 100 : 100,
  };
}

