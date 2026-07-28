import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { StudentAssignmentSchema } from '@/lib/validations'
import { generateId } from '@/lib/utils'

/**
 * POST /api/teacher/students/assign
 * Assign a student to a class
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    
    // Validate input
    const validationResult = StudentAssignmentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { classId, studentId } = validationResult.data

    // Verify teacher owns this class
    const classAssignment = await executeQuerySingle<any>(
      `SELECT c.name, c.student_count FROM classes c
       INNER JOIN teacher_class_assignments tca ON c.id = tca.class_id
       WHERE c.id = ? AND tca.teacher_id = ? AND tca.is_active = TRUE`,
      [classId, teacher.id]
    )

    if (!classAssignment) {
      return NextResponse.json(
        { error: 'Class not found or not assigned to you' },
        { status: 404 }
      )
    }

    // Verify student exists and is a student
    const student = await executeQuerySingle<any>(
      'SELECT id, email, first_name, last_name, role, class_id FROM `user` WHERE id = ?',
      [studentId]
    )

    if (!student) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    }

    if (student.role !== 'student') {
      return NextResponse.json({ error: 'User is not a student' }, { status: 400 })
    }

    if (student.class_id === classId) {
      return NextResponse.json(
        { error: 'Student is already assigned to this class' },
        { status: 400 }
      )
    }

    // Assign student to class
    await executeQuery(
      'UPDATE `user` SET class_id = ?, updated_at = NOW() WHERE id = ?',
      [classId, studentId]
    )

    // Update class student count
    await executeQuery(
      'UPDATE classes SET student_count = student_count + 1, updated_at = NOW() WHERE id = ?',
      [classId]
    )

    // Log activity
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        teacher.id,
        'student_assigned',
        `Assigned student ${student.first_name} ${student.last_name} to class ${classAssignment.name}`,
        JSON.stringify({ classId, studentId, studentEmail: student.email })
      ]
    )

    console.log(`✅ Student ${student.email} assigned to class ${classId} by teacher ${teacher.id}`)

    return NextResponse.json({
      success: true,
      message: 'Student assigned to class successfully',
      data: {
        studentId,
        classId,
        studentName: `${student.first_name} ${student.last_name}`,
        className: classAssignment.name
      }
    })

  } catch (error) {
    console.error('❌ Error assigning student:', error)
    return NextResponse.json({ error: 'Failed to assign student' }, { status: 500 })
  }
}

