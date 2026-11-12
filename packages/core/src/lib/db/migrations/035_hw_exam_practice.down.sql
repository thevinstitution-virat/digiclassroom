-- 035_hw_exam_practice.down.sql: removes question pools and learners' practice sets support. Refuses (and changes nothing) while any pool or
-- practice set exists: those are content and learners' history; retire or delete them first, on purpose.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM hw_exam_set WHERE kind IN ('pool', 'practice')) THEN
    RAISE EXCEPTION 'pools or practice sets exist; remove them first' USING ERRCODE = 'restrict_violation';
  END IF;
END $$;
DROP TRIGGER IF EXISTS hw_exam_attempt_practice ON hw_exam_attempt;
DROP FUNCTION IF EXISTS hw_exam_attempt_practice();
ALTER TABLE hw_exam_set_item DROP COLUMN IF EXISTS topic;
DROP INDEX IF EXISTS hw_exam_set_owner_idx;
ALTER TABLE hw_exam_set DROP CONSTRAINT IF EXISTS hw_exam_set_practice_shape;
ALTER TABLE hw_exam_set DROP COLUMN IF EXISTS pool_set_id;
ALTER TABLE hw_exam_set DROP COLUMN IF EXISTS owner_user_id;
ALTER TABLE hw_exam_set DROP CONSTRAINT hw_exam_set_kind_check;
ALTER TABLE hw_exam_set ADD CONSTRAINT hw_exam_set_kind_check CHECK (kind IN ('pyq', 'sqp', 'mock_half', 'mock_full'));
COMMIT;
