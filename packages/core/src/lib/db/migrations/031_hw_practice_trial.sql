-- 031_hw_practice_trial.sql
--
-- Virat Evaluator, self-practice for independent learners (docs/hw-eval/self-practice.md): one trial per learner, limited by
-- days AND by rupees of AI cost. The "expand" step: one NEW table, nothing existing is altered. Rollback: 031_hw_practice_trial.down.sql.
--
-- Decisions (owner, 7 Nov 2026): 7 days and up to Rs 10 of AI cost. Both are copied onto the row when the trial starts, so
-- changing the settings later does not change a trial already running.
--   * A learner has at most one trial (user_id is the key); it is never restarted here.
--   * spent_paise is the AI cost recorded against the learner's own reading and marking jobs. Building an answer key is not counted
--     (an open decision in the design document).
--   * The table holds ids, dates and amounts only; no names, emails or work.
-- The feature is off unless HW_SELF_PRACTICE_ENABLED is set.

BEGIN;

CREATE TABLE hw_practice_trial (
  user_id        VARCHAR(255)  PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  ends_at        TIMESTAMPTZ   NOT NULL,
  budget_paise   BIGINT        NOT NULL CHECK (budget_paise >= 0),
  spent_paise    NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (spent_paise >= 0),
  state          TEXT          NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'used_up', 'ended')),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT hw_practice_trial_ends_after_start CHECK (ends_at > started_at)
);
CREATE INDEX hw_practice_trial_state_idx ON hw_practice_trial (state);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_practice_trial OWNER TO digiclassroom_app';
END $$;

COMMIT;
