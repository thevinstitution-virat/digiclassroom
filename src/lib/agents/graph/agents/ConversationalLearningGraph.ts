import { conversationalLearningNode } from './ConversationalLearningNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const conversationalLearningGraph = buildAgentGraph({
    agentName: 'conversational_learning',
    generationNode: conversationalLearningNode
});

        // @ts-ignore
registerGraph('conversational_learning', conversationalLearningGraph);
