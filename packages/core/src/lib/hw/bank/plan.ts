// What an import would do, decided without touching the database: compare the rows the file expands to with the rows already stored.
// The rule that matters: a row a person has checked or published is never changed by an import. If the file now says something different,
// that is a conflict the importer reports and refuses; only an explicit "revise" sends such a row back to draft (a new version, a new check).

import { rowKey, type ExpandedPaper, type ExpandedQuestion } from './expand';

export type RowAction = 'new' | 'unchanged' | 'update_draft' | 'revise' | 'conflict';

/** The part of a stored row the plan needs. */
export interface StoredRow {
  id: string;
  number: number;
  alt: string | null;
  variant: string | null;
  status: 'draft' | 'checked' | 'published' | 'rejected';
  contentHash: string;
  version: number;
}

export interface StoredPaper {
  id: string;
  status: 'draft' | 'checked' | 'published';
  version: number;
  sourceSha256: string;
  title: string;
  maxMarks: number;
  duration: string | null;
  sourceFiles: string[];
}

export interface RowPlan {
  key: string;
  number: number;
  alt: string | null;
  variant: string | null;
  action: RowAction;
  existingId?: string;
  existingStatus?: StoredRow['status'];
  /** Why, for the report: what the stored row is and what the file says. */
  note: string;
}

export interface ImportPlan {
  paper: 'new' | 'unchanged' | 'update';
  rows: RowPlan[];
  /** Stored rows the file no longer has. Reported, never deleted. */
  orphans: { key: string; status: StoredRow['status'] }[];
  counts: Record<RowAction, number> & { orphans: number; total: number };
  conflicts: RowPlan[];
  /** True when there is anything to write. */
  changes: boolean;
}

export function planImport(file: ExpandedPaper, sourceSha256: string, stored: { paper: StoredPaper | null; rows: StoredRow[] }, opts: { revise?: boolean } = {}): ImportPlan {
  const byKey = new Map(stored.rows.map((r) => [rowKey(r), r]));
  const seen = new Set<string>();
  const rows: RowPlan[] = file.questions.map((q: ExpandedQuestion) => {
    const key = rowKey(q);
    seen.add(key);
    const base = { key, number: q.number, alt: q.alt, variant: q.variant };
    const s = byKey.get(key);
    if (!s) return { ...base, action: 'new' as const, note: 'not in the bank yet' };
    const common = { existingId: s.id, existingStatus: s.status };
    if (s.contentHash === q.contentHash) return { ...base, ...common, action: 'unchanged' as const, note: `same content (${s.status})` };
    if (s.status === 'draft' || s.status === 'rejected') return { ...base, ...common, action: 'update_draft' as const, note: `content changed; it is still ${s.status}, so it is updated and goes back to draft` };
    if (opts.revise) return { ...base, ...common, action: 'revise' as const, note: `content changed after a person ${s.status === 'checked' ? 'checked' : 'published'} it; sent back to draft (version ${s.version + 1}) and needs a new check` };
    return { ...base, ...common, action: 'conflict' as const, note: `content changed after a person ${s.status === 'checked' ? 'checked' : 'published'} it; not changed (pass revise to send it back to draft)` };
  });
  const orphans = stored.rows.filter((r) => !seen.has(rowKey(r))).map((r) => ({ key: rowKey(r), status: r.status }));
  const counts = { new: 0, unchanged: 0, update_draft: 0, revise: 0, conflict: 0, orphans: orphans.length, total: rows.length };
  for (const r of rows) counts[r.action] += 1;

  let paper: ImportPlan['paper'] = 'new';
  if (stored.paper) {
    const p = stored.paper;
    const same = p.sourceSha256 === sourceSha256 && p.title === file.title && p.maxMarks === file.maxMarks && p.duration === file.duration
      && JSON.stringify(p.sourceFiles) === JSON.stringify(file.sourceFiles);
    paper = same ? 'unchanged' : 'update';
  }
  const changes = counts.new + counts.update_draft + counts.revise > 0 || paper !== 'unchanged';
  return { paper, rows, orphans, counts, conflicts: rows.filter((r) => r.action === 'conflict'), changes };
}

/** One screenful for a person: what would happen, and the conflicts spelled out. */
export function renderPlan(file: ExpandedPaper, plan: ImportPlan): string {
  const c = plan.counts;
  const out = [
    `${file.board} Class ${file.classLevel} ${file.subject} (${file.subjectCode}) ${file.session} ${file.kind}: ${c.total} rows to attempt`,
    `paper: ${plan.paper}`,
    `rows: ${c.new} new, ${c.unchanged} unchanged, ${c.update_draft} updated (draft), ${c.revise} sent back to draft, ${c.conflict} conflicts`,
  ];
  if (c.orphans) out.push(`${c.orphans} stored rows are not in the file (kept): ${plan.orphans.map((o) => `${o.key} [${o.status}]`).join(', ')}`);
  for (const r of plan.conflicts) out.push(`  CONFLICT Q${r.number}${r.alt ?? ''}${r.variant ? ' (vi)' : ''}: ${r.note}`);
  return out.join('\n');
}
