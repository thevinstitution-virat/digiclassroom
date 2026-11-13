// R2 keys for this feature. The digiclassroom-pro bucket is shared with another app, so
// every key is built here, under hw-assignments/, and anything that reads or deletes a key
// checks it with assertHwKey first.

export const HW_PREFIX = 'hw-assignments/';
/** The board-paper bank's figure images (docs/hw-eval/board-paper-importer.md): private objects, shown to a learner through short-lived signed links only. */
export const HW_BANK_PREFIX = 'hw-bank/';
/** Exam packages: a learner's photographed answer pages (docs/hw-eval/exam-packages.md), private, read through short-lived signed links. */
export const HW_EXAMS_PREFIX = 'hw-exams/';

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
export function answerFileKey(ref: AnswerFileRef, kind: HwFileKind, version: number, photoExt?: 'png' | 'jpg' | 'webp'): string {
  if (!Number.isInteger(version) || version < 1) throw new Error('hw key: version must be a positive integer');
  return [
    'hw-assignments',
    checkId('orgId', ref.orgId),
    checkId('assignmentId', ref.assignmentId),
    checkId('submissionId', ref.submissionId),
    checkId('questionId', ref.questionId),
    // a photo keeps the type it really is (photo/image.ts reads it from the bytes)
    `${kind}.v${version}.${kind === 'photo' && photoExt ? photoExt : EXT[kind]}`,
  ].join('/');
}

/** A figure image of the board-paper bank: hw-bank/{figure row id}.v{version}.{ext}. A new image is a new version, never a replaced object. */
export function bankFigureKey(figureRowId: string, version: number, ext: 'png' | 'jpg' | 'webp'): string {
  if (!Number.isInteger(version) || version < 1) throw new Error('hw key: version must be a positive integer');
  return `${HW_BANK_PREFIX}${checkId('figureRowId', figureRowId)}.v${version}.${ext}`;
}

/**
 * A picture printed with an exam question (migration 037): hw-exams/figures/{sha-256 of the bytes}.{ext}. Named by its content, so the same picture
 * in several pools or practice tests is one object, and an object never changes once written.
 */
export function examFigureKey(sha256Hex: string, ext: 'png' | 'jpg' | 'webp'): string {
  if (!/^[0-9a-f]{64}$/.test(sha256Hex)) throw new Error('hw key: an exam figure is named by the sha-256 of its bytes (64 hex characters)');
  return `${HW_EXAMS_PREFIX}figures/${sha256Hex}.${ext}`;
}

/** One photographed answer page: hw-exams/{attempt id}/p{page id}.{ext}. A page row is never re-pointed, so no version is needed. */
export function examPageKey(attemptId: string, pageId: string, ext: 'png' | 'jpg' | 'webp'): string {
  return `${HW_EXAMS_PREFIX}${checkId('attemptId', attemptId)}/p${checkId('pageId', pageId)}.${ext}`;
}

/**
 * The picture of an answer that is read and shown: the photo when the learner answered with a photo, else the ink render. Both may exist when
 * a learner switched between Write and Photo; the mode they handed in with decides.
 */
export function answerImageKey(a: { mode: string; renderKey: string | null; imageKey: string | null }): string | null {
  return a.mode === 'photo' ? a.imageKey : a.renderKey ?? a.imageKey;
}

/** Refuse any key outside this feature's prefixes, or with path tricks in it. */
export function assertHwKey(key: string): string {
  if (!(key.startsWith(HW_PREFIX) || key.startsWith(HW_BANK_PREFIX) || key.startsWith(HW_EXAMS_PREFIX)) || key.includes('..') || key.includes('//') || key.includes('\\')) {
    throw new Error(`refusing R2 key outside ${HW_PREFIX}, ${HW_BANK_PREFIX} and ${HW_EXAMS_PREFIX}: ${key}`);
  }
  return key;
}

/** The version number in a key written by answerFileKey, or 0. */
export function keyVersion(key: string | null | undefined): number {
  const m = key?.match(/\.v(\d+)\.[a-z.]+$/);
  return m ? Number(m[1]) : 0;
}
