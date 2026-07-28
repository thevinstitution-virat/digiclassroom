import { constrainedGenerationNode } from './ConstrainedGenerationNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const constrainedGenerationGraph = buildAgentGraph({
    agentName: 'constrained_generation',
    generationNode: constrainedGenerationNode
});

        // @ts-ignore
registerGraph('constrained_generation', constrainedGenerationGraph);
