-- 025_hw_tenant_control.down.sql
--
-- Rolls back 025_hw_tenant_control.sql: drops the class allow-list and the two columns. Budgets set in paise are lost (export
-- hw_tenant_quota first if any was set): institutions fall back to their answer-count quota, or to "AI off" if it is 0. With the
-- allow-list gone the feature applies to the whole institution again, wherever it is switched on.

BEGIN;

DROP TABLE IF EXISTS hw_tenant_scope;
ALTER TABLE hw_tenant_quota DROP COLUMN IF EXISTS scope_restricted, DROP COLUMN IF EXISTS monthly_budget_paise;

COMMIT;
