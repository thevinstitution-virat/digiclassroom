import { logger } from '@/lib/logger';

import { ZodSchema, ZodError } from 'zod';

export function safeValidate<T>(
    schema: ZodSchema<T>,
    data: unknown,
    context: string
): { success: true; data: T } | { success: false; errors: string[] } {
    const result = schema.safeParse(data);

    if (result.success)
  return { success: true, data: result.data };

    const errors = result.error.errors.map(e =>
        `[${context}] ${e.path.join('.')}: ${e.message}`
    );

    // Log but don't throw — degraded response is better than crash
    errors.forEach(e => logger.error(e));

    return { success: false, errors };
}

// Strict version — throws. Use only in development/test environments.
export function strictValidate<T>(schema: ZodSchema<T>, data: unknown, context: string): T {
    try {
        return schema.parse(data);
    } catch (e) {
        if (e instanceof ZodError) {
            throw new Error(`Validation failed in ${context}:\n${e.errors.map(err =>
                `  ${err.path.join('.')}: ${err.message}`
            ).join('\n')}`);
        }
        throw e;
    }
}
