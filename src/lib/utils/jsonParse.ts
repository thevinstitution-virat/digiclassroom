import { logger } from '@/lib/logger';

/**
 * Safely parse JSON values that might already be objects or strings
 * 
 * This is particularly useful when working with MySQL JSON columns,
 * which can be returned as either strings or already-parsed objects
 * depending on the MySQL driver configuration.
 * 
 * @param value - The value to parse (can be string, object, null, undefined)
 * @param fallback - The fallback value if parsing fails (default: null)
 * @returns The parsed object or the fallback value
 */
export const safeJsonParse = <T = any>(value: unknown, fallback: T | null = null): T | null => {
  // Handle null/undefined
  if (!value)
  return fallback;

  // Already an object - return as-is
  if (typeof value === 'object')
  return value as T;

  // String - attempt to parse
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error({ error: error }, '❌ [JSON Parse] Failed to parse JSON string:');
      logger.error({ data: value.substring(0, 100) }, '   Value:');
      return fallback;
    }
  }

  // Other types - return fallback
  logger.warn({ data: typeof value }, '⚠️ [JSON Parse] Unexpected type:');
  return fallback;
};

/**
 * Safely stringify a value to JSON
 * 
 * @param value - The value to stringify
 * @param fallback - The fallback value if stringification fails (default: null)
 * @returns The JSON string or the fallback value
 */
export const safeJsonStringify = (value: unknown, fallback: string | null = null): string | null => {
  if (!value)
  return fallback;

  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.error({ error: error }, '❌ [JSON Stringify] Failed to stringify value:');
    return fallback;
  }
};

