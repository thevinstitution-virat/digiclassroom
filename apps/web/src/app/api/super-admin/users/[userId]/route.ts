import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { UserUpdateData } from '@/types/user-management'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { isPlatformStaff, type Role } from '@/auth/permissions'
import { isDesignatedSuperAdmin } from '@/lib/auth/super-admin-guard'

// GET - Fetch specific user details
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = (session?.user as any)?.role;
    const currentUser = session?.user as any;
    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userId: targetUserId } = params

    // Fetch user from database — Better Auth `user` table.
    const user = await executeQuerySingle<any>(
      'SELECT id, name, email, role, email_verified as emailVerified, created_at as createdAt, updated_at as updatedAt FROM `user` WHERE id = ? LIMIT 1',
      [targetUserId]
    )

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      }
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update specific user
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = (session?.user as any)?.role;
    const currentUser = session?.user as any;
    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userId: targetUserId } = params
    const updateData: UserUpdateData = await request.json()

    // SECURITY: super_admin may only ever be the configured platform owner.
    // Block promoting any other account to super_admin via a role update.
    if (updateData.role === 'super_admin') {
      const target = await executeQuerySingle<{ email: string }>(
        'SELECT email FROM `user` WHERE id = ? LIMIT 1', [targetUserId]
      )
      if (!target || !isDesignatedSuperAdmin(target.email)) {
        return NextResponse.json(
          { success: false, error: 'super_admin is reserved for the platform owner and cannot be assigned' },
          { status: 403 }
        )
      }
    }

    // Build dynamic update query
    const updates: string[] = []
    const values: any[] = []

    if (updateData.role) {
      updates.push(`role = ?`)
      values.push(updateData.role)
    }
    if (updateData.firstName || updateData.lastName) {
      const name = `${updateData.firstName || ''} ${updateData.lastName || ''}`.trim()
      if (name) {
        updates.push(`name = ?`)
        values.push(name)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields to update'
      }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(targetUserId)

    await executeQuery(
      `UPDATE \`user\` SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return NextResponse.json({
      success: true,
      message: 'User updated successfully'
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Delete specific user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const currentUserId = session?.user?.id;

    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = (session?.user as any)?.role;
    const currentUser = session?.user as any;
    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { userId: targetUserId } = params

    // Prevent self-deletion
    if (currentUserId === targetUserId) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete your own account'
      }, { status: 400 })
    }

    // SECURITY: the platform owner (super_admin) account can never be deleted.
    const target = await executeQuerySingle<{ role: string }>(
      'SELECT role FROM `user` WHERE id = ? LIMIT 1', [targetUserId]
    )
    if (target?.role === 'super_admin') {
      return NextResponse.json(
        { success: false, error: 'The super_admin (platform owner) account cannot be deleted' },
        { status: 403 }
      )
    }

    // Delete user from Better Auth `user` table.
    await executeQuery('DELETE FROM `user` WHERE id = ?', [targetUserId])

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
