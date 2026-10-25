// Writing-pad copy tasks (sources A and B): an evaluator copies a known text on the pad, and
// the ink and its render are stored like a student's answer, under
// hw-assignments/evals/copies/<name>/<vN>/<itemId>/<raterId>/. One copy per rater per item.
// Which datasets are open for copying is HW_EVAL_COPY_DATASETS (comma-separated name@vN).
// scripts/hw-eval-reference.ts turns the copies into a new dataset version.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/services/r2';
import { getHwConfig } from '../config';
import { HwError } from '../errors';
import { EVAL_PREFIX, parseDatasetRef } from '../eval/dataset';
import { inkSummary, validateEncodedInk } from '../ink/stroke-format';
import { checkRender } from '../ink/png';
import { putHwObject } from '../storage/r2';
import { requireRater, type EvalActor } from './access';
import { evalSource } from './source';

export function copyDatasets(): string[] {
  return (getHwConfig().HW_EVAL_COPY_DATASETS ?? '').split(',').map((s) => s.trim()).filter(Boolean).filter((r) => {
    try { parseDatasetRef(r); return true; } catch { return false; }
  });
}

export const copyPrefix = (ref: string) => {
  const { name, version } = parseDatasetRef(ref);
  return `${EVAL_PREFIX}copies/${name}/${version}/`;
};

interface CopyStore {
  /** Item ids this rater has already copied in a dataset. */
  copied(ref: string, raterId: string): Promise<Set<string>>;
  exists(key: string): Promise<boolean>;
  put(key: string, body: Uint8Array, type: string): Promise<void>;
}

function localStore(root: string): CopyStore {
  const path = (key: string) => join(root, key.slice(EVAL_PREFIX.length));
  return {
    async copied(ref, raterId) {
      const dir = path(copyPrefix(ref));
      if (!existsSync(dir)) return new Set();
      return new Set(readdirSync(dir).filter((itemId) => existsSync(join(dir, itemId, raterId, 'meta.json'))));
    },
    async exists(key) { return existsSync(path(key)); },
    async put(key, body) { mkdirSync(dirname(path(key)), { recursive: true }); writeFileSync(path(key), body); },
  };
}

function r2Store(): CopyStore {
  return {
    async copied(ref, raterId) {
      const out = new Set<string>();
      let token: string | undefined;
      do {
        const r = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: copyPrefix(ref), ContinuationToken: token }));
        for (const o of r.Contents ?? []) {
          const m = o.Key?.slice(copyPrefix(ref).length).match(/^([^/]+)\/([^/]+)\/meta\.json$/);
          if (m && m[2] === raterId) out.add(m[1]);
        }
        token = r.IsTruncated ? r.NextContinuationToken : undefined;
      } while (token);
      return out;
    },
    async exists(key) {
      const r = await r2Client.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME, Prefix: key, MaxKeys: 1 }));
      return (r.KeyCount ?? 0) > 0;
    },
    put: (key, body, type) => putHwObject(key, body, type),
  };
}

let override: CopyStore | null = null;
/** Tests only. */
export function _setCopyStore(s: CopyStore | null): void { override = s; }
const store = () => override ?? (getHwConfig().HW_EVAL_LOCAL_ROOT ? localStore(getHwConfig().HW_EVAL_LOCAL_ROOT!) : r2Store());

/** The next texts for this rater to copy, across the open datasets. */
export async function copyQueue(a: EvalActor, limit = 20) {
  const r = requireRater(a);
  const out: { datasetRef: string; itemId: string; text: string; language: string; question: string }[] = [];
  let remaining = 0;
  for (const ref of copyDatasets()) {
    const done = await store().copied(ref, r.id);
    for (const it of await evalSource().items(ref)) {
      if (it.truthTranscript?.how !== 'known_text' || done.has(it.id)) continue;
      remaining++;
      if (out.length < limit) out.push({ datasetRef: ref, itemId: it.id, text: it.truthTranscript.text, language: it.language, question: it.question.text });
    }
  }
  return { items: out, remaining };
}

export async function storeCopy(a: EvalActor, input: { datasetRef: string; itemId: string; ink: Uint8Array; render: Uint8Array; durationMs: number; device: string }) {
  const r = requireRater(a);
  const cfg = getHwConfig();
  if (!copyDatasets().includes(input.datasetRef)) throw new HwError('FORBIDDEN', 'This dataset is not open for copying.');
  const it = (await evalSource().items(input.datasetRef)).find((x) => x.id === input.itemId);
  if (!it || it.truthTranscript?.how !== 'known_text') throw new HwError('NOT_FOUND', 'Nothing to copy for this item.');
  if (input.ink.length > cfg.HW_INK_MAX_BYTES || input.render.length > cfg.HW_RENDER_MAX_BYTES) throw new HwError('PAYLOAD_TOO_LARGE', 'This writing is too large.');
  let json: unknown;
  try {
    json = JSON.parse(gunzipSync(input.ink, { maxOutputLength: cfg.HW_INK_MAX_BYTES * 20 }).toString('utf8'));
  } catch {
    throw new HwError('BAD_REQUEST', 'The handwriting file could not be read.');
  }
  const ink = validateEncodedInk(json);
  if (!ink.ok) throw new HwError('BAD_REQUEST', 'The handwriting file is not valid.', ink.problem);
  if (!ink.ink.strokes.length) throw new HwError('BAD_REQUEST', 'Nothing is written yet.');
  const png = checkRender(input.render, cfg.HW_RENDER_MAX_WIDTH);
  if (!png.ok) throw new HwError('BAD_REQUEST', 'The handwriting image is not valid.', png.problem);

  const base = `${copyPrefix(input.datasetRef)}${it.id}/${r.id}/`;
  const s = store();
  if (await s.exists(`${base}meta.json`)) throw new HwError('CONFLICT', 'You have already copied this text.');
  const meta = {
    itemId: it.id, datasetRef: input.datasetRef, raterId: r.id, pseudonym: r.pseudonym,
    device: input.device.slice(0, 40), durationMs: Math.max(0, Math.round(input.durationMs)),
    ink: inkSummary(ink.ink), render: { width: png.info.width, height: png.info.height }, createdAt: new Date().toISOString(),
  };
  await s.put(`${base}ink.v1.json.gz`, input.ink, 'application/gzip');
  await s.put(`${base}render.v1.png`, input.render, 'image/png');
  // meta.json last: its presence means the copy is complete.
  await s.put(`${base}meta.json`, new TextEncoder().encode(JSON.stringify(meta)), 'application/json');
  return { ok: true as const };
}
