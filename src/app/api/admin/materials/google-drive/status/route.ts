import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { GoogleDriveService } from '@/lib/services/google-drive'
import mysql from 'mysql2/promise'
import type { SystemHealthCheck } from '@/types/google-drive'

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'virat_gyankosh',
  port: parseInt(process.env.DB_PORT || '3306')
}

/**
 * GET /api/admin/materials/google-drive/status
 * Check Google Drive connection status and system health
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

    // Check if credentials are configured in environment
    const hasCredentials = !!(
      process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REDIRECT_URI
    )

    if (!hasCredentials) {
      return NextResponse.json({
        success: true,
        connected: false,
        error: 'Google Drive credentials not configured in environment variables',
        healthCheck: {
          googleDriveConnected: false,
          databaseConnected: true,
          quotaStatus: 'unknown',
          lastSyncTime: 'never',
          pendingUploads: 0,
          failedUploads: 0
        } as SystemHealthCheck
      })
    }

    // Check for stored authentication tokens in database
    let storedCredentials = null
    const connection = await mysql.createConnection(dbConfig)

    try {
      const [result] = await connection.execute(
        'SELECT access_token, refresh_token, expiry_date, scope FROM google_drive_config WHERE id = ?',
        ['main']
      ) as any[]

      if (result.length > 0) {
        storedCredentials = result[0]
      }
    } catch (error) {
      console.warn('Could not check stored credentials:', error.message)
    } finally {
      await connection.end()
    }

    // Initialize Google Drive service with stored credentials if available
    let driveService
    if (storedCredentials) {
      console.log('Loading stored credentials for Google Drive service...')
      const credentials = {
        access_token: storedCredentials.access_token,
        refresh_token: storedCredentials.refresh_token,
        expiry_date: new Date(storedCredentials.expiry_date).getTime(),
        token_type: 'Bearer',
        scope: storedCredentials.scope || 'https://www.googleapis.com/auth/drive'
      }
      console.log('Credentials loaded:', {
        hasAccessToken: !!credentials.access_token,
        hasRefreshToken: !!credentials.refresh_token,
        expiryDate: new Date(credentials.expiry_date).toISOString(),
        isExpired: credentials.expiry_date < Date.now()
      })
      driveService = new GoogleDriveService(credentials)
    } else {
      console.log('No stored credentials found, initializing empty service')
      driveService = new GoogleDriveService()
    }

    // Check if service is authenticated
    const isAuthenticated = driveService.isAuthenticated()

    if (!isAuthenticated) {
      const errorMessage = storedCredentials
        ? 'Google Drive tokens have expired. Please re-authenticate in Settings tab.'
        : 'Google Drive not authenticated. Please complete OAuth setup in Settings tab.'

      return NextResponse.json({
        success: true,
        connected: false,
        error: errorMessage,
        hasStoredCredentials: !!storedCredentials,
        healthCheck: {
          googleDriveConnected: false,
          databaseConnected: true,
          quotaStatus: 'unknown',
          lastSyncTime: storedCredentials ? new Date(storedCredentials.expiry_date).toISOString() : 'never',
          pendingUploads: 0,
          failedUploads: 0
        } as SystemHealthCheck
      })
    }

    // Test connection
    const connectionTest = await driveService.testConnection()

    if (!connectionTest) {
      return NextResponse.json({
        success: true,
        connected: false,
        error: 'Google Drive connection test failed',
        healthCheck: {
          googleDriveConnected: false,
          databaseConnected: true,
          quotaStatus: 'unknown',
          lastSyncTime: 'never',
          pendingUploads: 0,
          failedUploads: 0
        } as SystemHealthCheck
      })
    }

    // Get quota information
    let quotaStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
    let quotaInfo = null

    try {
      quotaInfo = await driveService.getStorageQuota()
      const usagePercentage = (parseInt(quotaInfo.usage) / parseInt(quotaInfo.limit)) * 100

      if (usagePercentage > 90) {
        quotaStatus = 'critical'
      } else if (usagePercentage > 75) {
        quotaStatus = 'warning'
      }
    } catch (error) {
      console.warn('Could not fetch quota information:', error)
      quotaStatus = 'unknown' as any
    }

    // Get system health information
    const healthCheck: SystemHealthCheck = {
      googleDriveConnected: true,
      databaseConnected: true,
      quotaStatus,
      lastSyncTime: new Date().toISOString(), // In real implementation, get from database
      pendingUploads: 0, // In real implementation, count from upload_sessions table
      failedUploads: 0   // In real implementation, count from upload_sessions table
    }

    return NextResponse.json({
      success: true,
      connected: true,
      quota: quotaInfo,
      healthCheck,
      message: 'Google Drive is connected and operational'
    })

  } catch (error) {
    console.error('Error checking Google Drive status:', error)
    return NextResponse.json({
      success: true,
      connected: false,
      error: 'Failed to check Google Drive status',
      healthCheck: {
        googleDriveConnected: false,
        databaseConnected: true,
        quotaStatus: 'unknown',
        lastSyncTime: 'never',
        pendingUploads: 0,
        failedUploads: 0
      } as SystemHealthCheck
    })
  }
}

/**
 * POST /api/admin/materials/google-drive/status
 * Refresh Google Drive connection and sync status
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

    // Initialize Google Drive service
    const driveService = new GoogleDriveService()

    // Attempt to refresh token if authenticated
    if (driveService.isAuthenticated()) {
      try {
        await driveService.refreshToken()
      } catch (error) {
        console.warn('Token refresh failed:', error)
        return NextResponse.json({
          success: false,
          error: 'Failed to refresh Google Drive token. Re-authentication may be required.'
        })
      }
    }

    // Test connection after refresh
    const connectionTest = await driveService.testConnection()

    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        error: 'Google Drive connection test failed after refresh'
      })
    }

    // Get updated quota information
    let quotaInfo = null
    try {
      quotaInfo = await driveService.getStorageQuota()
    } catch (error) {
      console.warn('Could not fetch quota information after refresh:', error)
    }

    return NextResponse.json({
      success: true,
      connected: true,
      quota: quotaInfo,
      message: 'Google Drive connection refreshed successfully'
    })

  } catch (error) {
    console.error('Error refreshing Google Drive status:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to refresh Google Drive status' },
      { status: 500 }
    )
  }
}
