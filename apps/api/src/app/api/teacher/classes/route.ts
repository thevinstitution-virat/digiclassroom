import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { TeacherClassSchema } from '@/lib/validations'
import { generateId } from '@/lib/utils'

/**
 * GET /api/teacher/classes
 * Get all classes for the authenticated teacher
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

    // Get teacher from database
    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM `user` WHERE id = ?',
      [userId]
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
        { status: 403 }
      )
    }

    if (teacher.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Teacher account is not approved' },
        { status: 403 }
      )
    }

    // Get classes assigned to this teacher
    const classes = await executeQuery<any>(
      `SELECT
        c.id, c.organization_id, c.name, c.description, c.grade_level,
        c.qdrant_namespace, c.subjects, c.student_count,
        c.created_at, c.updated_at,
        tca.assigned_at, tca.is_active
      FROM classes c
      INNER JOIN teacher_class_assignments tca ON c.id = tca.class_id
      WHERE tca.teacher_id = ? AND tca.is_active = TRUE
      ORDER BY c.created_at DESC`,
      [teacher.id]
    )

    // Parse subjects JSON
    const formattedClasses = classes.map(cls => ({
      id: cls.id,
      organizationId: cls.organization_id,
      name: cls.name,
      description: cls.description,
      gradeLevel: cls.grade_level,
      qdrantNamespace: cls.qdrant_namespace,
      subjects: cls.subjects ? JSON.parse(cls.subjects) : [],
      studentCount: cls.student_count || 0,
      assignedAt: cls.assigned_at,
      createdAt: cls.created_at,
      updatedAt: cls.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        classes: formattedClasses,
        total: formattedClasses.length
      }
    })

  } catch (error) {
    console.error('❌ Error fetching teacher classes:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch classes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/teacher/classes
 * Create a new class (requires approved teacher status)
 */
export async function POST(request: NextRequest) {
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

    // Get teacher from database
    const teacher = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM `user` WHERE id = ?',
      [userId]
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
        { status: 403 }
      )
    }

    if (teacher.approval_status !== 'approved') {
      return NextResponse.json(
        { error: 'Teacher account is not approved. Please wait for admin approval.' },
        { status: 403 }
      )
    }

    // Get request body
    const body = await request.json()
    
    // Validate input
    const validationResult = TeacherClassSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      )
    }

    const { name, subject, gradeLevel, section, description } = validationResult.data

    // Resolve the teacher's organization from the Better Auth `member` table
    // (Phase 4.1: legacy `users.tenant_id` removed — org membership now lives
    // in `member`). A teacher with no org membership creates an org-less class.
    const membership = await executeQuerySingle<any>(
      'SELECT organization_id FROM `member` WHERE user_id = ? LIMIT 1',
      [teacher.id]
    )
    const organizationId = membership?.organization_id ?? null

    // Create class
    const classId = generateId()
    const qdrantNamespace = `class_${classId}_grade_${gradeLevel}_${subject.toLowerCase().replace(/\s+/g, '_')}`

    await executeQuery(
      `INSERT INTO classes (
        id, organization_id, name, description, grade_level,
        qdrant_namespace, subjects, student_count, settings,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        classId,
        organizationId,
        `${name}${section ? ` - ${section}` : ''}`,
        description || `${subject} class for Grade ${gradeLevel}`,
        gradeLevel,
        qdrantNamespace,
        JSON.stringify([subject]),
        0,
        JSON.stringify({ section, createdBy: teacher.id })
      ]
    )

    // Assign teacher to class
    const assignmentId = generateId()
    await executeQuery(
      `INSERT INTO teacher_class_assignments (
        id, teacher_id, class_id, assigned_by, assigned_at, is_active
      ) VALUES (?, ?, ?, ?, NOW(), TRUE)`,
      [assignmentId, teacher.id, classId, teacher.id]
    )

    // Log activity
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description,
        metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        teacher.id,
        'class_created',
        `Created class: ${name}`,
        JSON.stringify({ classId, subject, gradeLevel, section })
      ]
    )

    console.log(`✅ Class created: ${name} by teacher ${teacher.id}`)

    return NextResponse.json({
      success: true,
      message: 'Class created successfully',
      data: {
        classId,
        name: `${name}${section ? ` - ${section}` : ''}`,
        subject,
        gradeLevel,
        section,
        qdrantNamespace
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Error creating class:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create class',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

