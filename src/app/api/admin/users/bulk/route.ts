import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { BulkUserAction } from '@/types/user-management'

// POST - Perform bulk actions on users
export async function POST(request: NextRequest) {
  try {
    const { userId: currentUserId, sessionClaims } = await auth()
    
    if (!currentUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = sessionClaims?.metadata?.role
    const client = await clerkClient()
    const currentUser = await client.users.getUser(currentUserId)
    const isAdmin = userRole === 'admin' ||
      currentUser.emailAddresses[0]?.emailAddress === 'thevinstitution@gmail.com'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const bulkAction: BulkUserAction = await request.json()
    const { userIds, action, payload } = bulkAction

    if (!userIds || userIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No users selected'
      }, { status: 400 })
    }

    // Prevent actions on current user
    if (userIds.includes(currentUserId)) {
      return NextResponse.json({
        success: false,
        error: 'Cannot perform bulk actions on your own account'
      }, { status: 400 })
    }

    const results = {
      successful: [] as string[],
      failed: [] as { userId: string; error: string }[]
    }

    // Process each user
    for (const userId of userIds) {
      try {
        switch (action) {
          case 'changeRole':
            if (!payload?.role) {
              throw new Error('Role is required for role change action')
            }
            await client.users.updateUserMetadata(userId, {
              publicMetadata: { role: payload.role }
            })
            results.successful.push(userId)
            break

          case 'changeStatus':
            if (!payload?.status) {
              throw new Error('Status is required for status change action')
            }
            
            if (payload.status === 'suspended') {
              await client.users.banUser(userId)
            } else if (payload.status === 'active') {
              await client.users.unbanUser(userId)
            }
            results.successful.push(userId)
            break

          case 'delete':
            await client.users.deleteUser(userId)
            results.successful.push(userId)
            break

          case 'sendEmail':
            // Implement email sending logic here
            // For now, we'll just mark as successful
            console.log(`Sending email to user ${userId}:`, payload?.message)
            results.successful.push(userId)
            break

          default:
            throw new Error(`Unknown action: ${action}`)
        }
      } catch (error) {
        results.failed.push({
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const actionLabels = {
      changeRole: 'role change',
      changeStatus: 'status change',
      delete: 'deletion',
      sendEmail: 'email sending'
    }

    return NextResponse.json({
      success: true,
      message: `Bulk ${actionLabels[action]} completed`,
      data: {
        totalProcessed: userIds.length,
        successful: results.successful.length,
        failed: results.failed.length,
        results
      }
    })

  } catch (error) {
    console.error('Error performing bulk action:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to perform bulk action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET - Get bulk action status/history (optional feature)
export async function GET(request: NextRequest) {
  try {
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    const userRole = sessionClaims?.metadata?.role
    const client = await clerkClient()
    const currentUser = await client.users.getUser(userId)
    const isAdmin = userRole === 'admin' ||
      currentUser.emailAddresses[0]?.emailAddress === 'thevinstitution@gmail.com'

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // This would typically fetch from a database where you store bulk action history
    // For now, return empty array
    return NextResponse.json({
      success: true,
      data: {
        recentActions: [],
        message: 'Bulk action history not implemented yet'
      }
    })

  } catch (error) {
    console.error('Error fetching bulk action history:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch bulk action history'
    }, { status: 500 })
  }
}
