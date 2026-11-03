-- 022_hw_eval_consent_pilot.down.sql
--
-- Rolls back 022_hw_eval_consent_pilot.sql: drops the added columns, constraints and indexes, and restores the withdrawal guard of
-- migration 015. The columns hold pilot consent detail (pseudonym, account link, collector, who withdrew and why): export it first
-- if it is needed. The consent rows themselves, and their withdrawal dates, stay.

BEGIN;

DROP INDEX IF EXISTS hw_eval_consent_live_person;
DROP INDEX IF EXISTS hw_eval_consent_user_idx;
ALTER TABLE hw_eval_consent DROP CONSTRAINT IF EXISTS hw_eval_consent_scope_known;
ALTER TABLE hw_eval_consent DROP CONSTRAINT IF EXISTS hw_eval_consent_withdrawn_together;

-- The old guard compares every column but withdrawn_at, so the new columns must go before it is restored.
ALTER TABLE hw_eval_consent
  DROP COLUMN IF EXISTS pseudonym,
  DROP COLUMN IF EXISTS subject_user_id,
  DROP COLUMN IF EXISTS collected_by,
  DROP COLUMN IF EXISTS withdrawn_by,
  DROP COLUMN IF EXISTS withdrawn_reason;

CREATE OR REPLACE FUNCTION hw_eval_consent_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'withdrawn_at') <> (to_jsonb(OLD) - 'withdrawn_at')
     OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at) THEN
    RAISE EXCEPTION 'hw_eval_consent: only withdrawn_at may be set, once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

COMMIT;
