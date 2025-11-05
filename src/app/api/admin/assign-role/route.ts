import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json({ 
        error: 'Email and role are required' 
      }, { status: 400 })
    }

    // Special check for your email to allow self-assignment
    const currentUser = await clerkClient.users.getUser(userId)
    const isTargetEmail = email === 'bhaarat2050@gmail.com'
    const isCurrentUserTargetEmail = currentUser.emailAddresses.some(
      emailAddr => emailAddr.emailAddress === 'bhaarat2050@gmail.com'
    )

    if (!isCurrentUserTargetEmail && !isTargetEmail) {
      return NextResponse.json({ 
        error: 'Only bhaarat2050@gmail.com can assign admin roles' 
      }, { status: 403 })
    }

    // Find user by email
    const users = await clerkClient.users.getUserList({
      emailAddress: [email]
    })

    if (users.length === 0) {
      return NextResponse.json({ 
        error: 'User not found' 
      }, { status: 404 })
    }

    const targetUser = users[0]

    // Update user metadata with admin role
    await clerkClient.users.updateUserMetadata(targetUser.id, {
      publicMetadata: {
        role: role
      }
    })

    return NextResponse.json({
      success: true,
      message: `Successfully assigned ${role} role to ${email}`,
      userId: targetUser.id
    })

  } catch (error) {
    console.error('Role assignment error:', error)
    return NextResponse.json({
      error: 'Failed to assign role',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to check current user role
export async function GET() {
  try {
    const { userId, sessionClaims } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentRole = sessionClaims?.metadata?.role || 'user'
    const user = await clerkClient.users.getUser(userId)
    
    return NextResponse.json({
      userId,
      email: user.emailAddresses[0]?.emailAddress,
      currentRole,
      isAdmin: currentRole === 'admin'
    })

  } catch (error) {
    console.error('Role check error:', error)
    return NextResponse.json({
      error: 'Failed to check role'
    }, { status: 500 })
  }
}
