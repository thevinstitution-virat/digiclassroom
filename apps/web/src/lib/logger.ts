/**
 * Standard structured logger for AntiGravity-grade observability.
 * Emits JSON-formatted logs suitable for Datadog, ELK, or CloudWatch.
 */

interface LogContext {
    requestId?: string;
    userId?: string;
    organizationId?: string | null;
    route?: string;
    [key: string]: any;
}

const formatLog = (level: string, message: string, context?: LogContext, error?: any) => {
    const timestamp = new Date().toISOString();
    
    const logEntry = {
        timestamp,
        level,
        message,
        ...context,
        ...(error && { 
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack,
            }
        })
    };

    return JSON.stringify(logEntry);
};

export const logger = {
    info: (message: string, context?: LogContext) => {
        console.log(formatLog('INFO', message, context));
    },
    warn: (message: string, context?: LogContext, error?: any) => {
        console.warn(formatLog('WARN', message, context, error));
    },
    error: (message: string, context?: LogContext, error?: any) => {
        console.error(formatLog('ERROR', message, context, error));
    },
    debug: (message: string, context?: LogContext) => {
        if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
            console.debug(formatLog('DEBUG', message, context));
        }
    }
};
