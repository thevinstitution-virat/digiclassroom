import { topicExplanationNode } from './TopicExplanationNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const topicExplanationGraph = buildAgentGraph({
    agentName: 'topic_explanation',
    generationNode: topicExplanationNode
});

        // @ts-ignore
registerGraph('topic_explanation', topicExplanationGraph);
