/**
 * Admin Teacher Verification Document View API
 * GET /api/admin/teacher-verification/view/[documentId]
 * 
 * Serves verification document files for admin review
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'
import { executeQuerySingle } from '@/lib/db/connection'
import { readFile } from 'fs/promises'
import { join } from 'path'

/**
 * GET /api/admin/teacher-verification/view/[documentId]
 * View a verification document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
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
    const userRole = sessionClaims?.metadata?.role
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

    const documentId = params.documentId

    // Get document from database
    const document = await executeQuerySingle<any>(
      `SELECT 
        id, teacher_id, file_path, file_name, mime_type, file_size
       FROM teacher_verification_documents 
       WHERE id = ?`,
      [documentId]
    )

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found' },
        { status: 404 }
      )
    }

    // Read file from filesystem
    const filePath = join(process.cwd(), document.file_path)
    
    try {
      const fileBuffer = await readFile(filePath)
      
      // Return file with appropriate headers
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': document.mime_type,
          'Content-Disposition': `inline; filename="${document.file_name}"`,
          'Content-Length': document.file_size.toString(),
          'Cache-Control': 'private, max-age=3600'
        }
      })
    } catch (fileError) {
      console.error('Error reading file:', fileError)
      return NextResponse.json(
        { success: false, error: 'File not found or cannot be read' },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('❌ Error viewing verification document:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to view document',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

