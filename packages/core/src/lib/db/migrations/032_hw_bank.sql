-- 032_hw_bank.sql
--
-- Virat Evaluator, board-paper bank (docs/hw-eval/board-paper-importer.md): official board papers (a CBSE sample paper, a past paper) and their official
-- marking schemes, as questions a learner can practise and the answer-key service can use as an OFFICIAL key (scheme source board_scheme_key).
-- The "expand" step: four NEW tables, nothing existing is altered. Rollback: 032_hw_bank.down.sql.
--
-- Decisions:
--   * The bank is shared content, not a school's data: no organization column (like hw_shared_key). Papers are public documents, but their text is
--     kept out of git and out of public storage.
--   * One row is one thing a learner can ATTEMPT. A question with an internal choice ("attempt either A or B") is stored as one row per alternative
--     (alt A, alt B; or C, D with the common sub-parts copied), carrying the same choice_group, so totals never count both alternatives. A
--     "for visually impaired students" version is its own row (variant 'vi'), never served by default.
--   * Nothing becomes an official key until a person has checked it: status draft -> checked -> published. The content of a checked or published
--     row cannot change; it has to go back to draft first (guard trigger), which bumps its version.
--   * Parts and their value points are kept as JSON (they are read whole and never queried one point at a time).

BEGIN;

CREATE TABLE hw_bank_paper (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  board            TEXT         NOT NULL CHECK (board <> ''),
  class_level      INTEGER      NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  subject          TEXT         NOT NULL CHECK (subject <> ''),
  subject_code     TEXT         NOT NULL CHECK (subject_code <> ''),
  session          TEXT         NOT NULL CHECK (session <> ''),
  kind             TEXT         NOT NULL CHECK (kind IN ('sqp', 'past_paper')),
  title            TEXT         NOT NULL,
  max_marks        NUMERIC(6,1) NOT NULL CHECK (max_marks > 0),
  duration         TEXT,
  source_files     JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(source_files) = 'array'),
  source_sha256    CHAR(64)     NOT NULL,
  status           TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'checked', 'published')),
  version          INTEGER      NOT NULL DEFAULT 1 CHECK (version >= 1),
  imported_by      TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_bank_paper_identity UNIQUE (board, class_level, subject_code, session, kind)
);

CREATE TABLE hw_bank_question (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  paper_id         VARCHAR(36)  NOT NULL REFERENCES hw_bank_paper(id) ON DELETE CASCADE,
  number           INTEGER      NOT NULL CHECK (number >= 1),
  alt              TEXT         CHECK (alt IN ('A', 'B', 'C', 'D')),
  variant          TEXT         CHECK (variant = 'vi'),
  section          TEXT         NOT NULL CHECK (section <> ''),
  marks            NUMERIC(4,1) NOT NULL CHECK (marks > 0 AND (marks * 2) = round(marks * 2)),
  qtype            TEXT         NOT NULL CHECK (qtype IN ('mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based')),
  stem             TEXT         NOT NULL CHECK (stem <> ''),
  stem_raw         TEXT         NOT NULL,
  options          JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(options) = 'array'),
  correct_option   TEXT         CHECK (correct_option ~ '^[A-D]$'),
  accepted_answers JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(accepted_answers) = 'array'),
  choice_group     TEXT,
  choice_kind      TEXT         CHECK (choice_kind IN ('option', 'subpart')),
  parts            JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(parts) = 'array'),
  scheme_text      TEXT         NOT NULL DEFAULT '',
  equations        JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(equations) = 'array'),
  diagram_parts    JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(diagram_parts) = 'array'),
  needs_check      JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(needs_check) = 'array'),
  status           TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'checked', 'published', 'rejected')),
  version          INTEGER      NOT NULL DEFAULT 1 CHECK (version >= 1),
  content_hash     CHAR(64)     NOT NULL,
  checked_by       TEXT,
  checked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- a choice row says which kind of choice it belongs to, and the other way round
  CONSTRAINT hw_bank_question_choice_together CHECK ((choice_group IS NULL) = (choice_kind IS NULL)),
  -- a multiple-choice or assertion-reason row has four options and a correct one; a written row has neither
  CONSTRAINT hw_bank_question_mcq_shape CHECK (
    (qtype IN ('mcq', 'assertion_reason') AND correct_option IS NOT NULL AND jsonb_array_length(options) = 4)
    OR (qtype NOT IN ('mcq', 'assertion_reason') AND correct_option IS NULL AND jsonb_array_length(options) = 0)),
  -- checked or published means a named person checked it
  CONSTRAINT hw_bank_question_checked_by CHECK ((status IN ('checked', 'published')) = (checked_by IS NOT NULL AND checked_at IS NOT NULL))
);
-- One row per paper, number, alternative and variant.
CREATE UNIQUE INDEX hw_bank_question_identity ON hw_bank_question (paper_id, number, COALESCE(alt, ''), COALESCE(variant, ''));
CREATE INDEX hw_bank_question_status_idx ON hw_bank_question (paper_id, status);

CREATE TABLE hw_bank_figure (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  question_id         VARCHAR(36)  NOT NULL REFERENCES hw_bank_question(id) ON DELETE CASCADE,
  figure_id           TEXT         NOT NULL CHECK (figure_id <> ''),
  side                TEXT         NOT NULL CHECK (side IN ('paper', 'scheme')),
  description         TEXT         NOT NULL,
  labels              JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(labels) = 'array'),
  readings            JSONB,
  confidence          TEXT         NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  needs_person_check  BOOLEAN      NOT NULL DEFAULT false,
  note                TEXT,
  -- the image itself, once uploaded (private storage); the description is what a screen reader and the checker see
  storage_key         TEXT         CHECK (storage_key IS NULL OR storage_key LIKE 'hw-bank/%'),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_bank_figure_once UNIQUE (question_id, figure_id)
);

-- Who imported what, when, from which file (append-only: rows are never changed).
CREATE TABLE hw_bank_import (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  paper_id         VARCHAR(36)  REFERENCES hw_bank_paper(id) ON DELETE SET NULL,
  actor            TEXT         NOT NULL,
  source_sha256    CHAR(64)     NOT NULL,
  summary          JSONB        NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER hw_bank_paper_touch BEFORE UPDATE ON hw_bank_paper FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();
CREATE TRIGGER hw_bank_question_touch BEFORE UPDATE ON hw_bank_question FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- A checked or published row's content never changes: send it back to draft first (which is how a revised scheme gets a new version and a new check).
CREATE OR REPLACE FUNCTION hw_bank_question_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('checked', 'published') AND NEW.status IN ('checked', 'published')
     AND (NEW.content_hash <> OLD.content_hash OR NEW.marks <> OLD.marks OR NEW.parts <> OLD.parts OR NEW.stem <> OLD.stem
          OR NEW.options <> OLD.options OR NEW.correct_option IS DISTINCT FROM OLD.correct_option) THEN
    RAISE EXCEPTION 'hw_bank_question: the content of a checked or published question cannot change; send it back to draft first'
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id <> OLD.id OR NEW.paper_id <> OLD.paper_id OR NEW.number <> OLD.number OR NEW.alt IS DISTINCT FROM OLD.alt OR NEW.variant IS DISTINCT FROM OLD.variant THEN
    RAISE EXCEPTION 'hw_bank_question: a question''s place in the paper cannot change' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_bank_question_guard BEFORE UPDATE ON hw_bank_question FOR EACH ROW EXECUTE FUNCTION hw_bank_question_guard();

CREATE OR REPLACE FUNCTION hw_bank_import_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Deleting a paper sets paper_id to NULL through the foreign key (depth > 1); anything else is refused.
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 AND NEW.paper_id IS NULL AND (to_jsonb(NEW) - 'paper_id') = (to_jsonb(OLD) - 'paper_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'hw_bank_import rows are append-only' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER hw_bank_import_append_only BEFORE UPDATE OR DELETE ON hw_bank_import FOR EACH ROW EXECUTE FUNCTION hw_bank_import_append_only();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_bank_paper OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_bank_question OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_bank_figure OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_bank_import OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_bank_question_guard() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_bank_import_append_only() OWNER TO digiclassroom_app';
END $$;

COMMIT;
