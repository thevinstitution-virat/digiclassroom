// A way to see exactly what is sent to a provider, for the cost measurements (Task 1 of the
// cost work). Off unless an observer is installed: production never installs one, and with no
// observer nothing here runs. The observer gets the request body as sent, with image bytes
// replaced by their size and hash, and the step the caller labelled with withStep().

import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

export interface ObservedRequest {
  step: string | null;
  provider: 'gemini' | 'openrouter' | 'openai';
  /** 'generate' or 'batch' (one entry per batched request). */
  path: 'generate' | 'batch';
  body: unknown;
}

type Observer = (r: ObservedRequest) => void;

const steps = new AsyncLocalStorage<string>();
let observer: Observer | null = null;

export function setRequestObserver(o: Observer | null): void {
  observer = o;
}

/** Label the provider calls made inside `fn` (e.g. 'read_tier1'). */
export function withStep<T>(step: string, fn: () => Promise<T>): Promise<T> {
  return steps.run(step, fn);
}

export function emitRequest(provider: ObservedRequest['provider'], path: ObservedRequest['path'], body: unknown): void {
  if (!observer) return;
  observer({ step: steps.getStore() ?? null, provider, path, body: redactImages(body) });
}

/** Deep copy with every base64 payload / data URL replaced by `<image: N bytes, sha256 prefix>`. */
export function redactImages(v: unknown): unknown {
  if (typeof v === 'string') {
    const m = /^data:([\w/+.-]+);base64,([\s\S]*)$/.exec(v);
    if (m) return `<image ${m[1]}: ${Buffer.from(m[2], 'base64').length} bytes, sha256 ${createHash('sha256').update(m[2]).digest('hex').slice(0, 12)}>`;
    return v;
  }
  if (Array.isArray(v)) return v.map(redactImages);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // Gemini inlineData: { mimeType, data: <base64> }
    if (typeof o.data === 'string' && typeof o.mimeType === 'string' && /^image\//.test(o.mimeType) && !/\s/.test(o.data.slice(0, 80))) {
      return { ...o, data: `<image ${o.mimeType}: ${Buffer.from(o.data, 'base64').length} bytes, sha256 ${createHash('sha256').update(o.data).digest('hex').slice(0, 12)}>` };
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, redactImages(x)]));
  }
  return v;
}
