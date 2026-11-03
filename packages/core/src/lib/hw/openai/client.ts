// OpenAI direct implementation of the AI calls (HW_*_PROVIDER=openai), for gpt-6-luna and other OpenAI
// models. The same Gemini-shaped call goes in and the same result comes out, so the reader, grader and
// job handlers never know which provider ran.
//
// Written against the OpenAI docs as of November 2026:
// - POST /v1/chat/completions, the same body shape OpenRouter takes, except that reasoning is the
//   top-level `reasoning_effort` and the model id has no "openai/" prefix. Structured output through
//   response_format json_schema; images as data URLs with `detail`; explicit prompt caching through
//   `prompt_cache_options` and `prompt_cache_breakpoint` (GPT-5.6 and later).
// - usage: prompt_tokens, prompt_tokens_details.{cached_tokens, cache_write_tokens}, completion_tokens
//   (reasoning included, in completion_tokens_details.reasoning_tokens). OpenAI reports no cost, so
//   calls are priced from HW_PRICE_TABLE_JSON.
// - Batch: upload a JSONL file to /v1/files (purpose "batch"), POST /v1/batches { input_file_id,
//   endpoint "/v1/chat/completions", completion_window "24h" }, GET /v1/batches/{id}; when "completed"
//   download output_file_id (and error_file_id) from /v1/files/{id}/content. Output order is not input
//   order: lines are matched by custom_id. Statuses validating | in_progress | finalizing | cancelling
//   are pending; failed | expired | cancelled end the batch.
//
// NOT yet exercised against the live API in this repository (no valid OpenAI key was available when it
// was written): `npm run hw:cost:probe -- direct openai` makes the round trip and prints the timings.

import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { emitRequest } from '../ai/observe';
import { chatBody, parseChat } from '../openrouter/client';
import type { BatchEntry, BatchItem, BatchOutcome, GeminiCall, GeminiResult } from '../gemini/client';

const BASE = 'https://api.openai.com/v1';

function key(): string {
  const k = getHwConfig().OPENAI_API_KEY;
  if (!k) throw new HwError('NOT_CONFIGURED', 'AI is not configured for handwritten assignments.', 'OPENAI_API_KEY is not set');
  return k;
}

/** Images can be sent inline in a batch (data URLs inside the JSONL body). */
export const readBatchSupported = true;

/** The chat completions body OpenAI takes: OpenRouter's, with `reasoning_effort` and a bare model id. */
export function openAiBody(call: GeminiCall) {
  const { reasoning, ...rest } = chatBody(call);
  return { ...rest, model: call.model.replace(/^openai\//, ''), reasoning_effort: reasoning.effort };
}

async function request(path: string, init: RequestInit): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) } });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* a file download is not JSON */ }
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } } | null)?.error?.message ?? text.slice(0, 300);
    // Bad key, no credit or forbidden: retrying will not help and the admin must act.
    if (res.status === 401 || res.status === 402 || res.status === 403) {
      throw new HwError('NOT_CONFIGURED', 'The AI account needs attention (key or credits).', `OpenAI ${path}: HTTP ${res.status} ${msg.replace(/sk-[A-Za-z0-9_*-]+/g, 'sk-…')}`);
    }
    throw new HwError('PROVIDER_ERROR', 'The AI service failed.', `OpenAI ${path}: HTTP ${res.status} ${msg}`);
  }
  return { status: res.status, body, text };
}

export async function generate(call: GeminiCall): Promise<GeminiResult> {
  const body = openAiBody(call);
  emitRequest('openai', 'generate', body);
  const { body: res } = await request('/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return parseChat(res as Parameters<typeof parseChat>[0], call.model);
}

export async function createBatch(items: BatchItem[], displayName: string): Promise<string> {
  if (items.length === 0) throw new Error('createBatch: no items');
  const model = items[0].call.model;
  if (items.some((i) => i.call.model !== model)) throw new Error('createBatch: mixed models');
  const lines = items.map((i) => {
    const body = openAiBody(i.call);
    emitRequest('openai', 'batch', body);
    return JSON.stringify({ custom_id: i.key, method: 'POST', url: '/v1/chat/completions', body });
  });
  const form = new FormData();
  form.append('purpose', 'batch');
  form.append('file', new Blob([lines.join('\n')], { type: 'application/jsonl' }), `${displayName.replace(/[^\w.-]+/g, '_')}.jsonl`);
  const up = (await request('/files', { method: 'POST', body: form })).body as { id?: string } | null;
  if (!up?.id) throw new HwError('PROVIDER_ERROR', 'The AI batch service failed.', 'OpenAI file upload returned no id');
  const b = (await request('/batches', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_file_id: up.id, endpoint: '/v1/chat/completions', completion_window: '24h', metadata: { name: displayName.slice(0, 64) } }),
  })).body as { id?: string } | null;
  if (!b?.id) throw new HwError('PROVIDER_ERROR', 'The AI batch service failed.', 'OpenAI batch created without an id');
  return b.id;
}

interface BatchObject {
  status?: string;
  output_file_id?: string | null;
  error_file_id?: string | null;
  errors?: { data?: { message?: string }[] } | null;
  request_counts?: { total?: number; completed?: number; failed?: number };
}
interface ResultLine {
  custom_id: string;
  response?: { status_code?: number; body?: unknown } | null;
  error?: { code?: string; message?: string } | null;
}

const PENDING = new Set(['validating', 'in_progress', 'finalizing', 'cancelling']);

export async function pollBatch(name: string, model: string): Promise<BatchOutcome> {
  const b = (await request(`/batches/${encodeURIComponent(name)}`, { method: 'GET' })).body as BatchObject | null;
  const status = b?.status ?? 'unknown';
  if (PENDING.has(status)) return { state: 'pending' };
  if (status !== 'completed') {
    const why = b?.errors?.data?.[0]?.message;
    return { state: 'failed', reason: `batch ${status}${why ? `: ${why}` : ''}` };
  }
  const results = new Map<string, BatchEntry>();
  const read = async (id: string | null | undefined) => {
    if (!id) return [] as ResultLine[];
    const text = (await request(`/files/${encodeURIComponent(id)}/content`, { method: 'GET' })).text;
    return text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as ResultLine);
  };
  for (const line of [...(await read(b?.output_file_id)), ...(await read(b?.error_file_id))]) {
    if (results.has(line.custom_id) && !line.error) continue;
    if (line.error || !line.response?.body || (line.response.status_code ?? 200) >= 400) {
      results.set(line.custom_id, { ok: false, error: new HwError('PROVIDER_ERROR', 'The AI could not complete this request.', line.error?.message ?? `status ${line.response?.status_code}`) });
      continue;
    }
    try {
      results.set(line.custom_id, { ok: true, result: parseChat(line.response.body as Parameters<typeof parseChat>[0], model) });
    } catch (e) {
      results.set(line.custom_id, { ok: false, error: e });
    }
  }
  return { state: 'succeeded', results };
}
