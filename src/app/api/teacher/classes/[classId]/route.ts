import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { generateId } from '@/lib/utils'

/**
 * GET /api/teacher/classes/[classId]
 * Get a specific class details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM users WHERE clerk_id = ?',
      [userId]
    )

    if (!teacher || teacher.role !== 'teacher' || teacher.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const classId = params.classId

    // Get class with teacher assignment check
    const classData = await executeQuerySingle<any>(
      `SELECT 
        c.id, c.tenant_id, c.name, c.description, c.grade_level,
        c.qdrant_namespace, c.subjects, c.student_count,
        c.created_at, c.updated_at
      FROM classes c
      INNER JOIN teacher_class_assignments tca ON c.id = tca.class_id
      WHERE c.id = ? AND tca.teacher_id = ? AND tca.is_active = TRUE`,
      [classId, teacher.id]
    )

    if (!classData) {
      return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        id: classData.id,
        tenantId: classData.tenant_id,
        name: classData.name,
        description: classData.description,
        gradeLevel: classData.grade_level,
        qdrantNamespace: classData.qdrant_namespace,
        subjects: classData.subjects ? JSON.parse(classData.subjects) : [],
        studentCount: classData.student_count || 0,
        createdAt: classData.created_at,
        updatedAt: classData.updated_at
      }
    })

  } catch (error) {
    console.error('❌ Error fetching class:', error)
    return NextResponse.json({ error: 'Failed to fetch class' }, { status: 500 })
  }
}

/**
 * PUT /api/teacher/classes/[classId]
 * Update a class
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM users WHERE clerk_id = ?',
      [userId]
    )

    if (!teacher || teacher.role !== 'teacher' || teacher.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const classId = params.classId
    const body = await request.json()

    // Verify teacher owns this class
    const classAssignment = await executeQuerySingle<any>(
      'SELECT id FROM teacher_class_assignments WHERE class_id = ? AND teacher_id = ? AND is_active = TRUE',
      [classId, teacher.id]
    )

    if (!classAssignment) {
      return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 404 })
    }

    // Build update query
    const updates: string[] = []
    const values: any[] = []

    if (body.name) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.gradeLevel) {
      updates.push('grade_level = ?')
      values.push(body.gradeLevel)
    }
    if (body.subjects) {
      updates.push('subjects = ?')
      values.push(JSON.stringify(body.subjects))
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(classId)

    await executeQuery(
      `UPDATE classes SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // Log activity
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        teacher.id,
        'class_updated',
        `Updated class: ${body.name || classId}`,
        JSON.stringify({ classId, updates: Object.keys(body) })
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Class updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating class:', error)
    return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
  }
}

/**
 * DELETE /api/teacher/classes/[classId]
 * Delete a class
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { classId: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM users WHERE clerk_id = ?',
      [userId]
    )

    if (!teacher || teacher.role !== 'teacher' || teacher.approval_status !== 'approved') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const classId = params.classId

    // Verify teacher owns this class
    const classData = await executeQuerySingle<any>(
      `SELECT c.name FROM classes c
       INNER JOIN teacher_class_assignments tca ON c.id = tca.class_id
       WHERE c.id = ? AND tca.teacher_id = ? AND tca.is_active = TRUE`,
      [classId, teacher.id]
    )

    if (!classData) {
      return NextResponse.json({ error: 'Class not found or not assigned to you' }, { status: 404 })
    }

    // Delete class (cascade will handle assignments)
    await executeQuery('DELETE FROM classes WHERE id = ?', [classId])

    // Log activity
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        teacher.id,
        'class_deleted',
        `Deleted class: ${classData.name}`,
        JSON.stringify({ classId })
      ]
    )

    return NextResponse.json({
      success: true,
      message: 'Class deleted successfully'
    })

  } catch (error) {
    console.error('❌ Error deleting class:', error)
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 })
  }
}

