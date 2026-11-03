-- 026_hw_monitoring.down.sql: removes the two tables 026 added. Their rows are derived data (the daily table is recomputed from the product's
-- own tables; the alert table is a history of alerts) so nothing else depends on them; the old hw_eval_monitor_daily is untouched.
BEGIN;
DROP TABLE IF EXISTS hw_monitor_alert;
DROP TABLE IF EXISTS hw_monitor_group_daily;
COMMIT;
