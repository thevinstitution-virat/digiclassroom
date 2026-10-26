import { createHash } from 'crypto';
import { PASSAGE_ID_RE } from './passage-id';

/**
 * The fixed uuid5 namespace of library contract v2. Generated once on 26 Oct 2026 and never changed:
 * changing it changes every point id in every collection that uses this contract.
 */
export const POINT_ID_NAMESPACE = '8fa6d651-f95a-49d8-a753-f3f06fc98958';

export const UUID_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const UUID_RE = new RegExp(`^${UUID_SRC}$`);

/** RFC 4122 version-5 uuid (SHA-1), without a dependency, so every repo computes the same bytes. */
export function uuid5(name: string, namespace: string): string {
  if (!UUID_RE.test(namespace)) throw new Error(`Not a lowercase uuid namespace: ${namespace}`);
  const bytes = createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(Buffer.from(name, 'utf8'))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function checkIds(workId: string, passageId: string) {
  if (!UUID_RE.test(workId)) throw new Error(`work_id must be a lowercase uuid, got ${JSON.stringify(workId)}`);
  if (!PASSAGE_ID_RE.test(passageId)) throw new Error(`Not a passage id: ${JSON.stringify(passageId)}`);
}

/**
 * The Qdrant point id of a live passage: uuid5 of `<work_id>/<passage_id>`. The same passage keeps
 * the same point id across revisions and re-indexes, so a changed passage is re-embedded in place.
 */
export function pointIdFor(workId: string, passageId: string): string {
  checkIds(workId, passageId);
  return uuid5(`${workId}/${passageId}`, POINT_ID_NAMESPACE);
}

/**
 * The point id of a passage indexed for review (`status: preview`) from a pending revision:
 * uuid5 of `<work_id>/<passage_id>@<revision_id>`. A preview point must never share the live
 * point's id, or embedding a revision for review would overwrite the passage every app is reading.
 */
export function previewPointIdFor(workId: string, passageId: string, revisionId: string): string {
  checkIds(workId, passageId);
  if (!UUID_RE.test(revisionId)) throw new Error(`revision_id must be a lowercase uuid, got ${JSON.stringify(revisionId)}`);
  return uuid5(`${workId}/${passageId}@${revisionId}`, POINT_ID_NAMESPACE);
}
