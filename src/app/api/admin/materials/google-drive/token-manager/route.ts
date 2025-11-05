import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { tokenManager } from '@/lib/services/token-manager'

/**
 * GET /api/admin/materials/google-drive/token-manager
 * Get token manager status
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Get token status
    const status = await tokenManager.getTokenStatus()

    return NextResponse.json({
      success: true,
      tokenManager: {
        isRunning: tokenManager.intervalId !== null,
        ...status
      }
    })

  } catch (error) {
    console.error('Error getting token manager status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to get token manager status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/materials/google-drive/token-manager
 * Control token manager (start/stop/refresh)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = sessionClaims?.metadata?.role
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const { action } = await request.json()

    switch (action) {
      case 'start':
        tokenManager.start()
        return NextResponse.json({
          success: true,
          message: 'Token manager started'
        })

      case 'stop':
        tokenManager.stop()
        return NextResponse.json({
          success: true,
          message: 'Token manager stopped'
        })

      case 'refresh':
        const refreshSuccess = await tokenManager.forceRefresh()
        return NextResponse.json({
          success: refreshSuccess,
          message: refreshSuccess ? 'Tokens refreshed successfully' : 'Token refresh failed'
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, or refresh' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Error controlling token manager:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to control token manager' },
      { status: 500 }
    )
  }
}
