// R2 access for this feature: reuses the shared client from services/r2.ts, but only ever
// touches keys under hw-assignments/, and refuses to run without credentials (the shared
// module only logs a warning).

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/lib/services/r2';
import { HwError } from '../errors';
import { assertHwKey } from './keys';

/** Signed read URLs are short-lived: long enough to open a marking screen, no longer. */
const READ_URL_SECONDS = 300;

function bucket(): string {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new HwError('NOT_CONFIGURED', 'File storage is not configured.', 'R2 credentials are not fully set');
  }
  return R2_BUCKET_NAME;
}

export async function putHwObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  assertHwKey(key);
  await r2Client.send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }));
}

export async function getHwObject(key: string): Promise<Uint8Array> {
  assertHwKey(key);
  const res = await r2Client.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new HwError('NOT_FOUND', 'File not found.', `R2 object ${key} has no body`);
  return res.Body.transformToByteArray();
}

export async function signedReadUrl(key: string): Promise<string> {
  assertHwKey(key);
  return getSignedUrl(r2Client, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: READ_URL_SECONDS });
}
