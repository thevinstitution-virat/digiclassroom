import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { cancelProcessing, getActiveUploads, cleanupAllStuckProcesses, forceKillProcess } from '@/lib/utils/upload-process-manager'
import { removeProgressEmitter } from '@/lib/utils/progress-bus'

/**
 * POST /api/admin/content/cleanup
 * Clean up stuck upload processes
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

    const body = await request.json().catch(() => ({}))
    const { uploadId, action } = body

    if (action === 'cleanup-all') {
      console.log(`🧹 Cleanup: Terminating all stuck processes`)

      const result = await cleanupAllStuckProcesses()

      // Clean up progress emitters for all cleaned processes
      result.cleaned.forEach(id => removeProgressEmitter(id))

      return NextResponse.json({
        success: true,
        message: `Cleaned up ${result.cleaned.length} processes`,
        details: {
          cleaned: result.cleaned,
          errors: result.errors
        }
      })
    }

    if (!uploadId) {
      return NextResponse.json(
        { success: false, error: 'uploadId is required (or use action: "cleanup-all")' },
        { status: 400 }
      )
    }

    console.log(`🧹 Cleanup: Terminating upload process ${uploadId}`)

    // Try normal cancellation first
    let result = await cancelProcessing(uploadId)

    // If normal cancellation failed, try force kill
    if (!result.killed) {
      console.log(`⚡ Cleanup: Force killing process ${uploadId}`)
      const forceKilled = forceKillProcess(uploadId)
      result.killed = forceKilled
    }

    // Remove progress emitter
    removeProgressEmitter(uploadId)

    console.log(`✅ Cleanup: Process ${uploadId} terminated - killed: ${result.killed}, cleaned: ${result.cleaned}`)

    return NextResponse.json({
      success: true,
      message: `Upload process ${uploadId} terminated`,
      details: {
        processKilled: result.killed,
        tempFilesCleaned: result.cleaned
      }
    })

  } catch (error) {
    console.error('❌ Cleanup error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to cleanup upload process',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/content/cleanup
 * List active upload processes
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

    const activeUploads = getActiveUploads()

    return NextResponse.json({
      success: true,
      activeProcesses: activeUploads,
      count: activeUploads.length,
      message: activeUploads.length > 0
        ? `Found ${activeUploads.length} active upload processes`
        : 'No active upload processes found'
    })

  } catch (error) {
    console.error('❌ Cleanup list error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list upload processes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
