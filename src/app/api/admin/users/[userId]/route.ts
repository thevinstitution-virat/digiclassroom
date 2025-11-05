import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { UserUpdateData } from '@/types/user-management'

// GET - Fetch specific user details
export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { userId: targetUserId } = params

    // Fetch user from Clerk
    const user = await client.users.getUser(targetUserId)

    const userProfile = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress.split('@')[0] || 'Unknown',
      email: user.emailAddresses[0]?.emailAddress || '',
      profileImageUrl: user.imageUrl,
      role: (user.publicMetadata?.role as any) || 'student',
      status: user.banned ? 'suspended' : 
              user.emailAddresses[0]?.verification?.status === 'verified' ? 'active' : 'pending',
      createdAt: new Date(user.createdAt),
      lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
      emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
      phoneNumber: user.phoneNumbers[0]?.phoneNumber || null,
      metadata: user.publicMetadata || {}
    }

    return NextResponse.json({
      success: true,
      data: userProfile
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// PUT - Update user information
export async function PUT(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { userId: targetUserId } = params
    const updateData: UserUpdateData = await request.json()

    // Prepare update payload
    const updatePayload: any = {}

    if (updateData.firstName !== undefined) {
      updatePayload.firstName = updateData.firstName
    }

    if (updateData.lastName !== undefined) {
      updatePayload.lastName = updateData.lastName
    }

    if (updateData.role || updateData.metadata) {
      updatePayload.publicMetadata = {
        ...(updateData.metadata || {}),
        ...(updateData.role && { role: updateData.role })
      }
    }

    // Update user in Clerk
    const updatedUser = await client.users.updateUser(targetUserId, updatePayload)

    // Handle status changes
    if (updateData.status) {
      if (updateData.status === 'suspended') {
        await client.users.banUser(targetUserId)
      } else if (updateData.status === 'active') {
        await client.users.unbanUser(targetUserId)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.emailAddresses[0]?.emailAddress,
        role: updatedUser.publicMetadata?.role,
        status: updateData.status
      }
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to update user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
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

    const { userId: targetUserId } = params

    // Prevent self-deletion
    if (currentUserId === targetUserId) {
      return NextResponse.json({
        success: false,
        error: 'Cannot delete your own account'
      }, { status: 400 })
    }

    // Delete user from Clerk
    await client.users.deleteUser(targetUserId)

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to delete user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
