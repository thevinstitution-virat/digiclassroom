import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'

// Validation schema for access tracking
const AccessTrackingSchema = z.object({
  materialId: z.string(),
  action: z.enum(['view', 'download', 'bookmark', 'share', 'browse']),
  readingProgress: z.object({
    currentPage: z.number().optional(),
    totalPages: z.number().optional(),
    progressPercentage: z.number().optional(),
    readingTime: z.number().optional()
  }).optional(),
  metadata: z.object({
    userAgent: z.string().optional(),
    referrer: z.string().optional(),
    timestamp: z.string().optional()
  }).optional()
})

/**
 * POST /api/materials/access
 * Track user material access for analytics
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate access data
    const validatedData = AccessTrackingSchema.parse(body)
    
    // Get request metadata
    const userAgent = request.headers.get('user-agent') || ''
    const referrer = request.headers.get('referer') || ''
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    // Create access log entry
    const accessLog = {
      userId,
      materialId: validatedData.materialId,
      action: validatedData.action,
      readingProgress: validatedData.readingProgress,
      userAgent,
      referrer,
      ipAddress,
      timestamp: new Date().toISOString()
    }

    // In a real implementation, you would save this to your database
    // For demo purposes, we'll just log it
    console.log('Material access tracked:', accessLog)

    // Update material download count if it's a download action
    if (validatedData.action === 'download') {
      await updateMaterialDownloadCount(validatedData.materialId)
    }

    // Update user reading progress if provided
    if (validatedData.readingProgress && validatedData.action === 'view') {
      await updateUserReadingProgress(userId, validatedData.materialId, validatedData.readingProgress)
    }

    return NextResponse.json({
      success: true,
      message: 'Access tracked successfully'
    })

  } catch (error) {
    console.error('Error tracking material access:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid access data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/materials/access
 * Get user's material access history (for analytics dashboard)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const materialId = searchParams.get('materialId')
    const action = searchParams.get('action')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build query filters
    const filters: any = { userId }
    if (materialId) filters.materialId = materialId
    if (action) filters.action = action

    // In a real implementation, you would query your database
    // For demo purposes, returning mock data
    const mockAccessHistory = [
      {
        id: '1',
        userId,
        materialId: 'sample_material_1',
        action: 'view',
        timestamp: new Date().toISOString(),
        readingProgress: {
          currentPage: 5,
          totalPages: 20,
          progressPercentage: 25,
          readingTime: 15
        }
      },
      {
        id: '2',
        userId,
        materialId: 'sample_material_1',
        action: 'download',
        timestamp: new Date(Date.now() - 86400000).toISOString() // 1 day ago
      }
    ]

    return NextResponse.json({
      success: true,
      data: mockAccessHistory.slice(offset, offset + limit),
      pagination: {
        limit,
        offset,
        total: mockAccessHistory.length
      }
    })

  } catch (error) {
    console.error('Error fetching access history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions (these would typically be in separate service files)

async function updateMaterialDownloadCount(materialId: string) {
  // In a real implementation, this would update the download count in your database
  console.log(`Incrementing download count for material: ${materialId}`)
  
  // Example SQL query:
  // UPDATE materials SET download_count = download_count + 1 WHERE id = ?
}

async function updateUserReadingProgress(
  userId: string, 
  materialId: string, 
  progress: any
) {
  // In a real implementation, this would update or create reading progress in your database
  console.log(`Updating reading progress for user ${userId}, material ${materialId}:`, progress)
  
  // Example SQL query:
  // INSERT INTO user_reading_progress (user_id, material_id, current_page, total_pages, progress_percentage, reading_time_minutes, last_read_at)
  // VALUES (?, ?, ?, ?, ?, ?, NOW())
  // ON DUPLICATE KEY UPDATE
  // current_page = VALUES(current_page),
  // progress_percentage = VALUES(progress_percentage),
  // reading_time_minutes = VALUES(reading_time_minutes),
  // last_read_at = NOW()
}
