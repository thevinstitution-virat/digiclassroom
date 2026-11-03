-- 023_hw_eval_runs_gates.down.sql
--
-- Rolls back 023_hw_eval_runs_gates.sql: drops the two result tables and their trigger function. They hold imported copies of
-- command-line outputs (the originals are the report files), so nothing is lost that cannot be imported again. Roll back 024 first:
-- an eligibility record that cites a gate result by id keeps the id as text, so it does not block this, but the evidence is gone.

BEGIN;

DROP TABLE IF EXISTS hw_eval_gate_result;
DROP TABLE IF EXISTS hw_eval_run;
DROP FUNCTION IF EXISTS hw_eval_results_append_only();

COMMIT;
