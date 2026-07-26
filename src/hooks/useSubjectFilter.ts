/**
 * useSubjectFilter Hook
 *
 * Centralized subject filtering logic based on class level, medium, stream, and subscription.
 * Uses the centralized subject matrix as the single source of truth.
 *
 * This hook eliminates code duplication for subject filtering across pages.
 *
 * @param classLevel - The class level (1-12)
 * @param medium - The medium of instruction (ENGLISH or HINDI)
 * @param stream - The academic stream (BIOLOGY/MATHEMATICS/COMMERCE/HUMANITIES)
  for Classes 11-12
 * @param selectedOptionalSubjects - Optional subjects selected by the user (for Classes 11-12)
 * @param purchasedSubjects - Array of subjects the user has purchased (null = all subjects)
 * @param hasAllSubjects - Whether the user has access to all subjects
 * @returns Filtered array of subject names
 */

import { useMemo } from 'react'
import { getAvailableSubjects, requiresStreamSelection, type Medium, type Stream } from '@/config/subject-matrix'

export interface UseSubjectFilterOptions {
  classLevel: number | null
  medium: Medium
  stream?: Stream
  selectedOptionalSubjects?: string[]
  purchasedSubjects: string[] | null
  hasAllSubjects: boolean
  enableLogging?: boolean
}

export function useSubjectFilter({
  classLevel,
  medium,
  stream,
  selectedOptionalSubjects,
  purchasedSubjects,
  hasAllSubjects,
  enableLogging = true
}: UseSubjectFilterOptions): string[] {

  return useMemo(() => {
    // If no class level, return empty array
    if (!classLevel) {
      if (enableLogging) {
        console.warn('⚠️ [useSubjectFilter] No class level provided')
      }
      return []
    }

    // For Classes 11-12, stream is required
    if (requiresStreamSelection(classLevel) && !stream) {
      if (enableLogging) {
        console.warn(`⚠️ [useSubjectFilter] Stream is required for Class ${classLevel} but not provided`)
      }
      return []
    }

    // Get base subjects from centralized subject matrix
    let subjects = getAvailableSubjects(classLevel, medium, stream, selectedOptionalSubjects)

    if (enableLogging) {
      console.log(`📚 [useSubjectFilter] Base subjects for Class ${classLevel} (${medium} medium${stream ? `, ${stream} stream` : ''}):`, subjects)
    }

    // If no subjects found, return empty array
    if (!subjects || subjects.length === 0) {
      if (enableLogging) {
        console.warn(`⚠️ [useSubjectFilter] No subjects found for Class ${classLevel} with medium ${medium}${stream ? ` and stream ${stream}` : ''}`)
      }
      return []
    }

    // Filter by purchased subjects if user doesn't have all subjects
    if (!hasAllSubjects && purchasedSubjects && purchasedSubjects.length > 0) {
      const upperPurchased = purchasedSubjects.map(s => s.toUpperCase())
      const filteredSubjects = subjects.filter(subject =>
        upperPurchased.includes(subject.toUpperCase()) || upperPurchased.includes('ALL')
      )

      if (enableLogging) {
        console.log(`🔒 [useSubjectFilter] Filtered by subscription:`, {
          original: subjects,
          purchased: purchasedSubjects,
          filtered: filteredSubjects
        })
      }

      subjects = filteredSubjects
    } else if (enableLogging) {
      console.log(`✅ [useSubjectFilter] User has access to all subjects`)
    }

    return subjects
  }, [classLevel, medium, stream, selectedOptionalSubjects, purchasedSubjects, hasAllSubjects, enableLogging])
}

