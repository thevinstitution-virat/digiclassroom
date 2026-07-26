import { doubtClearingNode } from './DoubtClearingNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const doubtClearingGraph = buildAgentGraph({
    agentName: 'doubt_clearing',
    generationNode: doubtClearingNode
});

registerGraph('doubt_clearing', doubtClearingGraph);
