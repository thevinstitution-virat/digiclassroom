/**
 * Teacher Verification Document Upload API
 * 
 * Allows teachers to upload verification documents (teaching credentials, ID proof, etc.)
 * to upgrade their verification status from 'unverified' or 'verified_email' to 'verified_document'
 * 
 * B2C Feature: Part of the progressive verification system
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

// File upload configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_FILE_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
}

const ALLOWED_DOCUMENT_TYPES = [
  'teaching_certificate',
  'government_id',
  'school_id',
  'degree_certificate',
  'employment_letter',
  'other'
]

/**
 * POST /api/teacher/verification/upload
 * Upload verification document
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a teacher
    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'teacher') {
      return NextResponse.json(
        { success: false, error: 'Only teachers can upload verification documents' },
        { status: 403 }
      )
    }

    // Get teacher from database
    const teacher = await executeQuerySingle<any>(
      `SELECT id, email, verification_status, first_name, last_name 
       FROM users 
       WHERE clerk_id = ? AND role = 'teacher'`,
      [userId]
    )

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: 'Teacher record not found' },
        { status: 404 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const documentType = formData.get('documentType') as string
    const notes = formData.get('notes') as string || ''

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!documentType || !ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid document type. Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(', ')}` 
        },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid file type. Allowed types: PDF, JPG, PNG' 
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { 
          success: false, 
          error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` 
        },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExtension = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]
    const uniqueFilename = `${uuidv4()}.${fileExtension}`
    
    // Create upload directory path: uploads/teacher-verification/{teacher_id}/
    const uploadDir = join(process.cwd(), 'uploads', 'teacher-verification', teacher.id)
    const filePath = join(uploadDir, uniqueFilename)
    
    // Relative path for database storage
    const relativeFilePath = `uploads/teacher-verification/${teacher.id}/${uniqueFilename}`

    try {
      // Ensure upload directory exists
      await mkdir(uploadDir, { recursive: true })

      // Convert file to buffer and save
      const fileBuffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filePath, fileBuffer)

      console.log(`✅ File saved to: ${filePath}`)

    } catch (fileError) {
      console.error('Error saving file:', fileError)
      return NextResponse.json(
        { success: false, error: 'Failed to save file' },
        { status: 500 }
      )
    }

    // Create document record in database
    const documentId = uuidv4()
    
    try {
      await executeQuery(
        `INSERT INTO teacher_verification_documents (
          id, teacher_id, document_type, file_path, file_name, file_size, 
          mime_type, status, notes, uploaded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          documentId,
          teacher.id,
          documentType,
          relativeFilePath,
          file.name,
          file.size,
          file.type,
          'pending', // Status: pending admin review
          notes
        ]
      )

      console.log(`✅ Document record created: ${documentId}`)

    } catch (dbError) {
      console.error('Error creating document record:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to create document record' },
        { status: 500 }
      )
    }

    // Update teacher verification status to 'pending' (awaiting admin review)
    // Note: We don't automatically set to 'verified_document' - admin must review first
    try {
      await executeQuery(
        `UPDATE users 
         SET verification_status = 'unverified',
             updated_at = NOW()
         WHERE id = ? AND verification_status = 'unverified'`,
        [teacher.id]
      )

      // Update Clerk metadata to reflect document submission
      const client = await clerkClient()
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...sessionClaims?.metadata,
          verificationDocumentSubmitted: true,
          verificationDocumentSubmittedAt: new Date().toISOString(),
        }
      })

    } catch (updateError) {
      console.error('Error updating verification status:', updateError)
      // Don't fail the request - document is already uploaded
    }

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        fileName: file.name,
        fileSize: file.size,
        documentType,
        status: 'pending',
        message: 'Document uploaded successfully. Your verification is pending admin review.',
        estimatedReviewTime: '24-48 hours'
      }
    })

  } catch (error) {
    console.error('❌ Error uploading verification document:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to upload document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/teacher/verification/upload
 * Get teacher's uploaded verification documents
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is a teacher
    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'teacher') {
      return NextResponse.json(
        { success: false, error: 'Only teachers can view verification documents' },
        { status: 403 }
      )
    }

    // Get teacher from database
    const teacher = await executeQuerySingle<any>(
      `SELECT id FROM users WHERE clerk_id = ? AND role = 'teacher'`,
      [userId]
    )

    if (!teacher) {
      return NextResponse.json(
        { success: false, error: 'Teacher record not found' },
        { status: 404 }
      )
    }

    // Get all verification documents for this teacher
    const documents = await executeQuery<any>(
      `SELECT 
        id, document_type, file_name, file_size, mime_type,
        status, notes, uploaded_at, reviewed_at, reviewed_by, rejection_reason
       FROM teacher_verification_documents
       WHERE teacher_id = ?
       ORDER BY uploaded_at DESC`,
      [teacher.id]
    )

    return NextResponse.json({
      success: true,
      data: {
        documents: documents.map(doc => ({
          id: doc.id,
          documentType: doc.document_type,
          fileName: doc.file_name,
          fileSize: doc.file_size,
          mimeType: doc.mime_type,
          status: doc.status,
          notes: doc.notes,
          uploadedAt: doc.uploaded_at,
          reviewedAt: doc.reviewed_at,
          reviewedBy: doc.reviewed_by,
          rejectionReason: doc.rejection_reason
        }))
      }
    })

  } catch (error) {
    console.error('❌ Error fetching verification documents:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch documents',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

