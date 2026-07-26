import { auth } from '@/auth';
import { isPlatformStaff, type Role } from '@/auth/permissions';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { GoogleDriveService } from '@/lib/services/google-drive'
import mysql from 'mysql2/promise'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

/**
 * POST /api/super-admin/materials/google-drive/auth
 * Exchange authorization code for access tokens
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
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Authorization code is required' },
        { status: 400 }
      )
    }

    // Check if credentials are configured
    if (!process.env.GOOGLE_DRIVE_CLIENT_ID || !process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Google Drive credentials not configured' },
        { status: 400 }
      )
    }

    // Initialize Google Drive service
    const driveService = new GoogleDriveService()

    // Exchange code for tokens
    const tokens = await driveService.getTokens(code)

    // Test the connection
    const connectionTest = await driveService.testConnection()
    if (!connectionTest) {
      return NextResponse.json(
        { success: false, error: 'Failed to connect to Google Drive with the provided authorization' },
        { status: 400 }
      )
    }

    // Store tokens securely (in production, use encrypted storage)
    const connection = await mysql.createConnection(dbConfig)

    try {
      // Create or update Google Drive configuration
      await connection.execute(`
        INSERT INTO google_drive_config (
          id, access_token, refresh_token, token_type, scope, expiry_date, 
          configured_by, created_at, updated_at
        ) VALUES (
          'main', ?, ?, ?, ?, ?, ?, NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
          access_token = VALUES(access_token),
          refresh_token = VALUES(refresh_token),
          token_type = VALUES(token_type),
          scope = VALUES(scope),
          expiry_date = VALUES(expiry_date),
          configured_by = VALUES(configured_by),
          updated_at = NOW()
      `, [
        tokens.access_token,
        tokens.refresh_token,
        tokens.token_type,
        tokens.scope,
        new Date(tokens.expiry_date),
        userId
      ])

      // Log the authentication event
      await connection.execute(`
        INSERT INTO admin_activity_log (
          admin_id, action, details, ip_address, user_agent, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `, [
        userId,
        'google_drive_auth',
        JSON.stringify({ success: true, scope: tokens.scope }),
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        request.headers.get('user-agent') || 'unknown'
      ])

    } finally {
      await connection.end()
    }

    return NextResponse.json({
      success: true,
      message: 'Google Drive authenticated successfully',
      data: {
        scope: tokens.scope,
        expiryDate: new Date(tokens.expiry_date).toISOString()
      }
    })

  } catch (error) {
    console.error('Error authenticating Google Drive:', error)

    // Log the failed authentication attempt
    try {
      const session = await auth.api.getSession({ headers: await headers() });
      const userId = session?.user?.id;
      if (userId) {
        const connection = await mysql.createConnection(dbConfig)
        try {
          await connection.execute(`
            INSERT INTO admin_activity_log (
              admin_id, action, details, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
          `, [
            userId,
            'google_drive_auth_failed',
            JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
            request.headers.get('user-agent') || 'unknown'
          ])
        } finally {
          await connection.end()
        }
      }
    } catch (logError) {
      console.warn('Failed to log authentication error:', logError)
    }

    return NextResponse.json(
      { success: false, error: 'Failed to authenticate with Google Drive' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/super-admin/materials/google-drive/auth
 * Get current authentication status
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

    const connection = await mysql.createConnection(dbConfig)

    try {
      // Get current Google Drive configuration
      const [configResult] = await connection.execute(
        'SELECT scope, expiry_date, configured_by, created_at, updated_at FROM google_drive_config WHERE id = ?',
        ['main']
      ) as any[]

      if (configResult.length === 0) {
        return NextResponse.json({
          success: true,
          authenticated: false,
          message: 'Google Drive not configured'
        })
      }

      const config = configResult[0]
      const isExpired = new Date() > new Date(config.expiry_date)

      return NextResponse.json({
        success: true,
        authenticated: !isExpired,
        data: {
          scope: config.scope,
          expiryDate: config.expiry_date,
          configuredBy: config.configured_by,
          configuredAt: config.created_at,
          lastUpdated: config.updated_at,
          isExpired
        }
      })

    } finally {
      await connection.end()
    }

  } catch (error) {
    console.error('Error checking Google Drive authentication status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to check authentication status' },
      { status: 500 }
    )
  }
}
