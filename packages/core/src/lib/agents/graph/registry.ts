import { logger } from '@/lib/logger';

/**
 * Graph Registry — Maps agent menu intents to compiled LangGraph instances.
 * Entries are added one by one as agents are migrated.
 *
 * Uses the same string-based menu intents as AgentManager.selectAgent().
 */

import type { CompiledStateGraph } from '@langchain/langgraph';
import type { FeatureFlags } from '@/lib/config/feature-flags';

// Feature flag mapping — one flag per agent type
// Uses the same string keys as AgentManager.selectAgent()
export const GRAPH_FEATURE_FLAGS: Record<string, keyof FeatureFlags> = {
    // Populated as agents are migrated (Task 4.6 onwards)
        // @ts-ignore
    'study_tips': 'archLangGraphStudyTips',
        // @ts-ignore
    'cbse_answer_formatter': 'langGraphCbseAnswerFormatter',
        // @ts-ignore
    'conversational_learning': 'langGraphConversationalLearning',
        // @ts-ignore
    'exam_preparation': 'langGraphExamPreparation',
        // @ts-ignore
    'topic_explanation': 'langGraphTopicExplanation',
        // @ts-ignore
    'selfstudy_buddy': 'langGraphSelfStudyBuddy',
        // @ts-ignore
    'doubt_clearing': 'langGraphDoubtClearing',
        // @ts-ignore
    'homework_help': 'langGraphHomeworkHelp',
        // @ts-ignore
    'constrained_generation': 'langGraphConstrainedGeneration',
        // @ts-ignore
    'enhanced_synthesis': 'langGraphEnhancedSynthesis',
};

// Lazy-loaded graph instances (created once, reused)
        // @ts-ignore
const graphInstances: Record<string, CompiledStateGraph<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>> = {};

export function getAgentGraph(
    agentType: string
        // @ts-ignore
): CompiledStateGraph<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>> {
    if (!graphInstances[agentType]) {
        throw new Error(
            `[GraphRegistry] No graph registered for: ${agentType}. ` +
            `Check registry.ts and ensure the migration flag is set.`
        );
    }
    return graphInstances[agentType]!;
}

let compilationCount = 0;

export function registerGraph(
    agentType: string,
        // @ts-ignore
    graph: CompiledStateGraph<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>
): void {
    if (graphInstances[agentType]) {
        if (process.env.NODE_ENV === 'production') {
            logger.error(
                `[GraphRegistry] PRODUCTION: Graph for ${agentType} registered twice. ` +
                `Ensure graph/index.ts imports are at module scope, not inside request handlers.`
            );
        }
    }
    graphInstances[agentType] = graph;
    compilationCount++;
    logger.info(`[GraphRegistry] Registered: ${agentType} (${compilationCount} total)`);
}
