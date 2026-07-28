/**
 * INTEGRATION EXAMPLE - How to use new services with existing API route
 * 
 * This file shows the MINIMAL changes needed to integrate new enterprise services
 * with your existing API route WITHOUT modifying agent code.
 * 
 * COPY the relevant sections to your existing route.ts file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { LegacyAgentAdapter } from './legacy-agent-adapter';

// ============================================================================
// OPTION 1: MINIMAL INTEGRATION (Recommended First Step)
// ============================================================================

/**
 * Add this ONE LINE at the start of your POST handler
 * This initializes new services but doesn't use them yet
 */
export async function POST_OPTION_1(req: NextRequest) {
  // Initialize new services (safe, idempotent, non-blocking)
  await LegacyAgentAdapter.initialize().catch(err => {
    console.warn('⚠️ New services failed to initialize, continuing with existing services:', err);
  });

  // Your existing code continues UNCHANGED...
  // const { userId: clerkId } = await auth()
  // ... rest of your existing code
}

// ============================================================================
// OPTION 2: ADD DATABASE CACHE (Optional Enhancement)
// ============================================================================

/**
 * Enhance your existing pre-generated answers cache with database-backed cache
 * Add this BEFORE your existing findPreGeneratedAnswer call
 */
export async function POST_OPTION_2_CACHE_ENHANCEMENT(req: NextRequest) {
  // ... your existing auth code ...

  const message = 'student question here'; // Your existing code
  const profile = { subject: 'Science', classLevel: 'Class 9', board: 'CBSE' }; // Your existing code

  // TRY NEW DATABASE CACHE FIRST (if available)
  try {
    const services = await LegacyAgentAdapter.getServices();
    const cachedAnswer = await services.preGenAnswers.findAnswer(message, {
      subject: profile.subject || '',
      class_level: profile.classLevel || '',
      board: profile.board || 'CBSE'
    });

    if (cachedAnswer) {
      console.log('✅ [NEW CACHE] Database cache HIT');
      
      // Track analytics (optional)
      await services.analytics.trackEvent({
        eventType: 'cache_hit',
        userId: 'user-id-here',
        metadata: { cacheType: 'database', subject: profile.subject },
        timestamp: new Date()
      });

      return NextResponse.json({
        response: cachedAnswer,
        cached: true,
        cacheType: 'database'
      });
    }
  } catch (error) {
    console.warn('⚠️ New cache lookup failed, falling back to existing cache:', error);
  }

  // FALL BACK TO YOUR EXISTING CACHE (unchanged)
  // const existingCached = await findPreGeneratedAnswer(message, { ... });
  // ... your existing code continues
}

// ============================================================================
// OPTION 3: ADD ANALYTICS TRACKING (Optional Enhancement)
// ============================================================================

/**
 * Track agent performance and user interactions
 * Add this AFTER your agent execution
 */
export async function POST_OPTION_3_ANALYTICS(req: NextRequest) {
  const startTime = Date.now();

  // ... your existing code ...
  // const response = await runTutorGraph({ ... });

  // TRACK ANALYTICS (optional)
  try {
    const services = await LegacyAgentAdapter.getServices();
    const duration = Date.now() - startTime;
    
    await services.analytics.trackEvent({
      eventType: 'chat_request',
      userId: 'user-id-here',
      metadata: {
        menuIntent: 'explain_topic',
        subject: 'Science',
        classLevel: 'Class 9',
        duration,
        cached: false
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.warn('⚠️ Analytics tracking failed:', error);
  }

  // return NextResponse.json(response);
}

// ============================================================================
// OPTION 4: USE NEW SERVICES IN EXISTING AGENTS (Future)
// ============================================================================

/**
 * Example: How to use new services inside your existing agent code
 * Add this to any existing agent file (e.g., homework_help_agent.ts)
 */
export async function AGENT_INTEGRATION_EXAMPLE() {
  // Inside your existing agent method:
  
  // Get new services
  const services = await LegacyAgentAdapter.getServices();
  
  // Use new cache
  const cached = await services.preGenAnswers.findAnswer('question', {
    subject: 'Science',
    class_level: 'Class 9',
    board: 'CBSE'
  });
  
  if (cached) {
    return cached; // Return cached answer
  }
  
  // Continue with existing logic...
  // const context = await this.vectorService.search(...);
  // ... your existing code
}

// ============================================================================
// COMPLETE EXAMPLE: Minimal Integration
// ============================================================================

/**
 * This is what your route.ts would look like with minimal integration
 */
export async function POST_COMPLETE_EXAMPLE(req: NextRequest) {
  // STEP 1: Initialize new services (ONE LINE ADDED)
  await LegacyAgentAdapter.initialize().catch(err => {
    console.warn('⚠️ New services initialization failed:', err);
  });

  try {
    // STEP 2: Your existing authentication (UNCHANGED)
    // const { userId: clerkId } = await auth()
    // if (!clerkId) { return ... }

    // STEP 3: Your existing request parsing (UNCHANGED)
    // const body = await req.json()
    // const message = body.message
    // const profile = { ... }

    // STEP 4: Your existing cache check (UNCHANGED)
    // const existingCached = await findPreGeneratedAnswer(message, profile)
    // if (existingCached) { return ... }

    // STEP 5: Your existing agent execution (UNCHANGED)
    // const response = await runTutorGraph({ ... })

    // STEP 6: Your existing response (UNCHANGED)
    // return NextResponse.json(response)

  } catch (error) {
    // Your existing error handling (UNCHANGED)
    // return NextResponse.json({ error: ... })
  }
}

