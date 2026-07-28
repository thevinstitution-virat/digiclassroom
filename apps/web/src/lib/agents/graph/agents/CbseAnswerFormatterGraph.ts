import { cbseAnswerFormatterNode } from './CbseAnswerFormatterNode';
import { buildAgentGraph } from '../BaseGraphFactory';
import { registerGraph } from '../registry';

export const cbseAnswerFormatterGraph = buildAgentGraph({
    agentName: 'cbse_answer_formatter',
    generationNode: cbseAnswerFormatterNode
});

        // @ts-ignore
registerGraph('cbse_answer_formatter', cbseAnswerFormatterGraph);
