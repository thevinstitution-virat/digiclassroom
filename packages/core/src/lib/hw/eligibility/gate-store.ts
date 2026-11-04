// Storing an imported report (roadmap 5.5 and 5.3). The rows are the report's own: nothing is recalculated here. Importing also keeps the
// registry honest in one direction only: a group that is not yet in the registry gets its measured status recorded, and a group that is
// eligible for the very configuration a NEW result measured, and that result does not pass, is demoted at once. A passing result never
// promotes anything by itself: promotion is a person's decision (registry.ts).

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { hwEligibility, hwEligibilityEvent, hwEvalGateResult, hwEvalRegression, hwEvalRun } from '@/db/hw-control-schema';
import { writeAudit } from '../admin-audit';
import { groupKey } from './group';
import { runRowsFromReport, type GateResultDraft, type ReportJson } from './gate-import';
import { autoDemote } from './registry';

/** What `npm run hw:eval:regression` writes to regression.json. */
export interface RegressionJson { baseline: string; candidate: string; dataset?: string; ok: boolean; checks: unknown[] }

/** Stores the regression gate's result, unchanged. The same file imported twice is stored once. Returns whether a row was added. */
export async function importRegression(r: RegressionJson, meta: { importedBy: string; sourceSha256: string; dataset?: string }): Promise<{ added: boolean }> {
  const dataset = r.dataset ?? meta.dataset;
  if (!dataset) throw new Error('the dataset is not in regression.json: pass --dataset name@vN');
  if (typeof r.ok !== 'boolean' || !Array.isArray(r.checks)) throw new Error('that is not a regression.json (needs ok and checks)');
  return db.transaction(async (tx) => {
    const rows = await tx.insert(hwEvalRegression).values({
      id: randomUUID(), baselineRunId: r.baseline, candidateRunId: r.candidate, datasetRef: dataset, ok: r.ok, checks: r.checks, sourceSha256: meta.sourceSha256, importedBy: meta.importedBy,
    }).onConflictDoNothing().returning({ id: hwEvalRegression.id });
    if (rows.length) await writeAudit(tx, { actorId: meta.importedBy, action: 'regression_imported', entity: 'regression', entityId: rows[0].id, newValue: { baseline: r.baseline, candidate: r.candidate, dataset, ok: r.ok } });
    return { added: rows.length > 0 };
  });
}

export interface ImportOutcome { runsAdded: number; resultsAdded: number; resultsAlreadyThere: number; recorded: string[]; demoted: string[] }

export async function importGateReport(report: ReportJson, results: GateResultDraft[], meta: { importedBy: string; reportSha256: string }): Promise<ImportOutcome> {
  const out: ImportOutcome = { runsAdded: 0, resultsAdded: 0, resultsAlreadyThere: 0, recorded: [], demoted: [] };
  const added: { id: string; draft: GateResultDraft }[] = [];
  await db.transaction(async (tx) => {
    for (const r of runRowsFromReport(report)) {
      const n = await tx.insert(hwEvalRun).values({ ...r, importedBy: meta.importedBy, sourceSha256: meta.reportSha256 } as typeof hwEvalRun.$inferInsert).onConflictDoNothing().returning({ id: hwEvalRun.runId });
      out.runsAdded += n.length;
    }
    for (const d of results) {
      const id = randomUUID();
      const [row] = await tx.insert(hwEvalGateResult).values({
        id, groupKey: d.groupKey, subject: d.subject, questionType: d.questionType, language: d.language, schemeSource: d.schemeSource, verdict: d.verdict, checks: d.checks,
        runIds: d.runIds, datasetVersions: d.datasetVersions, productionFingerprint: d.productionFingerprint, fingerprintParts: d.fingerprintParts as unknown as Record<string, unknown> | null,
        reportSha256: meta.reportSha256, importedBy: meta.importedBy,
      }).onConflictDoNothing().returning({ id: hwEvalGateResult.id });
      if (row) { added.push({ id: row.id, draft: d }); out.resultsAdded++; } else out.resultsAlreadyThere++;
    }
    await writeAudit(tx, { actorId: meta.importedBy, action: 'gate_report_imported', entity: 'gate_report', entityId: meta.reportSha256, newValue: { dataset: report.datasetRef, runs: report.runs.map((r) => r.runId), groups: results.map((r) => `${r.groupKey}: ${r.verdict}`) } });
  });

  for (const { draft } of added) {
    if (draft.verdict === 'eligible') continue;
    const key = groupKey(draft);
    const [cur] = await db.select().from(hwEligibility).where(eq(hwEligibility.groupKey, key)).limit(1);
    if (!cur) {
      const reason = `gate result imported: ${draft.verdict.replace('_', ' ')}`;
      await db.transaction(async (tx) => {
        await tx.insert(hwEligibility).values({ groupKey: key, subject: draft.subject, questionType: draft.questionType, language: draft.language, schemeSource: draft.schemeSource, status: draft.verdict, decidedBy: 'system:gate-import', reason }).onConflictDoNothing();
        await tx.insert(hwEligibilityEvent).values({ id: randomUUID(), groupKey: key, fromStatus: 'none', toStatus: draft.verdict, actorId: 'system:gate-import', automatic: true, reason });
      });
      out.recorded.push(key);
    } else if (cur.status === 'eligible' && draft.productionFingerprint && cur.configHash === draft.productionFingerprint) {
      if (await autoDemote({ groupKey: key, actor: 'system:gate-import', reason: `a newer gate result for the same marking setup says "${draft.verdict.replace('_', ' ')}"` })) out.demoted.push(key);
    }
  }
  return out;
}

