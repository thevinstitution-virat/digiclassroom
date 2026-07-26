/**
 * AI Chat History API Route
 * Fetches user's conversation history across all 6 agent types
 * 
 * GET /api/ai/chat/history
 * - Fetches paginated conversation history for authenticated user
 * - Supports filtering by agent type
 * - Returns conversations with message counts and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { executeQuery } from '@/lib/db/connection';
import { safeJsonParse } from '@/lib/utils/jsonParse';

export const runtime = 'nodejs';

// Agent type mapping for display
const AGENT_DISPLAY_NAMES: Record<string, string> = {
  selfstudy_buddy: 'Selfstudy Buddy',  // New name
  homework_help: 'Selfstudy Buddy',     // Backward compatibility - shows as new name
  explain_topic: 'Deep Dive',
  exam_prep: 'Ace Your Exams',
  clear_doubts: 'Doubt Resolution',
  study_tips: 'Virat Insights',
  book_structure: "Let's Talk"
};

const AGENT_COLORS: Record<string, string> = {
  selfstudy_buddy: '#F97316', // Orange
  homework_help: '#F97316',   // Backward compatibility
  explain_topic: '#3B82F6', // Blue
  exam_prep: '#10B981', // Green
  clear_doubts: '#8B5CF6', // Purple
  study_tips: '#EC4899', // Pink
  book_structure: '#14B8A6' // Teal
};

const AGENT_ICONS: Record<string, string> = {
  selfstudy_buddy: 'PenTool',
  homework_help: 'PenTool',  // Backward compatibility
  explain_topic: 'Layers',
  exam_prep: 'Trophy',
  clear_doubts: 'CheckCircle',
  study_tips: 'Sparkles',
  book_structure: 'MessageCircle'
};

export async function GET(request: NextRequest) {
  try {
    // ============================================================================
    // STEP 1: AUTHENTICATION
    // ============================================================================
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        {
          error: 'AUTHENTICATION_REQUIRED',
          message: 'Please sign in to view chat history'
        },
        { status: 401 }
      );
    }

    // ============================================================================
    // STEP 2: PARSE QUERY PARAMETERS
    // ============================================================================
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const agentType = searchParams.get('agentType'); // Optional filter
    const offset = (page - 1) * limit;

    console.log(`📚 [Chat History] Fetching for user: ${userId}, page: ${page}, limit: ${limit}, agent: ${agentType || 'all'}`);

    // ============================================================================
    // STEP 3: BUILD QUERY
    // ============================================================================
    // Use subqueries to avoid GROUP BY issues with JSON columns
    let conversationsQuery = `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = c.id) as message_count,
        (SELECT MAX(timestamp) FROM chat_messages WHERE conversation_id = c.id) as last_message_at
      FROM conversations c
      WHERE c.user_id = ?
    `;

    const queryParams: any[] = [userId];

    // Add agent type filter if specified
    if (agentType && agentType !== 'all') {
      conversationsQuery += ` AND c.intent = ?`;
      queryParams.push(agentType);
    }

    // Note: LIMIT/OFFSET cannot be parameterized in MySQL prepared statements
    // We use hardcoded values (already validated as integers)
    conversationsQuery += `
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // ============================================================================
    // STEP 4: EXECUTE QUERY
    // ============================================================================
    const conversations = await executeQuery(conversationsQuery, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT c.id) as total
      FROM conversations c
      WHERE c.user_id = ?
    `;
    const countParams: any[] = [userId];

    if (agentType && agentType !== 'all') {
      countQuery += ` AND c.intent = ?`;
      countParams.push(agentType);
    }

    const [countResult] = await executeQuery(countQuery, countParams);
    const total = countResult?.total || 0;

    // ============================================================================
    // STEP 5: ENRICH CONVERSATION DATA
    // ============================================================================
    const enrichedConversations = conversations.map((conv: any) => {
      const agentIntent = conv.intent || 'general_help';

      return {
        id: conv.id,
        sessionId: conv.session_id,
        agentType: agentIntent,
        agentDisplayName: AGENT_DISPLAY_NAMES[agentIntent] || 'General Help',
        agentColor: AGENT_COLORS[agentIntent] || '#6B7280',
        agentIcon: AGENT_ICONS[agentIntent] || 'MessageSquare',
        topic: conv.topic,
        subject: conv.subject,
        classLevel: conv.class_level,
        status: conv.status,
        messageCount: conv.message_count || 0,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        lastMessageAt: conv.last_message_at || conv.updated_at,
        metadata: safeJsonParse(conv.metadata)
      };
    });

    // ============================================================================
    // STEP 6: RETURN RESPONSE
    // ============================================================================
    return NextResponse.json({
      success: true,
      conversations: enrichedConversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: offset + limit < total
      },
      filter: {
        agentType: agentType || 'all'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [Chat History] Error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch chat history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai/chat/history/[conversationId]
 * Fetch messages for a specific conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: 'AUTHENTICATION_REQUIRED' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'MISSING_CONVERSATION_ID' },
        { status: 400 }
      );
    }

    // Verify conversation belongs to user
    const [conversation] = await executeQuery(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );

    if (!conversation) {
      return NextResponse.json(
        { error: 'CONVERSATION_NOT_FOUND' },
        { status: 404 }
      );
    }

    // Fetch messages
    const messages = await executeQuery(
      `SELECT 
        id,
        message_type as role,
        content,
        metadata,
        rag_sources,
        timestamp,
        tokens_used,
        response_time_ms
      FROM chat_messages
      WHERE conversation_id = ?
      ORDER BY timestamp ASC`,
      [conversationId]
    );

    const enrichedMessages = messages.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      metadata: safeJsonParse(msg.metadata),
      sources: safeJsonParse(msg.rag_sources),
      tokensUsed: msg.tokens_used,
      responseTime: msg.response_time_ms
    }));

    return NextResponse.json({
      success: true,
      conversationId,
      messages: enrichedMessages,
      messageCount: enrichedMessages.length
    });

  } catch (error) {
    console.error('❌ [Chat History Messages] Error:', error);
    return NextResponse.json(
      {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch conversation messages'
      },
      { status: 500 }
    );
  }
}

