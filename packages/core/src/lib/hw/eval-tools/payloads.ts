// What raters submit for each task kind, when two submissions agree, and what an adjudicator
// is shown when they do not. Pure.

import { z } from 'zod';
import { alignWords, normaliseForReading, words, type AlignOp } from '../eval/reading';
import type { EvalItem } from '../eval/dataset';
import type { HwEvalTaskKind } from '@/db/hw-eval-schema';

const half = z.number().min(0).max(100).refine((x) => Math.abs(x * 2 - Math.round(x * 2)) < 1e-9, 'marks must be in 0.5 steps');
const note = z.string().trim().max(2000).optional();

export const TranscribePayload = z.object({ text: z.string().max(20_000) }).strict();
export const BlindMarkPayload = z.object({ byPoint: z.record(half), note }).strict();
export const KeyAuditPayload = z.object({
  points: z.array(z.object({ id: z.string().min(1).max(20), verdict: z.enum(['correct', 'partly_correct', 'wrong', 'not_in_source']), note })).min(1).max(50),
  missing: z.array(z.string().trim().min(1).max(1000)).max(20),
  note,
}).strict();
/** Regions are fractions of the image (0–1), so they survive any display size. */
export const DeidentifyPayload = z.object({
  verdict: z.enum(['clean', 'needs_blanking']),
  regions: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0).max(1), h: z.number().min(0).max(1) })).max(20),
  note,
}).strict();

export type TaskPayload =
  | z.infer<typeof TranscribePayload>
  | z.infer<typeof BlindMarkPayload>
  | z.infer<typeof KeyAuditPayload>
  | z.infer<typeof DeidentifyPayload>;

const SCHEMA: Record<HwEvalTaskKind, z.ZodTypeAny> = {
  transcribe: TranscribePayload, blind_mark: BlindMarkPayload, key_audit: KeyAuditPayload, deidentify: DeidentifyPayload,
};

export interface PayloadContext {
  /** blind_mark: point ids and their marks. key_audit: point ids. */
  points?: { id: string; marks: number }[];
}

/** Parses a submission; checks it against the task (every point marked, within its marks). */
export function parsePayload(kind: HwEvalTaskKind, raw: unknown, ctx: PayloadContext = {}): { ok: true; payload: TaskPayload } | { ok: false; problem: string } {
  const r = SCHEMA[kind].safeParse(raw);
  if (!r.success) return { ok: false, problem: `${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}` };
  const p = r.data as TaskPayload;
  if (kind === 'blind_mark' && ctx.points) {
    const by = (p as z.infer<typeof BlindMarkPayload>).byPoint;
    const ids = ctx.points.map((x) => x.id);
    const extra = Object.keys(by).filter((k) => !ids.includes(k));
    if (extra.length) return { ok: false, problem: `unknown points ${extra.join(', ')}` };
    for (const pt of ctx.points) {
      if (by[pt.id] === undefined) return { ok: false, problem: `no marks for ${pt.id}` };
      if (by[pt.id] > pt.marks + 1e-9) return { ok: false, problem: `${pt.id}: ${by[pt.id]} is more than its ${pt.marks} marks` };
    }
  }
  if (kind === 'key_audit' && ctx.points) {
    const got = (p as z.infer<typeof KeyAuditPayload>).points.map((x) => x.id).sort().join(',');
    if (got !== ctx.points.map((x) => x.id).sort().join(',')) return { ok: false, problem: 'judge every key point exactly once' };
  }
  if (kind === 'deidentify') {
    const d = p as z.infer<typeof DeidentifyPayload>;
    if (d.verdict === 'needs_blanking' && !d.regions.length) return { ok: false, problem: 'mark the regions to blank' };
    if (d.regions.some((g) => g.x + g.w > 1.0001 || g.y + g.h > 1.0001)) return { ok: false, problem: 'a region goes outside the image' };
  }
  return { ok: true, payload: p };
}

/** Transcripts agree when identical after the reading normalisation (NFC, spaces, line ends). */
export function payloadsAgree(kind: HwEvalTaskKind, a: TaskPayload, b: TaskPayload): boolean {
  if (kind === 'transcribe') return normaliseForReading((a as { text: string }).text) === normaliseForReading((b as { text: string }).text);
  if (kind === 'blind_mark') {
    const x = (a as { byPoint: Record<string, number> }).byPoint;
    const y = (b as { byPoint: Record<string, number> }).byPoint;
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    return [...keys].every((k) => x[k] === y[k]);
  }
  if (kind === 'deidentify') {
    const x = a as z.infer<typeof DeidentifyPayload>;
    const y = b as z.infer<typeof DeidentifyPayload>;
    return x.verdict === 'clean' && y.verdict === 'clean';
  }
  const x = a as z.infer<typeof KeyAuditPayload>;
  const y = b as z.infer<typeof KeyAuditPayload>;
  const v = (p: typeof x) => p.points.map((q) => `${q.id}:${q.verdict}`).sort().join(',');
  return v(x) === v(y) && !x.missing.length && !y.missing.length;
}

/** The task's outcome once every submission is in. */
export function outcomeOf(kind: HwEvalTaskKind, payloads: readonly TaskPayload[]): 'done' | 'needs_adjudication' {
  if (payloads.length < 2) {
    // Single-rater kinds: a clean de-identification or an all-correct audit is final; anything else gets a second look.
    if (kind === 'deidentify') return (payloads[0] as z.infer<typeof DeidentifyPayload>).verdict === 'clean' ? 'done' : 'needs_adjudication';
    if (kind === 'key_audit') {
      const p = payloads[0] as z.infer<typeof KeyAuditPayload>;
      return p.points.every((q) => q.verdict === 'correct') && !p.missing.length ? 'done' : 'needs_adjudication';
    }
    return 'done';
  }
  return payloads.every((p) => payloadsAgree(kind, payloads[0], p)) ? 'done' : 'needs_adjudication';
}

/** Word-level differences between two transcripts, for the adjudicator (truth = A, output = B). */
export function transcriptDiff(a: string, b: string): AlignOp[] {
  return alignWords(words(b), words(a));
}

/** Points the two markers gave different marks, with both values. */
export function markDiff(a: Record<string, number>, b: Record<string, number>): { pointId: string; a: number; b: number }[] {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).map((k) => ({ pointId: k, a: a[k], b: b[k] }));
}

/** Which items a task kind can be made from. */
export function eligibleForTask(kind: HwEvalTaskKind, it: EvalItem): boolean {
  const hasImage = !!(it.media.render || it.media.photo);
  if (kind === 'transcribe') return hasImage;
  if (kind === 'deidentify') return !!it.media.photo;
  if (kind === 'blind_mark') return !!it.key?.points.every((p) => p.text) && (hasImage || !!it.truthTranscript);
  return false; // key_audit tasks target keys, not items
}
