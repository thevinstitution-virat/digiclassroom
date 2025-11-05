import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import mysql from 'mysql2/promise'
import { z } from 'zod'
import type { MaterialApprovalRequest } from '@/types/google-drive'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

// Validation schema for approval request
const ApprovalRequestSchema = z.object({
  materialId: z.string().uuid('Invalid material ID format'),
  action: z.enum(['approve', 'reject'], {
    required_error: 'Action must be either "approve" or "reject"'
  }),
  comments: z.string().optional(),
  adminId: z.string().optional()
})

/**
 * POST /api/admin/materials/approval
 * Approve or reject materials
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = ApprovalRequestSchema.parse({
      ...body,
      adminId: userId // Override with authenticated user ID
    })

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Check if material exists and is in pending_review status
      const [materialResult] = await connection.execute(
        'SELECT id, title, status, created_by FROM materials WHERE id = ? AND is_active = TRUE',
        [validatedData.materialId]
      ) as any[]

      if (materialResult.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Material not found or inactive' },
          { status: 404 }
        )
      }

      const material = materialResult[0]

      if (material.status !== 'pending_review') {
        return NextResponse.json(
          { success: false, error: `Material is not pending review. Current status: ${material.status}` },
          { status: 400 }
        )
      }

      // Determine new status based on action
      const newStatus = validatedData.action === 'approve' ? 'approved' : 'rejected'

      // Update material status
      const updateFields = [
        'status = ?',
        'updated_at = NOW()'
      ]
      const updateValues = [newStatus]

      if (validatedData.action === 'approve') {
        updateFields.push('approved_by = ?', 'approved_at = NOW()')
        updateValues.push(userId)
      } else {
        updateFields.push('rejected_by = ?', 'rejected_at = NOW()')
        updateValues.push(userId)
      }

      // Add comments to metadata if provided
      if (validatedData.comments) {
        updateFields.push('metadata = JSON_SET(COALESCE(metadata, "{}"), "$.approvalComments", ?)')
        updateValues.push(validatedData.comments)
      }

      updateValues.push(validatedData.materialId)

      const updateQuery = `
        UPDATE materials 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `

      const [updateResult] = await connection.execute(updateQuery, updateValues) as any[]

      if (updateResult.affectedRows === 0) {
        return NextResponse.json(
          { success: false, error: 'Failed to update material status' },
          { status: 500 }
        )
      }

      // Log the approval/rejection activity
      await connection.execute(`
        INSERT INTO material_approval_log (
          material_id, admin_id, action, comments, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `, [
        validatedData.materialId,
        userId,
        validatedData.action,
        validatedData.comments || null,
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      ])

      // Send notification to material creator (if notification system exists)
      try {
        await sendApprovalNotification(
          connection,
          material.created_by,
          material.title,
          validatedData.action,
          validatedData.comments
        )
      } catch (notificationError) {
        console.warn('Failed to send approval notification:', notificationError)
        // Don't fail the request if notification fails
      }

      return NextResponse.json({
        success: true,
        data: {
          materialId: validatedData.materialId,
          action: validatedData.action,
          newStatus,
          approvedBy: userId,
          approvedAt: new Date().toISOString()
        },
        message: `Material ${validatedData.action}d successfully`
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error processing material approval:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process approval request' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/materials/approval
 * Get materials pending approval with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const status = url.searchParams.get('status') || 'pending_review'

    // Create database connection
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Get total count
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM materials WHERE status = ? AND is_active = TRUE',
        [status]
      ) as any[]
      const total = countResult[0]?.total || 0

      // Calculate pagination
      const totalPages = Math.ceil(total / limit)
      const offset = (page - 1) * limit

      // Get materials pending approval
      const [materialsResult] = await connection.execute(`
        SELECT
          m.*
        FROM materials m
        WHERE m.status = ? AND m.is_active = TRUE
        ORDER BY m.created_at ASC
        LIMIT ? OFFSET ?
      `, [status, limit, offset]) as any[]

      // Transform results
      const materials = materialsResult.map((row: any) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        type: row.type,
        board: row.board,
        medium: row.medium,
        class: row.class,
        stream: row.stream,
        subject: row.subject,
        fileName: row.file_name,
        fileSize: row.file_size,
        tags: row.tags ? JSON.parse(row.tags) : [],
        difficulty: row.difficulty,
        status: row.status,
        createdAt: row.created_at,
        createdBy: row.created_by
      }))

      return NextResponse.json({
        success: true,
        data: materials,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Error fetching materials for approval:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch materials for approval' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to send approval notification
 */
async function sendApprovalNotification(
  connection: mysql.Connection,
  userId: string,
  materialTitle: string,
  action: 'approve' | 'reject',
  comments?: string
): Promise<void> {
  try {
    // Create notification record
    const notificationData = {
      id: require('uuid').v4(),
      user_id: userId,
      type: 'material_approval',
      title: `Material ${action}d`,
      message: `Your material "${materialTitle}" has been ${action}d.${comments ? ` Comments: ${comments}` : ''}`,
      data: JSON.stringify({
        materialTitle,
        action,
        comments,
        timestamp: new Date().toISOString()
      }),
      is_read: false,
      created_at: new Date()
    }

    await connection.execute(`
      INSERT INTO notifications (id, user_id, type, title, message, data, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      notificationData.id,
      notificationData.user_id,
      notificationData.type,
      notificationData.title,
      notificationData.message,
      notificationData.data,
      notificationData.is_read,
      notificationData.created_at
    ])

    // Here you could also send email notification, push notification, etc.
    
  } catch (error) {
    console.error('Error creating approval notification:', error)
    throw error
  }
}
