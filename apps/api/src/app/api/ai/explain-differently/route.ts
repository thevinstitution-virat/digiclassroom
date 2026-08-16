/**
 * "Explain Differently" API Endpoint
 *
 * Re-explains an answer the tutor already produced using ONE vivid, relatable
 * analogy drawn from everyday Indian student life (cricket, kirana shops, local
 * trains, chai, festivals, the monsoon, pocket money, tiffin, …). It is
 * a pure transformation of text we already have, so — unlike the previous
 * implementation which POSTed a synthetic "Re-explain this…" prompt back through
 * /api/ai/chat — it deliberately skips RAG retrieval, premise validation and the
 * semantic cache. Those steps ran a nonsense query through the whole pipeline
 * (and could crash on the premise validator), which made the feature flaky.
 *
 * Mirrors the sibling single-purpose endpoints (translate, word-meanings,
 * generate-visual): authenticate, one focused LLM call, return JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { OpenAIService } from '@/lib/services/openai_service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExplainDifferentlyRequest {
  /** The concept / original student question. */
  query: string;
  /** The explanation the tutor already gave, which we now recast as an analogy. */
  answer: string;
  subject?: string;
  classLevel?: string;
  /** Student's medium — the analogy is written in this language. */
  medium?: 'ENGLISH' | 'HINDI';
  /**
   * How many times the student has already pressed the button for this answer.
   * Lets us ask for a genuinely different analogy each press instead of repeating.
   */
  attempt?: number;
}

// A rotating set of everyday-Indian domains to anchor the analogy in, so repeated
// presses ("Another Way") pull from a different corner of daily life each time.
const ANALOGY_DOMAINS = [
  'a neighbourhood kirana (grocery) shop, buying/selling, or haggling in a local market',
  'gully or stadium cricket — batting order, run rate, fielding, team selection',
  'a crowded local train or bus journey, tickets, and platforms',
  'sharing a tiffin, making chai, or splitting snacks among friends',
  'a family festival or wedding — preparations, guests, budgeting, and rituals',
  'the monsoon, farming, or a school playground game',
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ExplainDifferentlyRequest = await request.json();
    const { query, answer, subject, classLevel, medium, attempt } = body;

    if (!answer || !answer.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: answer' },
        { status: 400 }
      );
    }

    const domain = ANALOGY_DOMAINS[(attempt ?? 0) % ANALOGY_DOMAINS.length];
    const languageDirective =
      medium === 'HINDI'
        ? 'Write the whole explanation in Hindi (Devanagari script). Keep established technical/exam terms in English in brackets on first use.'
        : 'Write the whole explanation in clear, simple English suitable for an Indian school student.';

    const systemPrompt =
      'You are Virat, a warm Indian school teacher famous for making hard ideas click with ' +
      'a single well-chosen analogy from everyday Indian life. You never lecture; you paint one ' +
      'concrete, relatable picture and then connect it, piece by piece, back to the concept.';

    const userPrompt = [
      `A student for ${classLevel || 'school'} (${subject || 'general'}) was already given the explanation below,`,
      `but wants to understand it a different way — through a relatable Indian analogy.`,
      ``,
      `Original question: ${query || '(not provided)'}`,
      ``,
      `Explanation already given (do NOT repeat its wording, structure, or examples):`,
      `"""`,
      answer.slice(0, 4000),
      `"""`,
      ``,
      `Now re-explain the SAME idea using ONE vivid analogy anchored in ${domain}.`,
      `Structure it as:`,
      `1. Start with the analogy as a short, concrete little scene the student can picture.`,
      `2. Then map each important part of the analogy back to the actual concept, so the`,
      `   mapping is explicit ("the shopkeeper raising the price = …").`,
      `3. End with one sentence that states the concept plainly, now that it's intuitive.`,
      ``,
      `Keep it tight (about 150–250 words). Use simple Markdown. ${languageDirective}`,
    ].join('\n');

    console.log(
      `💡 [Explain Differently] subject=${subject} class=${classLevel} medium=${medium} attempt=${attempt ?? 0} domain="${domain}"`
    );

    const openai = OpenAIService.getInstance();
    const startTime = Date.now();
    const response = await openai.generateChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      // A touch of warmth for a vivid analogy, but not so high it drifts off-topic.
      temperature: 0.7,
      maxTokens: 900,
    });

    const explanation = response.text.trim();
    const duration = Date.now() - startTime;
    console.log(`✅ [Explain Differently] Completed in ${duration}ms (${explanation.length} chars)`);

    if (!explanation) {
      return NextResponse.json(
        { error: 'The tutor returned an empty explanation.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, explanation, domain, duration });
  } catch (error) {
    console.error('❌ [Explain Differently] Error:', error);
    return NextResponse.json(
      {
        error: 'Could not generate another explanation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
