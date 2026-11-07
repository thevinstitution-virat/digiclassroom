// Board-paper bank tables. Mirrors packages/core/src/lib/db/migrations/032_hw_bank.sql, which is the source of truth: the CHECK constraints,
// the "checked content never changes" guard and the append-only import log live there, not here.

import { pgTable, varchar, text, integer, numeric, boolean, jsonb, timestamp, char, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const id = () => varchar('id', { length: 36 }).primaryKey();

export type BankPaperKind = 'sqp' | 'past_paper';
export type BankStatus = 'draft' | 'checked' | 'published';
export type BankQuestionStatus = BankStatus | 'rejected';
export type BankQuestionType = 'mcq' | 'assertion_reason' | 'very_short' | 'short' | 'long' | 'case_based';

/** One value point of a part, as stored (the bank file's shape, see lib/hw/bank/schema.ts). */
export interface BankValuePoint { id: string; text: string; marks: number; quote: string }
export interface BankPart {
  label: string;
  alternative: string | null;
  marks: number;
  answer_kind: string;
  value_points: BankValuePoint[];
  [k: string]: unknown;
}

export const hwBankPaper = pgTable('hw_bank_paper', {
  id: id(),
  board: text('board').notNull(),
  classLevel: integer('class_level').notNull(),
  subject: text('subject').notNull(),
  subjectCode: text('subject_code').notNull(),
  session: text('session').notNull(),
  kind: text('kind').$type<BankPaperKind>().notNull(),
  title: text('title').notNull(),
  maxMarks: numeric('max_marks', { precision: 6, scale: 1, mode: 'number' }).notNull(),
  duration: text('duration'),
  sourceFiles: jsonb('source_files').$type<string[]>().notNull().default([]),
  sourceSha256: char('source_sha256', { length: 64 }).notNull(),
  status: text('status').$type<BankStatus>().notNull().default('draft'),
  version: integer('version').notNull().default(1),
  importedBy: text('imported_by').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
});

export const hwBankQuestion = pgTable('hw_bank_question', {
  id: id(),
  paperId: varchar('paper_id', { length: 36 }).notNull().references(() => hwBankPaper.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  alt: text('alt').$type<'A' | 'B' | 'C' | 'D'>(),
  variant: text('variant').$type<'vi'>(),
  section: text('section').notNull(),
  marks: numeric('marks', { precision: 4, scale: 1, mode: 'number' }).notNull(),
  qtype: text('qtype').$type<BankQuestionType>().notNull(),
  stem: text('stem').notNull(),
  stemRaw: text('stem_raw').notNull(),
  options: jsonb('options').$type<{ letter: string; text: string }[]>().notNull().default([]),
  correctOption: text('correct_option'),
  acceptedAnswers: jsonb('accepted_answers').$type<string[]>().notNull().default([]),
  choiceGroup: text('choice_group'),
  choiceKind: text('choice_kind').$type<'option' | 'subpart'>(),
  parts: jsonb('parts').$type<BankPart[]>().notNull().default([]),
  schemeText: text('scheme_text').notNull().default(''),
  equations: jsonb('equations').$type<unknown[]>().notNull().default([]),
  diagramParts: jsonb('diagram_parts').$type<string[]>().notNull().default([]),
  needsCheck: jsonb('needs_check').$type<string[]>().notNull().default([]),
  status: text('status').$type<BankQuestionStatus>().notNull().default('draft'),
  version: integer('version').notNull().default(1),
  contentHash: char('content_hash', { length: 64 }).notNull(),
  checkedBy: text('checked_by'),
  checkedAt: ts('checked_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('hw_bank_question_identity').on(t.paperId, t.number, sql`COALESCE(${t.alt}, '')`, sql`COALESCE(${t.variant}, '')`),
  index('hw_bank_question_status_idx').on(t.paperId, t.status),
]);

export const hwBankFigure = pgTable('hw_bank_figure', {
  id: id(),
  questionId: varchar('question_id', { length: 36 }).notNull().references(() => hwBankQuestion.id, { onDelete: 'cascade' }),
  figureId: text('figure_id').notNull(),
  side: text('side').$type<'paper' | 'scheme'>().notNull(),
  description: text('description').notNull(),
  labels: jsonb('labels').$type<unknown[]>().notNull().default([]),
  readings: jsonb('readings').$type<unknown>(),
  confidence: text('confidence').$type<'high' | 'medium' | 'low'>().notNull(),
  needsPersonCheck: boolean('needs_person_check').notNull().default(false),
  note: text('note'),
  storageKey: text('storage_key'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export type BankVerdict = 'ok' | 'fix' | 'reject';

/** Migration 033: what a person decided about a row (append-only). Bound to the exact content they were shown (contentHash). */
export const hwBankReview = pgTable('hw_bank_review', {
  id: id(),
  paperId: varchar('paper_id', { length: 36 }).references(() => hwBankPaper.id, { onDelete: 'set null' }),
  questionId: varchar('question_id', { length: 36 }).references(() => hwBankQuestion.id, { onDelete: 'set null' }),
  number: integer('number').notNull(),
  alt: text('alt').$type<'A' | 'B' | 'C' | 'D'>(),
  variant: text('variant').$type<'vi'>(),
  questionVersion: integer('question_version').notNull(),
  contentHash: char('content_hash', { length: 64 }).notNull(),
  verdict: text('verdict').$type<BankVerdict>().notNull(),
  confirmed: jsonb('confirmed').$type<string[]>().notNull().default([]),
  note: text('note').notNull().default(''),
  reviewer: text('reviewer').notNull(),
  recordedBy: text('recorded_by').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});

export const hwBankImport = pgTable('hw_bank_import', {
  id: id(),
  paperId: varchar('paper_id', { length: 36 }).references(() => hwBankPaper.id, { onDelete: 'set null' }),
  actor: text('actor').notNull(),
  sourceSha256: char('source_sha256', { length: 64 }).notNull(),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
});
