import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { executeQuery } from '@/lib/db/connection'

/**
 * GET /api/admin/teachers/pending
 * Get list of pending teacher approvals (admin only)
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query based on status
    let query = `
      SELECT 
        id, clerk_id, email, role, approval_status,
        first_name, last_name, preferences,
        approved_by, approved_at, rejection_reason,
        created_at, updated_at
      FROM users
      WHERE role = 'teacher'
    `
    const params: any[] = []

    if (status === 'all') {
      // Get all teachers
    } else {
      query += ' AND approval_status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const teachers = await executeQuery<any>(query, params)

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM users WHERE role = "teacher"'
    const countParams: any[] = []
    
    if (status !== 'all') {
      countQuery += ' AND approval_status = ?'
      countParams.push(status)
    }

    const countResult = await executeQuery<any>(countQuery, countParams)
    const total = countResult[0]?.total || 0

    // Parse preferences and format response
    const formattedTeachers = teachers.map(teacher => {
      let preferences = {}
      try {
        preferences = teacher.preferences ? JSON.parse(teacher.preferences) : {}
      } catch (e) {
        console.error('Error parsing preferences:', e)
      }

      return {
        id: teacher.id,
        clerkId: teacher.clerk_id,
        email: teacher.email,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        approvalStatus: teacher.approval_status,
        approvedBy: teacher.approved_by,
        approvedAt: teacher.approved_at,
        rejectionReason: teacher.rejection_reason,
        specialization: preferences.specialization || [],
        qualification: preferences.qualification || '',
        experienceYears: preferences.experienceYears || 0,
        phone: preferences.phone || '',
        createdAt: teacher.created_at,
        updatedAt: teacher.updated_at
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        teachers: formattedTeachers,
        total,
        limit,
        offset,
        status
      }
    })

  } catch (error) {
    console.error('❌ Error fetching pending teachers:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch pending teachers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

