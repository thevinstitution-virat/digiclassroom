/**
 * Teacher Verification Service
 * 
 * Handles email domain verification and teacher verification status management
 * for the B2C teacher verification system.
 * 
 * Key Features:
 * - Educational domain detection (.edu, .ac.in, .school, etc.)
 * - Automatic email-based verification for trusted domains
 * - Verification status management and UI helpers
 */

import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

// ============================================================================
// EDUCATIONAL DOMAIN PATTERNS
// ============================================================================

/**
 * List of educational domain patterns that qualify for automatic email verification
 * 
 * These domains are considered trusted educational institutions and teachers
 * with these email domains will be automatically verified at the 'verified_email' level.
 */
const EDUCATIONAL_DOMAIN_PATTERNS = [
  // Generic educational domains
  '.edu',           // US educational institutions
  '.edu.in',        // Indian educational institutions
  '.ac.in',         // Indian academic institutions
  '.edu.au',        // Australian educational institutions
  '.ac.uk',         // UK academic institutions
  '.edu.sg',        // Singapore educational institutions
  '.edu.my',        // Malaysian educational institutions
  '.edu.pk',        // Pakistani educational institutions
  '.edu.bd',        // Bangladeshi educational institutions
  '.edu.np',        // Nepali educational institutions
  '.edu.lk',        // Sri Lankan educational institutions
  
  // Specific educational keywords
  '.school',        // Schools
  '.university',    // Universities
  '.college',       // Colleges
  '.academy',       // Academies
  '.institute',     // Institutes
  
  // Government education domains
  '.gov.in',        // Indian government (includes education departments)
  '.nic.in',        // National Informatics Centre (government schools)
]

/**
 * Additional trusted educational domain suffixes
 * These are checked after the main patterns
 */
const EDUCATIONAL_DOMAIN_SUFFIXES = [
  'school.com',
  'school.org',
  'school.net',
  'college.com',
  'college.org',
  'university.com',
  'university.org',
  'academy.com',
  'academy.org',
]

// ============================================================================
// VERIFICATION STATUS TYPES
// ============================================================================

export type VerificationStatus = 
  | 'unverified' 
  | 'verified_email' 
  | 'verified_document' 
  | 'verified_manual'

export type VerificationMethod = 
  | 'email_domain' 
  | 'document_upload' 
  | 'manual_review' 
  | null

export interface VerificationResult {
  verified: boolean
  verificationStatus: VerificationStatus
  verificationMethod: VerificationMethod
  emailDomain: string | null
  isEducationalDomain: boolean
}

export interface VerificationStatusInfo {
  label: string
  description: string
  color: string
  icon: string
  canAccessFeatures: {
    basicDashboard: boolean
    classCreation: boolean
    studentInvitations: boolean
    advancedAnalytics: boolean
    bulkImport: boolean
  }
}

// ============================================================================
// EMAIL DOMAIN EXTRACTION
// ============================================================================

/**
 * Extract domain from email address
 * 
 * @param email - Email address to extract domain from
 * @returns Domain string or null if invalid email
 * 
 * @example
 * extractEmailDomain('teacher@school.edu') // Returns 'school.edu'
 * extractEmailDomain('invalid-email') // Returns null
 */
export function extractEmailDomain(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null
  }

  const emailLower = email.toLowerCase().trim()
  const parts = emailLower.split('@')

  if (parts.length !== 2 || !parts[1]) {
    return null
  }

  return parts[1]
}

// ============================================================================
// EDUCATIONAL DOMAIN DETECTION
// ============================================================================

/**
 * Check if an email domain is from an educational institution
 * 
 * This function checks against known educational domain patterns and suffixes
 * to determine if the email is from a trusted educational institution.
 * 
 * @param email - Email address to check
 * @returns True if domain is educational, false otherwise
 * 
 * @example
 * isEducationalDomain('teacher@mit.edu') // Returns true
 * isEducationalDomain('teacher@gmail.com') // Returns false
 */
export function isEducationalDomain(email: string): boolean {
  const domain = extractEmailDomain(email)
  
  if (!domain) {
    return false
  }

  // Check against educational domain patterns
  for (const pattern of EDUCATIONAL_DOMAIN_PATTERNS) {
    if (domain.endsWith(pattern)) {
      return true
    }
  }

  // Check against educational domain suffixes
  for (const suffix of EDUCATIONAL_DOMAIN_SUFFIXES) {
    if (domain.endsWith(suffix)) {
      return true
    }
  }

  return false
}

// ============================================================================
// AUTO-VERIFICATION
// ============================================================================

/**
 * Automatically verify teacher by email domain
 * 
 * This function checks if the teacher's email is from an educational domain
 * and returns the appropriate verification status.
 * 
 * @param userId - User ID (UUID)
 * @param email - Teacher's email address
 * @returns Verification result with status and metadata
 * 
 * @example
 * const result = await autoVerifyTeacherByEmail('user-123', 'prof@stanford.edu')
 * // Returns: { verified: true, verificationStatus: 'verified_email', ... }
 */
export async function autoVerifyTeacherByEmail(
  userId: string,
  email: string
): Promise<VerificationResult> {
  const emailDomain = extractEmailDomain(email)
  const isEduDomain = isEducationalDomain(email)

  const result: VerificationResult = {
    verified: isEduDomain,
    verificationStatus: isEduDomain ? 'verified_email' : 'unverified',
    verificationMethod: isEduDomain ? 'email_domain' : null,
    emailDomain,
    isEducationalDomain: isEduDomain,
  }

  // If educational domain, update database with verification
  if (isEduDomain && userId) {
    try {
      await executeQuery(
        `UPDATE users 
         SET verification_status = ?,
             verification_method = ?,
             verified_at = NOW(),
             email_domain = ?,
             is_educational_domain = TRUE,
             updated_at = NOW()
         WHERE id = ?`,
        ['verified_email', 'email_domain', emailDomain, userId]
      )
      
      console.log(`✅ Auto-verified teacher ${userId} via educational domain: ${emailDomain}`)
    } catch (error) {
      console.error(`❌ Failed to update verification status for user ${userId}:`, error)
      // Don't throw - return result anyway
    }
  }

  return result
}

// ============================================================================
// VERIFICATION STATUS HELPERS
// ============================================================================

/**
 * Get UI-friendly information about a verification status
 * 
 * Returns display information and feature access permissions for each
 * verification tier in the B2C model.
 * 
 * @param status - Verification status
 * @returns UI information and feature access details
 */
export function getVerificationStatusInfo(status: VerificationStatus): VerificationStatusInfo {
  switch (status) {
    case 'unverified':
      return {
        label: 'Unverified',
        description: 'Basic access with limited features. Verify your email domain or upload documents to unlock more features.',
        color: 'gray',
        icon: 'AlertCircle',
        canAccessFeatures: {
          basicDashboard: true,
          classCreation: true, // Limited to 3 classes
          studentInvitations: false, // Join codes only
          advancedAnalytics: false,
          bulkImport: false,
        }
      }

    case 'verified_email':
      return {
        label: 'Email Verified',
        description: 'Your educational email has been verified. You have access to most features.',
        color: 'blue',
        icon: 'CheckCircle',
        canAccessFeatures: {
          basicDashboard: true,
          classCreation: true, // Up to 10 classes
          studentInvitations: true, // Can send email invitations
          advancedAnalytics: false,
          bulkImport: false,
        }
      }

    case 'verified_document':
      return {
        label: 'Document Verified',
        description: 'Your teaching credentials have been verified. You have full access to all features.',
        color: 'green',
        icon: 'ShieldCheck',
        canAccessFeatures: {
          basicDashboard: true,
          classCreation: true, // Up to 50 classes
          studentInvitations: true,
          advancedAnalytics: true,
          bulkImport: true,
        }
      }

    case 'verified_manual':
      return {
        label: 'Manually Verified',
        description: 'Your account has been manually verified by our team. You have full access to all features.',
        color: 'purple',
        icon: 'Award',
        canAccessFeatures: {
          basicDashboard: true,
          classCreation: true, // Unlimited
          studentInvitations: true,
          advancedAnalytics: true,
          bulkImport: true,
        }
      }

    default:
      return {
        label: 'Unknown',
        description: 'Verification status unknown',
        color: 'gray',
        icon: 'HelpCircle',
        canAccessFeatures: {
          basicDashboard: false,
          classCreation: false,
          studentInvitations: false,
          advancedAnalytics: false,
          bulkImport: false,
        }
      }
  }
}

/**
 * Check if a teacher can access a specific feature based on verification status
 * 
 * @param verificationStatus - Teacher's verification status
 * @param feature - Feature to check access for
 * @returns True if teacher can access the feature
 */
export function canAccessFeature(
  verificationStatus: VerificationStatus,
  feature: keyof VerificationStatusInfo['canAccessFeatures']
): boolean {
  const statusInfo = getVerificationStatusInfo(verificationStatus)
  return statusInfo.canAccessFeatures[feature]
}

/**
 * Get verification tier limits for resource usage
 * 
 * @param verificationStatus - Teacher's verification status
 * @returns Resource limits for the verification tier
 */
export function getVerificationTierLimits(verificationStatus: VerificationStatus) {
  switch (verificationStatus) {
    case 'unverified':
      return {
        maxClasses: 3,
        maxStudentsPerClass: 50,
        maxTotalStudents: 50,
        dailyQuestions: 100,
        validationsPerMonth: 50,
        canInviteStudents: false,
        canExportReports: false,
      }

    case 'verified_email':
      return {
        maxClasses: 10,
        maxStudentsPerClass: 200,
        maxTotalStudents: 200,
        dailyQuestions: 300,
        validationsPerMonth: 200,
        canInviteStudents: true,
        canExportReports: true,
      }

    case 'verified_document':
    case 'verified_manual':
      return {
        maxClasses: 50,
        maxStudentsPerClass: 1000,
        maxTotalStudents: 1000,
        dailyQuestions: 1000,
        validationsPerMonth: 1000,
        canInviteStudents: true,
        canExportReports: true,
      }

    default:
      return {
        maxClasses: 0,
        maxStudentsPerClass: 0,
        maxTotalStudents: 0,
        dailyQuestions: 0,
        validationsPerMonth: 0,
        canInviteStudents: false,
        canExportReports: false,
      }
  }
}

