/**
 * Chat History Save API
 * Saves conversation exchanges to database
 * 
 * POST /api/ai/chat/history/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { ChatHistoryService } from '@/lib/services/chat-history-service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const sessionUserId = session?.user?.id;
    if (!sessionUserId) {
      return NextResponse.json(
        { error: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      userId,
      role,
      intent,
      topic,
      subject,
      classLevel,
      sessionId,
      metadata,
      userMessage,
      assistantMessage,
      assistantMetadata
    } = body;

    // Validate required fields
    if (!userId || !role || !intent || !sessionId || !userMessage || !assistantMessage) {
      return NextResponse.json(
        { error: 'MISSING_REQUIRED_FIELDS' },
        { status: 400 }
      );
    }

    // Verify user matches authenticated user
    if (userId !== sessionUserId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // Save conversation exchange
    await ChatHistoryService.saveConversationExchange(
      {
        userId,
        // @ts-ignore
        userId,
        role,
        intent,
        topic,
        subject,
        classLevel,
        sessionId,
        metadata
      },
      userMessage,
      assistantMessage,
      assistantMetadata
    );

    return NextResponse.json({
      success: true,
      message: 'Conversation saved successfully'
    });

  } catch (error) {
    console.error('❌ [Chat History Save] Error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to save conversation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

