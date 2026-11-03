// Turns the report that `npm run hw:eval:report` writes (report.json, the ReportModel) into the rows the control room stores. Pure.
// Nothing is recalculated: each gate row, with its checks and its verdict, is copied as the report has it. Only two things are added,
// because a report cannot know them: the SCHEME SOURCE of the questions the dataset measured (declared by whoever imports it), and the
// production fingerprint of the configuration the runs used.

import { fingerprint, type FingerprintParts } from './fingerprint';
import { groupKey, productQuestionType, type GroupSchemeSource } from './group';

export type ReportVerdict = 'Eligible' | 'Not yet' | 'Insufficient data';
export interface ReportGateRow { subject: string; questionType: string; language: string; verdict: ReportVerdict; checks: { gate: string; state: string; detail: string }[] }
export interface ReportRun {
  runId: string; mode: string; status: string; configHash: string; gitCommit: string; repeat: number; costInr: number;
  counts: Record<string, number>; summary?: unknown;
}
export interface ReportJson { title: string; generatedAt: string; datasetRef: string; manifestSha256: string; runs: ReportRun[]; gates: ReportGateRow[] }

export type DbVerdict = 'eligible' | 'not_yet' | 'insufficient_data';
const VERDICT: Record<ReportVerdict, DbVerdict> = { Eligible: 'eligible', 'Not yet': 'not_yet', 'Insufficient data': 'insufficient_data' };
const SEVERITY: Record<DbVerdict, number> = { eligible: 0, insufficient_data: 1, not_yet: 2 };
const LANGUAGES = new Set(['en', 'hi', 'mixed']);

export interface GateResultDraft {
  groupKey: string; subject: string; questionType: 'very_short' | 'short' | 'long' | 'essay'; language: 'en' | 'hi' | 'mixed'; schemeSource: GroupSchemeSource;
  verdict: DbVerdict; checks: { gate: string; state: 'pass' | 'fail' | 'insufficient' | 'not_applicable'; detail: string }[];
  runIds: string[]; datasetVersions: string[]; productionFingerprint: string | null; fingerprintParts: FingerprintParts | null;
}

const STATES = new Set(['pass', 'fail', 'insufficient', 'not_applicable']);

/**
 * One result per product group. When several evaluation question types fall into one product type (for example mcq and very_short), the
 * group's verdict is the worst of them: eligible only if every one is.
 */
export function resultsFromReport(report: ReportJson, opts: { schemeSource: GroupSchemeSource; parts: FingerprintParts | null }): GateResultDraft[] {
  const problems: string[] = [];
  const byKey = new Map<string, { rows: ReportGateRow[]; type: GateResultDraft['questionType'] }>();
  for (const row of report.gates) {
    if (!LANGUAGES.has(row.language)) { problems.push(`unknown language "${row.language}"`); continue; }
    if (!VERDICT[row.verdict]) { problems.push(`unknown verdict "${row.verdict}"`); continue; }
    const type = productQuestionType(row.questionType);
    const key = groupKey({ subject: row.subject, questionType: type, language: row.language as GateResultDraft['language'], schemeSource: opts.schemeSource });
    const g = byKey.get(key) ?? { rows: [], type };
    g.rows.push(row);
    byKey.set(key, g);
  }
  if (problems.length) throw new Error(`the report cannot be imported: ${[...new Set(problems)].join('; ')}`);
  const fp = opts.parts ? fingerprint(opts.parts) : null;
  const runIds = report.runs.map((r) => r.runId);
  return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, g]) => {
    const verdict = g.rows.map((r) => VERDICT[r.verdict]).reduce((w, v) => (SEVERITY[v] > SEVERITY[w] ? v : w), 'eligible' as DbVerdict);
    const several = g.rows.length > 1;
    return {
      groupKey: key, subject: g.rows[0].subject, questionType: g.type, language: g.rows[0].language as GateResultDraft['language'], schemeSource: opts.schemeSource,
      verdict,
      checks: g.rows.flatMap((r) => r.checks.map((c) => ({
        gate: several ? `${r.questionType}: ${c.gate}` : c.gate,
        state: (STATES.has(c.state) ? c.state : 'insufficient') as GateResultDraft['checks'][number]['state'],
        detail: c.detail,
      }))),
      runIds, datasetVersions: [report.datasetRef], productionFingerprint: fp, fingerprintParts: opts.parts,
    };
  });
}

export function runRowsFromReport(report: ReportJson) {
  return report.runs.map((r) => ({
    runId: r.runId, mode: r.mode, status: r.status, datasetRef: report.datasetRef, manifestSha256: report.manifestSha256 || null,
    configHash: r.configHash ?? null, gitCommit: r.gitCommit ?? null, repeat: r.repeat ?? null, costPaise: Math.max(0, Math.round((r.costInr ?? 0) * 100)),
    counts: r.counts ?? {}, summary: (r.summary ?? {}) as Record<string, unknown>,
  }));
}
