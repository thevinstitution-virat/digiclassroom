-- 027_hw_question_keys.down.sql: removes what 027 added. Keys are derived data (rebuilt on request); the rubric items a key produced stay as they are,
-- but their source goes back to 'teacher' (the old check allows no other value besides 'ai_draft'). Origin, passage and rubric mode are lost.
BEGIN;
ALTER TABLE hw_ai_usage_monthly DROP COLUMN IF EXISTS key_cost_paise, DROP COLUMN IF EXISTS key_builds;
DROP TABLE IF EXISTS hw_ai_grade_scheme;
DROP TABLE IF EXISTS hw_question_key;
UPDATE hw_rubric_item SET source = 'teacher' WHERE source = 'key';
ALTER TABLE hw_rubric_item DROP CONSTRAINT hw_rubric_item_source_check;
ALTER TABLE hw_rubric_item ADD CONSTRAINT hw_rubric_item_source_check CHECK (source IN ('teacher', 'ai_draft'));
ALTER TABLE hw_question
  DROP COLUMN IF EXISTS active_key_id, DROP COLUMN IF EXISTS rubric_mode, DROP COLUMN IF EXISTS passage,
  DROP COLUMN IF EXISTS origin_ref, DROP COLUMN IF EXISTS origin;
COMMIT;
