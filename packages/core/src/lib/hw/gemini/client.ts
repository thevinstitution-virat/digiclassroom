// The only place this feature talks to the Gemini API (direct, not through OpenRouter:
// the Batch API and its discount exist only there).
//
// Written against @google/genai 2.28.0 and the Gemini docs as of October 2026:
// - generateContent with systemInstruction, responseMimeType 'application/json' and
//   responseJsonSchema (structured output; JSON is syntactically guaranteed, values are not,
//   so callers validate again).
// - thinkingConfig.thinkingLevel (MINIMAL on 3.5 Flash-Lite / 3.6 Flash; 3.8 Flash supports
//   LOW and up only). Never sent together with thinkingBudget.
// - Per-part mediaResolution { level } on each image.
// - temperature is left at its default: the Gemini 3 docs warn that lowering it degrades output.
// - usageMetadata: promptTokenCount (includes cached), cachedContentTokenCount,
//   candidatesTokenCount + thoughtsTokenCount (both billed as output).
// - Batch: batches.create({ model, src: InlinedRequest[] }) / batches.get; results come back
//   in dest.inlinedResponses in the same order, each with our metadata echoed.

import {
  GoogleGenAI,
  JobState,
  PartMediaResolutionLevel,
  ThinkingLevel,
  type GenerateContentResponse,
  type InlinedRequest,
  type Part,
} from '@google/genai';
import { getHwConfig, requireGeminiKey } from '../config';
import { HwError } from '../errors';
import type { TokenUsage } from '../cost/pricing';

export interface GeminiCall {
  model: string;
  systemInstruction: string;
  parts: Part[];
  schema: object;
}

export interface GeminiResult {
  json: unknown;
  usage: TokenUsage;
  /** The provider's usage object as returned, kept for audit. */
  rawUsage: Record<string, unknown>;
  model: string;
}

let client: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: requireGeminiKey() });
  return client;
}

/** Tests only: substitute the SDK client. */
export function _setGeminiClient(c: GoogleGenAI | null): void {
  client = c;
}

export function textPart(text: string): Part {
  return { text };
}

export function imagePart(png: Uint8Array): Part {
  const level = PartMediaResolutionLevel[`MEDIA_RESOLUTION_${getHwConfig().HW_READ_MEDIA_RESOLUTION}` as keyof typeof PartMediaResolutionLevel];
  return {
    inlineData: { mimeType: 'image/png', data: Buffer.from(png).toString('base64') },
    mediaResolution: { level },
  };
}

function requestFor(call: GeminiCall) {
  return {
    model: call.model,
    contents: [{ role: 'user', parts: call.parts }],
    config: {
      systemInstruction: call.systemInstruction,
      responseMimeType: 'application/json',
      responseJsonSchema: call.schema,
      thinkingConfig: { thinkingLevel: ThinkingLevel[getHwConfig().HW_THINKING_LEVEL] },
    },
  };
}

export function usageOf(res: GenerateContentResponse): { usage: TokenUsage; rawUsage: Record<string, unknown> } {
  const u = res.usageMetadata;
  if (!u || typeof u.promptTokenCount !== 'number') {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI response could not be used.', 'response has no usageMetadata');
  }
  return {
    usage: {
      input: u.promptTokenCount,
      cached: u.cachedContentTokenCount ?? 0,
      output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
    },
    rawUsage: JSON.parse(JSON.stringify(u)) as Record<string, unknown>,
  };
}

/**
 * The answer text, without thought parts. Read from the parts rather than the SDK's `.text`
 * getter, because batch results can arrive as plain objects without it.
 */
function responseText(res: GenerateContentResponse): string {
  const parts = res.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
}

/** Parse one response. Usage is extracted first, so it is recorded even when the output is unusable. */
export function parseResponse(res: GenerateContentResponse, model: string): GeminiResult {
  const { usage, rawUsage } = usageOf(res);
  const candidate = res.candidates?.[0];
  const finish = candidate?.finishReason;
  const text = responseText(res);
  if (!text) {
    throw Object.assign(
      new HwError('INVALID_PROVIDER_OUTPUT', 'The AI returned no answer.', `empty response (finishReason ${finish ?? 'none'})`),
      { usage, model },
    );
  }
  if (finish && finish !== 'STOP') {
    throw Object.assign(
      new HwError('INVALID_PROVIDER_OUTPUT', 'The AI response was cut off.', `finishReason ${finish}`),
      { usage, model },
    );
  }
  try {
    return { json: JSON.parse(text), usage, rawUsage, model: res.modelVersion ?? model };
  } catch {
    throw Object.assign(
      new HwError('INVALID_PROVIDER_OUTPUT', 'The AI returned malformed output.', 'response text is not JSON'),
      { usage, model },
    );
  }
}

/** Usage attached to an error thrown after the provider already billed for the call. */
export function usageFromError(e: unknown): { usage: TokenUsage; model: string } | null {
  const x = e as { usage?: TokenUsage; model?: string };
  return x && x.usage && x.model ? { usage: x.usage, model: x.model } : null;
}

export async function generate(call: GeminiCall): Promise<GeminiResult> {
  let res: GenerateContentResponse;
  try {
    res = await ai().models.generateContent(requestFor(call));
  } catch (e) {
    throw new HwError('PROVIDER_ERROR', 'The AI service failed.', `generateContent(${call.model}): ${(e as Error).message}`);
  }
  return parseResponse(res, call.model);
}

// ── Batch ────────────────────────────────────────────────────────────────────

export interface BatchItem {
  key: string;
  call: GeminiCall;
}

/** All items must use the same model: a batch job is created for one model. */
export async function createBatch(items: BatchItem[], displayName: string): Promise<string> {
  if (items.length === 0) throw new Error('createBatch: no items');
  const model = items[0].call.model;
  if (items.some((i) => i.call.model !== model)) throw new Error('createBatch: mixed models');
  const src: InlinedRequest[] = items.map((i) => {
    const r = requestFor(i.call);
    return { contents: r.contents, config: r.config, metadata: { key: i.key } };
  });
  try {
    const job = await ai().batches.create({ model, src, config: { displayName } });
    if (!job.name) throw new Error('batch created without a name');
    return job.name;
  } catch (e) {
    throw new HwError('PROVIDER_ERROR', 'The AI batch service failed.', `batches.create(${model}): ${(e as Error).message}`);
  }
}

export type BatchOutcome =
  | { state: 'pending' }
  | { state: 'failed'; reason: string }
  | { state: 'succeeded'; results: Map<string, GenerateContentResponse | { error: string }> };

const PENDING = new Set<string>([JobState.JOB_STATE_QUEUED, JobState.JOB_STATE_PENDING, JobState.JOB_STATE_RUNNING, JobState.JOB_STATE_UNSPECIFIED]);

export async function pollBatch(name: string): Promise<BatchOutcome> {
  let job;
  try {
    job = await ai().batches.get({ name });
  } catch (e) {
    throw new HwError('PROVIDER_ERROR', 'The AI batch service failed.', `batches.get(${name}): ${(e as Error).message}`);
  }
  const state = job.state ?? JobState.JOB_STATE_UNSPECIFIED;
  if (PENDING.has(state)) return { state: 'pending' };
  if (state !== JobState.JOB_STATE_SUCCEEDED) {
    return { state: 'failed', reason: `batch ${state}${job.error?.message ? `: ${job.error.message}` : ''}` };
  }
  const responses = job.dest?.inlinedResponses;
  if (!responses) return { state: 'failed', reason: 'batch succeeded but returned no inline responses' };
  const results = new Map<string, GenerateContentResponse | { error: string }>();
  for (const r of responses) {
    const key = r.metadata?.key;
    if (!key) continue;
    if (r.error || !r.response) results.set(key, { error: r.error?.message ?? 'no response for this request' });
    else results.set(key, r.response);
  }
  return { state: 'succeeded', results };
}
