import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuerySingle } from '@/lib/db/connection'

/**
 * GET /api/teacher/status
 * Check teacher approval status
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user from Better Auth `user` table (legacy `users` removed in Phase 4.1a).
    const user = await executeQuerySingle<any>(
      `SELECT
        id, email, role, approval_status,
        approved_by, approved_at, rejection_reason,
        first_name, last_name, preferences, created_at
      FROM \`user\`
      WHERE id = ?`,
      [userId]
    )

    if (!user) {
      return NextResponse.json({
        isTeacher: false,
        approvalStatus: null,
        canAccessFeatures: false,
        message: 'User not found in database. Please complete registration.'
      })
    }

    const isTeacher = user.role === 'teacher'
    const approvalStatus = user.approval_status || 'pending'
    const canAccessFeatures = isTeacher && approvalStatus === 'approved'

    let message = ''
    if (!isTeacher) {
      message = 'You are not registered as a teacher.'
    } else if (approvalStatus === 'pending') {
      message = 'Your teacher account is pending approval. Please wait for admin review.'
    } else if (approvalStatus === 'rejected') {
      message = user.rejection_reason || 'Your teacher account was rejected. Please contact support.'
    } else if (approvalStatus === 'approved') {
      message = 'Your teacher account is approved. Welcome!'
    }

    // Parse preferences
    let preferences = {}
    try {
      preferences = user.preferences ? JSON.parse(user.preferences) : {}
    } catch (e) {
      console.error('Error parsing preferences:', e)
    }

    return NextResponse.json({
      isTeacher,
      approvalStatus,
      canAccessFeatures,
      message,
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        approvedAt: user.approved_at,
        rejectionReason: user.rejection_reason,
        specialization: preferences.specialization || [],
        qualification: preferences.qualification || '',
        experienceYears: preferences.experienceYears || 0,
        registeredAt: user.created_at
      }
    })

  } catch (error) {
    console.error('❌ Error checking teacher status:', error)
    return NextResponse.json(
      { 
        error: 'Failed to check teacher status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

