import { AppError } from './base-error';

export class AgentError extends AppError {
    constructor(message: string, code: string = 'AGENT_ERROR', isRetryable: boolean = false) {
        super(message, code, 500, isRetryable);
    }
}

export class AgentExecutionError extends AgentError {
    constructor(message: string, isRetryable: boolean = true) {
        super(message, 'AGENT_EXECUTION_ERROR', isRetryable);
    }
}

export class AgentTimeoutError extends AgentError {
    constructor(message: string = 'Agent execution timed out') {
        super(message, 'AGENT_TIMEOUT_ERROR', true);
    }
}
