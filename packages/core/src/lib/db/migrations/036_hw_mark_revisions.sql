-- 036_hw_mark_revisions.sql: marks changed after they reached the learner, each with who changed them (docs/hw-eval/mark-revisions.md).
--
-- Owner's rule (12 Nov 2026): the super admin, an institution's admin and the learner's assigned teacher may change released marks at any time:
-- returned homework, and a reported exam attempt. A school's admin or teacher must give their name and designation, and the learner's grade
-- card / report says "Revised by <name>, <designation>, <date>". A platform super admin (the app's owner) is recorded the same way but the
-- learner sees only "Marks revised on <date>".
--
-- * hw_mark_revision: one row per changed answer, append-only (never edited; it goes only with its answer).
-- * hw_exam_report: a revision of an exam attempt is a NEW report row (revision 1, 2, ...), the old one kept as it was; the table stays
--   append-only. UNIQUE (attempt_id) becomes UNIQUE (attempt_id, revision).
-- Needs 014 and 034. Drops nothing.

BEGIN;

CREATE TABLE hw_mark_revision (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  -- the answer's own institution (the exam space for an exam answer)
  organization_id     VARCHAR(255) NOT NULL,
  answer_id           VARCHAR(36)  NOT NULL REFERENCES hw_answer(id) ON DELETE CASCADE,
  submission_id       VARCHAR(36)  NOT NULL REFERENCES hw_submission(id) ON DELETE CASCADE,
  exam_attempt_id     VARCHAR(36)  REFERENCES hw_exam_attempt(id) ON DELETE CASCADE,
  -- null when the answer had no mark yet (an exam answer that was waiting for a person)
  marks_before        NUMERIC(6,2) CHECK (marks_before >= 0),
  marks_after         NUMERIC(6,2) NOT NULL CHECK (marks_after >= 0),
  item_marks          JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(item_marks) = 'array'),
  reason              TEXT         NOT NULL CHECK (length(btrim(reason)) BETWEEN 3 AND 1000),
  revised_by          VARCHAR(255) NOT NULL,
  reviser_name        TEXT         NOT NULL CHECK (length(btrim(reviser_name)) BETWEEN 2 AND 120),
  reviser_designation TEXT         NOT NULL CHECK (length(btrim(reviser_designation)) BETWEEN 2 AND 120),
  -- platform = the app's super admin / owner; admin = the institution's admin; teacher = the learner's assigned teacher
  reviser_kind        TEXT         NOT NULL CHECK (reviser_kind IN ('platform', 'admin', 'teacher')),
  -- what the learner sees: the reviser's name and designation, or the date only (the app's own staff)
  show_reviser        BOOLEAN      NOT NULL,
  -- the school the reviser acted for (an exam answer's learner may belong to one); null for platform staff
  reviser_org_id      VARCHAR(255),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_mark_revision_shown CHECK (show_reviser = (reviser_kind <> 'platform')),
  CONSTRAINT hw_mark_revision_org CHECK ((reviser_kind = 'platform') = (reviser_org_id IS NULL))
);
CREATE INDEX hw_mark_revision_answer_idx ON hw_mark_revision (answer_id, created_at);
CREATE INDEX hw_mark_revision_attempt_idx ON hw_mark_revision (exam_attempt_id) WHERE exam_attempt_id IS NOT NULL;

CREATE OR REPLACE FUNCTION hw_mark_revision_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hw_mark_revision rows are append-only' USING ERRCODE = 'restrict_violation';
END $$;
-- updates are refused; rows go only with their answer (ON DELETE CASCADE), like hw_ai_grade
CREATE TRIGGER hw_mark_revision_append_only BEFORE UPDATE ON hw_mark_revision
  FOR EACH ROW EXECUTE FUNCTION hw_mark_revision_append_only();

-- Exam reports: numbered revisions, still append-only.
ALTER TABLE hw_exam_report ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0);
ALTER TABLE hw_exam_report DROP CONSTRAINT hw_exam_report_one;
ALTER TABLE hw_exam_report ADD CONSTRAINT hw_exam_report_one UNIQUE (attempt_id, revision);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    EXECUTE 'ALTER TABLE public.hw_mark_revision OWNER TO digiclassroom_app';
    EXECUTE 'ALTER FUNCTION public.hw_mark_revision_append_only() OWNER TO digiclassroom_app';
  END IF;
END $$;

COMMIT;
