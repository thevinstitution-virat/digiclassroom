import { NextRequest, NextResponse } from 'next/server'
import { tokenManager } from '@/lib/services/token-manager'

/**
 * POST /api/admin/materials/google-drive/init
 * Initialize Google Drive services (auto-start token manager)
 */
export async function POST(request: NextRequest) {
  try {
    // Start token manager if not already running
    tokenManager.start()
    
    // Get initial status
    const status = await tokenManager.getTokenStatus()
    
    return NextResponse.json({
      success: true,
      message: 'Google Drive services initialized',
      tokenManager: {
        isRunning: true,
        ...status
      }
    })

  } catch (error) {
    console.error('Error initializing Google Drive services:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to initialize services' },
      { status: 500 }
    )
  }
}
