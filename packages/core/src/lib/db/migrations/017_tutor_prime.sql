-- 017_tutor_prime.sql
--
-- The tutor's Basic/Prime tiers (TUTOR_TIERS_ENABLED): of a day's questions_asked, how many were answered on Prime,
-- so Prime can be a share of the student's daily limit. Every existing row reads 0 (all earlier questions were Basic).
--
-- Adds one column with a default; touches no existing value. Apply by hand as a superuser (no migration ledger
-- here), after a schema backup, BEFORE the code that reads it goes live. Undo: 017_tutor_prime.down.sql.

BEGIN;

ALTER TABLE ai_tutor_usage ADD COLUMN IF NOT EXISTS prime_asked integer DEFAULT 0;

COMMIT;
