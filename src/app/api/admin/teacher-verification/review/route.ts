/**
 * Admin Teacher Verification Review API
 * POST /api/admin/teacher-verification/review
 * 
 * Approve or reject teacher verification documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'

/**
 * POST /api/admin/teacher-verification/review
 * Approve or reject a verification document
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

    // Check admin permissions
    const userRole = (sessionClaims?.metadata as any)?.role
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress

    const isAdmin = userRole === 'admin' ||
      ['bhaarat2050@gmail.com', 'thevinstitution@gmail.com'].includes(userEmail || '')

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get admin user ID from database
    const adminUser = await executeQuerySingle<any>(
      'SELECT id FROM users WHERE clerk_id = ?',
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
      `SELECT id, clerk_id, email, first_name, last_name, verification_status FROM users WHERE id = ?`,
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
        `UPDATE users 
         SET verification_status = 'verified_document',
             verification_method = 'document_upload',
             verified_at = NOW(),
             updated_at = NOW()
         WHERE id = ?`,
        [teacherId]
      )

      console.log(`✅ Teacher verification upgraded: ${teacher.email} → verified_document`)

      // Update Clerk metadata
      if (teacher.clerk_id) {
        try {
          const existingMetadata = (sessionClaims?.metadata as any) || {}
          await client.users.updateUserMetadata(teacher.clerk_id, {
            publicMetadata: {
              ...existingMetadata,
              verificationStatus: 'verified_document',
              verificationMethod: 'document_upload',
              verifiedAt: new Date().toISOString(),
              documentVerified: true
            }
          })

          console.log(`✅ Clerk metadata updated for teacher: ${teacher.email}`)
        } catch (clerkError) {
          console.error('⚠️ Failed to update Clerk metadata:', clerkError)
          // Don't fail the request - document is already approved in database
        }
      }
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

