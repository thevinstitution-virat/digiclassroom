-- 012_dcp_chat_history_postgres.sql
--
-- Postgres-native chat-history tables for the AI Tutor.
--
-- The original 001_menu_chatbot_tables.sql is MySQL-only DDL (AUTO_INCREMENT,
-- ENUM, inline INDEX) and was never applied to the DCP Postgres database, so
-- history persistence had no tables at all. This migration creates them fresh.
--
-- Decisions:
--   * Message table standardized on `chat_messages_history` (the write path in
--     chat-history-service.ts and the analytics readers already use this name;
--     the read route was reading the never-created `chat_messages` — fixed to
--     match in the same change).
--   * Legacy `clerk_user_id` dropped — DCP runs on better-auth, not Clerk.
--   * ENUMs relaxed to VARCHAR + free text, matching how the service inserts.

CREATE TABLE IF NOT EXISTS conversations (
  id            SERIAL PRIMARY KEY,
  user_id       VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL,
  intent        VARCHAR(100) NOT NULL,
  topic         VARCHAR(255),
  subject       VARCHAR(100),
  class_level   VARCHAR(20),
  session_id    VARCHAR(255) NOT NULL,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  metadata      JSONB,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id    ON conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations (session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_intent     ON conversations (intent);
CREATE INDEX IF NOT EXISTS idx_conversations_status     ON conversations (status);

CREATE TABLE IF NOT EXISTS chat_messages_history (
  id               SERIAL PRIMARY KEY,
  conversation_id  INTEGER     NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  message_type     VARCHAR(20) NOT NULL,
  content          TEXT        NOT NULL,
  metadata         JSONB,
  tokens_used      INTEGER,
  response_time_ms INTEGER,
  rag_sources      JSONB,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_history_conversation_id ON chat_messages_history (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_history_timestamp       ON chat_messages_history (timestamp);
