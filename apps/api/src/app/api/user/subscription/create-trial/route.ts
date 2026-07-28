import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { db } from '@/db'
import { user, userSubscriptions, enhancedUserProfiles, subscriptionPlans, freeTrials } from '@/db/schema'
import { eq, and, gt, inArray } from 'drizzle-orm'

/**
 * POST /api/user/subscription/create-trial
 * Create a personalized free trial subscription based on user's onboarding profile.
 *
 * Migrated to Drizzle ORM (Phase 4).
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log(`🎁 Creating personalized free trial for user ${userId}`)

    // Pre-flight: verify user exists in auth system
    const [authUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'User not found in auth system' },
        { status: 404 }
      )
    }

    // Check if user already has an active subscription
    const [existingSubscription] = await db
      .select({
        id: userSubscriptions.id,
        planCode: userSubscriptions.planCode,
        subscriptionStatus: userSubscriptions.subscriptionStatus
      })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          inArray(userSubscriptions.subscriptionStatus, ['active', 'trial']),
          gt(userSubscriptions.expiryDate, new Date())
        )
      )
      .limit(1)

    if (existingSubscription) {
      console.log(`⚠️ User ${userId} already has an active subscription`)
      return NextResponse.json({
        success: true,
        message: 'User already has an active subscription',
        data: {
          subscription_id: existingSubscription.id,
          plan_code: existingSubscription.planCode,
          status: existingSubscription.subscriptionStatus
        }
      })
    }

    // Get user profile for personalized trial
    const [userProfile] = await db
      .select()
      .from(enhancedUserProfiles)
      .where(eq(enhancedUserProfiles.userId, userId))
      .limit(1)

    if (!userProfile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found. Please complete onboarding first.' },
        { status: 404 }
      )
    }

    // Find or auto-create FREE_TRIAL plan
    let [trialPlan] = await db
      .select()
      .from(subscriptionPlans)
      .where(
        and(
          eq(subscriptionPlans.planCode, 'FREE_TRIAL'),
          eq(subscriptionPlans.isActive, true)
        )
      )
      .limit(1)

    if (!trialPlan) {
      console.log('📝 Auto-creating FREE_TRIAL plan...')
      await db.insert(subscriptionPlans).values({
        planCode: 'FREE_TRIAL',
        planName: 'Free Trial',
        planType: 'free_trial',
        board: 'ALL',
        classAccessType: 'single',
        dailyQuestionLimit: 30,
        monthlyPrice: '0',
        displayName: 'Free Trial',
        description: '30 questions total for your selected board and class. Valid for 7 days.',
        isActive: true,
      })

      const [created] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.planCode, 'FREE_TRIAL'))
        .limit(1)
      trialPlan = created
    }

    if (!trialPlan) {
      throw new Error('Failed to create or retrieve trial plan')
    }

    // Calculate expiry (7 days)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + 7)

    // Prepare subjects JSON
    let purchasedSubjects: any = null
    if (userProfile.subjects) {
      if (typeof userProfile.subjects === 'string') {
        try {
          purchasedSubjects = JSON.parse(userProfile.subjects)
        } catch {
          purchasedSubjects = (userProfile.subjects as string).split(',').map((s: string) => s.trim())
        }
      } else {
        purchasedSubjects = userProfile.subjects
      }
    }

    const purchasedBoard = userProfile.boardType || 'CBSE'

    console.log(`📝 Inserting subscription: board=${purchasedBoard}, class=${userProfile.gradeLevel}`)

    // Create subscription via Drizzle
    await db.insert(userSubscriptions).values({
      userId,
      clerkId: userId,
      subscriptionPlanId: trialPlan.id,
      subscriptionType: 'free_trial',
      subscriptionStatus: 'trial',
      purchasedBoard: purchasedBoard,
      purchasedClass: userProfile.gradeLevel,
      classAccessType: 'single',
      purchasedSubjects: purchasedSubjects,
      planName: trialPlan.planName,
      planCode: trialPlan.planCode,
      monthlyPrice: '0',
      billingCycle: 'monthly',
      dailyQuestionLimit: 30,
      startDate: new Date(),
      expiryDate,
      paymentStatus: 'paid',
    })

    // Create free trial tracking record
    await db.insert(freeTrials).values({
      userId,
      trialStart: new Date(),
      trialEnd: expiryDate,
      isConverted: false,
    })

    console.log(`✅ Free trial created for user ${userId}`)
    console.log(`   Board: ${purchasedBoard}, Class: ${userProfile.gradeLevel}`)
    console.log(`   Valid for 7 days, 30 questions total`)

    return NextResponse.json({
      success: true,
      message: 'Free trial subscription created successfully',
      data: {
        plan_code: trialPlan.planCode,
        plan_name: trialPlan.planName,
        status: 'trial',
        daily_limit: 30,
        expiry_date: expiryDate,
        trial_days: 7,
        board: purchasedBoard,
        class_level: userProfile.gradeLevel,
      }
    })

  } catch (error: unknown) {
    const err = error as any;
    console.error('❌ Error creating free trial:', err?.message || err)
    console.error('❌ Details:', JSON.stringify({
      code: err?.code,
      detail: err?.detail,
      constraint: err?.constraint,
      severity: err?.severity,
    }, null, 2))

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create free trial subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
