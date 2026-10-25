// Human work and pad copies -> the items of a NEW dataset version (datasets never change in
// place). Pure: the caller reads the export / copies and writes the version.
//
// Rules:
//   - transcripts become truth (how: double_typed_adjudicated) only for items without a
//     known text; a known text always wins;
//   - human marks become reference marks (double_marked / adjudicated) except where marks
//     are known by construction (mutation items), which stay; every rater's own marks go to
//     a sidecar for the teacher baseline;
//   - an item whose image still needs blanking, or whose key the audit did not pass, is
//     left out of the new version, and listed.

import { HARMLESS, newItemId, type EvalItem } from './dataset';
import type { ReferenceExport } from '../eval-tools/admin';

export interface ApplyReport {
  transcripts: number;
  marks: number;
  keptByConstruction: string[];
  knownTextKept: string[];
  droppedNeedsBlanking: string[];
  droppedKeyFailedAudit: string[];
  unknownItems: string[];
}

const sum = (m: Record<string, number>) => Object.values(m).reduce((s, x) => s + x, 0);

export function applyReference(items: readonly EvalItem[], ref: ReferenceExport): { items: EvalItem[]; raters: Record<string, Record<string, Record<string, number>>>; report: ApplyReport } {
  const ids = new Set(items.map((x) => x.id));
  const report: ApplyReport = { transcripts: 0, marks: 0, keptByConstruction: [], knownTextKept: [], droppedNeedsBlanking: [], droppedKeyFailedAudit: [], unknownItems: [] };
  report.unknownItems = [...Object.keys(ref.transcripts), ...Object.keys(ref.marks), ...Object.keys(ref.deidentification)].filter((id) => !ids.has(id));
  const failedKeys = new Set(Object.entries(ref.keyAudits).filter(([, a]) => a.missing.length || a.points.some((p) => p.verdict !== 'correct')).map(([k]) => k));
  const raters: Record<string, Record<string, Record<string, number>>> = {};
  const out: EvalItem[] = [];

  for (const orig of items) {
    const it: EvalItem = structuredClone(orig);
    if (ref.deidentification[it.id]?.verdict === 'needs_blanking') { report.droppedNeedsBlanking.push(it.id); continue; }
    if (it.key && failedKeys.has(it.key.keyId)) { report.droppedKeyFailedAudit.push(it.id); continue; }
    const t = ref.transcripts[it.id];
    if (t) {
      if (it.truthTranscript?.how === 'known_text') report.knownTextKept.push(it.id);
      else { it.truthTranscript = { text: t.text, how: 'double_typed_adjudicated' }; report.transcripts++; }
    }
    const m = ref.marks[it.id];
    if (m) {
      raters[it.id] = m.raters;
      if (it.referenceMarks?.how === 'by_construction') report.keptByConstruction.push(it.id);
      else { it.referenceMarks = { byPoint: m.byPoint, total: sum(m.byPoint), how: m.how === 'adjudicated' ? 'adjudicated' : 'double_marked' }; report.marks++; }
    }
    out.push(it);
  }
  // A variant whose parent was dropped cannot be compared with it: drop it too.
  const kept = new Set(out.map((x) => x.id));
  const final = out.filter((x) => !x.mutation?.parentItem || kept.has(x.mutation.parentItem));
  return { items: final, raters, report };
}

export interface CopyRecord {
  itemId: string;
  raterId: string;
  device: string;
  /** Paths inside the new version's folder. */
  inkPath: string;
  renderPath: string;
}

/**
 * One new ink item per copy, next to the typed originals. A copied variant points at the
 * same writer's copy of its parent when there is one (same handwriting on both sides of the
 * invariance check), otherwise at the typed parent.
 */
export function applyCopies(items: readonly EvalItem[], copies: readonly CopyRecord[]): { items: EvalItem[]; idOf: Map<string, string>; skipped: string[] } {
  const byId = new Map(items.map((x) => [x.id, x]));
  const idOf = new Map<string, string>(); // `${itemId}|${raterId}` -> new item id
  const skipped: string[] = [];
  for (const c of copies) {
    if (!byId.get(c.itemId)) { skipped.push(`${c.itemId}: not in the dataset`); continue; }
    idOf.set(`${c.itemId}|${c.raterId}`, newItemId());
  }
  const out: EvalItem[] = items.map((x) => structuredClone(x));
  for (const c of copies) {
    const src = byId.get(c.itemId);
    const id = idOf.get(`${c.itemId}|${c.raterId}`);
    if (!src || !id) continue;
    const copy: EvalItem = structuredClone(src);
    copy.id = id;
    copy.mode = 'ink';
    copy.media = { ink: c.inkPath, render: c.renderPath, photo: null };
    copy.device = c.device || 'unknown';
    if (copy.mutation?.parentItem) {
      copy.mutation.parentItem = idOf.get(`${copy.mutation.parentItem}|${c.raterId}`) ?? copy.mutation.parentItem;
    }
    out.push(copy);
  }
  return { items: out, idOf, skipped };
}

/** For reports: which harmless/injection variants have a same-writer parent. */
export function sameWriterPairs(items: readonly EvalItem[]): number {
  const byId = new Map(items.map((x) => [x.id, x]));
  return items.filter((x) => x.mode === 'ink' && x.mutation?.parentItem && (HARMLESS.has(x.mutation.type) || x.mutation.type === 'injection')
    && byId.get(x.mutation.parentItem)?.mode === 'ink' && byId.get(x.mutation.parentItem)?.device === x.device).length;
}
