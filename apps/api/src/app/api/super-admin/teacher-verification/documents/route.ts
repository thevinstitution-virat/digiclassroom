/**
 * Admin Teacher Verification Documents API
 * GET /api/super-admin/teacher-verification/documents
 * 
 * Fetches teacher verification documents for admin review
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db/connection'
import { isPlatformStaff, type Role } from '@/auth/permissions'

/**
 * GET /api/super-admin/teacher-verification/documents
 * Fetch verification documents with optional status filter
 */
export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status') || ''

    // Build query
    let query = `
      SELECT 
        d.id,
        d.teacher_id as teacherId,
        d.document_type as documentType,
        d.file_path as filePath,
        d.file_name as fileName,
        d.file_size as fileSize,
        d.mime_type as mimeType,
        d.status,
        d.notes,
        d.uploaded_at as uploadedAt,
        d.reviewed_at as reviewedAt,
        d.reviewed_by as reviewedBy,
        d.rejection_reason as rejectionReason,
        u.first_name as firstName,
        u.last_name as lastName,
        u.email as teacherEmail,
        u.verification_status as verificationStatus,
        u.email_domain as emailDomain,
        u.is_educational_domain as isEducationalDomain
      FROM teacher_verification_documents d
      INNER JOIN \`user\` u ON d.teacher_id = u.id
      WHERE u.role = 'teacher'
    `
    
    const params: any[] = []

    // Add status filter if provided
    if (statusFilter && statusFilter !== 'all') {
      query += ' AND d.status = ?'
      params.push(statusFilter)
    }

    // Order by upload date (newest first)
    query += ' ORDER BY d.uploaded_at DESC'

    // Execute query
    const documents = await executeQuery<any>(query, params)

    // Format response
    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      teacherId: doc.teacherId,
      teacherName: `${doc?.name?.split(' ')[0] || ''} ${doc?.name?.split(' ').slice(1).join(' ') || ''}`.trim() || 'Unknown',
      teacherEmail: doc.teacherEmail,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      filePath: doc.filePath,
      mimeType: doc.mimeType,
      status: doc.status,
      notes: doc.notes,
      uploadedAt: doc.uploadedAt,
      reviewedAt: doc.reviewedAt,
      reviewedBy: doc.reviewedBy,
      rejectionReason: doc.rejectionReason,
      verificationStatus: doc.verificationStatus,
      emailDomain: doc.emailDomain,
      isEducationalDomain: Boolean(doc.isEducationalDomain)
    }))

    return NextResponse.json({
      success: true,
      data: {
        documents: formattedDocuments,
        totalCount: formattedDocuments.length
      }
    })

  } catch (error) {
    console.error('❌ Error fetching verification documents:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch verification documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

