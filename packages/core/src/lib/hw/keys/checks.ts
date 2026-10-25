// Code checks on answer keys (stage1-design.md §2.4). No model involved. Pure.

import type { AnswerKey, PointSupport, PointVerification, ValuePoint, ValuePointKind } from './types';

const KINDS: ReadonlySet<string> = new Set<ValuePointKind>(['key_point', 'step', 'unit', 'format', 'competency']);
const SUPPORT: ReadonlySet<string> = new Set<PointSupport>(['supported', 'partial', 'unsupported']);

const onHalfGrid = (x: number) => Number.isFinite(x) && Math.abs(x * 2 - Math.round(x * 2)) < 1e-9;
const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

/** Writer JSON -> key, or the reasons it cannot be read. Nothing is repaired or defaulted. */
export function parseWriterOutput(json: unknown): { key: AnswerKey } | { problems: string[] } {
  const o = json as { reference_answer?: unknown; value_points?: unknown };
  const problems: string[] = [];
  if (!o || typeof o !== 'object') return { problems: ['output is not an object'] };
  if (typeof o.reference_answer !== 'string' || !o.reference_answer.trim()) problems.push('reference_answer is missing');
  if (!Array.isArray(o.value_points) || o.value_points.length === 0) problems.push('value_points is missing or empty');
  if (problems.length) return { problems };
  const points: ValuePoint[] = [];
  (o.value_points as unknown[]).forEach((raw, i) => {
    const p = raw as Record<string, unknown>;
    const where = `value_points[${i}]`;
    if (!p || typeof p !== 'object') return void problems.push(`${where} is not an object`);
    if (typeof p.id !== 'string' || !p.id) problems.push(`${where}.id is missing`);
    if (typeof p.text !== 'string' || !p.text.trim()) problems.push(`${where}.text is missing`);
    if (typeof p.marks !== 'number') problems.push(`${where}.marks is not a number`);
    if (typeof p.kind !== 'string' || !KINDS.has(p.kind)) problems.push(`${where}.kind is invalid`);
    if (!Array.isArray(p.cites) || p.cites.some((c) => typeof c !== 'string')) problems.push(`${where}.cites is invalid`);
    const alts = Array.isArray(p.accepted_alternatives) ? p.accepted_alternatives.filter((a): a is string => typeof a === 'string') : null;
    if (!alts) problems.push(`${where}.accepted_alternatives is invalid`);
    points.push({
      id: String(p.id ?? ''), text: String(p.text ?? '').trim(), marks: Number(p.marks), kind: p.kind as ValuePointKind,
      cites: Array.isArray(p.cites) ? (p.cites as string[]) : [], acceptedAlternatives: alts ?? [],
    });
  });
  return problems.length ? { problems } : { key: { referenceAnswer: (o.reference_answer as string).trim(), valuePoints: points } };
}

/** Every check that a key must pass before the verifier sees it. Empty = passed. */
export function checkKey(key: AnswerKey, passageIds: ReadonlySet<string>, questionMarks: number, opts: { requireCites?: boolean } = {}): string[] {
  const requireCites = opts.requireCites ?? true;
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of key.valuePoints) {
    if (ids.has(p.id)) problems.push(`duplicate point id ${p.id}`);
    ids.add(p.id);
    if (!(p.marks > 0)) problems.push(`${p.id}: marks must be more than 0`);
    if (!onHalfGrid(p.marks)) problems.push(`${p.id}: marks ${p.marks} not in 0.5 steps`);
    if (requireCites && p.cites.length === 0) problems.push(`${p.id}: cites no passage`);
    for (const c of p.cites) if (!passageIds.has(c)) problems.push(`${p.id}: cites ${c}, which was not given`);
  }
  const total = sum(key.valuePoints.map((p) => p.marks));
  if (Math.abs(total - questionMarks) > 1e-9) problems.push(`points add up to ${total}, question is worth ${questionMarks}`);
  return problems;
}

/** Verifier JSON -> one verdict per point, or the reasons it cannot be used. */
export function parseVerifierOutput(json: unknown, pointIds: readonly string[]): { verdicts: PointVerification[] } | { problems: string[] } {
  const raw = (json as { verdicts?: unknown })?.verdicts;
  if (!Array.isArray(raw)) return { problems: ['verdicts is missing'] };
  const problems: string[] = [];
  const byId = new Map<string, PointVerification>();
  for (const v of raw as Record<string, unknown>[]) {
    const id = typeof v?.point_id === 'string' ? v.point_id : '';
    if (!pointIds.includes(id)) { problems.push(`verdict for unknown point "${id}"`); continue; }
    if (byId.has(id)) { problems.push(`two verdicts for ${id}`); continue; }
    if (typeof v.support !== 'string' || !SUPPORT.has(v.support)) { problems.push(`${id}: invalid support`); continue; }
    byId.set(id, { pointId: id, support: v.support as PointSupport, reason: typeof v.reason === 'string' ? v.reason : '' });
  }
  for (const id of pointIds) if (!byId.has(id)) problems.push(`no verdict for ${id}`);
  return problems.length ? { problems } : { verdicts: pointIds.map((id) => byId.get(id)!) };
}

/**
 * Model family for the writer ≠ verifier rule. OpenRouter ids are "vendor/model"; Gemini
 * direct ids are bare ("gemini-…"). Two Google models are the same family whichever way
 * they are called.
 */
export function modelFamily(model: string): string {
  const m = model.trim().toLowerCase();
  if (m.includes('/')) return m.split('/')[0] === 'google-vertex' ? 'google' : m.split('/')[0];
  if (/^(gemini|gemma)\b/.test(m)) return 'google';
  if (/^(gpt|o\d)\b/.test(m)) return 'openai';
  if (/^claude\b/.test(m)) return 'anthropic';
  return m.split('-')[0];
}
