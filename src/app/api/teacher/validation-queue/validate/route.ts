import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { ContentValidationSchema } from '@/lib/validations'
import { generateId } from '@/lib/utils'

/**
 * POST /api/teacher/validation-queue/validate
 * Validate a content item
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    
    // Validate input
    const validationResult = ContentValidationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { contentId, validationStatus, validationScore, feedback, improvementNotes } = validationResult.data

    // Get content item
    const contentItem = await executeQuerySingle<any>(
      'SELECT id, content_text, subject, validation_status FROM content_validation_queue WHERE id = ?',
      [contentId]
    )

    if (!contentItem) {
      return NextResponse.json({ error: 'Content item not found' }, { status: 404 })
    }

    if (contentItem.validation_status !== 'pending') {
      return NextResponse.json(
        { error: 'Content item has already been validated' },
        { status: 400 }
      )
    }

    // Update validation
    await executeQuery(
      `UPDATE content_validation_queue
       SET validation_status = ?,
           validated_by = ?,
           validated_at = NOW(),
           validation_score = ?,
           feedback = ?,
           improvement_notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [validationStatus, teacher.id, validationScore, feedback, improvementNotes, contentId]
    )

    // Log activity
    const activityType = validationStatus === 'approved' ? 'content_approved' : 
                        validationStatus === 'rejected' ? 'content_rejected' : 
                        'content_validated'

    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        generateId(),
        teacher.id,
        activityType,
        `Validated content: ${contentItem.subject} - ${validationStatus}`,
        JSON.stringify({ 
          contentId, 
          validationStatus, 
          validationScore,
          subject: contentItem.subject 
        })
      ]
    )

    console.log(`✅ Content validated: ${contentId} - ${validationStatus} by teacher ${teacher.id}`)

    return NextResponse.json({
      success: true,
      message: 'Content validated successfully',
      data: {
        contentId,
        validationStatus,
        validationScore,
        validatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error validating content:', error)
    return NextResponse.json({ error: 'Failed to validate content' }, { status: 500 })
  }
}

