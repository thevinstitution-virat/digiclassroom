// Exam package tables. Mirrors packages/core/src/lib/db/migrations/034_hw_exams.sql, which is the source of truth: the CHECK constraints, the
// frozen-when-published guards, the immutable attempt clock, the attempt allowance and the append-only report all live there, not here.

import { randomUUID } from 'node:crypto';
import { pgTable, varchar, text, integer, numeric, jsonb, timestamp, char } from 'drizzle-orm/pg-core';
import type { BankPart, BankQuestionType } from './hw-bank-schema';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => varchar('id', { length: 36 }).primaryKey().$defaultFn(() => randomUUID());

export type ExamContentStatus = 'draft' | 'published' | 'retired';
/** 'pool' (035): questions learners draw their own tests from, never attempted; 'practice': one learner's test drawn from a pool. */
export type ExamSetKind = 'pyq' | 'sqp' | 'mock_half' | 'mock_full' | 'pool' | 'practice';
export type ExamAttemptStatus = 'started' | 'time_up' | 'uploaded' | 'evaluating' | 'reported' | 'abandoned';

export const hwExamPackage = pgTable('hw_exam_package', {
  id: id(),
  board: text('board').notNull(),
  classLevel: integer('class_level').notNull(),
  examYear: integer('exam_year').notNull(),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  blurb: text('blurb').notNull().default(''),
  attemptsPerSet: integer('attempts_per_set').notNull().default(5),
  pricePaise: integer('price_paise').notNull().default(0),
  status: text('status').$type<ExamContentStatus>().notNull().default('draft'),
  publishedAt: ts('published_at'),
  createdBy: text('created_by').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwExamSet = pgTable('hw_exam_set', {
  id: id(),
  packageId: varchar('package_id', { length: 36 }).notNull().references(() => hwExamPackage.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  kind: text('kind').$type<ExamSetKind>().notNull(),
  subject: text('subject').notNull(),
  subjectCode: text('subject_code').notNull(),
  title: text('title').notNull(),
  paperId: varchar('paper_id', { length: 36 }),
  maxMarks: numeric('max_marks', { precision: 6, scale: 1, mode: 'number' }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  graceMinutes: integer('grace_minutes').notNull().default(20),
  medium: text('medium').$type<'en' | 'hi'>().notNull().default('en'),
  syllabusScope: jsonb('syllabus_scope').$type<string[]>().notNull().default([]),
  /** 035: the learner a practice set was made for, and the pool it was drawn from (both set exactly when kind = 'practice'). */
  ownerUserId: varchar('owner_user_id', { length: 255 }),
  poolSetId: varchar('pool_set_id', { length: 36 }),
  status: text('status').$type<ExamContentStatus>().notNull().default('draft'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwExamSetItem = pgTable('hw_exam_set_item', {
  id: id(),
  setId: varchar('set_id', { length: 36 }).notNull().references(() => hwExamSet.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  number: integer('number').notNull(),
  section: text('section').notNull().default(''),
  marks: numeric('marks', { precision: 4, scale: 1, mode: 'number' }).notNull(),
  qtype: text('qtype').$type<BankQuestionType>().notNull(),
  chapter: text('chapter').notNull().default(''),
  /** 035: the topic within the chapter, for a learner choosing what to practise. */
  topic: text('topic').notNull().default(''),
  bankQuestionId: varchar('bank_question_id', { length: 36 }),
  stem: text('stem'),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  correctOption: text('correct_option'),
  acceptedAnswers: jsonb('accepted_answers').$type<string[]>().notNull().default([]),
  parts: jsonb('parts').$type<BankPart[] | Record<string, unknown>[]>().notNull().default([]),
  schemeText: text('scheme_text').notNull().default(''),
  diagramParts: jsonb('diagram_parts').$type<string[]>().notNull().default([]),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwExamEntitlement = pgTable('hw_exam_entitlement', {
  id: id(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  packageId: varchar('package_id', { length: 36 }).notNull().references(() => hwExamPackage.id, { onDelete: 'cascade' }),
  source: text('source').$type<'purchase' | 'trial' | 'grant'>().notNull(),
  status: text('status').$type<'active' | 'expired' | 'refunded'>().notNull().default('active'),
  startsAt: ts('starts_at').notNull().defaultNow(),
  expiresAt: ts('expires_at'),
  attemptsPerSet: integer('attempts_per_set'),
  orderRef: text('order_ref'),
  grantedBy: text('granted_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwExamAttempt = pgTable('hw_exam_attempt', {
  id: id(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  setId: varchar('set_id', { length: 36 }).notNull().references(() => hwExamSet.id, { onDelete: 'restrict' }),
  attemptNo: integer('attempt_no').notNull(),
  assignmentId: varchar('assignment_id', { length: 36 }),
  status: text('status').$type<ExamAttemptStatus>().notNull().default('started'),
  startedAt: ts('started_at').notNull().defaultNow(),
  expiresAt: ts('expires_at').notNull(),
  uploadDeadlineAt: ts('upload_deadline_at').notNull(),
  endedAt: ts('ended_at'),
  submittedAt: ts('submitted_at'),
  reportedAt: ts('reported_at'),
  evaluationMode: text('evaluation_mode').$type<'batch' | 'standard'>().notNull().default('batch'),
  readyBy: ts('ready_by'),
  maxMarks: numeric('max_marks', { precision: 6, scale: 1, mode: 'number' }).notNull(),
  marksAwarded: numeric('marks_awarded', { precision: 6, scale: 2, mode: 'number' }),
  failureReason: text('failure_reason'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwExamPage = pgTable('hw_exam_page', {
  id: id(),
  attemptId: varchar('attempt_id', { length: 36 }).notNull().references(() => hwExamAttempt.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  imageKey: text('image_key').notNull(),
  mimeType: text('mime_type').$type<'image/png' | 'image/jpeg' | 'image/webp'>().notNull(),
  widthPx: integer('width_px').notNull(),
  heightPx: integer('height_px').notNull(),
  bytes: integer('bytes').notNull(),
  sha256: char('sha256', { length: 64 }).notNull(),
  quality: jsonb('quality').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').$type<'accepted' | 'rejected'>().notNull().default('accepted'),
  rejectReason: text('reject_reason'),
  questionHint: integer('question_hint'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwExamReport = pgTable('hw_exam_report', {
  id: id(),
  attemptId: varchar('attempt_id', { length: 36 }).notNull().references(() => hwExamAttempt.id, { onDelete: 'cascade' }),
  marksAwarded: numeric('marks_awarded', { precision: 6, scale: 2, mode: 'number' }).notNull(),
  maxMarks: numeric('max_marks', { precision: 6, scale: 1, mode: 'number' }).notNull(),
  perQuestion: jsonb('per_question').$type<unknown[]>().notNull(),
  profile: jsonb('profile').$type<Record<string, unknown>>().notNull().default({}),
  weakAreas: jsonb('weak_areas').$type<unknown[]>().notNull().default([]),
  readerModel: text('reader_model').notNull(),
  graderModel: text('grader_model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  costPaise: numeric('cost_paise', { precision: 10, scale: 4, mode: 'number' }).notNull().default(0),
  /** 036: 0 = the report as made; 1, 2, ... = after each revision of its marks (a new row each time). */
  revision: integer('revision').notNull().default(0),
  createdAt: ts('created_at').notNull().defaultNow(),
});
