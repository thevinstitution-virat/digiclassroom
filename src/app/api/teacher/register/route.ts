import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server'
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
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
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

    // Look up the existing Better Auth `user` row. After Phase 4.1 this is
    // the only user table — sign-up already created the row; teacher
    // registration UPDATEs it with the teacher role + pending approval.
    const existingUser = await executeQuerySingle<any>(
      'SELECT id, role, approval_status FROM `user` WHERE id = ?',
      [userId]
    )

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User record missing. Please sign out and sign back in.' },
        { status: 404 }
      )
    }

    if (existingUser.role === 'teacher') {
      return NextResponse.json(
        {
          error: 'You are already registered as a teacher',
          approvalStatus: existingUser.approval_status
        },
        { status: 400 }
      )
    }

    if (existingUser.role && existingUser.role !== 'student') {
      return NextResponse.json(
        { error: 'This account is already registered with a different role' },
        { status: 400 }
      )
    }

    // Promote the existing Better Auth user to teacher with pending approval.
    await executeQuery(
      `UPDATE \`user\`
       SET role = ?, approval_status = ?, first_name = ?, last_name = ?, preferences = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        'teacher',
        'pending',
        firstName,
        lastName,
        JSON.stringify({ specialization, qualification, experienceYears, phone }),
        userId
      ]
    )

    // Log activity. (teacher_id is the Better Auth user.id — same value as
    // session.user.id since Phase 4.1.)
    await executeQuery(
      `INSERT INTO teacher_activity_logs (
        id, teacher_id, activity_type, activity_description, created_at
      ) VALUES (?, ?, ?, ?, NOW())`,
      [
        generateId(),
        userId,
        'profile_updated',
        'Teacher registration submitted for approval'
      ]
    )

    console.log(`✅ Teacher registration created: ${email} (Status: pending)`)

    return NextResponse.json({
      success: true,
      message: 'Teacher registration submitted successfully. Please wait for admin approval.',
      data: {
        userId,
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

