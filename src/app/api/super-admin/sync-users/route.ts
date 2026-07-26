/**
 * Admin API - User Management
 * GET /api/super-admin/sync-users - Get user statistics
 * POST /api/super-admin/sync-users - Trigger user count refresh
 *
 * Post-Clerk migration: Users are managed by BetterAuth directly.
 * This endpoint now returns user statistics from the database.
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { user } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'
import { isPlatformStaff, type Role } from '@/auth/permissions'

/**
 * POST /api/super-admin/sync-users
 * Returns current user counts (previously synced from Clerk)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = session?.user as any
    const userEmail = currentUser?.email
    const userRole = session?.user?.role

    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json({
        error: 'Admin access required',
        message: 'Only administrators can manage users'
      }, { status: 403 })
    }

    // Query actual user count from DB
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(user)

    const totalUsers = countResult?.count || 0

    return NextResponse.json({
      success: true,
      message: 'User statistics refreshed from database',
      totalUsers,
      syncedUsers: totalUsers,
      newUsers: 0,
      updatedUsers: 0,
      errors: []
    })

  } catch (error) {
    console.error('❌ User stats operation failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Operation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
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
 * GET /api/super-admin/sync-users
 * Get user statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = session?.user as any
    const userEmail = currentUser?.email
    const userRole = session?.user?.role

    const isAdmin = isPlatformStaff((userRole ?? '') as Role)

    if (!isAdmin) {
      return NextResponse.json({
        error: 'Admin access required'
      }, { status: 403 })
    }

    // Query real user counts from DB
    const [totalResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(user)

    const totalUsers = totalResult?.count || 0

    const stats = {
      totalUsers,
      databaseUsers: totalUsers,
      lastSyncTime: new Date().toISOString(),
      syncStatus: 'synced',
      authProvider: 'BetterAuth',
      recommendations: []
    }

    return NextResponse.json({
      success: true,
      stats
    })

  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user statistics'
      },
      { status: 500 }
    )
  }
}
