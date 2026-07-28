/**
 * Domain intelligence preserved from legacy cbse-answer-formatter.ts:
 * 1. CBSE answer structure: numbered points, key terms bolded
 * 2. Marks-aware formatting (1-mark = 1 line, 3-mark = 3 points, 5-mark = paragraph)
 * 3. Diagrams/figures referenced by label (Fig. 1.1 format)
 * 4. Includes introduction and conclusion based on mark weights
 * 5. Formatting generated dynamically according to exam guidelines
 */

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLangChainModel, getActiveProviderName } from '@/lib/llm/LangChainModelFactory';
import type { TutorState } from "../TutorGraphState";
import { isNCERTCitation } from "@/types/citations";

const llm = getLangChainModel({ temperature: 0.1 });

const CBSE_FORMATTER_PROMPT = `You are a CBSE Board Exam Evaluator and Answer Formatter.
Your task is to provide the perfect model answer for the student's question perfectly adhering to the CBSE Marking Scheme.

DOMAIN INTELLIGENCE TO PRESERVE STRICTLY:
1. Determine the "marks" implied by the student's query (default to 3 marks if unspecified).
2. FORMATTING RULES BASED ON MARKS:
   - 1-mark: Direct answer only (1 line/sentence). No elaboration.
   - 2-mark: Two distinct points.
   - 3-mark: Three detailed numbered points. Must use exactly numbers like "1.", "2.", "3.".
   - 5-mark: Must have a brief introduction paragraph, followed by 3-5 detailed points, and a brief conclusion.
   - 6+ marks: Detailed analysis, comprehensive coverage, clear headings, introduction, and conclusion.
3. STRUCTURE: Use numbered points for main arguments. Bold the key terms in each point.
4. DIAGRAMS: Reference diagrams or figures using the label format "(Fig. 1.1)" if contextually appropriate based on the textbook.
5. Use an academic, professional tone appropriate for a board exam.
6. Base your answer strictly on the provided Context/Citations.

CONTEXT (Textbook excerpts):
{context}

QUESTION:
{question}`;

export async function cbseAnswerFormatterNode(state: TutorState): Promise<Partial<TutorState>> {
    const startTime = Date.now();
    const llm = getLangChainModel({ temperature: 0.1, providerOverride: state.providerVariant });
    const query = state.messages.at(-1)?.content as string ?? '';

    // Extract context purely from NCERTCitations for formatting
    const ncertCitations = state.citations.filter(isNCERTCitation);
    const contextText = ncertCitations.map(c =>
        `[Chapter: ${c.chapter}, Page: ${c.pageNumber}]\n${c.contentExcerpt}`
    ).join('\n\n');

    const systemPromptMessage = new SystemMessage({
        content: CBSE_FORMATTER_PROMPT
            .replace('{context}', contextText || 'No textbook context provided.')
            .replace('{question}', query)
    });

    // We pass the conversation history but prepend our heavy formatting system prompt
    const messages = [
        systemPromptMessage,
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
        confidenceScore: content.length > 50 ? 0.95 : 0.85,
    };
}
