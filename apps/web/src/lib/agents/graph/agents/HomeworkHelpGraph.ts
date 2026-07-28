import { homeworkHelpNode } from './HomeworkHelpNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const homeworkHelpGraph = buildAgentGraph({
    agentName: 'homework_help',
    generationNode: homeworkHelpNode
});

        // @ts-ignore
registerGraph('homework_help', homeworkHelpGraph);
