-- 038_hw_exam_item_answers.sql: an exam question carries its model answer and its permanent question ID (cbse-science-qbank quality pass,
-- 14 Nov 2026). Needs 037. Adds three columns to hw_exam_set_item; adds no table and drops nothing.
--
--   model_answer   the full answer a learner would write, in the NCERT / Exemplar style (for an objective question: the option and a one-line
--                  reason). It is the key's worked answer, not the key: marking still uses correct_option / parts. Learners do not see it yet;
--                  where it is shown (after marking, in revision, in the teacher's panel) is decided later.
--   answer_source  who wrote the model answer: "assistant" (written from NCERT, checked with the key) or "NCERT Exemplar" (the book's own printed answer)
--   qid            the question's permanent ID in the bank (ids.json there), e.g. "10-Sci-13-13.1.1-004-E"; the same question keeps it in every pool,
--                  practice test and app, so later services can link to it. Not unique: a practice test copies its pool's questions.
--
-- The 034 guard already freezes every column of a published set's questions, so these are frozen with the rest.

BEGIN;

ALTER TABLE hw_exam_set_item ADD COLUMN model_answer TEXT;
ALTER TABLE hw_exam_set_item ADD COLUMN answer_source TEXT;
ALTER TABLE hw_exam_set_item ADD COLUMN qid TEXT;

ALTER TABLE hw_exam_set_item ADD CONSTRAINT hw_exam_set_item_answer_shapes CHECK (
  (model_answer IS NULL) = (answer_source IS NULL)
  AND (model_answer IS NULL OR length(btrim(model_answer)) BETWEEN 1 AND 8000)
  AND (answer_source IS NULL OR answer_source IN ('assistant', 'NCERT Exemplar', 'NCERT', 'CBSE marking scheme'))
  AND (qid IS NULL OR qid ~ '^[A-Za-z0-9][A-Za-z0-9.-]{2,79}$')
);

CREATE INDEX hw_exam_set_item_qid_idx ON hw_exam_set_item (qid) WHERE qid IS NOT NULL;

COMMIT;
