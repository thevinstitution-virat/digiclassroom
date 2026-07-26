import { auth } from '@/auth';
import { headers } from 'next/headers';
import { Roles } from '@/types/globals'

// Default role assignment rules
const DEFAULT_ROLE: Roles = 'student' // Most users will be students

// Email domain-based role assignment
const DOMAIN_ROLE_MAPPING: Record<string, Roles> = {
  // Educational institution domains
  'school.edu': 'teacher',
  'university.edu': 'teacher',
  'college.edu': 'teacher',

  // Admin domains (you can customize these)
  'viratgyankosh.com': 'admin',
  'admin.viratgyankosh.com': 'admin',

  // Add your specific domains here
  // 'yourschool.edu': 'teacher',
}

// Special email addresses for admin access
const ADMIN_EMAILS = [
  'thevinstitution@gmail.com', // ONLY admin account
  // Note: bhaarat2050@gmail.com is intentionally NOT included here as per requirements
  // Add more admin emails as needed
]

// Special email addresses for specific role assignments
const SPECIFIC_ROLE_ASSIGNMENTS: Record<string, Roles> = {
  'thevinstitution@gmail.com': 'admin',  // Only admin account
  'bhaarat2050@gmail.com': 'student',    // Normal student account, not admin
}

// Teacher identification patterns
const TEACHER_EMAIL_PATTERNS = [
  /teacher\./i,
  /faculty\./i,
  /instructor\./i,
  /prof\./i,
  /educator\./i,
]

// Parent identification patterns  
const PARENT_EMAIL_PATTERNS = [
  /parent\./i,
  /guardian\./i,
  /family\./i,
]

/**
 * Automatically determine user role based on email and other factors
 */
export function determineUserRole(email: string, firstName?: string, lastName?: string): Roles {
  const emailLower = email.toLowerCase()

  // 1. Check for specific role assignments first (highest priority)
  if (SPECIFIC_ROLE_ASSIGNMENTS[emailLower]) {
    return SPECIFIC_ROLE_ASSIGNMENTS[emailLower]
  }

  // 2. Check for admin emails (legacy support)
  if (ADMIN_EMAILS.includes(emailLower)) {
    return 'admin'
  }

  // 3. Check domain-based mapping
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain && DOMAIN_ROLE_MAPPING[domain]) {
    return DOMAIN_ROLE_MAPPING[domain]
  }

  // 4. Check email patterns for teachers
  if (TEACHER_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return 'teacher'
  }

  // 5. Check email patterns for parents
  if (PARENT_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return 'parent'
  }

  // 6. Check name patterns (optional)
  const fullName = `${firstName || ''} ${lastName || ''}`.toLowerCase()
  if (fullName.includes('teacher') || fullName.includes('instructor')) {
    return 'teacher'
  }

  // 7. Default to student
  return DEFAULT_ROLE
}

/**
 * Assign role to user automatically during signup/signin
 */
export async function autoAssignUserRole(userId: string, email: string, firstName?: string, lastName?: string): Promise<{
  success: boolean
  role: Roles
  message: string
}> {
  try {
    // Get current user to check if role already exists
    // User data is already available from session
    const user = session?.user as any;
    const existingRole = user.role as Roles

    // If user already has a role, don't override it
    if (existingRole) {
      return {
        success: true,
        role: existingRole,
        message: `User already has role: ${existingRole}`
      }
    }

    // Determine appropriate role
    const assignedRole = determineUserRole(email, firstName, lastName)

    // Assign default tenant (in production, this would be more sophisticated)
    const defaultTenantId = 'demo-tenant-001'

    // Update user metadata
    // TODO: Role update should use Better Auth admin API or direct DB update
    // await db.update(user).set({ role: newRole }).where(eq(user.id, targetUserId))console.log(`Auto-assigned role "${assignedRole}" to user ${userId} (${email})`)

    return {
      success: true,
      role: assignedRole,
      message: `Automatically assigned role: ${assignedRole}`
    }

  } catch (error) {
    console.error('Error auto-assigning user role:', error)
    return {
      success: false,
      role: DEFAULT_ROLE,
      message: `Failed to assign role: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Get human-readable reason for role assignment
 */
function getAssignmentReason(email: string, role: Roles): string {
  const domain = email.split('@')[1]?.toLowerCase()

  switch (role) {
    case 'admin':
      if (ADMIN_EMAILS.includes(email.toLowerCase())) {
        return 'Admin email address'
      }
      return 'Admin domain'

    case 'teacher':
      if (domain && DOMAIN_ROLE_MAPPING[domain] === 'teacher') {
        return `Educational domain: ${domain}`
      }
      if (TEACHER_EMAIL_PATTERNS.some(pattern => pattern.test(email))) {
        return 'Teacher email pattern'
      }
      return 'Teacher identification'

    case 'parent':
      return 'Parent email pattern'

    case 'student':
    default:
      return 'Default assignment'
  }
}

/**
 * Check if user needs role assignment
 */
export async function needsRoleAssignment(userId: string): Promise<boolean> {
  try {
    // User data is already available from session
    const user = session?.user as any;
    return !user.role
  } catch (error) {
    console.error('Error checking role assignment need:', error)
    return true // Assume needs assignment if we can't check
  }
}

/**
 * Bulk assign roles to existing users (for migration)
 */
export async function bulkAutoAssignRoles(): Promise<{
  processed: number
  successful: number
  failed: number
  results: Array<{ userId: string; email: string; success: boolean; role?: Roles; error?: string }>
}> {
  try {
    // Get all users without roles
    // TODO: Replace with direct DB user query
    const users = { data: [] } as any;
    const usersWithoutRoles = users.data.filter(user => !user.role)

    const results = []
    let successful = 0
    let failed = 0

    for (const user of usersWithoutRoles) {
      const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId)

      if (primaryEmail) {
        const result = await autoAssignUserRole(
          user.id,
          primaryEmail.emailAddress,
          user?.name?.split(' ')[0] || undefined,
          user?.name?.split(' ').slice(1).join(' ') || undefined
        )

        if (result.success) {
          successful++
        } else {
          failed++
        }

        results.push({
          userId: user.id,
          email: primaryEmail.emailAddress,
          success: result.success,
          role: result.role,
          error: result.success ? undefined : result.message
        })
      } else {
        failed++
        results.push({
          userId: user.id,
          email: 'No email found',
          success: false,
          error: 'No primary email address'
        })
      }
    }

    return {
      processed: usersWithoutRoles.length,
      successful,
      failed,
      results
    }

  } catch (error) {
    console.error('Error in bulk role assignment:', error)
    throw error
  }
}
