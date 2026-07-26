import { logger } from '@/lib/logger';

import { AgentResponse } from '../agents/core/base-agent';

// Only generate audio for these core explanatory agents
const AUDIO_ELIGIBLE_AGENTS = new Set([
    'topic_explanation_agent',
    'doubt_clearing_agent',
    'conversational_learning_agent',
]);

// Text above this length gets summarized before TTS — Kokoro has a 3000 char limit
const TTS_CHAR_LIMIT = 2800;

export interface AudioLessonResult {
    audioBase64: string;
    durationSeconds: number;
    language: string;
    format: 'wav';
    textLength: number;
    wasTruncated: boolean;
}

export class AudioLessonService {
    private readonly ttsUrl: string;

    constructor() {
        this.ttsUrl = process.env.TTS_SERVICE_URL ?? 'http://localhost:8002';
    }

    /**
     * Called AFTER an agent produces a response.
     * Keeps audio generation completely decoupled from agent logic.
     */
    async generateForResponse(
        agentResponse: AgentResponse,
        language: 'english' | 'hindi'
    ): Promise<AudioLessonResult | null> {
        if (!(process.env.ARCH_TTS_AUDIO_LESSONS === 'true' || process.env.ARCH_TTS_AUDIO_LESSONS === '1'))
            return null;

        const agentName = agentResponse.metadata?.agentName || '';

        // Only generate audio for eligible agents
        if (!AUDIO_ELIGIBLE_AGENTS.has(agentName)) {
            return null;
        }

        let text = agentResponse.content;
        if (!text || text.trim().length === 0)
            return null;

        let wasTruncated = false;

        // Strip markdown formatting — TTS reads "##" and "**" as text otherwise
        text = this.stripMarkdown(text);

        // Remove citation block — "[Chapter X, Page Y: 'keyword']" reads badly
        text = this.stripCitationBlock(text);

        if (text.length > TTS_CHAR_LIMIT) {
            // Truncate at a sentence boundary to avoid mid-sentence cutoff
            text = this.truncateAtSentenceBoundary(text, TTS_CHAR_LIMIT);
            wasTruncated = true;
        }

        if (text.trim().length === 0)
            return null;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

            const response = await fetch(`${this.ttsUrl}/synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language, speed: 0.85 }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                logger.error({ data: response.status }, '[AudioLesson] TTS service error:');
                return null; // non-fatal — student still gets text response
            }

            const result = await response.json();

            return {
                audioBase64: result.audio_base64,
                durationSeconds: result.duration_seconds,
                language: result.language,
                format: 'wav',
                textLength: text.length,
                wasTruncated,
            };
        } catch (error) {
            // TTS failure is always non-fatal
            logger.error({ error: error }, '[AudioLesson] Failed to generate audio:');
            return null;
        }
    }

    private stripMarkdown(text: string): string {
        return text
            .replace(/#{1,6}\s/g, '')           // headers
            .replace(/\*\*(.*?)\*\*/g, '$1')    // bold
            .replace(/\*(.*?)\*/g, '$1')        // italic
            .replace(/`(.*?)`/g, '$1')          // code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links
            .replace(/^\s*[-*+]\s/gm, '')       // bullet points
            .replace(/^\s*\d+\.\s/gm, '');      // numbered lists
    }

    private stripCitationBlock(text: string): string {
        // Remove "**Sources:**\n[Chapter X, Page Y: 'keyword']" blocks
        return text.replace(/\*\*Sources:\*\*[\s\S]*$/m, '').trim();
    }

    private truncateAtSentenceBoundary(text: string, limit: number): string {
        if (text.length <= limit)
            return text;
        const truncated = text.slice(0, limit);
        const lastPeriod = Math.max(
            truncated.lastIndexOf('. '),
            truncated.lastIndexOf('। '), // Hindi danda punctuation
            truncated.lastIndexOf('! '),
            truncated.lastIndexOf('? ')
        );
        return lastPeriod > limit * 0.7
            ? truncated.slice(0, lastPeriod + 1)
            : truncated + '...';
    }
}
