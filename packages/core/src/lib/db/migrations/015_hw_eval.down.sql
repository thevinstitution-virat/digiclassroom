-- 015_hw_eval.down.sql
--
-- Rolls back 015_hw_eval.sql. Drops only the hw_eval_ tables and functions it created;
-- 014's tables and everything else are untouched.
--
-- This deletes raters, tasks, human transcriptions and marks, consent records, shadow
-- results and monitoring. Export them first (they are the reference data the evals are
-- judged against). R2 objects under hw-assignments/evals/ are NOT removed by this file.

BEGIN;

DROP TABLE IF EXISTS
  hw_eval_monitor_daily,
  hw_eval_shadow_result,
  hw_eval_consent,
  hw_eval_adjudication,
  hw_eval_submission,
  hw_eval_assignment,
  hw_eval_task,
  hw_eval_rater;

DROP FUNCTION IF EXISTS
  hw_eval_shadow_guard(),
  hw_eval_consent_guard(),
  hw_eval_adjudication_check(),
  hw_eval_submission_stamp(),
  hw_eval_assignment_guard(),
  hw_eval_assignment_check(),
  hw_eval_rater_check_account(),
  hw_eval_skill_for(TEXT, TEXT),
  hw_eval_valid_skills(TEXT[]);

COMMIT;
