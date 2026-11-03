-- 021_hw_eval_rater_invite.down.sql
--
-- Rolls back 021_hw_eval_rater_invite.sql: drops the invitation table and restores the original account check of migration 015
-- (every 'student' and 'parent' account barred from being a rater). Raters already created stay; they are not re-checked.
-- Run it only after the invitation code is switched off (HW_EVAL_TOOLS_ENABLED false, or the code rolled back).

BEGIN;

DROP TABLE IF EXISTS hw_eval_rater_invite;
DROP TABLE IF EXISTS hw_admin_audit;  -- the append-only audit record goes with its table: export it first if it is needed
DROP FUNCTION IF EXISTS hw_admin_audit_append_only();

CREATE OR REPLACE FUNCTION hw_eval_rater_check_account() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r TEXT;
BEGIN
  SELECT role INTO r FROM "user" WHERE id = NEW.user_id;
  IF coalesce(r, 'student') IN ('student', 'parent') THEN
    RAISE EXCEPTION 'a % account cannot be a rater', coalesce(r, 'student')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

COMMIT;
