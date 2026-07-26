import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { generateId } from '@/lib/utils'
import { isPlatformStaff, type Role } from '@/auth/permissions'

/**
 * POST /api/super-admin/teachers/reject/[teacherId]
 * Reject a teacher account (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { teacherId: string } }
) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permissions
    const userRole = session?.user?.role
    // User data is already available from session
    const currentUser = session?.user as any;
    const userEmail = currentUser?.email
    
    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const teacherId = params.teacherId

    // Get request body
    const body = await request.json()
    const rejectionReason = body.rejectionReason || 'No reason provided'

    // Get admin user — Better Auth session.user.id is already the row id.
    const adminUser = await executeQuerySingle<any>(
      'SELECT id FROM `user` WHERE id = ?',
      [userId]
    )

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Admin user not found in database' },
        { status: 404 }
      )
    }

    // Get teacher from database
    const teacher = await executeQuerySingle<any>(
      'SELECT id, email, role, approval_status, first_name, last_name FROM `user` WHERE id = ?',
      [teacherId]
    )

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      )
    }

    if (teacher.role !== 'teacher') {
      return NextResponse.json(
        { error: 'User is not a teacher' },
        { status: 400 }
      )
    }

    // Update teacher approval status to rejected
    await executeQuery(
      `UPDATE \`user\`
       SET approval_status = 'rejected',
           approved_by = NULL,
           approved_at = NULL,
           rejection_reason = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [rejectionReason, teacherId]
    )

    // Log activity
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, 
        metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        teacherId,
        'profile_updated',
        'Teacher account rejected by admin',
        JSON.stringify({ 
          rejectedBy: adminUser.id, 
          rejectedByEmail: userEmail,
          rejectionReason 
        })
      ]
    )

    console.log(`❌ Teacher rejected: ${teacher.email} by ${userEmail}`)

    return NextResponse.json({
      success: true,
      message: 'Teacher rejected successfully',
      data: {
        teacherId,
        email: teacher.email,
        approvalStatus: 'rejected',
        rejectionReason
      }
    })

  } catch (error) {
    console.error('❌ Error rejecting teacher:', error)
    return NextResponse.json(
      { 
        error: 'Failed to reject teacher',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

