import { enhancedSynthesisNode } from './EnhancedSynthesisNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const enhancedSynthesisGraph = buildAgentGraph({
    agentName: 'enhanced_synthesis',
    generationNode: enhancedSynthesisNode
});

registerGraph('enhanced_synthesis', enhancedSynthesisGraph);
