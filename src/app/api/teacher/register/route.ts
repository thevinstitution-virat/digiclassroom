import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { executeQuery, executeQuerySingle } from '@/lib/db/connection'
import { TeacherRegistrationSchema } from '@/lib/validations'
import { generateId } from '@/lib/utils'

/**
 * POST /api/teacher/register
 * Register a new teacher (sets approval_status to 'pending')
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in first.' },
        { status: 401 }
      )
    }

    // Get request body
    const body = await request.json()
    
    // Validate input
    const validationResult = TeacherRegistrationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.errors 
        },
        { status: 400 }
      )
    }

    const { 
      email, 
      firstName, 
      lastName, 
      specialization, 
      qualification, 
      experienceYears,
      phone 
    } = validationResult.data

    // Get Clerk user
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)

    // Check if user already exists in database
    const existingUser = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM users WHERE clerk_id = ?',
      [userId]
    )

    if (existingUser) {
      if (existingUser.role === 'teacher') {
        return NextResponse.json(
          { 
            error: 'You are already registered as a teacher',
            approvalStatus: existingUser.approval_status
          },
          { status: 400 }
        )
      } else {
        return NextResponse.json(
          { error: 'This account is already registered with a different role' },
          { status: 400 }
        )
      }
    }

    // Get or create tenant (for now, use a default tenant)
    let tenantId = 'default-tenant-id'
    const tenant = await executeQuerySingle<any>(
      'SELECT id FROM tenants LIMIT 1'
    )
    if (tenant) {
      tenantId = tenant.id
    } else {
      // Create default tenant
      tenantId = generateId()
      await executeQuery(
        `INSERT INTO tenants (id, name, domain, subscription_plan, subscription_status, settings)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          'Default Educational Institute',
          'default.digiclassroom.com',
          'pro',
          'active',
          JSON.stringify({ features: ['ai_chat', 'teacher_validation'] })
        ]
      )
    }

    // Create user record with 'pending' approval status
    const newUserId = generateId()
    await executeQuery(
      `INSERT INTO users (
        id, tenant_id, clerk_id, email, role, approval_status,
        first_name, last_name, preferences, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        newUserId,
        tenantId,
        userId,
        email,
        'teacher',
        'pending',
        firstName,
        lastName,
        JSON.stringify({
          specialization,
          qualification,
          experienceYears,
          phone
        })
      ]
    )

    // Update Clerk metadata
    await client.users.updateUser(userId, {
      publicMetadata: {
        role: 'teacher',
        approvalStatus: 'pending',
        tenantId,
        userId: newUserId
      }
    })

    // Log activity
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, created_at
      ) VALUES (?, ?, ?, ?, NOW())`,
      [
        generateId(),
        newUserId,
        'profile_updated',
        'Teacher registration submitted for approval'
      ]
    )

    console.log(`✅ Teacher registration created: ${email} (Status: pending)`)

    return NextResponse.json({
      success: true,
      message: 'Teacher registration submitted successfully. Please wait for admin approval.',
      data: {
        userId: newUserId,
        email,
        approvalStatus: 'pending',
        firstName,
        lastName
      }
    }, { status: 201 })

  } catch (error) {
    console.error('❌ Error in teacher registration:', error)
    return NextResponse.json(
      { 
        error: 'Failed to register teacher',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/teacher/register
 * Get registration form metadata (subjects, qualifications, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      subjects: [
        'Mathematics',
        'Science',
        'Physics',
        'Chemistry',
        'Biology',
        'English',
        'Hindi',
        'Social Studies',
        'History',
        'Geography',
        'Computer Science',
        'Economics',
        'Commerce',
        'Accountancy'
      ],
      qualifications: [
        'B.Ed',
        'M.Ed',
        'B.A. + B.Ed',
        'B.Sc. + B.Ed',
        'M.A.',
        'M.Sc.',
        'Ph.D.',
        'Other'
      ],
      gradeLevels: Array.from({ length: 12 }, (_, i) => i + 1)
    })
  } catch (error) {
    console.error('❌ Error fetching registration metadata:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    )
  }
}

