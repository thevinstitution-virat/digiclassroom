import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { headers } from 'next/headers'
import { z } from 'zod'
import { UserProfileService } from '@/lib/services/user-profile-service'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service'

// Validation schema for user profile from frontend
const UserProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.string(),
  board: z.string(),
  medium: z.string(),
  class: z.number().min(1).max(12),
  stream: z.string().optional(),
  subjects: z.array(z.string()).optional()
})

const PartialUserProfileSchema = UserProfileSchema.partial()
const profileService = new UserProfileService()

/**
 * Helper to map DB profile to frontend expected format
 */
function mapToFrontendProfile(dbProfile: any, subscription: any = null) {
  return {
    userId: dbProfile.user_id,
    clerkId: dbProfile.user_id,
    role: dbProfile.role,
    board: dbProfile.board_type,
    medium: dbProfile.language_preference,
    class: dbProfile.grade_level || 10,
    stream: (dbProfile.grade_level >= 11) ? (dbProfile.specialization_subjects?.[0] || 'HUMANITIES') : null,
    subjects: dbProfile.subjects || [],
    isOnboardingComplete: true,
    preferences: {
      language: dbProfile.language_preference,
      learningStyle: dbProfile.learning_style || 'visual',
      difficulty: dbProfile.preferred_explanation_complexity || 'medium'
    },
    subscription: {
      plan: subscription?.plan_code?.toLowerCase() || 'starter',
      features: ['basic_materials', 'ai_tutor'],
      expiresAt: subscription?.expiry_date || null
    },
    createdAt: dbProfile.created_at,
    updatedAt: dbProfile.updated_at
  }
}

/**
 * GET /api/user/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await profileService.getUserProfile(userId)
    const subscription = await subscriptionValidationService.getUserSubscription(userId)

    if (!profile) {
      return NextResponse.json({
        success: true,
        data: null,
        onboardingComplete: false,
        message: 'Profile not found. Onboarding required.'
      })
    }

    const name = session?.user?.name || ''
    const hasName = name.trim().length > 0

    // An onboarding is fully complete ONLY if all required fields are present
    const isComplete = Boolean(
      hasName &&
      profile.board_type &&
      profile.grade_level &&
      profile.language_preference
    )

    return NextResponse.json({
      success: true,
      data: mapToFrontendProfile(profile, subscription),
      onboardingComplete: isComplete
    })
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/user/profile
 * Create or update user profile (onboarding)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[PROFILE POST] Starting...')
    const session = await auth.api.getSession({ headers: await headers() })
    const userId = session?.user?.id
    console.log('[PROFILE POST] userId:', userId)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[PROFILE POST] body:', JSON.stringify(body))
    const validatedData = UserProfileSchema.parse(body)
    console.log('[PROFILE POST] validated:', JSON.stringify(validatedData))

    if (validatedData.class >= 11 && !validatedData.stream) {
      return NextResponse.json({ error: 'Stream is required for classes 11 and 12' }, { status: 400 })
    }

    const dbProfileData = {
      user_id: userId,
      role: (validatedData.role === 'parent' || validatedData.role === 'guardian') ? 'parent_guardian' : validatedData.role as any,
      board_type: validatedData.board as any,
      grade_level: validatedData.class,
      subjects: validatedData.subjects || [],
      language_preference: validatedData.medium.toLowerCase() as any,
      specialization_subjects: validatedData.stream ? [validatedData.stream] : undefined,
      isOnboardingComplete: true
    }
    console.log('[PROFILE POST] dbProfileData:', JSON.stringify(dbProfileData))

    // Check if profile exists
    console.log('[PROFILE POST] Checking existing profile...')
    const existing = await profileService.getUserProfile(userId)
    console.log('[PROFILE POST] existing:', existing ? 'yes' : 'no')
    if (existing) {
      console.log('[PROFILE POST] Updating profile...')
      await profileService.updateUserProfile(userId, dbProfileData)
    } else {
      console.log('[PROFILE POST] Creating profile...')
      await profileService.createUserProfile(dbProfileData)
    }

    // Update user's name in the main users table / BetterAuth session
    console.log('[PROFILE POST] Updating user name...')
    const fullName = `${validatedData.firstName} ${validatedData.lastName}`.trim()
    await db.update(user).set({ name: fullName }).where(eq(user.id, userId))
    console.log('[PROFILE POST] Write complete, fetching profile...')

    const newProfile = await profileService.getUserProfile(userId)
    console.log('[PROFILE POST] newProfile:', newProfile ? 'found' : 'null')

    // NOTE: Free trial is NOT auto-created during onboarding.
    // Users must explicitly click "Start Free Trial" on the pricing page,
    // which calls POST /api/user/subscription/create-trial.

    return NextResponse.json({
      success: true,
      data: mapToFrontendProfile(newProfile),
      message: 'Profile updated successfully'
    })
  } catch (error: any) {
    console.error('[PROFILE POST] ERROR:', error?.message || error)
    console.error('[PROFILE POST] STACK:', error?.stack)
    console.error('[PROFILE POST] CODE:', error?.code)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid profile data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/user/profile
 * Update specific profile fields
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    const userId = session?.user?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = PartialUserProfileSchema.parse(body)

    const existingProfile = await profileService.getUserProfile(userId)
    if (!existingProfile) {
      return NextResponse.json({ error: 'Profile not found. Please complete onboarding first.' }, { status: 404 })
    }

    const dbProfileData: any = {}
    if (validatedData.role) dbProfileData.role = (validatedData.role === 'parent' || validatedData.role === 'guardian') ? 'parent_guardian' : validatedData.role
    if (validatedData.board) dbProfileData.board_type = validatedData.board
    if (validatedData.class) dbProfileData.grade_level = validatedData.class
    if (validatedData.subjects) dbProfileData.subjects = validatedData.subjects
    if (validatedData.medium) dbProfileData.language_preference = validatedData.medium.toLowerCase()
    if (validatedData.stream) dbProfileData.specialization_subjects = [validatedData.stream]

    if (Object.keys(dbProfileData).length > 0) {
      await profileService.updateUserProfile(userId, dbProfileData)
    }

    const updatedProfile = await profileService.getUserProfile(userId)

    return NextResponse.json({
      success: true,
      data: mapToFrontendProfile(updatedProfile),
      message: 'Profile updated successfully'
    })
  } catch (error) {
    console.error('Error updating user profile:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid profile data', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
