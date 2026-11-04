-- 026_hw_monitoring.sql
--
-- Virat Evaluator, roadmap task 5.4: the monitoring fields the first roll-up (015, hw_eval_monitor_daily) did not have, kept per GROUP
-- (subject x question type x language x scheme source) and per institution and Indian-time day, plus the alerts the roll-up raises.
-- The "expand" step: two NEW tables, nothing existing is altered, renamed or dropped. The old table keeps being written and read as before.
-- Why a new table and not new columns: the old table's primary key is (day, institution, subject, question type); adding language and
-- scheme source to a key means rebuilding it, which is a contract step. A new table needs none, and the old one can be dropped later,
-- on its own migration, once nothing reads it. Rollback: 026_hw_monitoring.down.sql.
--
-- Requires 015 (organization, hw_touch_updated_at) and 021 (hw_admin_audit is written by the code, not by this file).
-- Apply as a superuser or the owning role; the last block hands the new tables to digiclassroom_app, as 014 to 025 do.
--
-- Decisions:
--   * Rows are recomputed from the product's own tables (never incremented), as in 015, so a late correction is picked up the next time
--     the day is rolled up and running it twice is safe. Hence updated_at and no append-only trigger here.
--   * config_hash is the marking setup (lib/hw/eligibility/fingerprint.ts) running when the day was rolled up. The roll-up covers today and
--     yesterday every 15 minutes, so a day is attributed to the setup that was live at its end; a change of setup part-way through a day
--     is therefore approximate for that one day. The automatic demotion only looks at rows whose config_hash equals the promoted one.
--   * The alert table holds one OPEN alert per (group, code); clearing sets cleared_at. It never holds a student's words or an answer.

BEGIN;

CREATE TABLE hw_monitor_group_daily (
  day                    DATE          NOT NULL,
  organization_id        VARCHAR(255)  NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  group_key              TEXT          NOT NULL CHECK (group_key = lower(group_key)),
  subject                VARCHAR(100)  NOT NULL,
  question_type          TEXT          NOT NULL CHECK (question_type IN ('very_short', 'short', 'long', 'essay')),
  language               TEXT          NOT NULL CHECK (language IN ('en', 'hi', 'mixed')),
  scheme_source          TEXT          NOT NULL CHECK (scheme_source IN ('board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric')),
  config_hash            CHAR(64)      CHECK (config_hash IS NULL OR config_hash ~ '^[0-9a-f]{64}$'),
  -- Answers given a final mark that day, and how the final mark was reached (what the teacher DID, from hw_grade.source): accepted the AI
  -- suggestion as it was, accepted it after changing it, or marked by hand; or a rule in code marked it (an exact match or a blank).
  -- suggestions_shown counts answers that had an AI suggestion in front of the teacher, whatever they then did with it.
  answers_marked         INTEGER       NOT NULL DEFAULT 0 CHECK (answers_marked >= 0),
  suggestions_shown      INTEGER       NOT NULL DEFAULT 0 CHECK (suggestions_shown >= 0),
  accepted_unchanged     INTEGER       NOT NULL DEFAULT 0 CHECK (accepted_unchanged >= 0),
  accepted_edited        INTEGER       NOT NULL DEFAULT 0 CHECK (accepted_edited >= 0),
  marked_by_hand         INTEGER       NOT NULL DEFAULT 0 CHECK (marked_by_hand >= 0),
  marked_by_rule         INTEGER       NOT NULL DEFAULT 0 CHECK (marked_by_rule >= 0),
  -- Final mark differs from the suggestion; "large" is the evaluation's own definition (more than 1 mark or more than 20% of the question).
  overrides              INTEGER       NOT NULL DEFAULT 0 CHECK (overrides >= 0),
  large_overrides        INTEGER       NOT NULL DEFAULT 0 CHECK (large_overrides >= 0),
  override_abs_sum       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (override_abs_sum >= 0),   -- mean |change| = sum / overrides
  transcript_fixes       INTEGER       NOT NULL DEFAULT 0 CHECK (transcript_fixes >= 0),
  misread_taps           INTEGER       NOT NULL DEFAULT 0 CHECK (misread_taps >= 0),       -- student flagged "this is not what I wrote"
  instruction_flags      INTEGER       NOT NULL DEFAULT 0 CHECK (instruction_flags >= 0),
  instruction_not_taps   INTEGER       NOT NULL DEFAULT 0 CHECK (instruction_not_taps >= 0), -- teacher tapped "not an instruction"
  -- Marking jobs for this group's questions that finished that day.
  jobs_failed            INTEGER       NOT NULL DEFAULT 0 CHECK (jobs_failed >= 0),
  jobs_total             INTEGER       NOT NULL DEFAULT 0 CHECK (jobs_total >= 0),
  batch_fallbacks        INTEGER       NOT NULL DEFAULT 0 CHECK (batch_fallbacks >= 0),
  -- Money, in paise: what the day's reading and marking calls cost, shared over the answers they covered; the projected cost per answer
  -- is the configured figure for the question type when the row was written (NULL = none configured).
  actual_cost_paise      NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (actual_cost_paise >= 0),
  projected_paise_per_answer NUMERIC(10,4) CHECK (projected_paise_per_answer IS NULL OR projected_paise_per_answer >= 0),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT now(),
  PRIMARY KEY (day, organization_id, group_key),
  CHECK (accepted_unchanged + accepted_edited + marked_by_hand + marked_by_rule = answers_marked),
  CHECK (suggestions_shown <= answers_marked),
  CHECK (overrides <= suggestions_shown AND large_overrides <= overrides),
  CHECK (jobs_failed <= jobs_total AND batch_fallbacks <= jobs_total)
);
CREATE INDEX hw_monitor_group_daily_group_idx ON hw_monitor_group_daily (group_key, day);
CREATE INDEX hw_monitor_group_daily_org_idx   ON hw_monitor_group_daily (organization_id, day);
CREATE TRIGGER hw_monitor_group_daily_touch BEFORE UPDATE ON hw_monitor_group_daily
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

CREATE TABLE hw_monitor_alert (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_key     TEXT         NOT NULL CHECK (group_key = lower(group_key)),
  code          TEXT         NOT NULL CHECK (code IN ('override_rate', 'large_override_rate', 'transcript_fix_rate', 'failed_job_rate', 'cost_over_projection')),
  severity      TEXT         NOT NULL CHECK (severity IN ('warn', 'demote')),
  value         NUMERIC(12,4) NOT NULL,
  threshold     NUMERIC(12,4) NOT NULL,
  sample_size   INTEGER      NOT NULL CHECK (sample_size >= 0),   -- the answers (or jobs) the rate is over, in the 7 days before
  config_hash   CHAR(64),
  raised_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  demoted       BOOLEAN      NOT NULL DEFAULT false,              -- the group was taken out of "eligible" because of this alert
  emailed_at    TIMESTAMPTZ,
  cleared_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX hw_monitor_alert_open ON hw_monitor_alert (group_key, code) WHERE cleared_at IS NULL;
CREATE INDEX hw_monitor_alert_recent_idx ON hw_monitor_alert (raised_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_monitor_group_daily OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_monitor_alert OWNER TO digiclassroom_app';
END $$;

COMMIT;
