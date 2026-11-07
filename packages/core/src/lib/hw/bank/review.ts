// Phase 2 of the board-paper bank: a person checks each imported row against the printed paper and marking scheme, and what they decided is recorded.
// This file is the rules, with no database: the verdict file a reviewer hands back, and what applying it would do. store-side: review-store.ts.
//
// The rules that matter:
//   * a verdict is bound to the exact content the reviewer saw (its hash). A row that changed since is not checked by that verdict.
//   * "ok" on a row that has something a person must look at (needs_check) needs every one of those items confirmed, word for word.
//   * "fix" and "reject" must say what is wrong. "fix" keeps (or sends back) the row as a draft; the correction is made in the bank file and re-imported.
//   * all or nothing: one verdict that cannot be applied stops the whole file, and the reason is named.
//   * a paper is checked only when every one of its rows is, and the marks still add up.

import { z } from 'zod';
import { rowKey } from './expand';

export const REVIEW_FORMAT = 'cbse-paper-check/1';

const letter = z.enum(['A', 'B', 'C', 'D']);

export const verdictFileSchema = z.object({
  format: z.literal(REVIEW_FORMAT),
  paper: z.object({
    board: z.string().min(1), klass: z.number().int().min(1).max(12), code: z.string().min(1), year: z.string().min(1), kind: z.enum(['sqp', 'past_paper']),
  }),
  /** The person who checked, as they want to be recorded. */
  reviewer: z.string().trim().min(2, 'the reviewer must give a name'),
  verdicts: z.array(z.object({
    q: z.number().int().positive(),
    alt: letter.nullish().transform((x) => x ?? null),
    variant: z.literal('vi').nullish().transform((x) => x ?? null),
    content_hash: z.string().regex(/^[0-9a-f]{64}$/, 'not a content hash'),
    verdict: z.enum(['ok', 'fix', 'reject']),
    confirmed: z.array(z.string()).default([]),
    note: z.string().default(''),
  })).min(1, 'the file has no verdicts'),
});

export type VerdictFile = z.infer<typeof verdictFileSchema>;
export type VerdictIn = VerdictFile['verdicts'][number];

export function parseVerdictFile(jsonText: string): { ok: true; file: VerdictFile } | { ok: false; problems: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(jsonText); } catch (e) { return { ok: false, problems: [`not valid JSON: ${e instanceof Error ? e.message : String(e)}`] }; }
  const r = verdictFileSchema.safeParse(raw);
  if (r.success) return { ok: true, file: r.data };
  return { ok: false, problems: r.error.issues.slice(0, 50).map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`) };
}

/** The part of a stored row the review rules need. */
export interface ReviewRow {
  id: string;
  number: number;
  alt: string | null;
  variant: string | null;
  status: 'draft' | 'checked' | 'published' | 'rejected';
  contentHash: string;
  version: number;
  needsCheck: string[];
  marks: number;
  choiceGroup: string | null;
}

export interface ReviewPaper { id: string; status: 'draft' | 'checked' | 'published'; maxMarks: number }

/** The latest recorded verdict for a row, to tell a repeated file from a new decision. */
export interface LastReview { questionId: string; contentHash: string; verdict: 'ok' | 'fix' | 'reject'; note: string; reviewer: string }

export type ReviewAction = 'check' | 'note_fix' | 'withdraw' | 'reject' | 'unchanged';

export interface ReviewItem {
  key: string;
  label: string;
  verdict: VerdictIn;
  action: ReviewAction;
  row: ReviewRow;
  note: string;
}

export interface ReviewPlan {
  items: ReviewItem[];
  problems: string[];
  counts: Record<ReviewAction, number>;
  /** What the paper's own status becomes once this is applied (null: stays as it is). */
  paperAfter: 'checked' | 'draft' | null;
  /** Rows (after this file) that are not yet checked: what stands between the paper and "checked". */
  remaining: number;
  /** True when there is anything to write. */
  changes: boolean;
}

export const rowLabel = (r: { number: number; alt: string | null; variant: string | null }) => `Q${r.number}${r.alt ?? ''}${r.variant ? ' (vi)' : ''}`;

/** The paper's marks, counting an internal choice once (its alternatives carry the same marks) and leaving out the visually impaired versions. */
export function paperTotalMarks(rows: Pick<ReviewRow, 'marks' | 'choiceGroup' | 'variant'>[]): { total: number; problems: string[] } {
  const problems: string[] = [];
  const groups = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (r.variant) continue;
    if (!r.choiceGroup) { total += r.marks; continue; }
    const seen = groups.get(r.choiceGroup);
    if (seen === undefined) { groups.set(r.choiceGroup, r.marks); total += r.marks; }
    else if (seen !== r.marks) problems.push(`${r.choiceGroup}: its alternatives carry different marks (${seen} and ${r.marks})`);
  }
  return { total, problems };
}

/** What applying a verdict file would do. Nothing is written here; `problems` non-empty means the whole file is refused. */
export function planReview(paper: ReviewPaper, rows: ReviewRow[], last: LastReview[], file: VerdictFile): ReviewPlan {
  const problems: string[] = [];
  const byKey = new Map(rows.map((r) => [rowKey(r), r]));
  const lastBy = new Map(last.map((l) => [l.questionId, l]));
  const items: ReviewItem[] = [];
  const seen = new Set<string>();

  if (paper.status === 'published') problems.push('the paper is published: it is not reviewed again here');

  for (const v of file.verdicts) {
    const key = rowKey({ number: v.q, alt: v.alt, variant: v.variant });
    const label = rowLabel({ number: v.q, alt: v.alt, variant: v.variant });
    if (seen.has(key)) { problems.push(`${label}: two verdicts for the same question`); continue; }
    seen.add(key);
    const row = byKey.get(key);
    if (!row) { problems.push(`${label}: not in the bank`); continue; }
    if (row.status === 'published') { problems.push(`${label}: published, so it is not reviewed here`); continue; }
    if (row.contentHash !== v.content_hash) { problems.push(`${label}: the question changed after this sheet was made (the verdict is for other content); make a new sheet`); continue; }
    const note = v.note.trim();
    const lr = lastBy.get(row.id);
    const repeat = lr && lr.contentHash === row.contentHash && lr.verdict === v.verdict && lr.note === note && lr.reviewer === file.reviewer.trim();
    const add = (action: ReviewAction) => items.push({ key, label, verdict: v, action, row, note });

    if (v.verdict === 'ok') {
      if (row.status === 'rejected') { problems.push(`${label}: rejected; change it in the bank file and import it again before it can be checked`); continue; }
      if (row.status === 'checked') { add('unchanged'); continue; }
      const missing = row.needsCheck.filter((n) => !v.confirmed.includes(n));
      const extra = v.confirmed.filter((c) => !row.needsCheck.includes(c));
      if (missing.length) { problems.push(`${label}: ok, but ${missing.length} thing${missing.length === 1 ? '' : 's'} to look at ${missing.length === 1 ? 'was' : 'were'} not confirmed: ${missing.map((m) => JSON.stringify(m)).join('; ')}`); continue; }
      if (extra.length) { problems.push(`${label}: confirms something the question does not list (${extra.map((m) => JSON.stringify(m)).join('; ')}); make a new sheet`); continue; }
      add('check');
      continue;
    }
    if (!note) { problems.push(`${label}: ${v.verdict} must say what is wrong`); continue; }
    if (v.verdict === 'fix') {
      if (row.status === 'rejected') { problems.push(`${label}: rejected; change it in the bank file and import it again`); continue; }
      if (row.status === 'checked') { add('withdraw'); continue; }
      add(repeat ? 'unchanged' : 'note_fix');
      continue;
    }
    // reject
    if (row.status === 'rejected') { add('unchanged'); continue; }
    add('reject');
  }

  const counts: Record<ReviewAction, number> = { check: 0, note_fix: 0, withdraw: 0, reject: 0, unchanged: 0 };
  for (const i of items) counts[i.action] += 1;

  // The statuses after this file, for the paper as a whole.
  const after = new Map(rows.map((r) => [r.id, r.status as ReviewRow['status']]));
  for (const i of items) {
    if (i.action === 'check') after.set(i.row.id, 'checked');
    else if (i.action === 'withdraw') after.set(i.row.id, 'draft');
    else if (i.action === 'reject') after.set(i.row.id, 'rejected');
  }
  const remaining = [...after.values()].filter((s) => s !== 'checked' && s !== 'published').length;
  let paperAfter: ReviewPlan['paperAfter'] = null;
  if (remaining === 0 && rows.length > 0) {
    const t = paperTotalMarks(rows);
    if (t.problems.length) problems.push(...t.problems);
    else if (Math.abs(t.total - paper.maxMarks) > 1e-9) problems.push(`all rows would be checked but they add to ${t.total} marks, the paper says ${paper.maxMarks}`);
    else if (paper.status === 'draft') paperAfter = 'checked';
  } else if (paper.status === 'checked') {
    paperAfter = 'draft';
  }
  const changes = items.some((i) => i.action !== 'unchanged') || paperAfter !== null;
  return { items, problems, counts, paperAfter, remaining, changes };
}

export function renderReviewPlan(plan: ReviewPlan, reviewer: string): string {
  const c = plan.counts;
  const out = [
    `reviewer: ${reviewer}`,
    `${plan.items.length} verdicts: ${c.check} checked, ${c.note_fix} fixes noted, ${c.withdraw} checks withdrawn, ${c.reject} rejected, ${c.unchanged} already recorded`,
  ];
  for (const i of plan.items) if (i.action === 'note_fix' || i.action === 'withdraw' || i.action === 'reject') out.push(`  ${i.label}: ${i.action === 'note_fix' ? 'FIX' : i.action === 'withdraw' ? 'FIX (check withdrawn)' : 'REJECT'} - ${i.note}`);
  out.push(plan.paperAfter ? `paper: becomes ${plan.paperAfter}` : `paper: stays as it is; ${plan.remaining} row${plan.remaining === 1 ? '' : 's'} not checked yet`);
  for (const p of plan.problems) out.push(`  PROBLEM ${p}`);
  return out.join('\n');
}

export interface ReviewStatus {
  paperStatus: ReviewPaper['status'];
  counts: Record<ReviewRow['status'], number> & { total: number };
  /** Draft rows that carry something a person must look at. */
  flaggedDraft: number;
  /** Draft rows whose latest verdict, for the content they hold now, is a fix: the correction is waiting to be made. */
  openFixes: { label: string; note: string; reviewer: string }[];
  /** Draft rows with no verdict for the content they hold now. */
  unreviewed: number;
}

export function reviewStatus(paper: ReviewPaper, rows: ReviewRow[], last: LastReview[]): ReviewStatus {
  const counts = { draft: 0, checked: 0, published: 0, rejected: 0, total: rows.length };
  const lastBy = new Map(last.map((l) => [l.questionId, l]));
  const openFixes: ReviewStatus['openFixes'] = [];
  let flaggedDraft = 0;
  let unreviewed = 0;
  for (const r of rows) {
    counts[r.status] += 1;
    if (r.status !== 'draft') continue;
    if (r.needsCheck.length) flaggedDraft += 1;
    const l = lastBy.get(r.id);
    if (l && l.contentHash === r.contentHash && l.verdict === 'fix') openFixes.push({ label: rowLabel(r), note: l.note, reviewer: l.reviewer });
    else unreviewed += 1;
  }
  return { paperStatus: paper.status, counts, flaggedDraft, openFixes, unreviewed };
}

export function renderReviewStatus(s: ReviewStatus): string {
  const c = s.counts;
  const out = [
    `paper: ${s.paperStatus}`,
    `rows: ${c.total} (${c.checked} checked, ${c.draft} draft, ${c.rejected} rejected, ${c.published} published)`,
    `draft rows: ${s.unreviewed} waiting for a review (${s.flaggedDraft} of the draft rows carry something to look at), ${s.openFixes.length} with a fix waiting`,
  ];
  for (const f of s.openFixes) out.push(`  FIX ${f.label} (${f.reviewer}): ${f.note}`);
  return out.join('\n');
}
