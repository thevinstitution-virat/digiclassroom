-- 024_hw_eligibility.down.sql
--
-- Rolls back 024_hw_eligibility.sql: drops the registry and its history (export hw_eligibility_event first if the history matters) and
-- the hw_question.scheme_source column. With the registry gone, switch HW_ELIGIBILITY_ENFORCED off or roll the code back first,
-- otherwise every group reads as "not eligible" and AI suggestions stop (the safe direction).

BEGIN;

DROP TABLE IF EXISTS hw_eligibility_event;
DROP TABLE IF EXISTS hw_eligibility;
DROP FUNCTION IF EXISTS hw_eligibility_event_append_only();
ALTER TABLE hw_question DROP COLUMN IF EXISTS scheme_source;

COMMIT;
