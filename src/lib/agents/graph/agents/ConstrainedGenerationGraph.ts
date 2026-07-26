import { constrainedGenerationNode } from './ConstrainedGenerationNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const constrainedGenerationGraph = buildAgentGraph({
    agentName: 'constrained_generation',
    generationNode: constrainedGenerationNode
});

registerGraph('constrained_generation', constrainedGenerationGraph);
