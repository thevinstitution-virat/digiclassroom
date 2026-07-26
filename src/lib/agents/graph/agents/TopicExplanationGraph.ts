import { topicExplanationNode } from './TopicExplanationNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const topicExplanationGraph = buildAgentGraph({
    agentName: 'topic_explanation',
    generationNode: topicExplanationNode
});

registerGraph('topic_explanation', topicExplanationGraph);
