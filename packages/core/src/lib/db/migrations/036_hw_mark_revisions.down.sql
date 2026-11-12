-- 036_hw_mark_revisions.down.sql: removes mark revisions. Refuses (and changes nothing) while any revision or revised exam report exists: those
-- are learners' records; they are not thrown away by a schema change.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM hw_mark_revision) OR EXISTS (SELECT 1 FROM hw_exam_report WHERE revision > 0) THEN
    RAISE EXCEPTION 'mark revisions exist; they are learners'' records and are not removed by a migration' USING ERRCODE = 'restrict_violation';
  END IF;
END $$;
ALTER TABLE hw_exam_report DROP CONSTRAINT hw_exam_report_one;
ALTER TABLE hw_exam_report ADD CONSTRAINT hw_exam_report_one UNIQUE (attempt_id);
ALTER TABLE hw_exam_report DROP COLUMN revision;
DROP TRIGGER IF EXISTS hw_mark_revision_append_only ON hw_mark_revision;
DROP FUNCTION IF EXISTS hw_mark_revision_append_only();
DROP TABLE hw_mark_revision;
COMMIT;
