import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { generateId } from '@/lib/utils'

/**
 * GET /api/teacher/students
 * Get all students in teacher's classes
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM `user` WHERE id = ?',
      [userId]
    )

    if (!teacher || teacher.role !== 'teacher' || teacher.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const classId = searchParams.get('classId')

    let query = `
      SELECT DISTINCT
        u.id, u.email, u.first_name, u.last_name,
        u.class_id, c.name as class_name, c.grade_level,
        u.created_at as enrolled_at
      FROM \`user\` u
      LEFT JOIN classes c ON u.class_id = c.id
      INNER JOIN teacher_class_assignments tca ON c.id = tca.class_id
      WHERE u.role = 'student'
        AND tca.teacher_id = ?
        AND tca.is_active = TRUE
    `
    const params: any[] = [teacher.id]

    if (classId) {
      query += ' AND u.class_id = ?'
      params.push(classId)
    }

    query += ' ORDER BY u.last_name, u.first_name'

    const students = await executeQuery<any>(query, params)

    const formattedStudents = students.map(student => ({
      id: student.id,
      email: student.email,
      firstName: student.first_name,
      lastName: student.last_name,
      classId: student.class_id,
      className: student.class_name,
      gradeLevel: student.grade_level,
      enrolledAt: student.enrolled_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        students: formattedStudents,
        total: formattedStudents.length
      }
    })

  } catch (error) {
    console.error('❌ Error fetching students:', error)
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })
  }
}

