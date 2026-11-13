// R2 access for this feature: reuses the shared client from services/r2.ts, but only ever
// touches keys under hw-assignments/, and refuses to run without credentials (the shared
// module only logs a warning).
//
// For local development ONLY: when HW_DEV_LOCAL_STORAGE_DIR is set and NODE_ENV is not 'production', files are kept in that folder and read
// back as data: URLs, so answers can be tried without touching the shared bucket (the exam booklet's stand-in, exam-pages.ts, does the same).
// In production the variable is ignored.

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/lib/services/r2';
import { HwError, isHwError } from '../errors';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertHwKey } from './keys';
import { mimeOfKey } from '../photo/image';

function devPath(key: string): string | null {
  const dir = process.env.HW_DEV_LOCAL_STORAGE_DIR;
  if (!dir || process.env.NODE_ENV === 'production') return null;
  const base = resolve(dir);
  const p = resolve(join(base, key));
  if (!p.startsWith(base)) throw new Error('local dev storage: path outside the folder');
  return p;
}

/** Signed read URLs are short-lived: long enough to open a marking screen, no longer. */
const READ_URL_SECONDS = 300;

function bucket(): string {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new HwError('NOT_CONFIGURED', 'File storage is not configured.', 'R2 credentials are not fully set');
  }
  return R2_BUCKET_NAME;
}

/**
 * A storage call. When the bucket refuses it, the learner sees which refusal it was (AccessDenied, NoSuchBucket, InvalidAccessKeyId, ...:
 * names, never secrets), so a wrong storage setting is found from the screen; the full error goes to the log.
 */
async function storage<T>(what: string, key: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (isHwError(e)) throw e;
    const err = e as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    const name = err.Code ?? err.name ?? 'Error';
    throw new HwError('PROVIDER_ERROR', `File storage did not accept this (${name}). Please try again later.`,
      `R2 ${what} ${key} failed: ${name} (HTTP ${err.$metadata?.httpStatusCode ?? '?'}): ${err.message ?? ''}`);
  }
}

export async function putHwObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  assertHwKey(key);
  const dev = devPath(key);
  if (dev) { await mkdir(dirname(dev), { recursive: true }); await writeFile(dev, body); return; }
  await storage('put', key, () => r2Client.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType })));
}

export async function getHwObject(key: string): Promise<Uint8Array> {
  assertHwKey(key);
  const dev = devPath(key);
  if (dev) return new Uint8Array(await readFile(dev));
  const res = await storage('get', key, () => r2Client.send(new GetObjectCommand({ Bucket: bucket(), Key: key })));
  if (!res.Body) throw new HwError('NOT_FOUND', 'File not found.', `R2 object ${key} has no body`);
  return res.Body.transformToByteArray();
}

export async function signedReadUrl(key: string): Promise<string> {
  assertHwKey(key);
  const dev = devPath(key);
  if (dev) return `data:${key.endsWith('.json.gz') ? 'application/gzip' : mimeOfKey(key)};base64,${(await readFile(dev)).toString('base64')}`;
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: READ_URL_SECONDS });
}

export async function deleteHwObject(key: string): Promise<void> {
  assertHwKey(key);
  const dev = devPath(key);
  if (dev) { await rm(dev, { force: true }); return; }
  await r2Client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
