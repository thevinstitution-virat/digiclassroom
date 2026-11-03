-- 022_hw_eval_consent_pilot.sql
--
-- Virat Evaluator, roadmap task 3.1: consent records for the pilot. The "expand" step: columns added to hw_eval_consent (015), one
-- constraint, one index, and the withdrawal guard replaced. Nothing is renamed or dropped. Rollback: 022_hw_eval_consent_pilot.down.sql.
--
-- Requires 015 (hw_eval_consent, its guard trigger) and 021 is NOT required. Apply as a superuser or the owning role.
--
-- A consent record says that one person (a volunteer, a teacher, a student, or a parent for a student) agreed that work of theirs
-- may be used for certain SOURCES of evidence (A to F, see docs/hw-eval/pilot-plan.md) and certain USES (evaluation, shadow
-- mode, the report). It holds a pseudonym, never a name; the link to an account (subject_user_id) exists only for volunteers and
-- teachers, whose own copy tasks are gated on it, and is read only by the super admin's screens.
--
-- scope is a list of tokens: source:A .. source:F and use:evaluation, use:shadow, use:report. Rows written before this migration
-- (none in production) keep whatever scope they had; the new check applies to rows written from now on.
--
-- Withdrawal: one action, recorded with who and why, once. The guard (015) allowed only withdrawn_at to change; it now allows
-- withdrawn_at, withdrawn_by and withdrawn_reason to be set together, once, and nothing else.

BEGIN;

ALTER TABLE hw_eval_consent
  ADD COLUMN pseudonym         VARCHAR(40)  CHECK (pseudonym IS NULL OR pseudonym ~ '^[A-Za-z0-9_-]{3,40}$'),
  ADD COLUMN subject_user_id   VARCHAR(255) REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN collected_by      VARCHAR(120),
  ADD COLUMN withdrawn_by      VARCHAR(255),
  ADD COLUMN withdrawn_reason  TEXT;

ALTER TABLE hw_eval_consent
  ADD CONSTRAINT hw_eval_consent_scope_known
  CHECK (scope <@ ARRAY['source:A','source:B','source:C','source:D','source:E','source:F','use:evaluation','use:shadow','use:report']::text[])
  NOT VALID;

ALTER TABLE hw_eval_consent
  ADD CONSTRAINT hw_eval_consent_withdrawn_together
  CHECK ((withdrawn_at IS NULL) = (withdrawn_by IS NULL) AND (withdrawn_at IS NULL OR withdrawn_reason IS NOT NULL))
  NOT VALID;

-- One live record per person and kind.
CREATE UNIQUE INDEX hw_eval_consent_live_person ON hw_eval_consent (lower(pseudonym), subject_kind) WHERE withdrawn_at IS NULL AND pseudonym IS NOT NULL;
CREATE INDEX hw_eval_consent_user_idx ON hw_eval_consent (subject_user_id) WHERE subject_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION hw_eval_consent_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'withdrawn_at' - 'withdrawn_by' - 'withdrawn_reason') <> (to_jsonb(OLD) - 'withdrawn_at' - 'withdrawn_by' - 'withdrawn_reason')
     OR (OLD.withdrawn_at IS NOT NULL AND (NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at
                                           OR NEW.withdrawn_by IS DISTINCT FROM OLD.withdrawn_by
                                           OR NEW.withdrawn_reason IS DISTINCT FROM OLD.withdrawn_reason)) THEN
    RAISE EXCEPTION 'hw_eval_consent: only the withdrawal may be set, once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER FUNCTION public.hw_eval_consent_guard() OWNER TO digiclassroom_app';
END $$;

COMMIT;
