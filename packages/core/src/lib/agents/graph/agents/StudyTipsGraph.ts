/**
 * Study Tips Graph
 * Connects the shared infrastructure with the StudyTipsNode.
 */

import { buildAgentGraph } from '../BaseGraphFactory';
        // @ts-ignore
import { studyTipsGenerationNode } from './StudyTipsNode';

// Compile the graph
export const studyTipsGraph = buildAgentGraph({
    agentName: 'study_tips',
    generationNode: studyTipsGenerationNode,
    // Study tips are often general advice, so we can skip strict NCERT scope validation
    skipScopeValidation: true,
});
