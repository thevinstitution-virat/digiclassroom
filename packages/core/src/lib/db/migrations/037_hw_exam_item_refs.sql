-- 037_hw_exam_item_refs.sql: an exam question carries where it comes from and what a learner needs to see (docs/hw-eval/board-bank-roadmap.md,
-- phase 2). Needs 034 and 035. Adds six columns to hw_exam_set_item; adds no table and drops nothing.
--
--   ncert         the textbook section that teaches it: {"book", "chapterNo", "section", "title", "pages"}; drives the learner's topic choice and the
--                 "revise NCERT x.y, pages a-b" link after marking
--   sources       the printed papers it was asked in, e.g. ["31/2/1 Q13", "31/2/2 Q15"] (a choice alternative carries its letter: "31/2/1 Q28A")
--   choice_group  questions sharing a group are the alternatives of one internal choice; a practice test never draws two of them
--   figures       the question's own pictures: [{"key", "description", "labels"}]; the key is a private object under hw-exams/figures/
--
-- The 034 guard already freezes every column of a published set's questions, so these are frozen with the rest.

BEGIN;

ALTER TABLE hw_exam_set_item ADD COLUMN ncert JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE hw_exam_set_item ADD COLUMN sources JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE hw_exam_set_item ADD COLUMN choice_group TEXT;
ALTER TABLE hw_exam_set_item ADD COLUMN figures JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE hw_exam_set_item ADD CONSTRAINT hw_exam_set_item_ref_shapes CHECK (
  jsonb_typeof(ncert) = 'object' AND jsonb_typeof(sources) = 'array' AND jsonb_typeof(figures) = 'array'
  AND (choice_group IS NULL OR length(choice_group) BETWEEN 1 AND 100)
);
-- A figure is always a private object of this feature, never an outside link: every figure has a key under hw-exams/figures/, with no ".." or "//"
-- (backslashes are refused in code, assertHwKey; a jsonpath regex cannot say "backslash" portably).
ALTER TABLE hw_exam_set_item ADD CONSTRAINT hw_exam_set_item_figure_keys CHECK (
  NOT jsonb_path_exists(figures, '$[*] ? (!(@.key starts with "hw-exams/figures/") || @.key like_regex "[.][.]|//")')
);

CREATE INDEX hw_exam_set_item_choice_idx ON hw_exam_set_item (set_id, choice_group) WHERE choice_group IS NOT NULL;

-- A key written by the assistant ("KEY TO CHECK") is checked by a named teacher before its pool can be published. Changing the question's content
-- clears the check (code); the 034 guard freezes it, with everything else, once the set is published.
ALTER TABLE hw_exam_set_item ADD COLUMN key_checked_by TEXT;
ALTER TABLE hw_exam_set_item ADD COLUMN key_checked_at TIMESTAMPTZ;
ALTER TABLE hw_exam_set_item ADD CONSTRAINT hw_exam_set_item_key_check_named CHECK (
  (key_checked_by IS NULL) = (key_checked_at IS NULL) AND (key_checked_by IS NULL OR length(btrim(key_checked_by)) > 0)
);

COMMIT;
