/**
 * Streaming AI Chat API Endpoint
 * Provides real-time streaming responses with validation and fallback support
 *
 * Phase 3: API Route Protection
 * - Validates subscription access (board/class/subject)
 * - Checks daily question quota
 * - Increments question count
 * - Returns appropriate error responses
 */

import { auth } from '@/auth';
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { StreamingService, StreamingContext, StreamingConfig } from '@/lib/services/streaming_service';
import { LLMRequest } from '@/lib/services/streaming_service';
import { SourceChunk } from '@/lib/agents/source_validation';
import { VectorStoreService } from '@/lib/services/vector_store_service';
import { subscriptionValidationService } from '@/lib/services/subscription-validation-service';

interface StreamingChatRequest {
  message: string;
  context: {
    grade_level: number;
    subject: string;
    board_type: string;
    agent_type: string;
    bloom_level?: string;
    learning_style?: string;
  };
  conversation_history?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    modality?: 'text' | 'voice' | 'file';
  }>;
  streaming_config?: Partial<StreamingConfig>;
  session_metadata: {
    session_id: string;
    user_id: string;
  };
}

export async function POST(request: NextRequest) {
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
          message: 'Please sign in to use the AI Tutor'
        },
        { status: 401 }
      );
    }

    const body: StreamingChatRequest = await request.json();

    console.log(`🌊 Streaming chat request: ${body.message.substring(0, 50)}... for ${body.context.agent_type}`);

    // Validate request
    if (!body.message || !body.context || !body.session_metadata) {
      return NextResponse.json(
        { error: 'Missing required fields: message, context, or session_metadata' },
        { status: 400 }
      );
    }

    // ============================================================================
    // STEP 2: CHECK DAILY QUESTION QUOTA
    // ============================================================================
    const quotaCheck = await subscriptionValidationService.canAskQuestion(userId);

    if (!quotaCheck.allowed) {
      console.log(`❌ Quota exceeded for user ${userId}: ${quotaCheck.message}`);
      return NextResponse.json(
        {
          error: 'DAILY_LIMIT_EXCEEDED',
          message: quotaCheck.message || 'You have reached your daily question limit',
          remaining: 0,
          limit: quotaCheck.limit,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 429 }
      );
    }

    console.log(`✅ Quota check passed: ${quotaCheck.remaining}/${quotaCheck.limit} remaining`);

    // ============================================================================
    // STEP 3: VALIDATE BOARD ACCESS
    // ============================================================================
    const hasBoardAccess = await subscriptionValidationService.hasAccessToBoard(
      userId,
      body.context.board_type
    );

    if (!hasBoardAccess) {
      console.log(`❌ Board access denied for user ${userId}: ${body.context.board_type}`);
      return NextResponse.json(
        {
          error: 'BOARD_ACCESS_DENIED',
          message: `You don't have access to ${body.context.board_type} board. Please upgrade your subscription.`,
          board: body.context.board_type,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 403 }
      );
    }

    // ============================================================================
    // STEP 4: VALIDATE CLASS ACCESS
    // ============================================================================
    const hasClassAccess = await subscriptionValidationService.hasAccessToClass(
      userId,
      body.context.board_type,
      body.context.grade_level
    );

    if (!hasClassAccess) {
      console.log(`❌ Class access denied for user ${userId}: Class ${body.context.grade_level}`);
      return NextResponse.json(
        {
          error: 'CLASS_ACCESS_DENIED',
          message: `You don't have access to Class ${body.context.grade_level}. Please upgrade your subscription.`,
          board: body.context.board_type,
          class: body.context.grade_level,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 403 }
      );
    }

    // ============================================================================
    // STEP 5: VALIDATE SUBJECT ACCESS
    // ============================================================================
    const hasSubjectAccess = await subscriptionValidationService.hasAccessToSubject(
      userId,
      body.context.board_type,
      body.context.grade_level,
      body.context.subject
    );

    if (!hasSubjectAccess) {
      console.log(`❌ Subject access denied for user ${userId}: ${body.context.subject}`);
      return NextResponse.json(
        {
          error: 'SUBJECT_ACCESS_DENIED',
          message: `You don't have access to ${body.context.subject}. Please upgrade your subscription.`,
          board: body.context.board_type,
          class: body.context.grade_level,
          subject: body.context.subject,
          upgradeUrl: '/dashboard/user/upgrade'
        },
        { status: 403 }
      );
    }

    console.log(`✅ Access validation passed: ${body.context.board_type} / Class ${body.context.grade_level} / ${body.context.subject}`);

    // Initialize services
    const streamingService = new StreamingService(body.streaming_config);
    const vectorStoreService = new VectorStoreService();

    // Retrieve relevant textbook content
    const searchResponse = await vectorStoreService.search_relevant_content({
      query: body.message,
      grade_level: body.context.grade_level,
      subject: body.context.subject,
      board_type: body.context.board_type as any,
      limit: 5,
      content_types: ['text', 'examples', 'definitions'],
      cognitive_level: body.context.bloom_level || 'understand'
    });

    // Convert to SourceChunk format
    const sourceChunks: SourceChunk[] = searchResponse.results.map(result => ({
      content: result.text,
      source: result.metadata.source,
      chapter: result.metadata.chapter,
      page: result.metadata.page,
      section: result.metadata.content_type,
      confidence_score: result.score
    }));

    // Build streaming context
    const streamingContext: StreamingContext = {
      conversation_history: body.conversation_history || [],
      source_chunks: sourceChunks,
      student_context: {
        grade_level: body.context.grade_level,
        subject: body.context.subject,
        board_type: body.context.board_type,
        learning_style: body.context.learning_style
      },
      session_metadata: {
        session_id: body.session_metadata.session_id,
        user_id: body.session_metadata.user_id,
        agent_type: body.context.agent_type,
        bloom_level: body.context.bloom_level || 'understand'
      }
    };

    // Build LLM request
    const llmRequest: LLMRequest = {
      model_type: 'openai',
      prompt: buildConstrainedPrompt(body.message, body.context, sourceChunks),
      temperature: getTemperatureForAgent(body.context.agent_type),
      max_tokens: 800,
      system_prompt: buildSystemPrompt(body.context)
    };

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const streamGenerator = await streamingService.generateStreamingResponse(
            llmRequest,
            streamingContext,
            body.streaming_config
          );

          // Stream chunks
          for await (const chunk of streamGenerator) {
            const chunkData = {
              type: 'chunk',
              data: chunk
            };

            const chunkText = `data: ${JSON.stringify(chunkData)}\n\n`;
            controller.enqueue(encoder.encode(chunkText));
          }

          // Send final result
        // @ts-ignore
          const finalResult = await streamGenerator.return();
          if (finalResult.value) {
            const finalData = {
              type: 'final',
              data: finalResult.value
            };

            const finalText = `data: ${JSON.stringify(finalData)}\n\n`;
            controller.enqueue(encoder.encode(finalText));
          }

          // ============================================================================
          // STEP 6: INCREMENT QUESTION COUNT (After successful response)
          // ============================================================================
          try {
            await subscriptionValidationService.incrementQuestionCount(userId, userId, {
              subject: body.context.subject,
              board: body.context.board_type,
              class: body.context.grade_level.toString(),
              menu_type: body.context.agent_type,
              timestamp: new Date().toISOString()
            });
            console.log(`✅ Question count incremented for user ${userId}`);
          } catch (error) {
            console.error('❌ Failed to increment question count:', error);
            // Don't fail the request if quota increment fails
          }

          // End stream
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();

        } catch (error) {
          console.error('❌ Streaming error:', error);

          const errorData = {
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown streaming error',
              timestamp: Date.now()
            }
          };

          const errorText = `data: ${JSON.stringify(errorData)}\n\n`;
          controller.enqueue(encoder.encode(errorText));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('❌ Streaming API Error:', error);
    return NextResponse.json(
      {
        error: 'Streaming service error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function buildConstrainedPrompt(
  message: string,
  context: StreamingChatRequest['context'],
  sourceChunks: SourceChunk[]
): string {
  const contextText = sourceChunks.map((chunk, index) => {
    const citation = buildCitation(chunk);
    return `Source ${index + 1}: ${chunk.content} ${citation}`;
  }).join('\n\n---\n\n');

  return `You are a ${context.agent_type} for Class ${context.grade_level}, Subject ${context.subject}, Board ${context.board_type}.

STRICT TEXTBOOK FIDELITY REQUIREMENTS:
- Use ONLY the provided textbook excerpts below
- Every statement must be verified (≥85% similarity per sentence; overall ≥95%)
- Cite every fact as [Textbook, Ch X, Pg Y]
- If textbook content is insufficient, state this clearly

EDUCATIONAL CONTEXT:
- Bloom's Taxonomy Level: ${context.bloom_level || 'Understand'}
- Grade Level: Class ${context.grade_level}
- Subject: ${context.subject}
- Board: ${context.board_type}

GLOBAL NEUTRALITY:
- Do NOT use any cultural, religious, or region-specific references
- Provide only universal, globally applicable examples
- Use age-appropriate language for Class ${context.grade_level}

TEXTBOOK EXCERPTS:
${contextText}

STUDENT QUESTION: ${message}

RESPONSE REQUIREMENTS:
- Maintain 95%+ fidelity to source material
- Include proper citations for every statement
- Stream response in natural, conversational chunks
- If information is missing, state: "Textbook content insufficient; available info: [brief summary]"

Answer:`;
}

function buildSystemPrompt(context: StreamingChatRequest['context']): string {
  return `You are an expert AI tutor for ${context.board_type} curriculum.

CORE PRINCIPLES:
- Maintain 100% fidelity to textbook content
- Use only information from provided textbook excerpts
- Include proper citations for every statement
- Do NOT include any cultural, religious, or region-specific references unless the user explicitly requests them
- Use age-appropriate language for Class ${context.grade_level}
- Stream responses in natural, conversational chunks

FORBIDDEN ACTIONS:
- Adding external knowledge not in textbooks
- Making assumptions beyond source material
- Providing general explanations without textbook backing
- Omitting required citations

Remember: You are helping a Class ${context.grade_level} student with ${context.subject} using ONLY their textbook content.`;
}

function buildCitation(chunk: SourceChunk): string {
  const parts: string[] = [];
  if (chunk.chapter) parts.push(`Ch ${chunk.chapter}`);
  if (chunk.page) parts.push(`Pg ${chunk.page}`);
  if (chunk.section) parts.push(`Section: ${chunk.section}`);

  if (parts.length === 0) {
    parts.push(chunk.source || 'NCERT Textbook');
  }

  return `[${parts.join(', ')}]`;
}

function getTemperatureForAgent(agentType: string): number {
  const temperatureMap: Record<string, number> = {
    'homework_help': 0.4,
    'explain_topic': 0.4,
    'exam_prep': 0.2,
    'doubt_clearing': 0.3,
    'study_tips': 0.5
  };

  return temperatureMap[agentType] || 0.4;
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
