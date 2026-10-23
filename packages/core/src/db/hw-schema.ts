// Handwritten Assignments tables. Mirrors packages/core/src/lib/db/migrations/014_hw_assignments.sql,
// which is the source of truth: the CHECK constraints, composite foreign keys and triggers
// (marks bounds, publish rules, append-only history) live there, not here.
//
// Kept out of schema.ts so this feature does not collide with other branches editing it.

import {
  pgTable,
  varchar,
  text,
  integer,
  smallint,
  bigint,
  bigserial,
  boolean,
  numeric,
  jsonb,
  date,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => varchar('id', { length: 36 }).primaryKey();
const orgId = () => varchar('organization_id', { length: 255 }).notNull();

export type HwAssignmentStatus = 'draft' | 'published' | 'closed';
export type HwAnswerMode = 'typed' | 'ink' | 'photo';
export type HwQuestionType = 'very_short' | 'short' | 'long' | 'essay';
export type HwLanguage = 'en' | 'hi' | 'mixed';
export type HwRubricKind = 'key_point' | 'content' | 'structure' | 'language';
export type HwSubmissionStatus = 'draft' | 'submitted' | 'processing' | 'ready_for_review' | 'graded' | 'returned';
export type HwTranscriptStatus = 'not_needed' | 'pending' | 'done' | 'needs_review' | 'failed';
export type HwJobKind = 'read' | 'grade' | 'rubric_draft';
export type HwJobStatus = 'queued' | 'running' | 'batch_pending' | 'done' | 'failed';
export type HwGradeSource = 'accepted_ai' | 'edited_ai' | 'manual';
export type HwVerdict = 'met' | 'partial' | 'missing';

/** One rubric item's judgement inside hw_ai_grade.items. */
export interface HwAiGradeItem {
  rubric_item_id: string;
  verdict: HwVerdict;
  quote: string;
  marks: number;
  confidence: number;
}

/** One rubric item's final marks inside hw_grade.item_marks. */
export interface HwItemMark {
  rubric_item_id: string;
  marks: number;
}

/** A word the student says was misread, by character offsets into the transcript. */
export interface HwStudentFlag {
  start: number;
  end: number;
  text: string;
}

export const hwClassTeacher = pgTable('hw_class_teacher', {
  id: id(),
  organizationId: orgId(),
  classId: varchar('class_id', { length: 36 }).notNull(),
  sectionId: varchar('section_id', { length: 36 }),
  teacherId: varchar('teacher_id', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwAssignment = pgTable('hw_assignment', {
  id: id(),
  organizationId: orgId(),
  classId: varchar('class_id', { length: 36 }).notNull(),
  sectionId: varchar('section_id', { length: 36 }),
  subject: varchar('subject', { length: 100 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  instructions: text('instructions'),
  dueAt: ts('due_at'),
  status: text('status').$type<HwAssignmentStatus>().notNull().default('draft'),
  allowedModes: text('allowed_modes').array().$type<HwAnswerMode[]>().notNull(),
  totalMarks: numeric('total_marks', { precision: 7, scale: 2 }).notNull().default('0'),
  publishedAt: ts('published_at'),
  closedAt: ts('closed_at'),
  returnedAt: ts('returned_at'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwQuestion = pgTable('hw_question', {
  id: id(),
  organizationId: orgId(),
  assignmentId: varchar('assignment_id', { length: 36 }).notNull(),
  position: integer('position').notNull(),
  type: text('type').$type<HwQuestionType>().notNull(),
  prompt: text('prompt').notNull(),
  marks: numeric('marks', { precision: 6, scale: 2 }).notNull(),
  modelAnswer: text('model_answer'),
  acceptedAnswers: jsonb('accepted_answers').$type<string[]>().notNull().default([]),
  languageHint: text('language_hint').$type<HwLanguage>().notNull().default('en'),
  answerLines: integer('answer_lines').notNull().default(4),
  rubricVersion: integer('rubric_version').notNull().default(1),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwRubricItem = pgTable('hw_rubric_item', {
  id: id(),
  organizationId: orgId(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  position: integer('position').notNull(),
  kind: text('kind').$type<HwRubricKind>().notNull(),
  description: text('description').notNull(),
  marks: numeric('marks', { precision: 6, scale: 2 }).notNull(),
  version: integer('version').notNull().default(1),
  source: text('source').$type<'teacher' | 'ai_draft'>().notNull().default('teacher'),
  retiredAt: ts('retired_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwSubmission = pgTable('hw_submission', {
  id: id(),
  organizationId: orgId(),
  assignmentId: varchar('assignment_id', { length: 36 }).notNull(),
  studentId: varchar('student_id', { length: 255 }).notNull(),
  status: text('status').$type<HwSubmissionStatus>().notNull().default('draft'),
  submittedAt: ts('submitted_at'),
  isLate: boolean('is_late').notNull().default(false),
  failureReason: text('failure_reason'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwAnswer = pgTable('hw_answer', {
  id: id(),
  organizationId: orgId(),
  submissionId: varchar('submission_id', { length: 36 }).notNull(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  mode: text('mode').$type<HwAnswerMode>().notNull(),
  typedText: text('typed_text'),
  inkKey: text('ink_key'),
  renderKey: text('render_key'),
  imageKey: text('image_key'),
  transcript: text('transcript'),
  transcriptStatus: text('transcript_status').$type<HwTranscriptStatus>().notNull().default('pending'),
  transcriptConfidence: numeric('transcript_confidence', { precision: 4, scale: 3 }),
  unclearCount: integer('unclear_count').notNull().default(0),
  readerEngine: text('reader_engine'),
  readerTier: smallint('reader_tier'),
  studentFlags: jsonb('student_flags').$type<HwStudentFlag[]>().notNull().default([]),
  timeSpentMs: bigint('time_spent_ms', { mode: 'number' }).notNull().default(0),
  inkStats: jsonb('ink_stats').$type<Record<string, unknown>>().notNull().default({}),
  failureReason: text('failure_reason'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwTranscriptRevision = pgTable('hw_transcript_revision', {
  id: id(),
  organizationId: orgId(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  transcript: text('transcript').notNull(),
  source: text('source').$type<'typed' | 'reader' | 'teacher_edit' | 'teacher_confirm'>().notNull(),
  readerEngine: text('reader_engine'),
  confidence: numeric('confidence', { precision: 4, scale: 3 }),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwAiJob = pgTable('hw_ai_job', {
  id: id(),
  organizationId: orgId(),
  kind: text('kind').$type<HwJobKind>().notNull(),
  status: text('status').$type<HwJobStatus>().notNull().default('queued'),
  submissionId: varchar('submission_id', { length: 36 }),
  questionId: varchar('question_id', { length: 36 }),
  provider: text('provider'),
  model: text('model'),
  batchRef: text('batch_ref'),
  payloadRef: text('payload_ref'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  runAfter: ts('run_after').notNull().defaultNow(),
  lockedAt: ts('locked_at'),
  lockedBy: text('locked_by'),
  error: text('error'),
  tokensIn: bigint('tokens_in', { mode: 'number' }).notNull().default(0),
  tokensCached: bigint('tokens_cached', { mode: 'number' }).notNull().default(0),
  tokensOut: bigint('tokens_out', { mode: 'number' }).notNull().default(0),
  costEstimatePaise: numeric('cost_estimate_paise', { precision: 14, scale: 4 }).notNull().default('0'),
  startedAt: ts('started_at'),
  finishedAt: ts('finished_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwAiGrade = pgTable('hw_ai_grade', {
  id: id(),
  organizationId: orgId(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  jobId: varchar('job_id', { length: 36 }),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  rubricVersion: integer('rubric_version').notNull(),
  items: jsonb('items').$type<HwAiGradeItem[]>().notNull(),
  suggestedMarks: numeric('suggested_marks', { precision: 6, scale: 2 }).notNull(),
  confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
  validationNotes: jsonb('validation_notes').$type<string[]>().notNull().default([]),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwGrade = pgTable('hw_grade', {
  answerId: varchar('answer_id', { length: 36 }).primaryKey(),
  organizationId: orgId(),
  marks: numeric('marks', { precision: 6, scale: 2 }).notNull(),
  itemMarks: jsonb('item_marks').$type<HwItemMark[]>().notNull().default([]),
  comment: text('comment'),
  source: text('source').$type<HwGradeSource>().notNull(),
  aiGradeId: varchar('ai_grade_id', { length: 36 }),
  gradedBy: varchar('graded_by', { length: 255 }).notNull(),
  gradedAt: ts('graded_at').notNull().defaultNow(),
});

export const hwGradeHistory = pgTable('hw_grade_history', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  organizationId: orgId(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  marks: numeric('marks', { precision: 6, scale: 2 }).notNull(),
  itemMarks: jsonb('item_marks').$type<HwItemMark[]>().notNull(),
  comment: text('comment'),
  source: text('source').$type<HwGradeSource>().notNull(),
  aiGradeId: varchar('ai_grade_id', { length: 36 }),
  gradedBy: varchar('graded_by', { length: 255 }).notNull(),
  gradedAt: ts('graded_at').notNull(),
  recordedAt: ts('recorded_at').notNull().defaultNow(),
});

export const hwAiUsageMonthly = pgTable('hw_ai_usage_monthly', {
  organizationId: orgId(),
  month: date('month', { mode: 'string' }).notNull(),
  pagesRead: integer('pages_read').notNull().default(0),
  answersGraded: integer('answers_graded').notNull().default(0),
  tokensIn: bigint('tokens_in', { mode: 'number' }).notNull().default(0),
  tokensCached: bigint('tokens_cached', { mode: 'number' }).notNull().default(0),
  tokensOut: bigint('tokens_out', { mode: 'number' }).notNull().default(0),
  costPaise: numeric('cost_paise', { precision: 14, scale: 4 }).notNull().default('0'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.organizationId, t.month] })]);

export const hwTenantQuota = pgTable('hw_tenant_quota', {
  organizationId: varchar('organization_id', { length: 255 }).primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  monthlyAnswerQuota: integer('monthly_answer_quota').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

// Reserved for Phase 2 — declared so the types exist, nothing reads them yet.
export const hwWritingCalibration = pgTable('hw_writing_calibration', {
  id: id(),
  organizationId: orgId(),
  studentId: varchar('student_id', { length: 255 }).notNull(),
  samples: jsonb('samples').$type<unknown[]>().notNull().default([]),
  readabilityScore: numeric('readability_score', { precision: 4, scale: 3 }),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwAnswerGroup = pgTable('hw_answer_group', {
  id: id(),
  organizationId: orgId(),
  questionId: varchar('question_id', { length: 36 }).notNull(),
  label: text('label'),
  suggestedMarks: numeric('suggested_marks', { precision: 6, scale: 2 }),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwAnswerGroupMember = pgTable('hw_answer_group_member', {
  groupId: varchar('group_id', { length: 36 }).notNull(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  organizationId: orgId(),
}, (t) => [primaryKey({ columns: [t.groupId, t.answerId] })]);
