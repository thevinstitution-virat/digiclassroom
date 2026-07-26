import { selfStudyBuddyNode } from './SelfStudyBuddyNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const selfStudyBuddyGraph = buildAgentGraph({
    agentName: 'selfstudy_buddy',
    generationNode: selfStudyBuddyNode
});

        // @ts-ignore
registerGraph('selfstudy_buddy', selfStudyBuddyGraph);
