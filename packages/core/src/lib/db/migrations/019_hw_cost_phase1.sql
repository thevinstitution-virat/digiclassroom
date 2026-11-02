-- 019_hw_cost_phase1.sql
--
-- Handwritten Assignments cost work, phase 1 (docs/hw-eval/cost-phase1.md): two NEW tables, the
-- "expand" step. Nothing existing is altered, renamed or dropped, so the code that uses them
-- (behind HW_SHARED_KEYS_ENABLED, HW_CODE_MARKING_ENABLED, HW_DEDUPE_MARKING_ENABLED) can be
-- deployed before or after this file is applied: with those flags off it never touches them.
-- Apply it BEFORE switching any of those flags on.
-- Rollback: 019_hw_cost_phase1.down.sql.
--
-- Requires 014 (hw_ai_grade, hw_forbid_update). Apply as a superuser; the last block hands every
-- new object to digiclassroom_app, as 014 and 015 do.
--
-- Decisions:
--   * Where a suggestion came from is a SIDE table keyed by hw_ai_grade.id, not a new column on
--     hw_ai_grade: that table is append-only and read by every marking screen, and adding a
--     column to it would make the code depend on this migration even with every flag off.
--   * hw_shared_key is deliberately NOT tenant-scoped: it holds keys for PUBLIC questions
--     (a textbook exercise or a board paper) built from the official scheme or the textbook, so
--     one tenant paying for a key serves the next. A teacher-written question never enters it
--     (the code refuses, and question_origin below cannot say "custom").
--   * Neither table holds student data. hw_ai_grade_source holds a hash of a transcript, not the
--     transcript.

BEGIN;

-- ---------------------------------------------------------------------------
-- hw_ai_grade_source: how each AI suggestion was produced
-- ---------------------------------------------------------------------------

CREATE TABLE hw_ai_grade_source (
  ai_grade_id            VARCHAR(36)  PRIMARY KEY,
  organization_id        VARCHAR(255) NOT NULL,
  answer_id              VARCHAR(36)  NOT NULL,
  -- ai: a model marked it. code: marked by a rule on an exact match. reuse: copied from another
  -- answer's AI suggestion because transcript, question and key version are identical.
  mark_source            TEXT         NOT NULL CHECK (mark_source IN ('ai', 'code', 'reuse')),
  reused_from_answer_id  VARCHAR(36),
  -- sha256 of the normalised transcript, and of the question and its key (prompt, marks, rubric
  -- items, model answer, accepted answers, rubric version). Reuse needs both to match.
  transcript_hash        TEXT,
  key_version_hash       TEXT,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  FOREIGN KEY (ai_grade_id, organization_id)
    REFERENCES hw_ai_grade (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT hw_ai_grade_source_reuse_has_origin
    CHECK ((mark_source = 'reuse') = (reused_from_answer_id IS NOT NULL))
);
CREATE INDEX hw_ai_grade_source_org_idx    ON hw_ai_grade_source (organization_id);
CREATE INDEX hw_ai_grade_source_answer_idx ON hw_ai_grade_source (answer_id);
CREATE INDEX hw_ai_grade_source_dedupe_idx ON hw_ai_grade_source (organization_id, key_version_hash, transcript_hash)
  WHERE transcript_hash IS NOT NULL;
CREATE TRIGGER hw_ai_grade_source_append_only BEFORE UPDATE ON hw_ai_grade_source
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

-- ---------------------------------------------------------------------------
-- hw_shared_key: answer keys for public questions, shared across tenants
-- ---------------------------------------------------------------------------

CREATE TABLE hw_shared_key (
  cache_key            TEXT        PRIMARY KEY,   -- sha256 of every field below that defines the key
  question_hash        TEXT        NOT NULL,      -- sha256 of the normalised question text
  question_origin      TEXT        NOT NULL CHECK (question_origin IN ('textbook_exercise', 'board_paper')),
  source               TEXT        NOT NULL CHECK (source IN ('official', 'textbook')),
  -- official: the scheme label; textbook: book work key (or ISBN) + edition + chapter.
  source_ref           TEXT        NOT NULL,
  key_service_version  TEXT        NOT NULL,      -- bumped when prompts, checks or retrieval change
  config_hash          TEXT        NOT NULL,      -- writer, verifier, thresholds, index
  result               JSONB       NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  use_count            INTEGER     NOT NULL DEFAULT 0 CHECK (use_count >= 0)
);
CREATE INDEX hw_shared_key_question_idx ON hw_shared_key (question_hash);

-- ---------------------------------------------------------------------------
-- Ownership: same as every other table here
-- ---------------------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  FOREACH t IN ARRAY ARRAY['hw_ai_grade_source', 'hw_shared_key'] LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO digiclassroom_app', t);
  END LOOP;
END $$;

COMMIT;
