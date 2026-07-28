import { examPreparationNode } from './ExamPreparationNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const examPreparationGraph = buildAgentGraph({
    agentName: 'exam_preparation',
    generationNode: examPreparationNode
});

        // @ts-ignore
registerGraph('exam_preparation', examPreparationGraph);
