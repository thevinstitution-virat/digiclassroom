// One error type for the whole feature, so routers can map it to an HTTP/tRPC code
// without guessing from message text.

export type HwErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'CONFLICT'
  | 'FEATURE_DISABLED'
  | 'QUOTA_EXCEEDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'NOT_CONFIGURED'
  | 'PROVIDER_ERROR'
  | 'INVALID_PROVIDER_OUTPUT';

export class HwError extends Error {
  readonly code: HwErrorCode;
  /** Safe to show to the user. Internal detail stays in `message`. */
  readonly publicMessage: string;

  constructor(code: HwErrorCode, publicMessage: string, internal?: string) {
    super(internal ?? publicMessage);
    this.name = 'HwError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export const isHwError = (e: unknown): e is HwError => e instanceof HwError;

/** HTTP status for REST routes. */
export function hwHttpStatus(code: HwErrorCode): number {
  switch (code) {
    case 'UNAUTHORIZED': return 401;
    case 'FORBIDDEN':
    case 'FEATURE_DISABLED': return 403;
    case 'NOT_FOUND': return 404;
    case 'CONFLICT': return 409;
    case 'PAYLOAD_TOO_LARGE': return 413;
    case 'QUOTA_EXCEEDED': return 429;
    case 'NOT_CONFIGURED': return 503;
    case 'PROVIDER_ERROR':
    case 'INVALID_PROVIDER_OUTPUT': return 502;
    default: return 400;
  }
}

/** Short, single-line text for a job's `error` column or an answer's `failure_reason`. */
export function describeError(e: unknown): string {
  const raw = isHwError(e) ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e);
  return raw.replace(/\s+/g, ' ').slice(0, 1000);
}
