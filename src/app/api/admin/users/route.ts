import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { UserProfile, UserListFilters, UserRole, UserStatus } from '@/types/user-management'

// GET - Fetch users with filtering and pagination
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

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || 'all'
    const status = searchParams.get('status') || 'all'
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Fetch users from Clerk
    const offset = (page - 1) * limit
    const clerkUsers = await client.users.getUserList({
      limit,
      offset,
      orderBy: sortBy === 'name' ? 'first_name' : 
               sortBy === 'email' ? 'email_address' :
               sortBy === 'createdAt' ? 'created_at' :
               sortBy === 'lastSignInAt' ? 'last_sign_in_at' : 'created_at'
    })

    // Transform Clerk users to our UserProfile format
    let users: UserProfile[] = clerkUsers.data.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses[0]?.emailAddress.split('@')[0] || 'Unknown',
      email: user.emailAddresses[0]?.emailAddress || '',
      profileImageUrl: user.imageUrl,
      role: (user.publicMetadata?.role as UserRole) || 'student',
      status: user.banned ? 'suspended' : 
              user.emailAddresses[0]?.verification?.status === 'verified' ? 'active' : 'pending',
      createdAt: new Date(user.createdAt),
      lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
      emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
      phoneNumber: user.phoneNumbers[0]?.phoneNumber || null,
      metadata: user.publicMetadata || {}
    }))

    // Apply client-side filtering (since Clerk doesn't support all our filters)
    if (search) {
      const searchLower = search.toLowerCase()
      users = users.filter(user => 
        user.fullName.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.id.toLowerCase().includes(searchLower)
      )
    }

    if (role !== 'all') {
      users = users.filter(user => user.role === role)
    }

    if (status !== 'all') {
      users = users.filter(user => user.status === status)
    }

    // Apply sorting
    users.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.fullName.toLowerCase()
          bValue = b.fullName.toLowerCase()
          break
        case 'email':
          aValue = a.email.toLowerCase()
          bValue = b.email.toLowerCase()
          break
        case 'createdAt':
          aValue = a.createdAt.getTime()
          bValue = b.createdAt.getTime()
          break
        case 'lastSignInAt':
          aValue = a.lastSignInAt?.getTime() || 0
          bValue = b.lastSignInAt?.getTime() || 0
          break
        case 'role':
          aValue = a.role
          bValue = b.role
          break
        default:
          aValue = a.createdAt.getTime()
          bValue = b.createdAt.getTime()
      }

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        users,
        totalCount: clerkUsers.totalCount,
        hasNextPage: offset + limit < clerkUsers.totalCount,
        hasPreviousPage: page > 1,
        currentPage: page,
        totalPages: Math.ceil(clerkUsers.totalCount / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST - Create new user or send invitation
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { email, firstName, lastName, role, sendInvitation } = body

    if (!email || !role) {
      return NextResponse.json({
        success: false,
        error: 'Email and role are required'
      }, { status: 400 })
    }

    // Check if user already exists
    const existingUsers = await clerkClient.users.getUserList({
      emailAddress: [email]
    })

    if (existingUsers.data.length > 0) {
      return NextResponse.json({
        success: false,
        error: 'User with this email already exists'
      }, { status: 409 })
    }

    if (sendInvitation) {
      // Send invitation email (implement your email service here)
      // For now, we'll just return success
      return NextResponse.json({
        success: true,
        message: `Invitation sent to ${email}`,
        data: { email, role, invited: true }
      })
    } else {
      // Create user directly
      const newUser = await client.users.createUser({
        emailAddress: [email],
        firstName,
        lastName,
        publicMetadata: { role },
        skipPasswordRequirement: true
      })

      return NextResponse.json({
        success: true,
        message: 'User created successfully',
        data: {
          id: newUser.id,
          email: newUser.emailAddresses[0]?.emailAddress,
          role
        }
      })
    }

  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to create user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
