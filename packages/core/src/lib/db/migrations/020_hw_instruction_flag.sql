-- 020_hw_instruction_flag.sql
--
-- Handwritten Assignments, phase 1d (docs/hw-eval/cost-phase1d.md): ONE new table, the "expand" step.
-- It records every answer the instruction screen flagged when it was marked, and whether the teacher said
-- "not an instruction", with the patterns that fired, so the pilot can measure the screen's real
-- false-positive rate per pattern. Nothing existing is altered, renamed or dropped.
-- Used only while HW_INSTRUCTION_GUARD_ENABLED is on (off by default). Apply it BEFORE switching that flag on.
-- Rollback: 020_hw_instruction_flag.down.sql.
--
-- Requires 014 (hw_answer with UNIQUE (id, organization_id)). Apply as a superuser; the last block hands the
-- new table to digiclassroom_app, as 014, 015 and 019 do.
--
-- Decisions:
--   * One row per (answer, transcript): a flag belongs to the exact text that was screened. A teacher who
--     edits the transcript gets a fresh screen of the new text, so a dismissal never hides different words.
--   * The table holds a hash of the transcript, not the transcript, and the ids of the patterns, not the
--     student's words.
--   * flagged_at is when the answer was marked (the denominator of the false-positive rate); dismissed_at and
--     dismissed_by are the teacher's one-tap "not an instruction" (the numerator).

BEGIN;

CREATE TABLE hw_instruction_flag (
  organization_id  VARCHAR(255) NOT NULL,
  answer_id        VARCHAR(36)  NOT NULL,
  transcript_hash  TEXT         NOT NULL,
  screen_version   TEXT         NOT NULL,
  pattern_ids      JSONB        NOT NULL CHECK (jsonb_typeof(pattern_ids) = 'array' AND jsonb_array_length(pattern_ids) > 0),
  flagged_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  dismissed_at     TIMESTAMPTZ,
  dismissed_by     VARCHAR(255),
  PRIMARY KEY (answer_id, transcript_hash),
  FOREIGN KEY (answer_id, organization_id) REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT hw_instruction_flag_dismissed_together CHECK ((dismissed_at IS NULL) = (dismissed_by IS NULL))
);
CREATE INDEX hw_instruction_flag_org_idx ON hw_instruction_flag (organization_id, flagged_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_instruction_flag OWNER TO digiclassroom_app';
END $$;

COMMIT;
