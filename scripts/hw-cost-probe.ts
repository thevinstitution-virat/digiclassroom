// Cost work, task 1 and 2: two small live probes that the eval runner cannot make.
//
//   npm run hw:cost:probe -- cache   [--budget-inr 2]    does a GPT-5.6+ model write a cache that is never read?
//   npm run hw:cost:probe -- batch   [--wait-minutes 6]   does the provider batch path work, with what usage and what cost?
//   npm run hw:cost:probe -- direct gemini|openai [--wait-minutes 30] [--images 3]
//       a real image batch through the production provider code (Gemini direct, or OpenAI direct with gpt-6-luna): submit-to-complete
//       time and usage, appended to docs/hw-eval/cost1/batch-timings.jsonl. Needs a valid GEMINI_API_KEY / OPENAI_API_KEY.
//
// (from apps/api). Uses synthetic text only (no student data), spends well under ₹1, and prints
// every number from the provider's own usage fields.

import { readFileSync } from 'node:fs';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const KEY_SCHEMA = { type: 'object', properties: { points: { type: 'array', items: { type: 'string' } } }, required: ['points'], additionalProperties: false };
const SYSTEM = 'You write a short answer key for a school question using ONLY the passages given. Return JSON {"points": [..]}.';

/** A realistic textbook-key prompt: several passages (about 5k tokens) then the question. */
function longPrompt(question: string, topic: string): string {
  const sentence = (i: number) => `Passage ${i} on ${topic}: the textbook explains that the process has several stages, that each stage depends on the one before it, and that students should be able to describe the inputs, the outputs and the conditions needed.`;
  return `Passages:\n${Array.from({ length: 70 }, (_, i) => sentence(i + 1)).join('\n')}\n\nQuestion: ${question}`;
}

async function chat(body: Record<string, unknown>): Promise<{ usage: Record<string, unknown>; model: string; content: string }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { usage?: Record<string, unknown>; model?: string; choices?: { message?: { content?: string } }[]; error?: { message?: string } };
  if (!res.ok || !j.usage) throw new Error(`OpenRouter ${res.status}: ${j.error?.message ?? JSON.stringify(j).slice(0, 300)}`);
  return { usage: j.usage, model: j.model ?? '', content: j.choices?.[0]?.message?.content ?? '' };
}

const base = (model: string, user: string, extra: Record<string, unknown> = {}) => ({
  model,
  messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
  response_format: { type: 'json_schema', json_schema: { name: 'k', strict: true, schema: KEY_SCHEMA } },
  reasoning: { effort: 'low' },
  ...extra,
});

async function cacheProbe() {
  const model = 'openai/gpt-6-luna';
  const show = (label: string, r: Awaited<ReturnType<typeof chat>>) => {
    const u = r.usage as { prompt_tokens?: number; completion_tokens?: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } };
    console.log(`${label.padEnd(58)} prompt ${u.prompt_tokens}  cached ${u.prompt_tokens_details?.cached_tokens ?? 'n/r'}  cache-write ${u.prompt_tokens_details?.cache_write_tokens ?? 'n/r'}  out ${u.completion_tokens}  cost $${u.cost}`);
    return u;
  };
  console.log(`model ${model}; each prompt ~5k tokens (system + 70 passage lines + question)\n`);

  // 1. Default (automatic) caching: five different questions over the same passages. The common
  //    prefix is long; do the calls pay for cache writes that a later call reads?
  console.log('A. default caching, five questions about the SAME passages (a textbook-key shape):');
  for (let i = 1; i <= 3; i++) show(`  question ${i}`, await chat(base(model, longPrompt(`Describe stage ${i} of the process.`, 'photosynthesis'))));

  // 2. Default caching, five questions about DIFFERENT passages: no shared prefix beyond the system prompt.
  console.log('\nB. default caching, three questions about DIFFERENT passages (what keys for different questions look like):');
  for (const t of ['the water cycle', 'the French Revolution', 'quadratic equations']) show(`  ${t}`, await chat(base(model, longPrompt('Describe the main idea.', t))));

  // 3. The same different-passage calls in explicit mode with no breakpoint: nothing written, nothing read.
  console.log('\nC. explicit mode, no breakpoint, the same three different-passage questions:');
  for (const t of ['the water cycle', 'the French Revolution', 'quadratic equations']) {
    show(`  ${t}`, await chat(base(model, longPrompt('Describe the main idea.', t), { prompt_cache_options: { mode: 'explicit' } })));
  }

  // 4. Explicit mode with one breakpoint after the static prefix (the passages), two questions: one write, then reads.
  console.log('\nD. explicit mode, a breakpoint after the shared passages, two questions:');
  for (let i = 1; i <= 2; i++) {
    const prefix = longPrompt('', 'photosynthesis').replace(/\n\nQuestion: $/, '');
    show(`  question ${i}`, await chat({
      ...base(model, ''),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: [{ type: 'text', text: prefix, prompt_cache_breakpoint: { mode: 'explicit' } }, { type: 'text', text: `Question: Describe stage ${i} of the process.` }] },
      ],
      prompt_cache_options: { mode: 'explicit' },
    }));
  }
}

async function batchProbe() {
  const wait = Number(arg('wait-minutes', '6'));
  const model = 'google/gemini-3.5-flash-lite';
  const key = process.env.OPENROUTER_API_KEY;
  const post = async (path: string, body?: unknown) => {
    const res = await fetch(`https://openrouter.ai/api/v1${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let j: unknown = null;
    try { j = JSON.parse(text); } catch { /* keep text */ }
    return { status: res.status, j, text: text.slice(0, 400) };
  };
  const textBody = (n: number) => base(model, `Plants make food. Give ${n} point(s) about it.`, { reasoning: { effort: 'minimal' } });

  // Images: the provider is said to refuse inline images in a batch. Try it, with a 1x1 PNG.
  const png1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const withImage = { endpoint: '/v1/chat/completions', model, completion_window: '24h', requests: [{ custom_id: 'img', body: { model, messages: [{ role: 'user', content: [{ type: 'text', text: 'What is this?' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${png1}`, detail: 'low' } }] }] } }] };
  const img = await post('/batches', withImage);
  console.log(`batch with an inline image -> HTTP ${img.status} ${img.status >= 400 ? img.text : JSON.stringify(img.j).slice(0, 300)}`);

  const text = await post('/batches', { endpoint: '/v1/chat/completions', model, completion_window: '24h', requests: [1, 2].map((n) => ({ custom_id: `t${n}`, body: textBody(n) })) });
  console.log(`batch of 2 text requests -> HTTP ${text.status} ${JSON.stringify(text.j).slice(0, 300)}`);
  const id = (text.j as { id?: string } | null)?.id;
  if (!id) return;
  const started = Date.now();
  while ((Date.now() - started) / 60_000 < wait) {
    await new Promise((r) => setTimeout(r, 15_000));
    const g = await post(`/batches/${id}`);
    const b = g.j as { status?: string; results?: { custom_id: string; response?: { status_code?: number; body?: { usage?: Record<string, unknown> } } }[] | null; expires_at?: string; request_counts?: unknown } | null;
    console.log(`  ${((Date.now() - started) / 1000).toFixed(0)} s: ${b?.status}`);
    if (b?.status === 'completed' && b.results) {
      for (const r of b.results) console.log(`  ${r.custom_id}: status ${r.response?.status_code} usage ${JSON.stringify(r.response?.body?.usage)}`);
      console.log(`finished in ${((Date.now() - started) / 1000).toFixed(0)} s`);
      return;
    }
    if (b?.status && !['validating', 'in_progress', 'finalizing', 'completed'].includes(b.status)) { console.log(`  ended: ${b.status} ${JSON.stringify(g.j).slice(0, 300)}`); return; }
  }
  console.log(`still not finished after ${wait} minutes (id ${id}); a homework batch must wait for this`);
}

async function directProbe(which: string) {
  const { appendFileSync, readFileSync: read } = await import('node:fs');
  const wait = Number(arg('wait-minutes', '30'));
  const nImages = Number(arg('images', '3'));
  const cfg = which === 'gemini'
    ? { provider: 'gemini' as const, model: 'gemini-3.5-flash-lite', keyName: 'GEMINI_API_KEY', options: { thinkingLevel: 'MINIMAL' as const } }
    : { provider: 'openai' as const, model: 'gpt-6-luna', keyName: 'OPENAI_API_KEY', options: { reasoningEffort: 'low' } };
  const key = process.env[cfg.keyName];
  if (!key || /placeholder|your_|^sk-\.\.\./i.test(key)) throw new Error(`${cfg.keyName} is not set to a real key in this environment (apps/api/.env.local): no ${which} round trip is possible. Put a PAID-tier key there and rerun.`);
  const { readCall } = await import('@/lib/hw/reader/gemini-reader');
  const { createBatch, pollBatch } = await import('@/lib/hw/ai');
  // Synthetic font images from the existing small-run dataset: no student data.
  const dir = '../../hw-evals/datasets/smallrun-a/v2';
  const items = read(`${dir}/manifest.jsonl`, 'utf8').trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l) as { id: string; language: string; media: { render?: string } }).filter((i) => i.media.render).slice(0, nImages);
  const answers = items.map((i) => ({ answerId: i.id, languageHint: i.language as 'en' | 'hi' | 'mixed', png: new Uint8Array(read(`${dir}/${i.media.render}`)), mimeType: 'image/png' as const }));
  const call = { ...readCall(cfg.model, { answers }, cfg.options), provider: cfg.provider };
  const submitted = Date.now();
  const id = await createBatch([{ key: 'probe', call }], `hw-probe-${which}`);
  console.log(`${which}: batch ${id} submitted with ${nImages} image(s) in one request`);
  const row: Record<string, unknown> = { provider: cfg.provider, model: cfg.model, kind: 'read', images: nImages, submittedAt: new Date(submitted).toISOString() };
  while ((Date.now() - submitted) / 60_000 < wait) {
    await new Promise((r) => setTimeout(r, 15_000));
    const o = await pollBatch(cfg.provider, id, cfg.model);
    const secs = Math.round((Date.now() - submitted) / 1000);
    console.log(`  ${secs} s: ${o.state}`);
    if (o.state === 'pending') continue;
    Object.assign(row, { completedAt: new Date().toISOString(), seconds: secs, outcome: o.state === 'failed' ? 'failed' : 'completed' });
    if (o.state === 'failed') row.reason = o.reason;
    else { const e = o.results.get('probe'); row.requestOk = Boolean(e?.ok); if (e?.ok) row.usage = e.result.usage; else row.error = String((e as { error?: Error } | undefined)?.error?.message ?? 'no result'); }
    break;
  }
  if (!row.outcome) Object.assign(row, { outcome: 'still_pending', seconds: Math.round((Date.now() - submitted) / 1000) });
  console.log(JSON.stringify(row));
  appendFileSync('../../docs/hw-eval/cost1/batch-timings.jsonl', JSON.stringify(row) + String.fromCharCode(10));
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'direct' && !process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set (apps/api/.env.local)');
  if (mode === 'cache') await cacheProbe();
  else if (mode === 'batch') await batchProbe();
  else if (mode === 'direct') await directProbe(process.argv[3] ?? '');
  else throw new Error('usage: hw-cost-probe cache|batch');
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
void readFileSync;
