/**
 * AI Chat API Route - Enterprise Architecture
 * Handles all AI tutor requests with proper middleware, orchestration, and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeApplication, getOrchestrator, getContainer } from '@/lib/bootstrap/app-initializer';
import { SERVICE_NAMES } from '@/lib/di/service-registry';
import type { IUserService, IAnalyticsService } from '@/lib/services/interfaces';
import type { OrchestrationRequest } from '@/lib/orchestration/agent-orchestrator';

/**
 * POST /api/ai/chat
 * Main endpoint for AI tutor interactions
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  console.log(`📨 [${requestId}] Incoming request`);

  try {
    // 1. Initialize application (idempotent - only runs once)
    await initializeApplication();

    // 2. Parse request body
    const body = await req.json() as Record<string, unknown>;
    const {
      query,
      subject,
      classLevel,
      board = 'cbse',
      userId,
      menuIntent,
      conversationHistory = [],
      streaming = true
    } = body;

    // 3. Validate required fields
    if (!query || !subject || !classLevel || !userId || !menuIntent) {
      return NextResponse.json(
        { error: 'Missing required fields: query, subject, classLevel, userId, menuIntent' },
        { status: 400 }
      );
    }

    // 4. Get services from container
    const container = getContainer();
    const userService = await container.resolve<IUserService>(SERVICE_NAMES.USER);
    const analyticsService = await container.resolve<IAnalyticsService>(SERVICE_NAMES.ANALYTICS);

    // 5. Validate user access and quota
        // @ts-ignore
    const userContext = await userService.getUserContext(userId);
    
    if (!userContext.subscription.isActive) {
      return NextResponse.json(
        { error: 'No active subscription' },
        { status: 403 }
      );
    }

        // @ts-ignore
    const quotaCheck = await userService.checkQuota(userId);
    if (!quotaCheck.allowed) {
      return NextResponse.json(
        { error: 'Quota exceeded', remaining: quotaCheck.remaining },
        { status: 429 }
      );
    }

    // 6. Validate access to subject/class
        // @ts-ignore
    const hasAccess = await userService.validateAccess(userId, board, classLevel, subject);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this subject/class' },
        { status: 403 }
      );
    }

    // 7. Build orchestration request
    const orchestrationRequest: OrchestrationRequest = {
        // @ts-ignore
      query,
        // @ts-ignore
      subject,
        // @ts-ignore
      classLevel,
        // @ts-ignore
      board,
        // @ts-ignore
      userId,
        // @ts-ignore
      menuIntent,
        // @ts-ignore
      conversationHistory,
        // @ts-ignore
      streaming
    };

    // 8. Execute via orchestrator
    const orchestrator = getOrchestrator();
    const result = await orchestrator.execute(orchestrationRequest);

    // 9. Increment user quota
        // @ts-ignore
    await userService.incrementQuota(userId);

    // 10. Track analytics
    const duration = Date.now() - startTime;
    await analyticsService.trackEvent({
      eventType: 'chat_request',
        // @ts-ignore
      userId,
      metadata: {
        menuIntent,
        subject,
        classLevel,
        agentUsed: result.agentUsed,
        fallbackUsed: result.fallbackUsed,
        duration
      },
      timestamp: new Date()
    });

    // 11. Return response
    if (streaming && 'stream' in result.response) {
      // Streaming response
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
        // @ts-ignore
              for await (const chunk of result.response.stream) {
                controller.enqueue(new TextEncoder().encode(chunk));
              }
              controller.close();
            } catch (error) {
              console.error(`❌ [${requestId}] Streaming error:`, error);
              controller.error(error);
            }
          }
        }),
        {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Agent-Used': result.agentUsed,
            'X-Request-Id': requestId,
            'X-Duration-Ms': duration.toString()
          }
        }
      );
    }

    // Non-streaming response
    return NextResponse.json({
        // @ts-ignore
      content: result.response.content,
      metadata: result.response.metadata,
      requestId,
      duration
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Request failed:`, error);

    // Track error
    try {
      const container = getContainer();
      const analyticsService = await container.resolve<IAnalyticsService>(SERVICE_NAMES.ANALYTICS);
      await analyticsService.trackEvent({
        eventType: 'chat_error',
        userId: 'unknown',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId
        },
        timestamp: new Date()
      });
    } catch (analyticsError) {
      console.error('Failed to track error:', analyticsError);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        requestId,
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat
 * Health check endpoint
 */
export async function GET() {
  try {
    await initializeApplication();
    const orchestrator = getOrchestrator();
    
    const agents = orchestrator.getRegisteredAgents();
    const agentHealth = await orchestrator.healthCheck();

    return NextResponse.json({
      status: 'healthy',
      agents,
      health: agentHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}

