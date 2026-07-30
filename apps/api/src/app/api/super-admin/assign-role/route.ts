import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth/require-platform-staff'
import { isDesignatedSuperAdmin } from '@/lib/auth/super-admin-guard'
export async function POST(request: NextRequest) {
  try {
    // Privilege escalation (assigning roles) — super_admin only.
    const guard = await requirePlatformOwner();
    if (!guard.ok) return guard.response;

    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json({
        error: 'Email and role are required'
      }, { status: 400 })
    }

    // SECURITY: super_admin is the platform-owner role and is not assignable
    // here — only the configured SUPER_ADMIN_EMAIL may ever hold it. This
    // replaced a hardcoded address that no longer exists on the platform.
    if (role === 'super_admin' && !isDesignatedSuperAdmin(email)) {
      return NextResponse.json({
        error: 'super_admin is reserved for the platform owner and cannot be assigned'
      }, { status: 403 })
    }

    // Find user by email
    // TODO: Replace with direct DB user query
    const users = { data: [] } as any;
    if (users.length === 0) {
      return NextResponse.json({
        error: 'User not found'
      }, { status: 404 })
    }

    const targetUser = users[0]

    // Update user metadata with admin role
    // TODO: Role update should use Better Auth admin API or direct DB update
    // await db.update(user).set({ role: newRole }).where(eq(user.id, targetUserId))
    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${role} role to ${email}`,
      userId: targetUser.id
    })

  } catch (error) {
    console.error('Role assignment error:', error)
    return NextResponse.json({
      error: 'Failed to assign role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check current user role
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentRole = session?.user?.role || 'user'
    // User data is already available from session
    const user = session?.user as any;
    return NextResponse.json({
      userId,
      email: user?.email,
      currentRole,
      isAdmin: currentRole === 'admin'
    })

  } catch (error) {
    console.error('Role check error:', error)
    return NextResponse.json({
      error: 'Failed to check role'
    }, { status: 500 })
  }
}
