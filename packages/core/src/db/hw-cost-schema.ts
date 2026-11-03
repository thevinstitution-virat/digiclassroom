// Tables of the cost work (phase 1). Mirrors lib/db/migrations/019_hw_cost_phase1.sql, which is
// the source of truth: CHECK constraints, the reuse-has-origin rule and the append-only trigger
// live there, not here.

import { pgTable, varchar, text, integer, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export type HwMarkSource = 'ai' | 'code' | 'reuse';
export type HwKeyQuestionOrigin = 'textbook_exercise' | 'board_paper';

/** How each AI suggestion was produced; one row per hw_ai_grade row while the flags are on. */
export const hwAiGradeSource = pgTable('hw_ai_grade_source', {
  aiGradeId: varchar('ai_grade_id', { length: 36 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  markSource: text('mark_source').$type<HwMarkSource>().notNull(),
  reusedFromAnswerId: varchar('reused_from_answer_id', { length: 36 }),
  transcriptHash: text('transcript_hash'),
  keyVersionHash: text('key_version_hash'),
  createdAt: ts('created_at').notNull().defaultNow(),
});

/** Answers the instruction screen flagged when marked, and the teacher's "not an instruction" (migration 020). */
export const hwInstructionFlag = pgTable('hw_instruction_flag', {
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  answerId: varchar('answer_id', { length: 36 }).notNull(),
  transcriptHash: text('transcript_hash').notNull(),
  screenVersion: text('screen_version').notNull(),
  patternIds: jsonb('pattern_ids').$type<string[]>().notNull(),
  flaggedAt: ts('flagged_at').notNull().defaultNow(),
  dismissedAt: ts('dismissed_at'),
  dismissedBy: varchar('dismissed_by', { length: 255 }),
}, (t) => [primaryKey({ columns: [t.answerId, t.transcriptHash] })]);

/** Answer keys for public questions, shared across tenants. No organization_id by design. */
export const hwSharedKey = pgTable('hw_shared_key', {
  cacheKey: text('cache_key').primaryKey(),
  questionHash: text('question_hash').notNull(),
  questionOrigin: text('question_origin').$type<HwKeyQuestionOrigin>().notNull(),
  source: text('source').$type<'official' | 'textbook'>().notNull(),
  sourceRef: text('source_ref').notNull(),
  keyServiceVersion: text('key_service_version').notNull(),
  configHash: text('config_hash').notNull(),
  result: jsonb('result').$type<Record<string, unknown>>().notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
  lastUsedAt: ts('last_used_at').notNull().defaultNow(),
  useCount: integer('use_count').notNull().default(0),
});
