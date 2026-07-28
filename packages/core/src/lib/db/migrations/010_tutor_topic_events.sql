-- 010_tutor_topic_events.sql
--
-- Persistent per-student topic signal for the AI tutor.
--
-- WHY THIS EXISTS
-- Nothing previously stored topic-level signal for tutor interactions:
--   ai_tutor_usage    counters only (questions_asked, total_tokens_used)
--   learning_events   event_type enum covers video/quiz/session only
--   quiz_answers      has is_correct but per question_id, quizzes only
--   practest_attempt_events  has is_correct + user_id, but nothing aggregated it by topic
-- So the "Ace Your Exams" persona had no way to know what a student is weak at.
--
-- WHY RAW SQL RATHER THAN drizzle-kit generate
-- The drizzle migration journal stops at 0003 (53 tables) while src/db/schema.ts
-- defines 66. Twenty tables — the whole Phase 4/5 set (quizzes, quiz_attempts,
-- quiz_questions, quiz_options, quiz_answers, orders, payments, certificates,
-- batch_templates, batch_coupons, batch_waitlist, announcements, app_config,
-- learning_events, student_engagement_snapshots, student_yearly_growth, and the
-- four taxonomy_* tables) were created by raw SQL migrations in this directory,
-- bypassing drizzle. Running `drizzle-kit generate` therefore tries to author all
-- 21 tables in one migration and prompts rename-vs-create for each
-- (e.g. "is batches.template_id created or renamed from organization_id?").
-- Answering those wrongly would RENAME columns holding data, so that drift must
-- be resolved deliberately by a human, not guessed at here.
--
-- This migration is additive and idempotent: CREATE TABLE IF NOT EXISTS only, no
-- ALTER of existing tables, so it is safe to apply independently of that cleanup.
--
-- Apply with:  node scripts/run-migration.js src/lib/db/migrations/010_tutor_topic_events.sql
--
-- NOTE: the matching Drizzle definition (tutorTopicEvents in src/db/schema.ts)
-- must stay in sync with this DDL by hand until the journal drift is resolved.

CREATE TABLE IF NOT EXISTS tutor_topic_events (
  id              VARCHAR(36)  NOT NULL DEFAULT (UUID()),
  organization_id VARCHAR(255) NULL,
  user_id         VARCHAR(255) NOT NULL,

  -- All topic dimensions are nullable: the tutor profile is assembled from
  -- request-body fields (src/app/api/ai/chat/route.ts:62) that clients do not
  -- always send. A row with a null subject still counts toward doubt frequency,
  -- so a partial row must never fail the write.
  subject         VARCHAR(100) NULL,
  chapter         VARCHAR(255) NULL,
  topic           VARCHAR(255) NULL,

  -- Mirrors user_notes.board so the two can be compared without normalisation.
  board           ENUM('CBSE','ICSE','STATE_BOARD') NULL,

  -- VARCHAR not INT, matching user_notes.class_level and the tutor session,
  -- which carry both 'Class 10' and '10'.
  class_level     VARCHAR(20)  NULL,

  -- Enum so adding a future type ('quiz_failed', 're_explained') is a deliberate
  -- migration rather than a silent typo.
  event_type      ENUM('doubt_asked') NOT NULL DEFAULT 'doubt_asked',

  -- Active tutor persona (menuIntent id), for per-agent breakdowns.
  agent_id        VARCHAR(64)  NULL,

  created_at      TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- Supports "recent doubts for this student" (the read path's time window).
  INDEX idx_tte_user_time (user_id, created_at),
  -- Supports the GROUP BY subject/topic aggregation.
  INDEX idx_tte_user_subject_topic (user_id, subject, topic),

  CONSTRAINT fk_tte_organization
    FOREIGN KEY (organization_id) REFERENCES organization(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
