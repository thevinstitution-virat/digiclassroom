/**
 * User Sync Utility
 *
 * LEGACY FILE - Previously synced Clerk users to the application database.
 * With BetterAuth, users are automatically synced via the auth system.
 * These functions now serve as stubs for backward compat with admin tools.
 */

import { db } from '@/db'
import { user } from '@/db/schema'
import { sql } from 'drizzle-orm'

interface SyncResult {
  success: boolean
  totalUsers: number
  syncedUsers: number
  errors: string[]
  newUsers: number
  updatedUsers: number
}

/**
 * With BetterAuth, users are managed directly in the DB.
 * This function now just returns the current user count as a health check.
 */
export async function syncAllUsersFromClerk(): Promise<SyncResult> {
  try {
    const [countResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(user)

    const totalUsers = countResult?.count || 0

    return {
      success: true,
      totalUsers,
      syncedUsers: totalUsers,
      errors: [],
      newUsers: 0,
      updatedUsers: 0
    }
  } catch (error) {
    console.error('Error checking user count:', error)
    return {
      success: false,
      totalUsers: 0,
      syncedUsers: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      newUsers: 0,
      updatedUsers: 0
    }
  }
}

/**
 * Stub — BetterAuth manages user sessions directly.
 * @deprecated Use BetterAuth session API instead
 */
export async function syncUserByClerkId(_clerkId: string): Promise<boolean> {
  console.warn('syncUserByClerkId is deprecated — BetterAuth manages users directly')
  return true
}
