import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { OnboardingFormData, EnhancedUserProfile } from '@/types/user-management'

// Validation schema for user profile
const UserProfileSchema = z.object({
  role: z.enum(['admin', 'teacher', 'student', 'parent', 'guardian']),
  board: z.enum(['CBSE', 'ICSE', 'STATE_BOARD']),
  medium: z.enum(['ENGLISH', 'HINDI']),
  class: z.number().min(1).max(12),
  stream: z.enum(['HUMANITIES', 'BIOLOGY', 'MATHEMATICS', 'COMMERCE']).optional(),
  subjects: z.array(z.string()).optional()
})

// Partial schema for profile updates
const PartialUserProfileSchema = UserProfileSchema.partial()

/**
 * GET /api/user/profile
 * Get current user's profile
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user profile from database
    const profile = await getUserProfile(userId)
    
    if (!profile) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Profile not found. Onboarding required.'
      })
    }

    return NextResponse.json({
      success: true,
      data: profile
    })

  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/profile
 * Create or update user profile (onboarding)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Validate profile data
    const validatedData = UserProfileSchema.parse(body)
    
    // Additional validation for stream requirement
    if (validatedData.class >= 11 && !validatedData.stream) {
      return NextResponse.json(
        { error: 'Stream is required for classes 11 and 12' },
        { status: 400 }
      )
    }

    // Create or update user profile
    const profile = await createOrUpdateUserProfile(userId, validatedData)
    
    // Log onboarding completion
    await logOnboardingCompletion(userId, validatedData)

    return NextResponse.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('Error updating user profile:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid profile data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/user/profile
 * Update specific profile fields
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    // Partial validation for updates
    const validatedData = PartialUserProfileSchema.parse(body)
    
    // Get existing profile
    const existingProfile = await getUserProfile(userId)
    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Profile not found. Please complete onboarding first.' },
        { status: 404 }
      )
    }

    // Merge with existing data
    const updatedData = { ...existingProfile, ...validatedData }
    
    // Validate stream requirement after merge
    if (updatedData.class >= 11 && !updatedData.stream) {
      return NextResponse.json(
        { error: 'Stream is required for classes 11 and 12' },
        { status: 400 }
      )
    }

    // Update profile
    const profile = await updateUserProfile(userId, validatedData)

    return NextResponse.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    })

  } catch (error) {
    console.error('Error updating user profile:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid profile data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions (these would typically be in separate service files)

async function getUserProfile(userId: string): Promise<EnhancedUserProfile | null> {
  // This would query your database
  // For demo purposes, we'll check if user has completed onboarding and return appropriate data

  console.log(`Fetching profile for user: ${userId}`)

  // In a real implementation, you would query your database here
  // For now, we'll simulate checking if the user has completed onboarding
  // by looking for any previous profile creation in the logs or creating a default one

  // Check if this user has completed onboarding (simulated)
  // In real implementation: SELECT * FROM user_profiles WHERE user_id = ?

  // For demo purposes, let's create a default profile for any authenticated user
  // This simulates a user who has completed onboarding
  const defaultProfile: EnhancedUserProfile = {
    userId: userId,
    clerkId: userId,
    role: 'student',
    board: 'CBSE',
    medium: 'ENGLISH',
    class: 10,
    subjects: ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi'],
    isOnboardingComplete: true,
    preferences: {
      language: 'english',
      learningStyle: 'visual',
      difficulty: 'medium'
    },
    subscription: {
      plan: 'starter',
      features: ['basic_materials', 'ai_tutor'],
      expiresAt: new Date('2024-12-31')
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }

  console.log(`Returning profile for user ${userId}:`, defaultProfile)
  return defaultProfile
}

async function createOrUpdateUserProfile(
  userId: string, 
  data: OnboardingFormData
): Promise<EnhancedUserProfile> {
  // This would create or update in your database
  // For demo purposes, returning mock data
  
  const profile: EnhancedUserProfile = {
    userId,
    clerkId: userId, // In real implementation, get from Clerk
    role: data.role,
    board: data.board,
    medium: data.medium,
    class: data.class,
    stream: data.stream,
    subjects: data.subjects || getDefaultSubjects(data.class, data.stream),
    isOnboardingComplete: true,
    preferences: {
      language: data.medium.toLowerCase(),
      learningStyle: 'visual',
      difficulty: 'medium'
    },
    subscription: {
      plan: 'starter',
      features: ['basic_materials', 'ai_tutor']
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }

  // In real implementation, save to database
  console.log('Creating/updating user profile:', profile)
  
  return profile
}

async function updateUserProfile(
  userId: string,
  updates: Partial<OnboardingFormData>
): Promise<EnhancedUserProfile> {
  // This would update specific fields in your database
  // For demo purposes, returning mock updated data
  
  const existingProfile = await getUserProfile(userId)
  if (!existingProfile) {
    throw new Error('Profile not found')
  }

  const updatedProfile: EnhancedUserProfile = {
    ...existingProfile,
    ...updates,
    updatedAt: new Date()
  }

  // In real implementation, save to database
  console.log('Updating user profile:', updatedProfile)
  
  return updatedProfile
}

async function logOnboardingCompletion(
  userId: string,
  profileData: OnboardingFormData
) {
  // Log onboarding completion for analytics
  console.log(`User ${userId} completed onboarding:`, {
    role: profileData.role,
    board: profileData.board,
    class: profileData.class,
    stream: profileData.stream,
    completedAt: new Date()
  })
}

function getDefaultSubjects(classLevel: number, stream?: string): string[] {
  // Return default subjects based on class and stream
  if (classLevel <= 10) {
    return ['Mathematics', 'Science', 'English', 'Social Science', 'Hindi']
  }

  switch (stream) {
    case 'MATHEMATICS':
      return ['Physics', 'Chemistry', 'Mathematics', 'English']
    case 'BIOLOGY':
      return ['Physics', 'Chemistry', 'Biology', 'English']
    case 'COMMERCE':
      return ['Accountancy', 'Business Studies', 'Economics', 'English']
    case 'HUMANITIES':
      return ['History', 'Geography', 'Political Science', 'English']
    default:
      return ['English']
  }
}
