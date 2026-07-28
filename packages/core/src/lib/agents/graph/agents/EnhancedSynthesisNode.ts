/**
 * Enhanced Synthesis Node — LangGraph migration of enhanced_synthesis_agent.ts
 *
 * Domain intelligence preserved:
 * 1. Textbook-only content generation with STRICT constraints
 * 2. No general knowledge, no external examples — textbook content ONLY
 * 3. Every statement requires [Source: Page X, Chapter Y] citation
 * 4. Grade-appropriate language matching textbook style
 * 5. If insufficient textbook content, honestly state what IS available
 * 6. Forbidden: adding general knowledge, creating new examples, assumptions
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLangChainModel, getActiveProviderName } from '@/lib/llm/LangChainModelFactory';
import type { TutorState } from "../TutorGraphState";
import { isNCERTCitation } from "@/types/citations";

const llm = getLangChainModel({ temperature: 0.1 });

const SYNTHESIS_PROMPT = `You are a strict textbook content curator for CBSE {subject} curriculum, Class {grade}.

CORE PRINCIPLES:
- Extract and reorganize textbook content ONLY
- Never add information beyond source material
- Maintain educational accuracy and grade-appropriate language
- Provide clear source citations for every statement

STRICT RULES (VIOLATION = REJECTION):
1. Use ONLY information explicitly present in the textbook excerpts below
2. Do NOT add any general knowledge or explanations not in the text
3. Do NOT create examples unless they are directly from the textbook
4. Start each major point with content directly from the textbook
5. End each statement with [Source: Page X, Chapter Y] citation
6. If textbook content is insufficient, state exactly what IS available

TEXTBOOK CONTENT:
{context}

FORBIDDEN ACTIONS:
- Adding general knowledge not in textbooks
- Creating new examples or analogies
- Using external information or common knowledge
- Generating content without source backing

QUESTION: {question}`;

export async function enhancedSynthesisNode(state: TutorState): Promise<Partial<TutorState>> {
    const startTime = Date.now();
    const llm = getLangChainModel({ temperature: 0.1, providerOverride: state.providerVariant });
    const query = state.messages.at(-1)?.content as string ?? '';

    const ncertCitations = state.citations.filter(isNCERTCitation);
    const contextText = ncertCitations.map((c, i) =>
        `--- Source ${i + 1} ---\nChapter: ${c.chapter}\nPage: ${c.pageNumber}\nContent: ${c.contentExcerpt}\n`
    ).join('\n');

    const systemPromptContent = SYNTHESIS_PROMPT
        .replace(/{context}/g, contextText || 'No textbook content available.')
        .replace(/{grade}/g, String(state.grade))
        .replace(/{subject}/g, state.subject || 'General')
        .replace(/{question}/g, query);

    const messages = [
        new SystemMessage(systemPromptContent),
        ...state.messages
    ];

    const start = Date.now();
    const response = await llm.invoke(messages);
    const content = response.content.toString();

    const usageMeta = response.usage_metadata;
    const tokenUsage = usageMeta ? {
        promptTokens: usageMeta.input_tokens ?? 0,
        completionTokens: usageMeta.output_tokens ?? 0,
        totalTokens: (usageMeta.input_tokens ?? 0) + (usageMeta.output_tokens ?? 0),
    } : null;

    return {
        rawResponse: content,
        generationTimeMs: Date.now() - start,
        tokenUsage: tokenUsage || undefined,
        confidenceScore: content.length > 100 ? 0.93 : 0.7,
    };
}
