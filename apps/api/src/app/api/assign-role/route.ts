import { NextRequest, NextResponse } from 'next/server'
import { getOrgContextOrNull } from '@/lib/auth/get-org-context'
import { db } from '@/db'
import { user as userTable } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { UserRole, UserPersona } from '@/lib/validations'
import { isDesignatedSuperAdmin, sanitizeRole } from '@/lib/auth/super-admin-guard'

const DEFAULT_ROLE: UserRole = 'user'

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

  // SECURITY: super_admin is ONLY ever the configured platform owner. The old
  // email-allowlist and `@viratgyankosh.com` domain grants were privilege-
  // escalation shortcuts (anyone on that domain became super_admin) — removed.
  if (isDesignatedSuperAdmin(email)) {
    return { role: 'super_admin', persona: 'teacher' }
  }

  if (TEACHER_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return { role: 'user', persona: 'teacher' }
  }

  if (PARENT_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return { role: 'user', persona: 'guardian' }
  }

  return { role: 'user', persona: 'student' }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getOrgContextOrNull()

    if (!ctx) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { userId } = ctx;

    const body = await request.json().catch(() => ({}))
    const { role: manualRole, persona: manualPersona, manualAssignment } = body

    // Fetch user from DB
    const users = await db.select().from(userTable).where(eq(userTable.id, userId)).limit(1)
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const user = users[0]

    const existingRole = user.role as UserRole
    if (existingRole && !manualAssignment) {
      return NextResponse.json({
        success: true,
        role: existingRole,
        persona: 'student', // default persona
        message: `User already has role: \${existingRole}`
      })
    }

    let assignedRole: UserRole
    let assignedPersona: UserPersona

    if (manualAssignment && manualRole && manualPersona) {
      assignedRole = manualRole
      assignedPersona = manualPersona
    } else {
      const primaryEmail = user.email

      if (!primaryEmail) {
        return NextResponse.json(
          { error: 'No email address found' },
          { status: 400 }
        )
      }

      const result = determineUserRoleAndPersona(primaryEmail)
      assignedRole = result.role
      assignedPersona = result.persona
    }

    // SECURITY: never allow self-assignment of super_admin via this route, even if
    // the request body (manualAssignment) asks for it. Clamp to the owner-gated value.
    assignedRole = sanitizeRole(assignedRole, user.email, DEFAULT_ROLE) as UserRole

    await db.update(userTable).set({
      role: assignedRole,
      updatedAt: new Date(),
    }).where(eq(userTable.id, userId))

    return NextResponse.json({
      success: true,
      role: assignedRole,
      persona: assignedPersona,
      message: manualAssignment 
        ? `Manually assigned role: \${assignedRole} with persona: \${assignedPersona}`
        : `Automatically assigned role: \${assignedRole} with persona: \${assignedPersona}`
    })

  } catch (error) {
    console.error('Role assignment API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        role: 'user',
        persona: 'student'
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
