import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { aiWritingAssistant } from '@/lib/services/ai-writing-assistant';

/**
 * POST /api/ai-writing
 * AI Writing Assistant endpoint for proofread, rewrite, summarize, and generate questions
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as Record<string, unknown>;
    const { action, content, variant, length, count } = body;

    if (!action || !content) {
      return NextResponse.json(
        { error: 'Action and content are required' },
        { status: 400 }
      );
    }

    console.log(`🤖 AI Writing Assistant - Action: ${action}, User: ${userId}`);

    let result;

    switch (action) {
      case 'proofread':
        result = await aiWritingAssistant.proofread(content);
        break;

      case 'rewrite':
        if (!variant) {
          return NextResponse.json(
            { error: 'Variant is required for rewrite action' },
            { status: 400 }
          );
        }
        result = await aiWritingAssistant.rewrite(content, variant);
        break;

      case 'summarize':
        result = await aiWritingAssistant.summarize(content, length || 'medium');
        break;

      case 'generate-questions':
        result = { questions: await aiWritingAssistant.generateQuestions(content, count || 5) };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be: proofread, rewrite, summarize, or generate-questions' },
          { status: 400 }
        );
    }

    console.log(`✅ AI Writing Assistant - Action completed: ${action}`);

    return NextResponse.json({ success: true, result }, { status: 200 });
  } catch (error) {
    console.error('❌ Error in AI Writing Assistant:', error);
    return NextResponse.json(
      { error: 'Failed to process AI writing request', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

