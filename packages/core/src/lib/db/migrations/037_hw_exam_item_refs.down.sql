-- 037_hw_exam_item_refs.down.sql: removes the textbook reference, sources, choice group, figures and key checks of exam questions. Refuses (and changes nothing)
-- while any question carries one of them: that is content a teacher checked and learners saw. Delete those pools first, on purpose.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM hw_exam_set_item WHERE ncert <> '{}'::jsonb OR sources <> '[]'::jsonb OR choice_group IS NOT NULL OR figures <> '[]'::jsonb OR key_checked_by IS NOT NULL) THEN
    RAISE EXCEPTION 'exam questions carry textbook references, sources, choice groups, figures or key checks; remove them first' USING ERRCODE = 'restrict_violation';
  END IF;
END $$;
ALTER TABLE hw_exam_set_item DROP CONSTRAINT IF EXISTS hw_exam_set_item_key_check_named;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS key_checked_at;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS key_checked_by;
DROP INDEX IF EXISTS hw_exam_set_item_choice_idx;
ALTER TABLE hw_exam_set_item DROP CONSTRAINT IF EXISTS hw_exam_set_item_figure_keys;
ALTER TABLE hw_exam_set_item DROP CONSTRAINT IF EXISTS hw_exam_set_item_ref_shapes;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS figures;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS choice_group;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS sources;
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS ncert;
COMMIT;
