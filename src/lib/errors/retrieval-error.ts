import { AppError } from './base-error';

export class RetrievalError extends AppError {
    constructor(message: string, code: string = 'RETRIEVAL_ERROR', isRetryable: boolean = true) {
        super(message, code, 500, isRetryable);
    }
}

export class EmbeddingError extends RetrievalError {
    constructor(message: string) {
        super(message, 'EMBEDDING_ERROR', true);
    }
}
