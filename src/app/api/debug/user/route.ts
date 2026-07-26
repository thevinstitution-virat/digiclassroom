import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
/**
 * GET /api/debug/user
 * Debug endpoint to check current user authentication
 * ⚠️ DEVELOPMENT ONLY - Disabled in production for security
 */
export async function GET(request: NextRequest) {
  // Only allow in development environment
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        success: false,
        error: 'Debug endpoints are disabled in production'
      },
      { status: 403 }
    )
  }

  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    return NextResponse.json({
      success: true,
      authenticated: !!userId,
      userId: userId || null,
      sessionClaims: sessionClaims || null,
      userRole: sessionClaims?.metadata?.role || null,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })

  } catch (error) {
    console.error('Error in debug user endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check authentication',
        authenticated: false,
        userId: null
      },
      { status: 500 }
    )
  }
}
