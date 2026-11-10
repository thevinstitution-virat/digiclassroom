-- 034_hw_exams.down.sql: removes the exam packages and everything a learner did with them (entitlements, attempts, uploaded pages, reports).
-- The materialised hw_assignment rows an attempt created are NOT removed: they are ordinary assignments, and their submissions, answers and grades
-- belong to the learner. Delete them separately if that is really what is wanted.
BEGIN;
DROP TRIGGER IF EXISTS hw_exam_set_item_guard ON hw_exam_set_item;
DROP TRIGGER IF EXISTS hw_exam_set_guard ON hw_exam_set;
DROP TRIGGER IF EXISTS hw_exam_package_guard ON hw_exam_package;
DROP TRIGGER IF EXISTS hw_exam_report_append_only ON hw_exam_report;
DROP TRIGGER IF EXISTS hw_exam_attempt_allowance ON hw_exam_attempt;
DROP TRIGGER IF EXISTS hw_exam_attempt_clock_frozen ON hw_exam_attempt;
DROP TRIGGER IF EXISTS hw_exam_item_bank_checked ON hw_exam_set_item;

DROP TABLE IF EXISTS hw_exam_report;
DROP TABLE IF EXISTS hw_exam_page;
DROP TABLE IF EXISTS hw_exam_attempt;
DROP TABLE IF EXISTS hw_exam_entitlement;
DROP TABLE IF EXISTS hw_exam_set_item;
DROP TABLE IF EXISTS hw_exam_set;
DROP TABLE IF EXISTS hw_exam_package;

DROP FUNCTION IF EXISTS hw_exam_set_item_guard();
DROP FUNCTION IF EXISTS hw_exam_set_guard();
DROP FUNCTION IF EXISTS hw_exam_package_guard();
DROP FUNCTION IF EXISTS hw_exam_report_append_only();
DROP FUNCTION IF EXISTS hw_exam_attempt_allowance();
DROP FUNCTION IF EXISTS hw_exam_attempt_clock_frozen();
DROP FUNCTION IF EXISTS hw_exam_item_bank_checked();
COMMIT;
