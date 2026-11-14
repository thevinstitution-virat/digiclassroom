-- 038_hw_exam_item_answers.down.sql: removes the model answer and permanent question ID of exam questions. Refuses (and changes nothing) while any
-- question carries one: that is content a teacher may have checked. Clear them first, on purpose
-- (UPDATE hw_exam_set_item SET model_answer = NULL, answer_source = NULL, qid = NULL on draft sets).
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM hw_exam_set_item WHERE model_answer IS NOT NULL OR qid IS NOT NULL) THEN
    RAISE EXCEPTION 'exam questions carry model answers or permanent question IDs; remove them first' USING ERRCODE = 'restrict_violation';
  END IF;
END $$;
DROP INDEX IF EXISTS hw_exam_set_item_qid_idx;
ALTER TABLE hw_exam_set_item DROP CONSTRAINT IF EXISTS hw_exam_set_item_answer_shapes;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS qid;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS answer_source;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS model_answer;
COMMIT;
