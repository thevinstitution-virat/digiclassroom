-- 033_hw_bank_review.sql
--
-- Virat Evaluator, board-paper bank, phase 2 (docs/hw-eval/board-paper-importer.md): a person checks each imported question against the printed
-- paper and marking scheme, and what they decided is kept. One NEW table (the review log) and one guard function on the paper; nothing existing is altered.
-- Needs 032. Rollback: 033_hw_bank_review.down.sql.
--
-- Decisions:
--   * A review verdict is bound to the exact content it was given for (content_hash), so a row that changed after the person looked is not "checked".
--   * The log is append-only, like the import log. Who checked a row is also on the row (checked_by, checked_at); the log keeps every verdict,
--     including the ones that sent a row back ("fix") or threw it out ("reject").
--   * A paper may only be marked checked or published when every one of its rows is checked or published (a row that is still draft or was
--     rejected blocks it), and has at least one row. The importer sets it back to draft when a row changes.

BEGIN;

CREATE TABLE hw_bank_review (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  paper_id          VARCHAR(36)  REFERENCES hw_bank_paper(id) ON DELETE SET NULL,
  question_id       VARCHAR(36)  REFERENCES hw_bank_question(id) ON DELETE SET NULL,
  -- where the row sits in the paper, kept even if the row is deleted
  number            INTEGER      NOT NULL CHECK (number >= 1),
  alt               TEXT         CHECK (alt IN ('A', 'B', 'C', 'D')),
  variant           TEXT         CHECK (variant = 'vi'),
  question_version  INTEGER      NOT NULL CHECK (question_version >= 1),
  content_hash      CHAR(64)     NOT NULL,
  verdict           TEXT         NOT NULL CHECK (verdict IN ('ok', 'fix', 'reject')),
  -- the "needs a person to look at it" items the reviewer confirmed, word for word
  confirmed         JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(confirmed) = 'array'),
  note              TEXT         NOT NULL DEFAULT '',
  -- the person who checked, and the person who ran the command that recorded it (often the same)
  reviewer          TEXT         NOT NULL CHECK (btrim(reviewer) <> ''),
  recorded_by       TEXT         NOT NULL CHECK (btrim(recorded_by) <> ''),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- "fix" and "reject" say what is wrong
  CONSTRAINT hw_bank_review_note CHECK (verdict = 'ok' OR btrim(note) <> '')
);
CREATE INDEX hw_bank_review_question_idx ON hw_bank_review (question_id, created_at DESC);
CREATE INDEX hw_bank_review_paper_idx ON hw_bank_review (paper_id, created_at DESC);

-- Append-only. Deleting a paper (or a question) blanks the reference through the foreign key (depth > 1); anything else is refused.
CREATE OR REPLACE FUNCTION hw_bank_review_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
     AND (NEW.paper_id IS NULL OR NEW.paper_id IS NOT DISTINCT FROM OLD.paper_id)
     AND (NEW.question_id IS NULL OR NEW.question_id IS NOT DISTINCT FROM OLD.question_id)
     AND (to_jsonb(NEW) - 'paper_id' - 'question_id') = (to_jsonb(OLD) - 'paper_id' - 'question_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'hw_bank_review rows are append-only' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER hw_bank_review_append_only BEFORE UPDATE OR DELETE ON hw_bank_review FOR EACH ROW EXECUTE FUNCTION hw_bank_review_append_only();

-- A paper is checked (or published) only when all of its rows are.
CREATE OR REPLACE FUNCTION hw_bank_paper_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('checked', 'published') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (SELECT 1 FROM hw_bank_question WHERE paper_id = NEW.id) THEN
      RAISE EXCEPTION 'hw_bank_paper: a paper without questions cannot be %', NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM hw_bank_question WHERE paper_id = NEW.id AND status NOT IN ('checked', 'published')) THEN
      RAISE EXCEPTION 'hw_bank_paper: every question must be checked before the paper is %', NEW.status USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_bank_paper_guard BEFORE UPDATE ON hw_bank_paper FOR EACH ROW EXECUTE FUNCTION hw_bank_paper_guard();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_bank_review OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_bank_review_append_only() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_bank_paper_guard() OWNER TO digiclassroom_app';
END $$;

COMMIT;
