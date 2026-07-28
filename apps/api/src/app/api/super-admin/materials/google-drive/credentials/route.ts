import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { GoogleDriveService } from '@/lib/services/google-drive'
import { isPlatformStaff, type Role } from '@/auth/permissions'

/**
 * GET /api/super-admin/materials/google-drive/credentials
 * Get current Google Drive credentials configuration
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

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // Return current configuration (without secrets)
    const credentials = {
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET ? '***CONFIGURED***' : '',
      redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI || 'http://localhost:3000/api/super-admin/materials/google-drive/callback'
    }

    return NextResponse.json({
      success: true,
      data: credentials
    })

  } catch (error) {
    console.error('Error fetching Google Drive credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credentials' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/super-admin/materials/google-drive/credentials
 * Save Google Drive credentials and generate auth URL
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

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { clientId, clientSecret, redirectUri } = body

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { success: false, error: 'Client ID, Client Secret, and Redirect URI are required' },
        { status: 400 }
      )
    }

    // Validate redirect URI format
    try {
      new URL(redirectUri)
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Invalid redirect URI format' },
        { status: 400 }
      )
    }

    // In a production environment, you would save these to a secure storage
    // For this implementation, we'll assume they're set as environment variables
    // and generate the auth URL
    
    // Temporarily set environment variables for this session
    process.env.GOOGLE_DRIVE_CLIENT_ID = clientId
    process.env.GOOGLE_DRIVE_CLIENT_SECRET = clientSecret
    process.env.GOOGLE_DRIVE_REDIRECT_URI = redirectUri

    // Initialize Google Drive service and get auth URL
    const driveService = new GoogleDriveService()
    const authUrl = driveService.getAuthUrl()

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Credentials saved successfully. Please authorize the application using the provided URL.'
    })

  } catch (error) {
    console.error('Error saving Google Drive credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save credentials' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/super-admin/materials/google-drive/credentials
 * Remove Google Drive credentials
 */
export async function DELETE(request: NextRequest) {
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

    const userRole = session?.user?.role
    if (!isPlatformStaff((userRole ?? '') as Role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden. Admin access required.' },
        { status: 403 }
      )
    }

    // In a production environment, you would remove these from secure storage
    // For this implementation, we'll clear the environment variables
    delete process.env.GOOGLE_DRIVE_CLIENT_ID
    delete process.env.GOOGLE_DRIVE_CLIENT_SECRET
    delete process.env.GOOGLE_DRIVE_REDIRECT_URI

    return NextResponse.json({
      success: true,
      message: 'Google Drive credentials removed successfully'
    })

  } catch (error) {
    console.error('Error removing Google Drive credentials:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove credentials' },
      { status: 500 }
    )
  }
}
