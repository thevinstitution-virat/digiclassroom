import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { isPlatformStaff, type Role } from '@/auth/permissions'

/**
 * GET /api/super-admin/teachers/activity
 * Get teacher activity logs and statistics (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = session?.user?.role
    // User data is already available from session
    const currentUser = session?.user as any;
    const userEmail = currentUser?.email
    
    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacherId')
    const activityType = searchParams.get('activityType')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (teacherId) {
      // Get specific teacher's activity
      let query = `
        SELECT 
          tal.id, tal.teacher_id, tal.activity_type,
          tal.activity_description, tal.metadata,
          tal.ip_address, tal.user_agent, tal.created_at,
          u.email, u.first_name, u.last_name
        FROM teacher_activity_logs tal
        INNER JOIN \`user\` u ON tal.teacher_id = u.id
        WHERE tal.teacher_id = ?
      `
      const params: any[] = [teacherId]

      if (activityType) {
        query += ' AND tal.activity_type = ?'
        params.push(activityType)
      }

      query += ' ORDER BY tal.created_at DESC LIMIT ? OFFSET ?'
      params.push(limit, offset)

      const activities = await executeQuery<any>(query, params)

      // Get statistics for this teacher
      const stats = await executeQuerySingle<any>(
        `SELECT 
          COUNT(*) as total_activities,
          SUM(CASE WHEN activity_type = 'class_created' THEN 1 ELSE 0 END) as classes_created,
          SUM(CASE WHEN activity_type = 'student_assigned' THEN 1 ELSE 0 END) as students_assigned,
          SUM(CASE WHEN activity_type = 'content_validated' THEN 1 ELSE 0 END) as content_validated,
          SUM(CASE WHEN activity_type = 'content_approved' THEN 1 ELSE 0 END) as content_approved,
          MAX(created_at) as last_activity
        FROM teacher_activity_logs
        WHERE teacher_id = ?`,
        [teacherId]
      )

      const formattedActivities = activities.map(activity => ({
        id: activity.id,
        teacherId: activity.teacher_id,
        teacherEmail: activity.email,
        teacherName: `${activity.first_name} ${activity.last_name}`,
        activityType: activity.activity_type,
        activityDescription: activity.activity_description,
        metadata: activity.metadata ? JSON.parse(activity.metadata) : null,
        ipAddress: activity.ip_address,
        userAgent: activity.user_agent,
        createdAt: activity.created_at
      }))

      return NextResponse.json({
        success: true,
        data: {
          activities: formattedActivities,
          statistics: {
            totalActivities: stats?.total_activities || 0,
            classesCreated: stats?.classes_created || 0,
            studentsAssigned: stats?.students_assigned || 0,
            contentValidated: stats?.content_validated || 0,
            contentApproved: stats?.content_approved || 0,
            lastActivity: stats?.last_activity
          },
          total: formattedActivities.length,
          limit,
          offset
        }
      })

    } else {
      // Get all teachers' statistics
      const teacherStats = await executeQuery<any>(
        `SELECT * FROM teacher_statistics ORDER BY last_activity_at DESC`
      )

      return NextResponse.json({
        success: true,
        data: {
          teachers: teacherStats.map(stat => ({
            teacherId: stat.teacher_id,
            email: stat.email,
            teacherName: stat.teacher_name,
            approvalStatus: stat.approval_status,
            approvedAt: stat.approved_at,
            totalClasses: stat.total_classes || 0,
            totalStudents: stat.total_students || 0,
            totalActivities: stat.total_activities || 0,
            totalValidations: stat.total_validations || 0,
            approvedValidations: stat.approved_validations || 0,
            lastActivityAt: stat.last_activity_at
          })),
          total: teacherStats.length
        }
      })
    }

  } catch (error) {
    console.error('❌ Error fetching teacher activity:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch teacher activity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

