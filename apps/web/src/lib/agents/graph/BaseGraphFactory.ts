/**
 * BaseGraphFactory — Builds the common graph structure shared by all agents.
 * Each agent only provides its generation node and a name.
 *
 * Flow: START → set_agent_name → retrieve → validate_scope
 *         ├─ (out of scope) → scope_violation_handler → trace → END
 *         └─ (in scope) → generate → format_citations → conditional
 *                                                          ├─ (empty + fallbackLevel < 3) → fallback → generate
 *                                                          └─ trace → END
 */

import { StateGraph, END, START } from '@langchain/langgraph';
import { TutorGraphState, type TutorState } from './TutorGraphState';
import { retrievalNode } from './nodes/retrieval-node';
import { scopeValidationNode } from './nodes/scope-validation-node';
import { scopeViolationHandlerNode } from './nodes/scope-violation-handler-node';
import { citationFormatNode } from './nodes/citation-format-node';
import { langfuseTraceNode } from './nodes/langfuse-trace-node';
import { fallbackNode } from './nodes/fallback-node';

export interface AgentGraphConfig {
    agentName: string;
    /** Agent-specific generation node — ALL domain intelligence lives here */
    generationNode: (state: TutorState) => Promise<Partial<TutorState>>;
    /** Optional: skip scope validation (e.g., for web-search-focused agents) */
    skipScopeValidation?: boolean;
}

export function buildAgentGraph(config: AgentGraphConfig) {
    const graph = new StateGraph(TutorGraphState)

        // ── Shared Infrastructure Nodes ──────────────────────────────
        .addNode('set_agent_name', async () => ({ agentName: config.agentName }))
        .addNode('retrieve', retrievalNode)
        .addNode('validate_scope', scopeValidationNode)
        .addNode('scope_violation_handler', scopeViolationHandlerNode)
        .addNode('fallback', fallbackNode)
        .addNode('format_citations', citationFormatNode)
        .addNode('trace', langfuseTraceNode)

        // ── Agent-Specific Generation Node (ALL domain logic here) ───
        .addNode('generate', config.generationNode)

        // ── Graph Edges ───────────────────────────────────────────────
        .addEdge(START, 'set_agent_name')
        .addEdge('set_agent_name', 'retrieve')
        .addEdge('retrieve', 'validate_scope')

        // Scope validation gate
        .addConditionalEdges('validate_scope', (state: TutorState) => {
            if (config.skipScopeValidation)
  return 'generate';
            return state.ncertScopeValid ? 'generate' : 'scope_violation_handler';
        })

        // Scope violation → trace → end (no further processing)
        .addEdge('scope_violation_handler', 'trace')

        // Primary generation path
        .addEdge('generate', 'format_citations')

        // After citation formatting: check if we need fallback or can finalize
        .addConditionalEdges('format_citations', (state: TutorState) => {
            // If generation produced empty response and we haven't exhausted fallbacks
            if (!state.rawResponse && state.fallbackLevel < 3)
  return 'fallback';
            return 'trace';
        })

        // Fallback re-retrieves then retries generation
        .addEdge('fallback', 'generate')

        // Trace is the terminal node — always goes to END
        .addEdge('trace', END);

    return graph.compile();
}
