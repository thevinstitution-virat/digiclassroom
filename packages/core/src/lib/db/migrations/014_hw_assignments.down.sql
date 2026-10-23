-- 014_hw_assignments.down.sql
--
-- Rolls back 014_hw_assignments.sql. Drops only the hw_ tables and functions
-- it created; nothing else in the database is touched.
--
-- This deletes every assignment, answer and grade. R2 objects under
-- hw-assignments/ are NOT removed by this file: clean them up separately,
-- prefix-scoped.

BEGIN;

DROP TABLE IF EXISTS
  hw_answer_group_member,
  hw_answer_group,
  hw_writing_calibration,
  hw_tenant_quota,
  hw_ai_usage_monthly,
  hw_grade_history,
  hw_grade,
  hw_ai_grade,
  hw_ai_job,
  hw_transcript_revision,
  hw_answer,
  hw_submission,
  hw_rubric_item,
  hw_question,
  hw_assignment,
  hw_class_teacher;

DROP FUNCTION IF EXISTS
  hw_ai_grade_check(),
  hw_grade_record_history(),
  hw_grade_check(),
  hw_assignment_delete_check(),
  hw_assignment_check(),
  hw_question_check(),
  hw_rubric_item_check(),
  hw_forbid_update(),
  hw_touch_updated_at();

COMMIT;
