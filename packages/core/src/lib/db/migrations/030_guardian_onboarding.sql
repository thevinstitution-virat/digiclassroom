-- 030_guardian_onboarding.sql
--
-- Guardian onboarding for both modes (owner's requirement, 5 Nov 2026):
--   B2B: an institution admin picks a student of the institution and sends the guardian an invitation link.
--   B2C: for a student who joined as an independent learner (no institution), the super admin picks that student and creates the invitation.
-- The guardian signs up (or signs in) from the link; accepting it creates the platform-wide link between the guardian and the ward. The link is
-- platform-level (organization_id is NULL for an independent learner), so every screen that shows a ward's data checks the same table.
-- This replaces hw_guardian_link (028, never used on production: 0 rows); that table stays until a later "contract" migration drops it.
-- The "expand" step: two NEW tables. Rollback: 030_guardian_onboarding.down.sql.
--
-- Decisions:
--   * The invitation token is never stored: only its sha256. The link is shown once to the issuer and sent by email.
--   * An invitation names the guardian's e-mail address; only an account with that verified address can accept it.
--   * A link is never deleted: ending it records who and when. Invitations are never deleted either (revoked or accepted ones stay).
--   * The table holds ids and the invited address only.

BEGIN;

CREATE TABLE guardian_link (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  guardian_user_id  VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  student_user_id   VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  -- NULL = an independent learner (B2C); otherwise the institution the student belongs to (B2B).
  organization_id   VARCHAR(255) REFERENCES organization(id) ON DELETE CASCADE,
  created_via       TEXT         NOT NULL CHECK (created_via IN ('institution_invite', 'platform_invite')),
  invitation_id     VARCHAR(36),
  created_by        VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  ended_at          TIMESTAMPTZ,
  ended_by          VARCHAR(255),
  CONSTRAINT guardian_link_not_self CHECK (guardian_user_id <> student_user_id),
  CONSTRAINT guardian_link_ended_together CHECK ((ended_at IS NULL) = (ended_by IS NULL)),
  CONSTRAINT guardian_link_mode CHECK ((created_via = 'institution_invite') = (organization_id IS NOT NULL))
);
CREATE UNIQUE INDEX guardian_link_live ON guardian_link (guardian_user_id, student_user_id, (COALESCE(organization_id, ''))) WHERE ended_at IS NULL;
CREATE INDEX guardian_link_guardian_idx ON guardian_link (guardian_user_id) WHERE ended_at IS NULL;
CREATE INDEX guardian_link_student_idx ON guardian_link (student_user_id) WHERE ended_at IS NULL;

CREATE TABLE guardian_invitation (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token_hash        CHAR(64)     NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  guardian_email    TEXT         NOT NULL CHECK (guardian_email = lower(btrim(guardian_email)) AND guardian_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  student_user_id   VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  organization_id   VARCHAR(255) REFERENCES organization(id) ON DELETE CASCADE,
  issuer_kind       TEXT         NOT NULL CHECK (issuer_kind IN ('institution_admin', 'super_admin')),
  issuer_user_id    VARCHAR(255) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ  NOT NULL,
  email_sent_at     TIMESTAMPTZ,
  accepted_at       TIMESTAMPTZ,
  accepted_by       VARCHAR(255),
  link_id           VARCHAR(36),
  revoked_at        TIMESTAMPTZ,
  revoked_by        VARCHAR(255),
  CONSTRAINT guardian_invitation_mode CHECK ((issuer_kind = 'institution_admin') = (organization_id IS NOT NULL)),
  CONSTRAINT guardian_invitation_expiry CHECK (expires_at > created_at),
  CONSTRAINT guardian_invitation_accepted_together CHECK ((accepted_at IS NULL) = (accepted_by IS NULL) AND (accepted_at IS NULL) = (link_id IS NULL)),
  CONSTRAINT guardian_invitation_revoked_together CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
  CONSTRAINT guardian_invitation_one_outcome CHECK (accepted_at IS NULL OR revoked_at IS NULL)
);
-- One open invitation per guardian address, student and institution (a new one is made after revoking or expiry).
CREATE UNIQUE INDEX guardian_invitation_open ON guardian_invitation (guardian_email, student_user_id, (COALESCE(organization_id, ''))) WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX guardian_invitation_org_idx ON guardian_invitation (organization_id, created_at DESC);
CREATE INDEX guardian_invitation_student_idx ON guardian_invitation (student_user_id);

-- Links: only ending is allowed after creation. Invitations: only the outcome columns and the e-mail time may be set, once.
CREATE OR REPLACE FUNCTION guardian_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.ended_at IS NOT NULL THEN RAISE EXCEPTION 'an ended link cannot be changed' USING ERRCODE = 'restrict_violation'; END IF;
  IF NEW.id <> OLD.id OR NEW.guardian_user_id <> OLD.guardian_user_id OR NEW.student_user_id <> OLD.student_user_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.created_via <> OLD.created_via OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'only ended_at and ended_by of a link may change' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guardian_invitation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.token_hash <> OLD.token_hash OR NEW.guardian_email <> OLD.guardian_email OR NEW.student_user_id <> OLD.student_user_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.issuer_kind <> OLD.issuer_kind OR NEW.issuer_user_id <> OLD.issuer_user_id
     OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'an invitation cannot be rewritten: revoke it and make a new one' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (OLD.accepted_at IS NOT NULL OR OLD.revoked_at IS NOT NULL) AND (NEW.accepted_at IS DISTINCT FROM OLD.accepted_at OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR NEW.accepted_by IS DISTINCT FROM OLD.accepted_by OR NEW.revoked_by IS DISTINCT FROM OLD.revoked_by) THEN
    RAISE EXCEPTION 'an invitation that was accepted or revoked cannot change again' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION guardian_no_direct_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Deleting the institution or a user cascades through (trigger depth above 1); a direct DELETE is refused.
  IF pg_trigger_depth() = 1 THEN RAISE EXCEPTION '% rows are never deleted', TG_TABLE_NAME USING ERRCODE = 'restrict_violation'; END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER guardian_link_guard BEFORE UPDATE ON guardian_link FOR EACH ROW EXECUTE FUNCTION guardian_link_guard();
CREATE TRIGGER guardian_invitation_guard BEFORE UPDATE ON guardian_invitation FOR EACH ROW EXECUTE FUNCTION guardian_invitation_guard();
CREATE TRIGGER guardian_link_no_delete BEFORE DELETE ON guardian_link FOR EACH ROW EXECUTE FUNCTION guardian_no_direct_delete();
CREATE TRIGGER guardian_invitation_no_delete BEFORE DELETE ON guardian_invitation FOR EACH ROW EXECUTE FUNCTION guardian_no_direct_delete();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.guardian_link OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.guardian_invitation OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.guardian_link_guard() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.guardian_invitation_guard() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.guardian_no_direct_delete() OWNER TO digiclassroom_app';
END $$;

COMMIT;
