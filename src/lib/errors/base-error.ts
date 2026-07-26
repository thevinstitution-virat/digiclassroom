export class AppError extends Error {
    public code: string;
    public httpStatus: number;
    public isRetryable: boolean;

    constructor(message: string, code: string, httpStatus: number = 500, isRetryable: boolean = false) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.httpStatus = httpStatus;
        this.isRetryable = isRetryable;
        Error.captureStackTrace(this, this.constructor);
    }
}
