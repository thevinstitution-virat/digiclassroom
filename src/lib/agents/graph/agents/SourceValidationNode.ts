/**
 * Source Validation Node — LangGraph migration of source_validation.ts
 * 
 * Domain intelligence preserved:
 * 1. ContentVerificationEngine: sentence-level fidelity checking (Jaccard + keyword overlap)
 * 2. Overall fidelity threshold: 60%, sentence threshold: 50%
 * 3. Citation extraction patterns: [brackets], (parens), Source:, Reference:
 * 4. 5% failed-sentence tolerance
 * 5. Penalize missing citations by 10%
 * 
 * In LangGraph, this runs as a post-generation verification pass.
 * The node checks rawResponse against retrievedChunks for fidelity.
 */

import type { TutorState } from "../TutorGraphState";

const OVERALL_FIDELITY_THRESHOLD = 0.60;
const SENTENCE_SIMILARITY_THRESHOLD = 0.50;

function extractSentences(text: string): string[] {
    return text.split(/[.!?]+(?:\s+|$)|(?:\n\s*\n)/)
        .map(s => s.trim())
        .filter(s => s.length > 10);
}

function calculateKeywordSimilarity(text1: string, text2: string): number {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those']);
    const extract = (t: string) => new Set(
        t.toLowerCase().split(/\s+/).map(w => w.replace(/[.,!?;:]/g, '')).filter(w => !stopWords.has(w) && w.length > 2)
    );
    const w1 = extract(text1);
    const w2 = extract(text2);
    if (w1.size === 0 || w2.size === 0)
  return 0;
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    const union = new Set([...w1, ...w2]);
    return union.size > 0 ? intersection.size / union.size : 0;
}

function calculateLexicalSimilarity(t1: string, t2: string): number {
    const w1 = new Set(t1.toLowerCase().split(/\s+/));
    const w2 = new Set(t2.toLowerCase().split(/\s+/));
    const intersection = new Set([...w1].filter(x => w2.has(x)));
    const union = new Set([...w1, ...w2]);
    return union.size > 0 ? intersection.size / union.size : 0;
}

export async function sourceValidationNode(state: TutorState): Promise<Partial<TutorState>> {
    const generatedContent = state.rawResponse;
    if (!generatedContent || state.retrievedChunks.length === 0) {
        return { confidenceScore: 0 };
    }

    const sentences = extractSentences(generatedContent);
    let verifiedCount = 0;
    let failedCount = 0;
    const scores: number[] = [];

    for (const sentence of sentences) {
        let maxSim = 0;
        for (const chunk of state.retrievedChunks) {
            const lexSim = calculateLexicalSimilarity(sentence, chunk.text);
            const kwSim = calculateKeywordSimilarity(sentence, chunk.text);
            maxSim = Math.max(maxSim, 0.7 * lexSim + 0.3 * kwSim);
        }
        scores.push(maxSim);
        if (maxSim >= SENTENCE_SIMILARITY_THRESHOLD) {
            verifiedCount++;
        } else {
            failedCount++;
        }
    }

    const overallScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    // Penalize if no citations found
    const hasCitations = /\[.*?\]|\(.*?\)|Source:|Reference:/.test(generatedContent);
    const adjustedScore = hasCitations ? overallScore : overallScore * 0.9;

    const isVerified = adjustedScore >= OVERALL_FIDELITY_THRESHOLD
        && failedCount <= sentences.length * 0.05;

    return {
        confidenceScore: isVerified ? Math.max(adjustedScore, 0.85) : adjustedScore,
    };
}
