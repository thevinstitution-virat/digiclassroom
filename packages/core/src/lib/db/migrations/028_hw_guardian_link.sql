-- 028_hw_guardian_link.sql
--
-- Virat Evaluator, parent view (roadmap-remaining.md workstream A): which parent or guardian may see which student's RETURNED handwritten work.
-- The "expand" step: one NEW table, nothing existing is altered. Rollback: 028_hw_guardian_link.down.sql.
--
-- Decisions (the proposed policy; the owner may decide differently, and the feature is off unless HW_PARENT_VIEW_ENABLED is set):
--   * An institution admin makes the link, not the parent, so the institution knows who may see a child's work.
--   * A link is never edited or deleted: ending it sets ended_at and ended_by, so who could see what, and when, stays answerable.
--   * A link is per institution: the same parent account can be linked to a child in each institution separately.
--   * The table holds ids only; no names, emails or work.

BEGIN;

CREATE TABLE hw_guardian_link (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  guardian_user_id  VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  student_user_id   VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_by        VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  ended_by          VARCHAR(255),
  CONSTRAINT hw_guardian_link_not_self CHECK (guardian_user_id <> student_user_id),
  CONSTRAINT hw_guardian_link_ended_together CHECK ((ended_at IS NULL) = (ended_by IS NULL))
);
-- One live link per parent, child and institution.
CREATE UNIQUE INDEX hw_guardian_link_live ON hw_guardian_link (organization_id, guardian_user_id, student_user_id) WHERE ended_at IS NULL;
CREATE INDEX hw_guardian_link_guardian_idx ON hw_guardian_link (guardian_user_id) WHERE ended_at IS NULL;

-- Only ending a link is allowed after it is made: nothing else may change.
CREATE OR REPLACE FUNCTION hw_guardian_link_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'hw_guardian_link rows are never deleted: end the link instead' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'an ended link cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.id <> OLD.id OR NEW.organization_id <> OLD.organization_id OR NEW.guardian_user_id <> OLD.guardian_user_id
     OR NEW.student_user_id <> OLD.student_user_id OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'only ended_at and ended_by of a link may change' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
-- Deleting the institution or a user cascades through (trigger depth > 1); a direct DELETE is refused.
CREATE OR REPLACE FUNCTION hw_guardian_link_no_direct_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'hw_guardian_link rows are never deleted: end the link instead' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER hw_guardian_link_guard BEFORE UPDATE ON hw_guardian_link FOR EACH ROW EXECUTE FUNCTION hw_guardian_link_guard();
CREATE TRIGGER hw_guardian_link_no_delete BEFORE DELETE ON hw_guardian_link FOR EACH ROW EXECUTE FUNCTION hw_guardian_link_no_direct_delete();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_guardian_link OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_guardian_link_guard() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_guardian_link_no_direct_delete() OWNER TO digiclassroom_app';
END $$;

COMMIT;
