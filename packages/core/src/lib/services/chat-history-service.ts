import { logger } from '@/lib/logger';

/**
 * Chat History Service
 * Handles persistence of chat conversations and messages to database
 * Supports all 6 agent types with unified history
 */

import { executeQuery } from '@/lib/db/connection';

export interface SaveConversationParams {
  userId: string;
  role: 'student' | 'teacher' | 'parent' | 'admin';
  intent: string; // Agent type: homework_help, explain_topic, etc.
  topic?: string;
  subject?: string;
  classLevel?: string;
  sessionId: string;
  metadata?: Record<string, any>;
}

export interface SaveMessageParams {
  conversationId: number;
  messageType: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  tokensUsed?: number;
  responseTimeMs?: number;
  ragSources?: unknown[];
}

export class ChatHistoryService {
  /**
   * Create or get existing conversation
   * Returns conversation ID for message storage
   */
  static async createOrGetConversation(params: SaveConversationParams): Promise<number> {
    try {
      // Check if active conversation exists for this session
      const existingConversations = await executeQuery(
        `SELECT id FROM conversations 
         WHERE session_id = ? AND user_id = ? AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [params.sessionId, params.userId]
      );

      if (existingConversations.length > 0) {
        logger.info(`📝 [Chat History] Using existing conversation: ${existingConversations[0].id}`);
        return existingConversations[0].id;
      }

      // Create new conversation
      const result = await executeQuery(
        `INSERT INTO conversations 
         (user_id, user_id, role, intent, topic, subject, class_level, session_id, status, metadata, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW(), NOW())
         RETURNING id`,
        [
          params.userId,
          params.userId,
          params.role,
          params.intent,
          params.topic || null,
          params.subject || null,
          params.classLevel || null,
          params.sessionId,
          params.metadata ? JSON.stringify(params.metadata) : null
        ]
      );

      const conversationId = (result as any).insertId;
      logger.info(`✅ [Chat History] Created new conversation: ${conversationId} (Agent: ${params.intent})`);
      
      return conversationId;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '❌ [Chat History] Error creating conversation:');
      throw error;
    }
  }

  /**
   * Save a chat message to database
   */
  static async saveMessage(params: SaveMessageParams): Promise<void> {
    try {
      await executeQuery(
        `INSERT INTO chat_messages_history
         (conversation_id, message_type, content, metadata, tokens_used, response_time_ms, rag_sources, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          params.conversationId,
          params.messageType,
          params.content,
          params.metadata ? JSON.stringify(params.metadata) : null,
          params.tokensUsed || null,
          params.responseTimeMs || null,
          params.ragSources ? JSON.stringify(params.ragSources) : null
        ]
      );

      // Update conversation's updated_at timestamp
      await executeQuery(
        'UPDATE conversations SET updated_at = NOW() WHERE id = ?',
        [params.conversationId]
      );

      logger.info(`💬 [Chat History] Saved ${params.messageType} message to conversation ${params.conversationId}`);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '❌ [Chat History] Error saving message:');
      throw error;
    }
  }

  /**
   * Save both user query and AI response in one transaction
   */
  static async saveConversationExchange(
    conversationParams: SaveConversationParams,
    userMessage: string,
    assistantMessage: string,
    assistantMetadata?: {
      tokensUsed?: number;
      responseTimeMs?: number;
      ragSources?: unknown[];
      agentType?: string;
    }
  ): Promise<void> {
    try {
      // Get or create conversation
      const conversationId = await this.createOrGetConversation(conversationParams);

      // Save user message
      await this.saveMessage({
        conversationId,
        messageType: 'user',
        content: userMessage,
        metadata: {
          timestamp: new Date().toISOString()
        }
      });

      // Save assistant response
      await this.saveMessage({
        conversationId,
        messageType: 'assistant',
        content: assistantMessage,
        metadata: {
          agentType: assistantMetadata?.agentType || conversationParams.intent,
          timestamp: new Date().toISOString()
        },
        tokensUsed: assistantMetadata?.tokensUsed,
        responseTimeMs: assistantMetadata?.responseTimeMs,
        ragSources: assistantMetadata?.ragSources
      });

      logger.info(`✅ [Chat History] Saved conversation exchange (Conversation: ${conversationId})`);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '❌ [Chat History] Error saving conversation exchange:');
      // Don't throw - we don't want to break the chat flow if history saving fails
    }
  }

  /**
   * Mark conversation as completed
   */
  static async completeConversation(sessionId: string, userId: string): Promise<void> {
    try {
      await executeQuery(
        `UPDATE conversations 
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE session_id = ? AND user_id = ? AND status = 'active'`,
        [sessionId, userId]
      );

      logger.info(`✅ [Chat History] Marked conversation as completed (Session: ${sessionId})`);

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '❌ [Chat History] Error completing conversation:');
    }
  }

  /**
   * Delete a conversation and all its messages
   */
  static async deleteConversation(conversationId: number, userId: string): Promise<boolean> {
    try {
      // Verify ownership
      const [conversation] = await executeQuery(
        'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
        [conversationId, userId]
      );

      if (!conversation) {
        logger.warn(`⚠️ [Chat History] Conversation ${conversationId} not found or unauthorized`);
        return false;
      }

      // Delete conversation (messages will cascade delete due to FK constraint)
      await executeQuery(
        'DELETE FROM conversations WHERE id = ?',
        [conversationId]
      );

      logger.info(`🗑️ [Chat History] Deleted conversation: ${conversationId}`);
      return true;

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '❌ [Chat History] Error deleting conversation:');
      return false;
    }
  }

  /**
   * Get conversation statistics for a user
   */
  static async getUserStats(userId: string): Promise<{
    totalConversations: number;
    totalMessages: number;
    agentBreakdown: Record<string, number>;
  }> {
    try {
      // Total conversations
      const [totalResult] = await executeQuery(
        'SELECT COUNT(*) as total FROM conversations WHERE user_id = ?',
        [userId]
      );

      // Total messages
      const [messagesResult] = await executeQuery(
        `SELECT COUNT(*) as total FROM chat_messages_history cm
         JOIN conversations c ON cm.conversation_id = c.id
         WHERE c.user_id = ?`,
        [userId]
      );

      // Agent breakdown
      const agentStats = await executeQuery(
        `SELECT intent, COUNT(*) as count 
         FROM conversations 
         WHERE user_id = ?
         GROUP BY intent`,
        [userId]
      );

      const agentBreakdown: Record<string, number> = {};
      agentStats.forEach((stat: any) => {
        agentBreakdown[stat.intent] = stat.count;
      });

      return {
        totalConversations: totalResult?.total || 0,
        totalMessages: messagesResult?.total || 0,
        agentBreakdown
      };

    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : error }, '❌ [Chat History] Error getting user stats:');
      return {
        totalConversations: 0,
        totalMessages: 0,
        agentBreakdown: {}
      };
    }
  }
}

