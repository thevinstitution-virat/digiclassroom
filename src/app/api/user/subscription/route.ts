/**
 * User Subscription API Endpoint
 * Provides subscription details and quota information for the authenticated user
 * 
 * Phase 3: API Route Protection
 * - GET: Fetch user subscription and quota details
 * - Used by frontend to display subscription status and remaining questions
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service';

/**
 * GET /api/user/subscription
 * Fetch user subscription details and daily quota
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { 
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Please sign in to view your subscription'
        },
        { status: 401 }
      );
    }
    
    console.log(`📊 Fetching subscription for user ${clerkId}`);
    
    // Get user subscription
    const subscription = await subscriptionValidationService.getUserSubscription(clerkId);
    
    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error: 'NO_SUBSCRIPTION',
          message: 'No active subscription or trial found. Please start your free trial.',
          data: null
        },
        { status: 404 }
      );
    }
    
    // Get daily quota status
    const quotaCheck = await subscriptionValidationService.canAskQuestion(clerkId);
    
    // Get available content based on subscription
    const availableBoards = await subscriptionValidationService.getAvailableBoards(clerkId);
    
    // Build response
    const response = {
      success: true,
      data: {
        // Subscription Details
        subscription: {
          id: subscription.id,
          plan_name: subscription.plan_name,
          plan_code: subscription.plan_code,
          subscription_type: subscription.subscription_type,
          subscription_status: subscription.subscription_status,
          
          // Access Details
          purchased_board: subscription.purchased_board,
          purchased_class: subscription.purchased_class,
          class_access_type: subscription.class_access_type,
          purchased_subjects: subscription.purchased_subjects,
          
          // Pricing
          monthly_price: subscription.monthly_price,
          billing_cycle: subscription.billing_cycle,
          
          // Dates
          start_date: subscription.start_date,
          expiry_date: subscription.expiry_date,
          next_billing_date: subscription.next_billing_date,
          
          // Payment
          payment_status: subscription.payment_status,
          auto_renew: subscription.auto_renew,
        },
        
        // Quota Information
        quota: {
          daily_limit: quotaCheck.limit,
          questions_asked: quotaCheck.limit - quotaCheck.remaining,
          questions_remaining: quotaCheck.remaining,
          can_ask_question: quotaCheck.allowed,
          message: quotaCheck.message,
          
          // Percentage used (for progress bars)
          percentage_used: Math.round(((quotaCheck.limit - quotaCheck.remaining) / quotaCheck.limit) * 100)
        },
        
        // Available Content
        access: {
          boards: availableBoards,
          has_full_access: subscription.purchased_board === 'ALL',
          has_all_classes: subscription.class_access_type === 'all',
          has_all_subjects: !subscription.purchased_subjects || subscription.purchased_subjects.length === 0
        },
        
        // Status Flags
        is_trial: subscription.subscription_status === 'trial',
        is_active: subscription.subscription_status === 'active',
        is_expired: subscription.subscription_status === 'expired',
        needs_upgrade: !quotaCheck.allowed || subscription.subscription_status === 'expired'
      }
    };
    
    console.log(`✅ Subscription fetched: ${subscription.plan_name} (${quotaCheck.remaining}/${quotaCheck.limit} remaining)`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch subscription details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/user/subscription/available-content
 * Fetch available boards, classes, and subjects for the user
 * Query params: ?board=CBSE&class=10
 */
export async function OPTIONS(request: NextRequest) {
  try {
    // Authentication check
    const { userId: clerkId } = await auth();
    
    if (!clerkId) {
      return NextResponse.json(
        { 
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Please sign in to view available content'
        },
        { status: 401 }
      );
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const board = searchParams.get('board');
    const classLevel = searchParams.get('class');
    
    console.log(`📚 Fetching available content for user ${clerkId}: board=${board}, class=${classLevel}`);
    
    // Get available boards
    const availableBoards = await subscriptionValidationService.getAvailableBoards(clerkId);
    
    // Get available classes (if board is specified)
    let availableClasses: number[] = [];
    if (board) {
      availableClasses = await subscriptionValidationService.getAvailableClasses(clerkId, board);
    }
    
    // Get available subjects (if board and class are specified)
    let availableSubjects: string[] = [];
    if (board && classLevel) {
      availableSubjects = await subscriptionValidationService.getAvailableSubjects(
        clerkId,
        board,
        parseInt(classLevel)
      );
    }
    
    const response = {
      success: true,
      data: {
        boards: availableBoards,
        classes: availableClasses,
        subjects: availableSubjects,
        
        // Metadata
        filters: {
          board: board || null,
          class: classLevel ? parseInt(classLevel) : null
        }
      }
    };
    
    console.log(`✅ Available content: ${availableBoards.length} boards, ${availableClasses.length} classes, ${availableSubjects.length} subjects`);
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('❌ Error fetching available content:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Failed to fetch available content',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

