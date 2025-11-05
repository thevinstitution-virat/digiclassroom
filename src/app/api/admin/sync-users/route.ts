/**
 * Admin API - Sync Users from Clerk
 * Endpoint to manually trigger user synchronization from Clerk to application database
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { syncAllUsersFromClerk, syncUserByClerkId } from '@/lib/auth/user-sync'

/**
 * POST /api/admin/sync-users
 * Sync all users from Clerk to application database
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = sessionClaims?.metadata?.role
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress
    
    const isAdmin = userRole === 'admin' || 
      ['bhaarat2050@gmail.com', 'thevinstitution@gmail.com'].includes(userEmail || '')

    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Admin access required',
        message: 'Only administrators can sync users'
      }, { status: 403 })
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}))
    const { specificUserId, forceSync = false } = body

    console.log('🔄 User sync initiated by:', userEmail)

    let result

    if (specificUserId) {
      // Sync specific user
      console.log(`🎯 Syncing specific user: ${specificUserId}`)
      const success = await syncUserByClerkId(specificUserId)
      
      result = {
        success,
        message: success 
          ? `User ${specificUserId} synced successfully`
          : `Failed to sync user ${specificUserId}`,
        totalUsers: success ? 1 : 0,
        syncedUsers: success ? 1 : 0,
        newUsers: 0, // We don't track this for single user sync
        updatedUsers: success ? 1 : 0,
        errors: success ? [] : [`Failed to sync user ${specificUserId}`]
      }
    } else {
      // Sync all users
      console.log('🌐 Syncing all users from Clerk...')
      result = await syncAllUsersFromClerk()
    }

    console.log('✅ Sync completed:', {
      success: result.success,
      totalUsers: result.totalUsers,
      syncedUsers: result.syncedUsers,
      newUsers: result.newUsers,
      updatedUsers: result.updatedUsers,
      errors: result.errors?.length || 0
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Sync operation failed:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Sync operation failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        totalUsers: 0,
        syncedUsers: 0,
        newUsers: 0,
        updatedUsers: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/sync-users
 * Get sync status and statistics
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = sessionClaims?.metadata?.role
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const userEmail = currentUser.emailAddresses[0]?.emailAddress
    
    const isAdmin = userRole === 'admin' || 
      ['bhaarat2050@gmail.com', 'thevinstitution@gmail.com'].includes(userEmail || '')

    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Admin access required' 
      }, { status: 403 })
    }

    // Get Clerk users count
    const clerkUsers = await client.users.getUserList({ limit: 1 })
    const clerkUsersCount = clerkUsers.totalCount || 0

    // Get database users count (mock for now - would query actual database)
    const databaseUsersCount = clerkUsersCount // Assuming they're synced

    // Calculate role distribution (mock data - would query actual database)
    const adminUsers = userEmail === 'thevinstitution@gmail.com' ? 1 : 0
    const studentUsers = Math.max(0, clerkUsersCount - adminUsers - 1)
    const teacherUsers = 0
    const parentUsers = userEmail === 'bhaarat2050@gmail.com' ? 1 : 0

    const stats = {
      clerkUsers: clerkUsersCount,
      databaseUsers: databaseUsersCount,
      lastSyncTime: new Date().toISOString(),
      syncStatus: clerkUsersCount === databaseUsersCount ? 'synced' : 'out_of_sync',
      adminUsers,
      studentUsers,
      teacherUsers,
      parentUsers,
      syncedToday: clerkUsersCount,
      failedSyncs: 0,
      recommendations: clerkUsersCount === databaseUsersCount ? [] : [
        'Run manual sync to ensure all users are properly synchronized',
        'Check webhook configuration for automatic synchronization',
        'Verify database connectivity and permissions'
      ]
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error fetching sync stats:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch sync statistics' 
      },
      { status: 500 }
    )
  }
}
