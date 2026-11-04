// "Runs & gates" (roadmap 5.5), read-only. Everything here is what `npm run hw:eval:gates -- import` stored from the command line's own
// report.json: nothing is recalculated, so the screen cannot disagree with `hw:eval:report` for the same run. A new report is a new row;
// old ones stay (the tables refuse updates and deletes).

import { desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { hwEvalGateResult, hwEvalRegression, hwEvalRun } from '@/db/hw-control-schema';
import { requireSuperAdmin, type EvalActor } from '../eval-tools/access';

export interface DatasetRow { datasetRef: string; runs: number; manifestSha256: string | null; lastImportedAt: Date }

export interface RunsAndGates {
  /** Regression-gate results as imported from regression.json, newest first. */
  regressions: Array<{ id: string; baselineRunId: string; candidateRunId: string; datasetRef: string; ok: boolean; checks: unknown[]; importedBy: string; importedAt: Date }>;
  datasets: DatasetRow[];
  runs: Array<{
    runId: string; mode: string; status: string; datasetRef: string; manifestSha256: string | null; configHash: string | null; gitCommit: string | null;
    repeat: number | null; costPaise: number; counts: Record<string, number>; summary: Record<string, unknown>; importedBy: string; importedAt: Date;
  }>;
  /** The newest gate result of every group, as imported; `earlier` is how many older ones the group has. */
  gates: Array<{
    id: string; groupKey: string; subject: string; questionType: string; language: string; schemeSource: string; verdict: string;
    checks: Array<{ gate: string; state: string; detail: string }>; runIds: string[]; datasetVersions: string[]; productionFingerprint: string | null;
    importedBy: string; importedAt: Date; earlier: number;
  }>;
}

export async function runsAndGates(a: EvalActor): Promise<RunsAndGates> {
  requireSuperAdmin(a);
  const runs = await db.select().from(hwEvalRun).orderBy(desc(hwEvalRun.importedAt)).limit(300);
  const datasets = new Map<string, DatasetRow>();
  for (const r of runs) {
    const d = datasets.get(r.datasetRef);
    if (!d) datasets.set(r.datasetRef, { datasetRef: r.datasetRef, runs: 1, manifestSha256: r.manifestSha256, lastImportedAt: r.importedAt });
    else d.runs++;
  }
  const latest = await db.execute<{ id: string }>(sql`SELECT DISTINCT ON (group_key) id FROM hw_eval_gate_result ORDER BY group_key, imported_at DESC, id`);
  const counts = await db.execute<{ group_key: string; n: number }>(sql`SELECT group_key, count(*)::int AS n FROM hw_eval_gate_result GROUP BY group_key`);
  const all = await db.select().from(hwEvalGateResult).orderBy(hwEvalGateResult.groupKey, desc(hwEvalGateResult.importedAt)).limit(2000);
  const keep = new Set(latest.rows.map((r) => r.id));
  const n = new Map(counts.rows.map((r) => [r.group_key, Number(r.n)]));
  const regressions = await db.select().from(hwEvalRegression).orderBy(desc(hwEvalRegression.importedAt)).limit(100);
  return {
    regressions: regressions.map((r) => ({ id: r.id, baselineRunId: r.baselineRunId, candidateRunId: r.candidateRunId, datasetRef: r.datasetRef, ok: r.ok, checks: r.checks, importedBy: r.importedBy, importedAt: r.importedAt })),
    datasets: [...datasets.values()].sort((x, y) => +y.lastImportedAt - +x.lastImportedAt),
    runs: runs.map((r) => ({ runId: r.runId, mode: r.mode, status: r.status, datasetRef: r.datasetRef, manifestSha256: r.manifestSha256, configHash: r.configHash, gitCommit: r.gitCommit, repeat: r.repeat, costPaise: r.costPaise, counts: r.counts, summary: r.summary, importedBy: r.importedBy, importedAt: r.importedAt })),
    gates: all.filter((g) => keep.has(g.id)).map((g) => ({
      id: g.id, groupKey: g.groupKey, subject: g.subject, questionType: g.questionType, language: g.language, schemeSource: g.schemeSource, verdict: g.verdict,
      checks: g.checks as Array<{ gate: string; state: string; detail: string }>, runIds: g.runIds, datasetVersions: g.datasetVersions, productionFingerprint: g.productionFingerprint,
      importedBy: g.importedBy, importedAt: g.importedAt, earlier: (n.get(g.groupKey) ?? 1) - 1,
    })),
  };
}
