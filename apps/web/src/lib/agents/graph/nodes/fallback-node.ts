import { logger } from '@/lib/logger';

/**
 * Fallback Node — Re-retrieves with relaxed parameters when primary generation fails.
 * Implements the 4-level fallback (0=primary, 1=relaxed, 2=emergency, 3=refusal).
 */

import type { TutorState } from '../TutorGraphState';
import { RetrievalService } from '@/lib/agents/core/services/retrieval.service';
import type { EducationalContext } from '@/lib/services/vector_store_service';

const retrievalService = new RetrievalService();

const FALLBACK_CONFIG = {
    1: { limit: 20, description: 'relaxed threshold' },
    2: { limit: 30, description: 'emergency broad search' },
    3: { limit: 5, description: 'keyword only' },
} as const;

export async function fallbackNode(state: TutorState): Promise<Partial<TutorState>> {
    const query = state.messages.at(-1)?.content as string;
    const level = Math.min(state.fallbackLevel + 1, 3) as 1 | 2 | 3;

    const config = FALLBACK_CONFIG[level];
    logger.warn(`[Fallback] Level ${level} (${config.description}) for: "${query.slice(0, 50)}..."`);

    const context: EducationalContext = {
        query,
        subject: state.subject,
        grade_level: state.grade,
        board_type: 'CBSE',
        limit: config.limit,
        // Batch 2b: relaxed retrieval must stay within the org boundary too.
        organizationId: state.organizationId,
    };

    const response = await retrievalService.searchRelevantContent(context);

    return {
        retrievedChunks: response.results,
        fallbackLevel: level,
    };
}
