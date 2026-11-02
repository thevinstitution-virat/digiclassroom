// OpenRouter implementation of the AI calls (HW_AI_PROVIDER=openrouter). Same models as
// Gemini direct, addressed as "google/gemini-…".
//
// Written against the OpenRouter docs as of October 2026:
// - POST /api/v1/chat/completions; images as { type: 'image_url', image_url: { url: data URL, detail } }
//   (content parts only in the user message); system prompt as a system message.
// - response_format { type: 'json_schema', json_schema: { name, strict: true, schema } }.
// - reasoning { effort: 'minimal' | 'low' | … }, mapped by OpenRouter to Gemini's thinking level.
// - usage: prompt_tokens, prompt_tokens_details.cached_tokens, completion_tokens (includes
//   reasoning tokens, which are billed as output), and cost (credits = USD) when reported.
// - Batch: POST /api/v1/batches { endpoint, model, completion_window: '24h', requests: [{ custom_id, body }] },
//   GET /api/v1/batches/{id}; statuses validating | in_progress | finalizing | completed | failed |
//   expired | cancelled; results[] matched by custom_id, each { response: { status_code, body } } or { error }.
// - Batches reject inline (base64/data-URI) images: only public http(s) image URLs are accepted.
//   We do not publish students' pages, so with OpenRouter only text-only work (marking) is batched;
//   reading runs synchronously (see readBatchSupported).

/** Reading needs inline images, which OpenRouter batches refuse. */
export const readBatchSupported = false;

import { getHwConfig } from '../config';
import { HwError } from '../errors';
import type { TokenUsage } from '../cost/pricing';
import type { BatchEntry, BatchItem, BatchOutcome, GeminiCall, GeminiResult } from '../gemini/client';
import { emitRequest } from '../ai/observe';

const BASE = 'https://openrouter.ai/api/v1';

function key(): string {
  const k = getHwConfig().OPENROUTER_API_KEY;
  if (!k) throw new HwError('NOT_CONFIGURED', 'AI is not configured for handwritten assignments.', 'OPENROUTER_API_KEY is not set');
  return k;
}

async function request(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json', 'X-Title': 'DigiClassroom Handwritten Assignments', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep the raw text in the error below
  }
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? text.slice(0, 300);
    // Bad key, no credits or forbidden: retrying will not help, and the admin must act.
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      throw new HwError('NOT_CONFIGURED', 'The AI account needs attention (key or credits).', `OpenRouter ${path}: HTTP ${res.status} ${msg}`);
    }
    throw new HwError('PROVIDER_ERROR', 'The AI service failed.', `OpenRouter ${path}: HTTP ${res.status} ${msg}`);
  }
  return body;
}

/** OpenAI GPT-5.6 and later (explicit prompt caching exists only there). */
export const isExplicitCacheModel = (model: string): boolean => /^(openai\/)?gpt-(5\.([6-9]|\d\d+)|[6-9](\.\d+)?)(-|$)/i.test(model.trim());

/** OpenAI's minimum cacheable prefix. */
export const MIN_CACHEABLE_TOKENS = 1024;

/**
 * A deliberately LOW estimate of tokens (never above the real count for English; Devanagari and
 * numerals use more tokens per character, so they are under-counted too): a breakpoint is added
 * only when even this estimate reaches the minimum, so a write is never paid for a prefix too
 * short to be read back.
 */
export const lowTokenEstimate = (text: string): number => Math.floor(text.length / 4);

export interface ChatBody {
  model: string;
  messages: { role: 'system' | 'user'; content: string | Record<string, unknown>[] }[];
  response_format: unknown;
  reasoning: { effort: string };
  prompt_cache_options?: { mode: 'explicit' };
}

/** Gemini-shaped call -> chat completions body. */
export function chatBody(call: GeminiCall): ChatBody {
  const cfg = getHwConfig();
  const resolution = call.options?.mediaResolution ?? cfg.HW_READ_MEDIA_RESOLUTION;
  const content: Record<string, unknown>[] = call.parts.map((p) => {
    if (p.inlineData) {
      return {
        type: 'image_url',
        image_url: {
          url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
          detail: resolution === 'LOW' ? 'low' : 'high',
        },
      };
    }
    return { type: 'text', text: p.text ?? '' };
  });
  const body: ChatBody = {
    model: call.model,
    messages: [
      { role: 'system', content: call.systemInstruction },
      { role: 'user', content },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'hw_output', strict: true, schema: call.schema } },
    reasoning: { effort: call.options?.reasoningEffort ?? cfg.HW_THINKING_LEVEL.toLowerCase() },
  };
  // GPT-5.6+ charges 1.25x input for every cache WRITE, and writes happen automatically. A prompt
  // whose prefix is never sent twice pays that premium for nothing, so with the flag on the mode
  // is explicit: no breakpoint, no write. A breakpoint goes only after the static prefix, and only
  // when that prefix is long enough to be cached at all.
  if (cfg.HW_OPENAI_EXPLICIT_CACHE_ENABLED && isExplicitCacheModel(call.model)) {
    body.prompt_cache_options = { mode: 'explicit' };
    const n = call.options?.staticPrefixParts ?? 0;
    if (n > 0 && n <= content.length && content.slice(0, n).every((c) => c.type === 'text')) {
      const prefix = [call.systemInstruction, ...content.slice(0, n).map((c) => String(c.text))].join(' ');
      if (lowTokenEstimate(prefix) >= MIN_CACHEABLE_TOKENS) content[n - 1] = { ...content[n - 1], prompt_cache_breakpoint: { mode: 'explicit' } };
    }
  }
  return body;
}

interface ChatResponse {
  model?: string;
  choices?: { finish_reason?: string; message?: { content?: string | null } }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number; image_tokens?: number; text_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
    cost?: number;
  };
}

/** Parse one chat completion. Usage is taken first, so it is recorded even when the output is unusable. */
export function parseChat(res: ChatResponse, model: string): GeminiResult {
  const u = res.usage;
  if (!u || typeof u.prompt_tokens !== 'number') {
    throw new HwError('INVALID_PROVIDER_OUTPUT', 'The AI response could not be used.', 'OpenRouter response has no usage');
  }
  const pd = u.prompt_tokens_details;
  // Every detail the provider reports is kept (cache writes and reasoning are billed differently
  // from plain input and visible output); a detail it does not report stays undefined.
  const usage: TokenUsage = {
    input: u.prompt_tokens,
    cached: pd?.cached_tokens ?? 0,
    output: u.completion_tokens ?? 0,
    ...(pd?.cache_write_tokens !== undefined ? { cacheWrite: pd.cache_write_tokens } : {}),
    ...(u.completion_tokens_details?.reasoning_tokens !== undefined ? { thinking: u.completion_tokens_details.reasoning_tokens } : {}),
    ...(pd?.image_tokens !== undefined ? { inputImage: pd.image_tokens } : {}),
    ...(pd?.text_tokens !== undefined ? { inputText: pd.text_tokens } : {}),
  };
  const used = res.model ?? model;
  const costUsd = typeof u.cost === 'number' ? u.cost : undefined;
  const withUsage = (e: HwError) => Object.assign(e, { usage, model: used, costUsd });
  const choice = res.choices?.[0];
  const text = choice?.message?.content;
  if (!text) throw withUsage(new HwError('INVALID_PROVIDER_OUTPUT', 'The AI returned no answer.', `empty response (finish_reason ${choice?.finish_reason ?? 'none'})`));
  if (choice?.finish_reason && choice.finish_reason !== 'stop') {
    throw withUsage(new HwError('INVALID_PROVIDER_OUTPUT', 'The AI response was cut off.', `finish_reason ${choice.finish_reason}`));
  }
  try {
    return { json: JSON.parse(text), usage, rawUsage: JSON.parse(JSON.stringify(u)), model: used, costUsd };
  } catch {
    throw withUsage(new HwError('INVALID_PROVIDER_OUTPUT', 'The AI returned malformed output.', 'response text is not JSON'));
  }
}

export async function generate(call: GeminiCall): Promise<GeminiResult> {
  const body = chatBody(call);
  emitRequest('openrouter', 'generate', body);
  const res = (await request('/chat/completions', { method: 'POST', body: JSON.stringify(body) })) as ChatResponse;
  return parseChat(res, call.model);
}

export async function createBatch(items: BatchItem[], _displayName: string): Promise<string> {
  if (items.length === 0) throw new Error('createBatch: no items');
  const model = items[0].call.model;
  if (items.some((i) => i.call.model !== model)) throw new Error('createBatch: mixed models');
  if (items.some((i) => i.call.parts.some((p) => p.inlineData))) {
    throw new HwError('NOT_CONFIGURED', 'This AI provider cannot batch images.', 'OpenRouter batches reject inline images; read synchronously');
  }
  // Field order matters: everything before `requests`.
  const body = {
    endpoint: '/v1/chat/completions',
    model,
    completion_window: '24h',
    requests: items.map((i) => ({ custom_id: i.key, body: chatBody(i.call) })),
  };
  for (const r of body.requests) emitRequest('openrouter', 'batch', r.body);
  const res = (await request('/batches', { method: 'POST', body: JSON.stringify(body) })) as { id?: string };
  if (!res?.id) throw new HwError('PROVIDER_ERROR', 'The AI batch service failed.', 'OpenRouter batch created without an id');
  return res.id;
}

const PENDING = new Set(['validating', 'in_progress', 'finalizing']);

export async function pollBatch(name: string, model: string): Promise<BatchOutcome> {
  const b = (await request(`/batches/${encodeURIComponent(name)}`, { method: 'GET' })) as {
    status?: string;
    error?: { message?: string } | null;
    results?: { custom_id: string; response?: { status_code?: number; body?: ChatResponse }; error?: { message?: string } }[] | null;
  };
  const status = b?.status ?? 'unknown';
  if (PENDING.has(status)) return { state: 'pending' };
  if (status !== 'completed') return { state: 'failed', reason: `batch ${status}${b.error?.message ? `: ${b.error.message}` : ''}` };
  // A completed batch can briefly report results: null; try again on the next poll.
  if (!b.results) return { state: 'pending' };
  const results = new Map<string, BatchEntry>();
  for (const r of b.results) {
    if (r.error || !r.response?.body || (r.response.status_code ?? 200) >= 400) {
      results.set(r.custom_id, { ok: false, error: new HwError('PROVIDER_ERROR', 'The AI could not complete this request.', r.error?.message ?? `status ${r.response?.status_code}`) });
      continue;
    }
    try {
      results.set(r.custom_id, { ok: true, result: parseChat(r.response.body, model) });
    } catch (e) {
      results.set(r.custom_id, { ok: false, error: e });
    }
  }
  return { state: 'succeeded', results };
}
