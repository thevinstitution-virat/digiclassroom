import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { UserRole, UserPersona } from '@/lib/validations'

// Simplified role assignment logic - only admin/user roles
const DEFAULT_ROLE: UserRole = 'user'

const ADMIN_EMAILS = [
  'thevinstitution@gmail.com',  // Only admin account
  'admin@viratgyankosh.com',
]

// Specific role assignments (highest priority)
const SPECIFIC_ROLE_ASSIGNMENTS: Record<string, { role: UserRole; persona: UserPersona }> = {
  'thevinstitution@gmail.com': { role: 'admin', persona: 'teacher' },  // Only admin account
  'bhaarat2050@gmail.com': { role: 'user', persona: 'student' },       // Normal user account, not admin
}

const ADMIN_DOMAIN_MAPPING: Record<string, boolean> = {
  'viratgyankosh.com': true,
  'admin.viratgyankosh.com': true,
}

const TEACHER_EMAIL_PATTERNS = [
  /teacher\./i,
  /faculty\./i,
  /instructor\./i,
  /prof\./i,
  /educator\./i,
]

const PARENT_EMAIL_PATTERNS = [
  /parent\./i,
  /guardian\./i,
  /family\./i,
]

function determineUserRoleAndPersona(email: string): { role: UserRole; persona: UserPersona } {
  const emailLower = email.toLowerCase()

  // Check for specific role assignments first (highest priority)
  if (SPECIFIC_ROLE_ASSIGNMENTS[emailLower]) {
    return SPECIFIC_ROLE_ASSIGNMENTS[emailLower]
  }

  // Check for admin emails (legacy support)
  if (ADMIN_EMAILS.includes(emailLower)) {
    return { role: 'admin', persona: 'teacher' } // Admins get teacher persona for AI responses
  }

  // Check domain-based admin mapping
  const domain = email.split('@')[1]?.toLowerCase()
  if (domain && ADMIN_DOMAIN_MAPPING[domain]) {
    return { role: 'admin', persona: 'teacher' }
  }

  // For all other users, assign 'user' role with appropriate persona
  // Check email patterns for teachers
  if (TEACHER_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return { role: 'user', persona: 'teacher' }
  }

  // Check email patterns for parents/guardians
  if (PARENT_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return { role: 'user', persona: 'guardian' }
  }

  // Default to user with student persona
  return { role: 'user', persona: 'student' }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body for manual assignments
    const body = await request.json().catch(() => ({}))
    const { role: manualRole, persona: manualPersona, manualAssignment } = body

    // Get user from Clerk
    const client = await clerkClient()
    const user = await client.users.getUser(userId)

    // Check if user already has a role (unless it's a manual assignment)
    const existingRole = user.publicMetadata.role as UserRole
    if (existingRole && !manualAssignment) {
      return NextResponse.json({
        success: true,
        role: existingRole,
        persona: user.publicMetadata.persona || 'student',
        message: `User already has role: ${existingRole}`
      })
    }

    let assignedRole: UserRole
    let assignedPersona: UserPersona

    if (manualAssignment && manualRole && manualPersona) {
      // Manual assignment from setup page
      assignedRole = manualRole
      assignedPersona = manualPersona
      console.log(`Manual role assignment: ${assignedRole} with persona ${assignedPersona} for user ${userId}`)
    } else {
      // Automatic assignment based on email
      const primaryEmail = user.emailAddresses.find(
        email => email.id === user.primaryEmailAddressId
      )

      if (!primaryEmail) {
        return NextResponse.json(
          { error: 'No email address found' },
          { status: 400 }
        )
      }

      // Determine appropriate role and persona
      const result = determineUserRoleAndPersona(primaryEmail.emailAddress)
      assignedRole = result.role
      assignedPersona = result.persona
      console.log(`Auto-assigned role "${assignedRole}" with persona "${assignedPersona}" to user ${userId} (${primaryEmail.emailAddress})`)
    }

    // Assign default tenant
    const defaultTenantId = 'demo-tenant-001'

    // Update user metadata with both role and persona
    await client.users.updateUserMetadata(userId, {
      publicMetadata: {
        role: assignedRole,
        persona: assignedPersona,
        tenantId: defaultTenantId,
        autoAssigned: !manualAssignment,
        manuallyAssigned: !!manualAssignment,
        assignedAt: new Date().toISOString(),
      }
    })

    return NextResponse.json({
      success: true,
      role: assignedRole,
      persona: assignedPersona,
      message: manualAssignment 
        ? `Manually assigned role: ${assignedRole} with persona: ${assignedPersona}`
        : `Automatically assigned role: ${assignedRole} with persona: ${assignedPersona}`
    })

  } catch (error) {
    console.error('Role assignment API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        role: 'user', // fallback
        persona: 'student' // fallback
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Role assignment API is active',
    timestamp: new Date().toISOString()
  })
}
