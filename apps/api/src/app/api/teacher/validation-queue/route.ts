import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

/**
 * GET /api/teacher/validation-queue
 * Get content validation queue for teacher
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
    const status = searchParams.get('status') || 'pending'
    const priority = searchParams.get('priority')
    const subject = searchParams.get('subject')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query
    let query = `
      SELECT 
        id, content_id, content_type, content_text,
        subject, grade_level, board,
        validation_status, priority,
        assigned_to, assigned_at,
        validated_by, validated_at,
        validation_score, feedback, improvement_notes,
        source_metadata, created_at, updated_at
      FROM content_validation_queue
      WHERE 1=1
    `
    const params: any[] = []

    // Filter by status
    if (status !== 'all') {
      query += ' AND validation_status = ?'
      params.push(status)
    }

    // Filter by priority
    if (priority) {
      query += ' AND priority = ?'
      params.push(priority)
    }

    // Filter by subject
    if (subject) {
      query += ' AND subject = ?'
      params.push(subject)
    }

    // Show items assigned to this teacher or unassigned pending items
    if (status === 'pending') {
      query += ' AND (assigned_to = ? OR assigned_to IS NULL)'
      params.push(teacher.id)
    } else {
      query += ' AND (assigned_to = ? OR validated_by = ?)'
      params.push(teacher.id, teacher.id)
    }

    query += ' ORDER BY priority DESC, created_at ASC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const items = await executeQuery<any>(query, params)

    // Get counts
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN validation_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN assigned_to = ? THEN 1 ELSE 0 END) as assigned
      FROM content_validation_queue
      WHERE assigned_to = ? OR assigned_to IS NULL OR validated_by = ?
    `
    const counts = await executeQuerySingle<any>(countQuery, [teacher.id, teacher.id, teacher.id])

    // Format items
    const formattedItems = items.map(item => ({
      id: item.id,
      contentId: item.content_id,
      contentType: item.content_type,
      contentText: item.content_text,
      subject: item.subject,
      gradeLevel: item.grade_level,
      board: item.board,
      validationStatus: item.validation_status,
      priority: item.priority,
      assignedTo: item.assigned_to,
      assignedAt: item.assigned_at,
      validatedBy: item.validated_by,
      validatedAt: item.validated_at,
      validationScore: item.validation_score,
      feedback: item.feedback,
      improvementNotes: item.improvement_notes,
      sourceMetadata: item.source_metadata ? JSON.parse(item.source_metadata) : null,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        items: formattedItems,
        total: counts?.total || 0,
        pending: counts?.pending || 0,
        assigned: counts?.assigned || 0,
        limit,
        offset
      }
    })

  } catch (error) {
    console.error('❌ Error fetching validation queue:', error)
    return NextResponse.json({ error: 'Failed to fetch validation queue' }, { status: 500 })
  }
}

