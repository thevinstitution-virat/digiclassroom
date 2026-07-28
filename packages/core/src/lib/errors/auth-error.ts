import { AppError } from './base-error';

export class AuthError extends AppError {
    constructor(message: string, code: string = 'AUTH_ERROR', httpStatus: number = 401) {
        super(message, code, httpStatus, false);
    }
}

export class AuthenticationError extends AuthError {
    constructor(message: string = 'Not authenticated') {
        super(message, 'AUTHENTICATION_ERROR', 401);
    }
}

export class AuthorizationError extends AuthError {
    constructor(message: string = 'Not authorized') {
        super(message, 'AUTHORIZATION_ERROR', 403);
    }
}
