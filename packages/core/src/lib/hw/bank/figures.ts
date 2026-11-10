// Figure images for the board-paper bank (phase 4). The bank file describes every figure in words; a learner can only be shown the figure if someone
// has attached its picture (a crop of the board's PDF). Pictures are private objects (hw-bank/…), shown through short-lived signed links, and are
// part of what a person checks: a checked row's pictures never change (withdraw the check, attach, check again).

import { and, eq, inArray } from 'drizzle-orm';
import type { db as Db } from '@/db';
import { hwBankFigure, hwBankPaper, hwBankQuestion } from '@/db/hw-bank-schema';
import { bankFigureKey, keyVersion } from '../storage/keys';
import { rowLabel } from './review';
import type { PaperIdentity } from './review-store';

type Database = typeof Db;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
type Reader = Database | Tx;

export const MAX_FIGURE_BYTES = 3 * 1024 * 1024;
export const MIN_FIGURE_SIDE = 40;
export const MAX_FIGURE_SIDE = 4000;

export interface ImageInfo { mime: 'image/png' | 'image/jpeg' | 'image/webp'; ext: 'png' | 'jpg' | 'webp'; width: number; height: number; bytes: number }

const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));

/** What the bytes really are, from their own header (never from a file name), with the size in pixels — no size limits applied. */
export function readImageHeader(bytes: Uint8Array): ImageInfo | { problem: string } {
  const n = bytes.length;
  if (n === 0) return { problem: 'the file is empty' };
  let kind: ImageInfo['mime'] | null = null;
  let width = 0;
  let height = 0;
  if (n >= 24 && bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG' && ascii(bytes, 12, 4) === 'IHDR') {
    kind = 'image/png'; width = u32be(bytes, 16); height = u32be(bytes, 20);
  } else if (n >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    kind = 'image/jpeg';
    for (let i = 2; i + 9 < n;) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const m = bytes[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { height = u16be(bytes, i + 5); width = u16be(bytes, i + 7); break; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + u16be(bytes, i + 2);
    }
  } else if (n >= 30 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    kind = 'image/webp';
    const chunk = ascii(bytes, 12, 4);
    if (chunk === 'VP8X') { width = 1 + u24le(bytes, 24); height = 1 + u24le(bytes, 27); }
    else if (chunk === 'VP8 ') { width = (bytes[26] | (bytes[27] << 8)) & 0x3fff; height = (bytes[28] | (bytes[29] << 8)) & 0x3fff; }
    else if (chunk === 'VP8L') { const v = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24); width = 1 + (v & 0x3fff); height = 1 + ((v >>> 14) & 0x3fff); }
  }
  if (!kind) return { problem: 'this is not a PNG, JPEG or WebP picture' };
  if (!width || !height) return { problem: 'the size of the picture could not be read' };
  return { mime: kind, ext: kind === 'image/png' ? 'png' : kind === 'image/jpeg' ? 'jpg' : 'webp', width, height, bytes: n };
}

/** A figure picture: what the bytes really are, within the figure limits. Or why they cannot be used. */
export function sniffImage(bytes: Uint8Array): ImageInfo | { problem: string } {
  const n = bytes.length;
  if (n > MAX_FIGURE_BYTES) return { problem: `the picture is ${(n / 1048576).toFixed(1)} MB; the limit is ${MAX_FIGURE_BYTES / 1048576} MB` };
  const info = readImageHeader(bytes);
  if ('problem' in info) return info;
  const { width, height } = info;
  if (width < MIN_FIGURE_SIDE || height < MIN_FIGURE_SIDE) return { problem: `the picture is ${width}x${height}; each side must be at least ${MIN_FIGURE_SIDE} pixels` };
  if (width > MAX_FIGURE_SIDE || height > MAX_FIGURE_SIDE) return { problem: `the picture is ${width}x${height}; each side must be at most ${MAX_FIGURE_SIDE} pixels` };
  return info;
}

export class FigureRefusedError extends Error {
  constructor(message: string) { super(message); this.name = 'FigureRefusedError'; }
}

export type PutObject = (key: string, body: Uint8Array, contentType: string) => Promise<void>;

export interface AttachResult { figureId: string; rows: { question: string; key: string }[]; image: ImageInfo }

/**
 * Attaches a picture to every row that carries this figure id (a figure shared by two alternatives is one picture, stored once per row). All or
 * nothing: refused when the picture is not a usable image, the figure is not in the paper, or any row that carries it is already checked or published.
 */
export async function attachFigureImage(database: Database, put: PutObject, ident: PaperIdentity, figureId: string, bytes: Uint8Array): Promise<AttachResult> {
  const image = sniffImage(bytes);
  if ('problem' in image) throw new FigureRefusedError(image.problem);
  return database.transaction(async (tx) => {
    const paper = (await tx.select({ id: hwBankPaper.id }).from(hwBankPaper).where(and(
      eq(hwBankPaper.board, ident.board), eq(hwBankPaper.classLevel, ident.klass), eq(hwBankPaper.subjectCode, ident.code), eq(hwBankPaper.session, ident.year), eq(hwBankPaper.kind, ident.kind),
    )).for('update').limit(1))[0];
    if (!paper) throw new FigureRefusedError('that paper is not in the bank: import it first');
    const rows = await tx.select({
      id: hwBankFigure.id, storageKey: hwBankFigure.storageKey, status: hwBankQuestion.status, number: hwBankQuestion.number, alt: hwBankQuestion.alt, variant: hwBankQuestion.variant,
    }).from(hwBankFigure).innerJoin(hwBankQuestion, eq(hwBankQuestion.id, hwBankFigure.questionId))
      .where(and(eq(hwBankQuestion.paperId, paper.id), eq(hwBankFigure.figureId, figureId)));
    if (!rows.length) throw new FigureRefusedError(`no figure ${figureId} in that paper`);
    const locked = rows.filter((r) => r.status === 'checked' || r.status === 'published');
    if (locked.length) {
      throw new FigureRefusedError(`${locked.map(rowLabel).join(', ')} ${locked.length === 1 ? 'is' : 'are'} already checked: a checked question's pictures do not change. Ask for a correction on ${locked.length === 1 ? 'it' : 'them'} first, then attach the picture and check again.`);
    }
    const out: AttachResult['rows'] = [];
    for (const r of rows) {
      const key = bankFigureKey(r.id, keyVersion(r.storageKey) + 1, image.ext);
      await put(key, bytes, image.mime);
      await tx.update(hwBankFigure).set({ storageKey: key }).where(eq(hwBankFigure.id, r.id));
      out.push({ question: rowLabel(r), key });
    }
    return { figureId, rows: out, image };
  });
}

export interface FigureState { question: string; figureId: string; side: 'paper' | 'scheme'; confidence: string; hasImage: boolean; status: string }

/** Every figure of the paper, with whether it has its picture: what is left to attach. */
export async function figureStates(d: Reader, ident: PaperIdentity): Promise<FigureState[]> {
  const rows = await d.select({
    number: hwBankQuestion.number, alt: hwBankQuestion.alt, variant: hwBankQuestion.variant, status: hwBankQuestion.status, figureId: hwBankFigure.figureId, side: hwBankFigure.side,
    confidence: hwBankFigure.confidence, storageKey: hwBankFigure.storageKey,
  }).from(hwBankFigure).innerJoin(hwBankQuestion, eq(hwBankQuestion.id, hwBankFigure.questionId)).innerJoin(hwBankPaper, eq(hwBankPaper.id, hwBankQuestion.paperId))
    .where(and(eq(hwBankPaper.board, ident.board), eq(hwBankPaper.classLevel, ident.klass), eq(hwBankPaper.subjectCode, ident.code), eq(hwBankPaper.session, ident.year), eq(hwBankPaper.kind, ident.kind)));
  return rows
    .sort((a, b) => a.number - b.number || (a.alt ?? '').localeCompare(b.alt ?? '') || a.figureId.localeCompare(b.figureId))
    .map((r) => ({ question: rowLabel(r), figureId: r.figureId, side: r.side, confidence: r.confidence, hasImage: Boolean(r.storageKey), status: r.status }));
}

export interface LearnerFigure { figureId: string; description: string; url: string }

/** The pictures a learner sees with a question (the paper's own figures, never the marking scheme's), as short-lived links. A missing picture is left out. */
export async function learnerFigures(d: Reader, bankRowIds: string[], sign: (key: string) => Promise<string>): Promise<Map<string, LearnerFigure[]>> {
  const out = new Map<string, LearnerFigure[]>();
  if (!bankRowIds.length) return out;
  const rows = await d.select({ qid: hwBankFigure.questionId, figureId: hwBankFigure.figureId, description: hwBankFigure.description, key: hwBankFigure.storageKey })
    .from(hwBankFigure).where(and(inArray(hwBankFigure.questionId, bankRowIds), eq(hwBankFigure.side, 'paper')));
  for (const r of rows.sort((a, b) => a.figureId.localeCompare(b.figureId))) {
    if (!r.key) continue;
    const list = out.get(r.qid) ?? [];
    list.push({ figureId: r.figureId, description: r.description, url: await sign(r.key) });
    out.set(r.qid, list);
  }
  return out;
}
