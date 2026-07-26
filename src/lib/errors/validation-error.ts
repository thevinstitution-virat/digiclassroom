import { AppError } from './base-error';

export class ValidationError extends AppError {
    constructor(message: string, code: string = 'VALIDATION_ERROR') {
        super(message, code, 400, false);
    }
}

export class ScopeViolationError extends ValidationError {
    constructor(message: string) {
        super(message, 'SCOPE_VIOLATION_ERROR');
    }
}

export class InputValidationError extends ValidationError {
    constructor(message: string) {
        super(message, 'INPUT_VALIDATION_ERROR');
    }
}
