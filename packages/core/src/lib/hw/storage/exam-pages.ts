// Where a learner's photographed answer pages are kept: R2 (keys under hw-exams/), read through short-lived signed links.
//
// For local development ONLY there is a stand-in: when HW_DEV_LOCAL_STORAGE_DIR is set and NODE_ENV is not 'production', pages are written to that
// folder and read back as data: URLs, so the booklet can be tried without a bucket. In production the variable is ignored.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { assertHwKey, HW_EXAMS_PREFIX } from './keys';
import { deleteHwObject, putHwObject, signedReadUrl } from './r2';

export interface PageStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
  readUrl(key: string): Promise<string>;
}

const r2Store: PageStore = { put: putHwObject, remove: deleteHwObject, readUrl: signedReadUrl };

function localStore(root: string): PageStore {
  const base = resolve(root);
  const pathOf = (key: string) => {
    assertHwKey(key);
    if (!key.startsWith(HW_EXAMS_PREFIX)) throw new Error(`local page store only holds ${HW_EXAMS_PREFIX} keys`);
    const p = resolve(join(base, key));
    if (!p.startsWith(base)) throw new Error('local page store: path outside the folder');
    return p;
  };
  const typeOf = (key: string) => (key.endsWith('.png') ? 'image/png' : key.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
  return {
    async put(key, bytes) { const p = pathOf(key); await mkdir(dirname(p), { recursive: true }); await writeFile(p, bytes); },
    async remove(key) { await rm(pathOf(key), { force: true }); },
    async readUrl(key) { return `data:${typeOf(key)};base64,${(await readFile(pathOf(key))).toString('base64')}`; },
  };
}

export function examPageStore(): PageStore {
  const dir = process.env.HW_DEV_LOCAL_STORAGE_DIR;
  if (dir && process.env.NODE_ENV !== 'production') return localStore(dir);
  return r2Store;
}
