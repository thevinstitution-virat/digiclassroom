import { AppError } from './base-error';

export class RateLimitError extends AppError {
    constructor(message: string = 'Too many requests') {
        super(message, 'RATE_LIMIT_ERROR', 429, true);
    }
}
