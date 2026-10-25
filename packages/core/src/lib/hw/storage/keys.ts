// R2 keys for this feature. The digiclassroom-pro bucket is shared with another app, so
// every key is built here, under hw-assignments/, and anything that reads or deletes a key
// checks it with assertHwKey first.

export const HW_PREFIX = 'hw-assignments/';

export type HwFileKind = 'ink' | 'render' | 'photo';

const EXT: Record<HwFileKind, string> = { ink: 'json.gz', render: 'png', photo: 'webp' };
const ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface AnswerFileRef {
  orgId: string;
  assignmentId: string;
  submissionId: string;
  questionId: string;
}

function checkId(label: string, v: string): string {
  if (!ID.test(v)) throw new Error(`hw key: ${label} has unsafe characters`);
  return v;
}

/**
 * hw-assignments/{org}/{assignment}/{submission}/{question}/{kind}.v{version}.{ext}
 * Versioned names: a re-upload writes a new object, so a reader job in flight never sees a
 * half-replaced file.
 */
export function answerFileKey(ref: AnswerFileRef, kind: HwFileKind, version: number): string {
  if (!Number.isInteger(version) || version < 1) throw new Error('hw key: version must be a positive integer');
  return [
    'hw-assignments',
    checkId('orgId', ref.orgId),
    checkId('assignmentId', ref.assignmentId),
    checkId('submissionId', ref.submissionId),
    checkId('questionId', ref.questionId),
    `${kind}.v${version}.${EXT[kind]}`,
  ].join('/');
}

/** Refuse any key outside this feature's prefix, or with path tricks in it. */
export function assertHwKey(key: string): string {
  if (!key.startsWith(HW_PREFIX) || key.includes('..') || key.includes('//') || key.includes('\\')) {
    throw new Error(`refusing R2 key outside ${HW_PREFIX}: ${key}`);
  }
  return key;
}

/** The version number in a key written by answerFileKey, or 0. */
export function keyVersion(key: string | null | undefined): number {
  const m = key?.match(/\.v(\d+)\.[a-z.]+$/);
  return m ? Number(m[1]) : 0;
}
