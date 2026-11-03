// The one entry point for AI calls. Each step has a provider: HW_READ_PROVIDER, HW_ESCALATE_PROVIDER,
// HW_GRADE_PROVIDER, HW_RUBRIC_PROVIDER, each defaulting to HW_AI_PROVIDER (Gemini direct unless set);
// answer keys choose writer and verifier separately (HW_KEY_WRITER_PROVIDER, HW_KEY_VERIFIER_PROVIDER).
// All three providers (Gemini direct, OpenAI direct, OpenRouter) take the same Gemini-shaped request and
// return the same result, so the reader, grader and job handlers never know which one ran.
//
// A batch is always polled at the provider that created it (stored on the job), so changing a provider
// while batches are in flight is safe.

import { getHwConfig } from '../config';
import * as gemini from '../gemini/client';
import * as openrouter from '../openrouter/client';
import * as openai from '../openai/client';
import type { BatchItem, BatchOutcome, GeminiCall, GeminiResult } from '../gemini/client';

export type AiProvider = 'gemini' | 'openrouter' | 'openai';
export type AiRole = 'read' | 'escalate' | 'grade' | 'rubric';
export type { BatchEntry, BatchItem, BatchOutcome, CallOptions, GeminiCall as AiCall, GeminiResult as AiResult } from '../gemini/client';
export { imagePart, textPart, usageFromError } from '../gemini/client';
export { setRequestObserver, withStep } from './observe';

/** The default provider (HW_AI_PROVIDER). */
export function currentProvider(): AiProvider {
  return getHwConfig().HW_AI_PROVIDER;
}

/** The provider for one step of the pipeline. */
export function providerFor(role: AiRole): AiProvider {
  const c = getHwConfig();
  return { read: c.HW_READ_PROVIDER, escalate: c.HW_ESCALATE_PROVIDER, grade: c.HW_GRADE_PROVIDER, rubric: c.HW_RUBRIC_PROVIDER }[role] ?? c.HW_AI_PROVIDER;
}

/** The call, bound to the provider of its step. */
export const routed = (call: GeminiCall, role: AiRole): GeminiCall => ({ ...call, provider: providerFor(role) });

const impl = (p: AiProvider) => (p === 'openrouter' ? openrouter : p === 'openai' ? openai : gemini);

export function generate(call: GeminiCall): Promise<GeminiResult> {
  return impl(call.provider ?? currentProvider()).generate(call);
}

/** One call at a named provider, whatever the step routes say (answer keys choose writer and verifier separately). */
export function generateWith(provider: AiProvider, call: GeminiCall): Promise<GeminiResult> {
  return impl(provider).generate(call);
}

export function createBatch(items: BatchItem[], displayName: string): Promise<string> {
  const provider = items[0]?.call.provider ?? currentProvider();
  if (items.some((i) => (i.call.provider ?? currentProvider()) !== provider)) throw new Error('createBatch: mixed providers');
  return impl(provider).createBatch(items, displayName);
}

/** Reads send images inline. Gemini and OpenAI batch them; OpenRouter batches only accept public image URLs, so its reads run synchronously. */
export function readBatchSupported(provider: AiProvider = currentProvider()): boolean {
  return provider === 'openrouter' ? openrouter.readBatchSupported : true;
}

export function pollBatch(provider: string | null, name: string, model: string): Promise<BatchOutcome> {
  return impl(provider === 'openrouter' ? 'openrouter' : provider === 'openai' ? 'openai' : 'gemini').pollBatch(name, model);
}
