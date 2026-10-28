-- 017_tutor_prime.down.sql
--
-- Rolls back 017_tutor_prime.sql: the per-day Prime counts are lost (questions_asked, the total, stays). Turn
-- TUTOR_TIERS_ENABLED off first; the code that reads the column must not be live when it is dropped.

BEGIN;

ALTER TABLE ai_tutor_usage DROP COLUMN IF EXISTS prime_asked;

COMMIT;
