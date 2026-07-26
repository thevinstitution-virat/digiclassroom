/**
 * Admin Teacher Verification Review API
 * POST /api/super-admin/teacher-verification/review
 * 
 * Approve or reject teacher verification documents
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { isPlatformStaff, type Role } from '@/auth/permissions'

/**
 * POST /api/super-admin/teacher-verification/review
 * Approve or reject a verification document
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permissions
    const userRole = session?.user?.role
    // User data is already available from session
    const currentUser = session?.user as any;
    const userEmail = currentUser?.email

    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get admin user — Better Auth session.user.id is the row id.
    const adminUser = await executeQuerySingle<any>(
      'SELECT id FROM `user` WHERE id = ?',
      [userId]
    )

    if (!adminUser) {
      return NextResponse.json(
        { success: false, error: 'Admin user not found in database' },
        { status: 404 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { documentId, teacherId, action, rejectionReason } = body

    // Validate inputs
    if (!documentId || !teacherId || !action) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    // Get document from database
    const document = await executeQuerySingle<any>(
      `SELECT id, teacher_id, status, file_name FROM teacher_verification_documents WHERE id = ?`,
      [documentId]
    )

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    if (document.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: 'Document has already been reviewed' },
        { status: 400 }
      )
    }

    // Get teacher from database
    const teacher = await executeQuerySingle<any>(
      'SELECT id, email, first_name, last_name, verification_status FROM `user` WHERE id = ?',
      [teacherId]
    )

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: 'Teacher not found' },
        { status: 404 }
      )
    }

    // Update document status
    const newDocumentStatus = action === 'approve' ? 'approved' : 'rejected'
    
    await executeQuery(
      `UPDATE teacher_verification_documents 
       SET status = ?,
           reviewed_at = NOW(),
           reviewed_by = ?,
           rejection_reason = ?
       WHERE id = ?`,
      [
        newDocumentStatus,
        adminUser.id,
        action === 'reject' ? rejectionReason : null,
        documentId
      ]
    )

    console.log(`✅ Document ${action}ed: ${document.file_name} for teacher ${teacher.email}`)

    // If approved, upgrade teacher verification status to 'verified_document'
    if (action === 'approve') {
      await executeQuery(
        `UPDATE \`user\`
         SET verification_status = 'verified_document',
             verification_method = 'document_upload',
             verified_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [teacherId]
      )

      console.log(`✅ Teacher verification upgraded: ${teacher.email} → verified_document`)
      // Phase 4.1: role/verification state now lives directly on the Better Auth
      // `user` row (updated above). The legacy Clerk-metadata sync was removed.
    } else {
      // If rejected, optionally send notification (future enhancement)
      console.log(`❌ Document rejected for teacher ${teacher.email}: ${rejectionReason}`)
    }

    return NextResponse.json({
      success: true,
      message: `Document ${action}ed successfully`,
      data: {
        documentId,
        teacherId,
        action,
        documentStatus: newDocumentStatus,
        teacherVerificationStatus: action === 'approve' ? 'verified_document' : teacher.verification_status
      }
    })

  } catch (error) {
    console.error('❌ Error reviewing verification document:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to review document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

