-- 011_super_admin_bootstrap.sql
--
-- Target database: `digiclassroom` (DCP's own DB), PostgreSQL. Superuser.
--
-- WHY THIS EXISTS
--
-- `protect_super_admin()` blocked EVERY insert carrying role='super_admin':
--
--     IF TG_OP = 'INSERT' AND role_new = owner_role THEN
--       RAISE EXCEPTION 'the super-admin role cannot be granted to a new account';
--
-- That is correct while an owner row exists — it stops anyone minting a second
-- super-admin. But the 2026-08-06 identity reset emptied the `user` table, and
-- the rule then locked the door from the inside:
--
--   * no super_admin row existed;
--   * federated login (see cb06371, which provisions role from Vidyaverse's
--     global_role) tries to INSERT the owner as super_admin on first sign-in;
--   * the trigger rejected that insert;
--   * so sign-in failed, no user was ever created, and every subsequent attempt
--     failed the same way. Email/password returned 401 "User not found" because
--     that was literally true.
--
-- A deadlock the application could not break out of by any route. Recovery
-- required a DBA using the trigger's own escape hatch
-- (app.allow_superadmin_change), which is fine once but is not a thing anyone
-- should have to rediscover at 2am after the next reset.
--
-- WHAT CHANGES
--
-- Permit an INSERT of super_admin ONLY when no super_admin row exists yet —
-- bootstrapping the first owner. Every other guarantee is untouched:
--
--   * a SECOND super_admin still cannot be inserted;
--   * the role still cannot be granted to an existing account by UPDATE;
--   * it still cannot be removed from the owner;
--   * the owner still cannot be deleted.
--
-- The window this opens is exactly the window in which the system is unusable
-- anyway: zero owners. Anyone who could exploit it could equally well run the
-- escape hatch, since both require database access.

BEGIN;

CREATE OR REPLACE FUNCTION public.protect_super_admin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  owner_role CONSTANT text := 'super_admin';
  role_new text;
  role_old text;
  existing_owners int;
BEGIN
  -- Explicit DBA override, unchanged.
  IF current_setting('is_superuser', true) = 'on'
     AND current_setting('app.allow_superadmin_change', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role::text = owner_role THEN
      RAISE EXCEPTION 'the super-admin (owner) account cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  role_new := NEW.role::text;
  IF TG_OP = 'UPDATE' THEN role_old := OLD.role::text; END IF;

  IF TG_OP = 'INSERT' AND role_new = owner_role THEN
    -- BOOTSTRAP EXCEPTION: allow the FIRST owner to be created. Once one
    -- exists, this branch raises exactly as before.
    SELECT count(*) INTO existing_owners
      FROM public."user" WHERE role::text = owner_role;

    IF existing_owners > 0 THEN
      RAISE EXCEPTION 'the super-admin role cannot be granted to a new account';
    END IF;

    RAISE NOTICE 'bootstrapping the first super-admin account (%)', NEW.email;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF role_new = owner_role AND role_old IS DISTINCT FROM owner_role THEN
      RAISE EXCEPTION 'the super-admin role cannot be granted to another account';
    END IF;
    IF role_old = owner_role AND role_new IS DISTINCT FROM owner_role THEN
      RAISE EXCEPTION 'the super-admin role cannot be removed from the owner account';
    END IF;
  END IF;

  RETURN NEW;
END $function$;

COMMIT;
