// Virat Evaluator tables. Mirrors packages/core/src/lib/db/migrations/015_hw_eval.sql, which is
// the source of truth: the CHECK constraints, skill and independence triggers, and append-only
// rules live there, not here.

import { pgTable, varchar, text, integer, smallint, bigint, boolean, numeric, jsonb, date, timestamp, char, primaryKey } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => varchar('id', { length: 36 }).primaryKey();

export type HwEvalTaskKind = 'transcribe' | 'blind_mark' | 'key_audit' | 'deidentify';
export type HwEvalTaskStatus = 'open' | 'in_progress' | 'needs_adjudication' | 'done' | 'cancelled';

export const hwEvalRater = pgTable('hw_eval_rater', {
  id: id(),
  pseudonym: varchar('pseudonym', { length: 40 }).notNull(),
  /** Read only by super_admin endpoints. */
  userId: varchar('user_id', { length: 255 }).notNull(),
  skills: text('skills').array().notNull(),
  active: boolean('active').notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwEvalTask = pgTable('hw_eval_task', {
  id: id(),
  kind: text('kind').$type<HwEvalTaskKind>().notNull(),
  datasetRef: varchar('dataset_ref', { length: 80 }).notNull(),
  targetId: varchar('target_id', { length: 80 }).notNull(),
  subject: varchar('subject', { length: 100 }),
  requiredRaters: smallint('required_raters').notNull(),
  status: text('status').$type<HwEvalTaskStatus>().notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwEvalAssignment = pgTable('hw_eval_assignment', {
  id: id(),
  taskId: varchar('task_id', { length: 36 }).notNull(),
  raterId: varchar('rater_id', { length: 36 }).notNull(),
  orderIndex: integer('order_index').notNull(),
  assignedAt: ts('assigned_at').notNull().defaultNow(),
  startedAt: ts('started_at'),
  submittedAt: ts('submitted_at'),
});

export const hwEvalSubmission = pgTable('hw_eval_submission', {
  id: id(),
  assignmentId: varchar('assignment_id', { length: 36 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  timeMs: bigint('time_ms', { mode: 'number' }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwEvalAdjudication = pgTable('hw_eval_adjudication', {
  id: id(),
  taskId: varchar('task_id', { length: 36 }).notNull(),
  adjudicatorRaterId: varchar('adjudicator_rater_id', { length: 36 }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  reason: text('reason').notNull(),
  timeMs: bigint('time_ms', { mode: 'number' }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwEvalConsent = pgTable('hw_eval_consent', {
  id: id(),
  organizationId: varchar('organization_id', { length: 255 }),
  subjectKind: text('subject_kind').$type<'student' | 'parent' | 'teacher' | 'volunteer'>().notNull(),
  formVersion: varchar('form_version', { length: 40 }).notNull(),
  language: text('language').$type<'en' | 'hi'>().notNull(),
  scope: text('scope').array().notNull(),
  signedAt: date('signed_at', { mode: 'string' }).notNull(),
  evidenceKey: text('evidence_key'),
  withdrawnAt: ts('withdrawn_at'),
  recordedBy: varchar('recorded_by', { length: 255 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  guardianConsentId: varchar('guardian_consent_id', { length: 36 }),
});

/** Never read by product code (see the isolation test). */
export const hwEvalShadowResult = pgTable('hw_eval_shadow_result', {
  id: id(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  kind: text('kind').$type<'read' | 'mark'>().notNull(),
  candidateConfigHash: char('candidate_config_hash', { length: 64 }).notNull(),
  predictedTranscript: text('predicted_transcript'),
  predictedMarks: numeric('predicted_marks', { precision: 6, scale: 2 }),
  predictedItems: jsonb('predicted_items').$type<unknown[]>(),
  productionTranscript: text('production_transcript'),
  productionMarks: numeric('production_marks', { precision: 6, scale: 2 }),
  status: text('status').$type<'ok' | 'failed'>().notNull(),
  failureReason: text('failure_reason'),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensCached: integer('tokens_cached').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costPaise: numeric('cost_paise', { precision: 12, scale: 4 }).notNull().default('0'),
  finalMarks: numeric('final_marks', { precision: 6, scale: 2 }),
  comparedAt: ts('compared_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwEvalMonitorDaily = pgTable('hw_eval_monitor_daily', {
  day: date('day', { mode: 'string' }).notNull(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  questionType: text('question_type').$type<'very_short' | 'short' | 'long' | 'essay'>().notNull(),
  answersMarked: integer('answers_marked').notNull().default(0),
  aiSuggested: integer('ai_suggested').notNull().default(0),
  overrides: integer('overrides').notNull().default(0),
  overrideAbsSum: numeric('override_abs_sum', { precision: 10, scale: 2 }).notNull().default('0'),
  transcriptFixes: integer('transcript_fixes').notNull().default(0),
  misreadFlags: integer('misread_flags').notNull().default(0),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.day, t.organizationId, t.subject, t.questionType] })]);
