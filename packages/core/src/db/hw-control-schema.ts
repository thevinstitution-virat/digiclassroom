// Phase 5 ("control room") tables. Mirrors packages/core/src/lib/db/migrations/023_hw_eval_runs_gates.sql and 024_hw_eligibility.sql, which are
// the source of truth: the CHECK constraints, append-only triggers and the evidence rule live there, not here.

import { pgTable, varchar, text, smallint, bigint, boolean, jsonb, timestamp, char } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => varchar('id', { length: 36 }).primaryKey();

export type HwSchemeSource = 'board_scheme_key' | 'passage_key' | 'textbook_key' | 'teacher_rubric';
export type HwEligibilityStatus = 'insufficient_data' | 'not_yet' | 'eligible';
export type HwGateQuestionType = 'very_short' | 'short' | 'long' | 'essay';
export type HwGateLanguage = 'en' | 'hi' | 'mixed';

export const hwEvalRun = pgTable('hw_eval_run', {
  runId: text('run_id').primaryKey(),
  mode: text('mode').$type<'read' | 'key' | 'mark' | 'e2e'>().notNull(),
  status: text('status').notNull(),
  datasetRef: text('dataset_ref').notNull(),
  manifestSha256: char('manifest_sha256', { length: 64 }),
  configHash: text('config_hash'),
  gitCommit: text('git_commit'),
  repeat: smallint('repeat'),
  costPaise: bigint('cost_paise', { mode: 'number' }).notNull().default(0),
  counts: jsonb('counts').$type<Record<string, number>>().notNull().default({}),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  importedBy: varchar('imported_by', { length: 255 }).notNull(),
  importedAt: ts('imported_at').notNull().defaultNow(),
  sourceSha256: char('source_sha256', { length: 64 }).notNull(),
});

export interface HwGateCheck { gate: string; state: 'pass' | 'fail' | 'insufficient' | 'not_applicable'; detail: string }

/** The regression gate's result as the command wrote it (migration 029). */
export const hwEvalRegression = pgTable('hw_eval_regression', {
  id: id(),
  baselineRunId: text('baseline_run_id').notNull(),
  candidateRunId: text('candidate_run_id').notNull(),
  datasetRef: text('dataset_ref').notNull(),
  ok: boolean('ok').notNull(),
  checks: jsonb('checks').$type<unknown[]>().notNull(),
  sourceSha256: char('source_sha256', { length: 64 }).notNull(),
  importedBy: varchar('imported_by', { length: 255 }).notNull(),
  importedAt: ts('imported_at').notNull().defaultNow(),
});

export const hwEvalGateResult = pgTable('hw_eval_gate_result', {
  id: id(),
  groupKey: text('group_key').notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  questionType: text('question_type').$type<HwGateQuestionType>().notNull(),
  language: text('language').$type<HwGateLanguage>().notNull(),
  schemeSource: text('scheme_source').$type<HwSchemeSource>().notNull(),
  verdict: text('verdict').$type<HwEligibilityStatus>().notNull(),
  checks: jsonb('checks').$type<HwGateCheck[]>().notNull(),
  runIds: text('run_ids').array().notNull(),
  datasetVersions: text('dataset_versions').array().notNull(),
  productionFingerprint: char('production_fingerprint', { length: 64 }),
  fingerprintParts: jsonb('fingerprint_parts').$type<Record<string, unknown>>(),
  reportSha256: char('report_sha256', { length: 64 }).notNull(),
  importedBy: varchar('imported_by', { length: 255 }).notNull(),
  importedAt: ts('imported_at').notNull().defaultNow(),
});

export const hwEligibility = pgTable('hw_eligibility', {
  groupKey: text('group_key').primaryKey(),
  subject: varchar('subject', { length: 100 }).notNull(),
  questionType: text('question_type').$type<HwGateQuestionType>().notNull(),
  language: text('language').$type<HwGateLanguage>().notNull(),
  schemeSource: text('scheme_source').$type<HwSchemeSource>().notNull(),
  status: text('status').$type<HwEligibilityStatus>().notNull(),
  configHash: char('config_hash', { length: 64 }),
  gateResultId: varchar('gate_result_id', { length: 36 }),
  datasetVersions: text('dataset_versions').array().notNull().default([]),
  decidedBy: varchar('decided_by', { length: 255 }).notNull(),
  decidedAt: ts('decided_at').notNull().defaultNow(),
  reason: text('reason').notNull(),
});

export const hwEligibilityEvent = pgTable('hw_eligibility_event', {
  id: id(),
  at: ts('at').notNull().defaultNow(),
  groupKey: text('group_key').notNull(),
  fromStatus: text('from_status').notNull(),
  toStatus: text('to_status').$type<HwEligibilityStatus>().notNull(),
  configHash: char('config_hash', { length: 64 }),
  gateResultId: varchar('gate_result_id', { length: 36 }),
  datasetVersions: text('dataset_versions').array().notNull().default([]),
  actorId: text('actor_id').notNull(),
  automatic: boolean('automatic').notNull().default(false),
  reason: text('reason').notNull(),
});
