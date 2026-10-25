// The one entry point for AI calls. HW_AI_PROVIDER chooses Gemini direct (default) or
// OpenRouter; both take the same Gemini-shaped request and return the same result, so the
// reader, grader and job handlers never know which one ran.
//
// A batch is always polled at the provider that created it (stored on the job), so changing
// HW_AI_PROVIDER while batches are in flight is safe.

import { getHwConfig } from '../config';
import * as gemini from '../gemini/client';
import * as openrouter from '../openrouter/client';
import type { BatchItem, BatchOutcome, GeminiCall, GeminiResult } from '../gemini/client';

export type AiProvider = 'gemini' | 'openrouter';
export type { BatchEntry, BatchItem, BatchOutcome, GeminiCall as AiCall, GeminiResult as AiResult } from '../gemini/client';
export { imagePart, textPart, usageFromError } from '../gemini/client';

export function currentProvider(): AiProvider {
  return getHwConfig().HW_AI_PROVIDER;
}

const impl = (p: AiProvider) => (p === 'openrouter' ? openrouter : gemini);

export function generate(call: GeminiCall): Promise<GeminiResult> {
  return impl(currentProvider()).generate(call);
}

export function createBatch(items: BatchItem[], displayName: string): Promise<string> {
  return impl(currentProvider()).createBatch(items, displayName);
}

/** Reads send images inline; OpenRouter batches only accept public image URLs, so its reads run synchronously. */
export function readBatchSupported(): boolean {
  return currentProvider() === 'openrouter' ? openrouter.readBatchSupported : true;
}

export function pollBatch(provider: string | null, name: string, model: string): Promise<BatchOutcome> {
  return impl(provider === 'openrouter' ? 'openrouter' : 'gemini').pollBatch(name, model);
}
