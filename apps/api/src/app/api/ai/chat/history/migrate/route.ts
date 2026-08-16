/**
 * Chat History Migration API
 * Runs the database migration to create conversations and chat_messages_history tables
 * 
 * POST /api/ai/chat/history/migrate
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { initializeMenuSystem } from '@/lib/db/menu-migrate';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Only allow authenticated users (could add admin check here)
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      );
    }

    console.log('🔄 Running chat history migration...');

    // Run the menu system initialization (includes migration)
    await initializeMenuSystem();

    return NextResponse.json({
      success: true,
      message: 'Chat history tables created successfully',
      tables: [
        'conversations',
        'chat_messages_history',
        'menu_selections',
        'user_preferences',
        'progress_logs',
        'analytics_events',
        'performance_metrics'
      ]
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json(
      {
        error: 'MIGRATION_FAILED',
        message: 'Failed to run chat history migration',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Chat History Migration Endpoint',
    usage: 'POST to this endpoint to run the migration',
    note: 'This will create the conversations and chat_messages_history tables if they do not exist'
  });
}

