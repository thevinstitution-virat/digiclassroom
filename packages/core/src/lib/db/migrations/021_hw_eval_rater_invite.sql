-- 021_hw_eval_rater_invite.sql
--
-- Handwritten Assignments / Virat Evaluator, roadmap task 3.2: rater invitations. The "expand" step: one new table, and one
-- function body replaced. Nothing existing is renamed or dropped. Rollback: 021_hw_eval_rater_invite.down.sql.
--
-- An invitation is "this email address may become a rater with this pseudonym and these skills". The invitee signs up (self
-- sign-up is open), verifies their email, and the rater row is then created by the server (lib/hw/eval-tools/invites.ts, called
-- from the email-verified hook). The address is the proof: only the person who can read the invitation email can verify it.
--
-- Requires 014 and 015 ("user", member, student_enrollments, hw_eval_rater, hw_eval_valid_skills). Apply as a superuser or the
-- owning role; the last block hands the new table to digiclassroom_app, as 014, 015, 019 and 020 do.
--
-- It also creates hw_admin_audit, the append-only record of every super-admin change (roadmap section 2, "audit trail"):
-- who, when, what, old value, new value, and why. The database refuses UPDATE, DELETE and TRUNCATE on it.
--
-- Decisions:
--   * One pending invitation per email address and per pseudonym.
--   * An invitation expires (expires_at, set by the server, 30 days). Accepting, cancelling and blocking are final states with
--     resolved_at; a blocked invitation keeps the reason (for example, the account belongs to an institution).
--   * hw_eval_rater_check_account() is relaxed: it barred every account whose role is 'student' or 'parent', but 'student' is
--     the role EVERY self sign-up gets (databaseHooks.user.create), so a volunteer who signed up could never be a rater. It now
--     bars a 'parent' account always, and a 'student' account that belongs to an institution (a member row) or is enrolled in a
--     class (student_enrollments). A bare account with neither is not a student of anyone and may be a rater.

BEGIN;

CREATE TABLE hw_eval_rater_invite (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email             VARCHAR(255) NOT NULL CHECK (email = lower(email) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  pseudonym         VARCHAR(40)  NOT NULL CHECK (pseudonym ~ '^[A-Za-z0-9_-]{3,40}$'),
  skills            TEXT[]       NOT NULL DEFAULT ARRAY[]::text[] CHECK (hw_eval_valid_skills(skills)),
  status            TEXT         NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'blocked')),
  invited_by        VARCHAR(255) NOT NULL REFERENCES "user"(id),
  email_sent_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ  NOT NULL,
  resolved_at       TIMESTAMPTZ,
  accepted_user_id  VARCHAR(255) REFERENCES "user"(id),
  blocked_reason    TEXT,
  CONSTRAINT hw_eval_rater_invite_accepted_has_user CHECK ((status = 'accepted') = (accepted_user_id IS NOT NULL)),
  CONSTRAINT hw_eval_rater_invite_final_has_time CHECK (status = 'pending' OR resolved_at IS NOT NULL),
  CONSTRAINT hw_eval_rater_invite_blocked_has_reason CHECK (status <> 'blocked' OR blocked_reason IS NOT NULL)
);
CREATE UNIQUE INDEX hw_eval_rater_invite_pending_email ON hw_eval_rater_invite (email) WHERE status = 'pending';
CREATE UNIQUE INDEX hw_eval_rater_invite_pending_pseudonym ON hw_eval_rater_invite (lower(pseudonym)) WHERE status = 'pending';
CREATE INDEX hw_eval_rater_invite_created_idx ON hw_eval_rater_invite (created_at DESC);

-- ---------------------------------------------------------------------------
-- hw_admin_audit: append-only
-- ---------------------------------------------------------------------------

CREATE TABLE hw_admin_audit (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  actor_id    VARCHAR(255) NOT NULL,
  action      TEXT         NOT NULL CHECK (action <> ''),
  entity      TEXT         NOT NULL CHECK (entity <> ''),
  entity_id   TEXT,
  old_value   JSONB,
  new_value   JSONB,
  reason      TEXT
);
CREATE INDEX hw_admin_audit_at_idx ON hw_admin_audit (at DESC);
CREATE INDEX hw_admin_audit_entity_idx ON hw_admin_audit (entity, entity_id);

CREATE OR REPLACE FUNCTION hw_admin_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hw_admin_audit is append-only: % is not allowed', TG_OP USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER hw_admin_audit_no_change BEFORE UPDATE OR DELETE ON hw_admin_audit
  FOR EACH ROW EXECUTE FUNCTION hw_admin_audit_append_only();
CREATE TRIGGER hw_admin_audit_no_truncate BEFORE TRUNCATE ON hw_admin_audit
  FOR EACH STATEMENT EXECUTE FUNCTION hw_admin_audit_append_only();

CREATE OR REPLACE FUNCTION hw_eval_rater_check_account() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r TEXT;
BEGIN
  SELECT role INTO r FROM "user" WHERE id = NEW.user_id;
  IF coalesce(r, 'student') = 'parent' THEN
    RAISE EXCEPTION 'a parent account cannot be a rater' USING ERRCODE = 'check_violation';
  END IF;
  IF coalesce(r, 'student') = 'student'
     AND (EXISTS (SELECT 1 FROM member WHERE user_id = NEW.user_id)
          OR EXISTS (SELECT 1 FROM student_enrollments WHERE user_id = NEW.user_id)) THEN
    RAISE EXCEPTION 'a student account of an institution cannot be a rater' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_eval_rater_invite OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_admin_audit OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_admin_audit_append_only() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_eval_rater_check_account() OWNER TO digiclassroom_app';
END $$;

COMMIT;
