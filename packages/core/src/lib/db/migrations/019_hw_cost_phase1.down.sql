-- 019_hw_cost_phase1.down.sql
--
-- Rolls back 019_hw_cost_phase1.sql. Drops only the two tables it created. Suggestions in
-- hw_ai_grade are untouched; they lose only the record of how they were produced. Shared keys
-- are rebuilt (and paid for again) on demand.

BEGIN;

DROP TABLE IF EXISTS hw_ai_grade_source, hw_shared_key;

COMMIT;
