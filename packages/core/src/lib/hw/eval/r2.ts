// Eval files in R2: only under hw-assignments/evals/. Datasets are immutable there too: the
// uploader refuses a version whose manifest already exists.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/services/r2';
import { putHwObject } from '../storage/r2';
import { datasetObjectKey, EVAL_PREFIX, parseDatasetRef } from './dataset';

const TYPES: Record<string, string> = { '.json': 'application/json', '.jsonl': 'application/x-ndjson', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gz': 'application/gzip', '.html': 'text/html; charset=utf-8', '.csv': 'text/csv' };
const typeOf = (f: string) => TYPES[f.slice(f.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';

export function assertEvalKey(key: string): string {
  if (!key.startsWith(EVAL_PREFIX)) throw new Error(`refusing eval key outside ${EVAL_PREFIX}: ${key}`);
  return key;
}

export async function evalObjectExists(key: string): Promise<boolean> {
  assertEvalKey(key);
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (e) {
    const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return false;
    throw e;
  }
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

/** Uploads a local dataset version; the manifest goes last, so a half-upload is never a dataset. */
export async function uploadDatasetVersion(ref: string, dir: string): Promise<string[]> {
  parseDatasetRef(ref);
  const manifestKey = datasetObjectKey(ref, 'manifest.jsonl');
  if (await evalObjectExists(manifestKey)) throw new Error(`dataset ${ref} already exists in R2; datasets are immutable`);
  const all = files(dir).map((p) => relative(dir, p).split(sep).join('/'));
  const ordered = [...all.filter((f) => f !== 'manifest.jsonl'), 'manifest.jsonl'];
  for (const rel of ordered) await putHwObject(assertEvalKey(datasetObjectKey(ref, rel)), new Uint8Array(readFileSync(join(dir, rel))), typeOf(rel));
  return ordered.map((rel) => datasetObjectKey(ref, rel));
}

export async function uploadRun(runId: string, dir: string): Promise<string[]> {
  if (!/^run_[a-z0-9_-]+$/i.test(runId)) throw new Error(`bad run id ${runId}`);
  const keys: string[] = [];
  for (const p of files(dir)) {
    const rel = relative(dir, p).split(sep).join('/');
    const key = assertEvalKey(`${EVAL_PREFIX}runs/${runId}/${rel}`);
    await putHwObject(key, new Uint8Array(readFileSync(p)), typeOf(rel));
    keys.push(key);
  }
  return keys;
}
