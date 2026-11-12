-- 035_hw_exam_practice.sql: a learner's own practice test, drawn from a question pool (docs/hw-eval/exam-packages.md, section 13).
--
-- A super admin keeps a POOL of questions for a chapter (a set of kind 'pool', each question with a topic); a learner picks topics, question
-- types and how many, and gets a PRACTICE set of their own, drawn from the pool, which they attempt like any other set (timer, printed sheet,
-- photo booklet, marking). Needs 034. Alters hw_exam_set and hw_exam_set_item by adding columns and widening one CHECK; drops nothing.
--
-- Guards, not only code: a pool can never be attempted; a practice set can only be attempted by the learner it was made for; a practice set
-- always says whose it is and which pool it came from, and no other kind may.

BEGIN;

ALTER TABLE hw_exam_set DROP CONSTRAINT hw_exam_set_kind_check;
ALTER TABLE hw_exam_set ADD CONSTRAINT hw_exam_set_kind_check
  CHECK (kind IN ('pyq', 'sqp', 'mock_half', 'mock_full', 'pool', 'practice'));

ALTER TABLE hw_exam_set ADD COLUMN owner_user_id VARCHAR(255) REFERENCES "user"(id) ON DELETE CASCADE;
ALTER TABLE hw_exam_set ADD COLUMN pool_set_id VARCHAR(36) REFERENCES hw_exam_set(id) ON DELETE RESTRICT;
ALTER TABLE hw_exam_set ADD CONSTRAINT hw_exam_set_practice_shape
  CHECK ((kind = 'practice') = (owner_user_id IS NOT NULL) AND (kind = 'practice') = (pool_set_id IS NOT NULL));
CREATE INDEX hw_exam_set_owner_idx ON hw_exam_set (owner_user_id) WHERE owner_user_id IS NOT NULL;

ALTER TABLE hw_exam_set_item ADD COLUMN topic TEXT NOT NULL DEFAULT '';

-- A pool is never attempted; a practice set only by its own learner.
CREATE OR REPLACE FUNCTION hw_exam_attempt_practice() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE set_kind TEXT; set_owner VARCHAR(255);
BEGIN
  SELECT kind, owner_user_id INTO set_kind, set_owner FROM hw_exam_set WHERE id = NEW.set_id;
  IF set_kind = 'pool' THEN
    RAISE EXCEPTION 'set % is a question pool; it cannot be attempted', NEW.set_id USING ERRCODE = 'restrict_violation';
  END IF;
  IF set_kind = 'practice' AND set_owner IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'practice set % belongs to another learner', NEW.set_id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_exam_attempt_practice BEFORE INSERT ON hw_exam_attempt
  FOR EACH ROW EXECUTE FUNCTION hw_exam_attempt_practice();

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    EXECUTE 'ALTER FUNCTION public.hw_exam_attempt_practice() OWNER TO digiclassroom_app';
  END IF;
END $$;

COMMIT;
