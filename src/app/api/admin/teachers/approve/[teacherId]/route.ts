import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { generateId } from '@/lib/utils'

/**
 * POST /api/admin/teachers/approve/[teacherId]
 * Approve a teacher account (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { teacherId: string } }
) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permissions
    const userRole = sessionClaims?.metadata?.role
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress
    
    const isAdmin = userRole === 'admin' || 
      ['bhaarat2050@gmail.com', 'thevinstitution@gmail.com'].includes(userEmail || '')

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const teacherId = params.teacherId

    // Get admin user ID from database
    const adminUser = await executeQuerySingle<any>(
      'SELECT id FROM users WHERE clerk_id = ?',
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
      'SELECT id, clerk_id, email, role, approval_status, first_name, last_name FROM users WHERE id = ?',
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

    if (teacher.approval_status === 'approved') {
      return NextResponse.json(
        { error: 'Teacher is already approved' },
        { status: 400 }
      )
    }

    // Update teacher approval status
    await executeQuery(
      `UPDATE users 
       SET approval_status = 'approved',
           approved_by = ?,
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [adminUser.id, teacherId]
    )

    // Update Clerk metadata
    if (teacher.clerk_id) {
      try {
        await client.users.updateUser(teacher.clerk_id, {
          publicMetadata: {
            role: 'teacher',
            approvalStatus: 'approved',
            approvedAt: new Date().toISOString()
          }
        })
      } catch (clerkError) {
        console.error('Error updating Clerk metadata:', clerkError)
        // Continue even if Clerk update fails
      }
    }

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
        'Teacher account approved by admin',
        JSON.stringify({ approvedBy: adminUser.id, approvedByEmail: userEmail })
      ]
    )

    console.log(`✅ Teacher approved: ${teacher.email} by ${userEmail}`)

    return NextResponse.json({
      success: true,
      message: 'Teacher approved successfully',
      data: {
        teacherId,
        email: teacher.email,
        approvalStatus: 'approved',
        approvedBy: adminUser.id,
        approvedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error approving teacher:', error)
    return NextResponse.json(
      { 
        error: 'Failed to approve teacher',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

