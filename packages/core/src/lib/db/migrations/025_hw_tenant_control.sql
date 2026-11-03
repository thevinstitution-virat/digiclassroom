-- 025_hw_tenant_control.sql
--
-- Virat Evaluator, roadmap task 5.1: tenant control. The "expand" step: two columns on hw_tenant_quota (with defaults, so nothing existing
-- changes) and one new table. Nothing is renamed or dropped. Rollback: 025_hw_tenant_control.down.sql.
--
--   monthly_budget_paise  the institution's monthly AI budget, in paise (integer, never a float). When it is above 0 it is what the quota
--                         compares (this month's recorded cost against it); when it is 0 the old rule still applies (monthly_answer_quota,
--                         an answer count shared by reading and marking), so nothing changes until a budget is set. A later "contract"
--                         migration drops monthly_answer_quota once no institution uses it.
--   scope_restricted      false: the feature applies to the whole institution (as today). true: only to the classes and sections listed in
--                         hw_tenant_scope (none listed means none), so a pilot can run in one class without the rest of the school seeing it.
--   hw_tenant_scope       one row per allowed class (section_id NULL = every section of the class) or class section.
--
-- The month a budget is counted in is the Indian Standard Time month (code change in lib/hw/db.ts monthKey, no schema change): the usage table
-- keeps one row per month keyed by its first day, and no institution has usage rows yet.
--
-- Apply as a superuser or the owning role; the last block hands the new table to digiclassroom_app, as the earlier migrations do.

BEGIN;

ALTER TABLE hw_tenant_quota
  ADD COLUMN monthly_budget_paise BIGINT  NOT NULL DEFAULT 0 CHECK (monthly_budget_paise >= 0),
  ADD COLUMN scope_restricted     BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE hw_tenant_scope (
  organization_id  VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  class_id         VARCHAR(36)  NOT NULL REFERENCES institution_classes(id) ON DELETE CASCADE,
  section_id       VARCHAR(36)  REFERENCES institution_sections(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- A class (all sections) and a section of it are different entries; the same entry twice is refused.
CREATE UNIQUE INDEX hw_tenant_scope_entry ON hw_tenant_scope (organization_id, class_id, coalesce(section_id, ''));
CREATE INDEX hw_tenant_scope_org_idx ON hw_tenant_scope (organization_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_tenant_scope OWNER TO digiclassroom_app';
END $$;

COMMIT;
