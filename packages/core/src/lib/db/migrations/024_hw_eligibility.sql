-- 024_hw_eligibility.sql
--
-- Virat Evaluator, roadmap task 5.3: the eligibility registry. The "expand" step: one column on hw_question (with a default, so nothing
-- existing changes), two new tables. Rollback: 024_hw_eligibility.down.sql.
--
-- A GROUP is subject x question type x language x scheme source. AI marking suggestions are created and shown only for a group whose
-- row here says 'eligible' AND whose config_hash equals the marking configuration running now (lib/hw/eligibility). A group with no
-- row is not eligible: that is the default for every group. A change of model, prompt or marking options changes the running hash, so
-- eligibility stops applying until the group is promoted again from a passing gate run for the new configuration.
--
-- hw_eligibility is the current state; hw_eligibility_event is its append-only history (who, when, from what to what, which gate result,
-- why, and whether the monitor did it automatically).
--
-- hw_question.scheme_source: where a question's marking scheme came from. Every existing question is 'custom' (a teacher's own scheme,
-- the only kind that existed before 027). Migration 027 sets it from the answer key a question uses: 'board_scheme_key', 'passage_key' or 'textbook_key'.

BEGIN;

ALTER TABLE hw_question
  ADD COLUMN scheme_source TEXT NOT NULL DEFAULT 'teacher_rubric' CHECK (scheme_source IN ('board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric'));

CREATE TABLE hw_eligibility (
  group_key         TEXT         PRIMARY KEY CHECK (group_key = lower(group_key) AND group_key ~ '^[^|]+\|(very_short|short|long|essay)\|(en|hi|mixed)\|(board_scheme_key|passage_key|textbook_key|teacher_rubric)$'),
  subject           VARCHAR(100) NOT NULL,
  question_type     TEXT         NOT NULL CHECK (question_type IN ('very_short', 'short', 'long', 'essay')),
  language          TEXT         NOT NULL CHECK (language IN ('en', 'hi', 'mixed')),
  scheme_source     TEXT         NOT NULL CHECK (scheme_source IN ('board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric')),
  status            TEXT         NOT NULL CHECK (status IN ('insufficient_data', 'not_yet', 'eligible')),
  config_hash       CHAR(64)     CHECK (config_hash IS NULL OR config_hash ~ '^[0-9a-f]{64}$'),
  gate_result_id    VARCHAR(36),
  dataset_versions  TEXT[]       NOT NULL DEFAULT ARRAY[]::text[],
  decided_by        VARCHAR(255) NOT NULL,
  decided_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  reason            TEXT         NOT NULL CHECK (length(btrim(reason)) >= 3),
  -- An eligible group always carries the evidence it rests on.
  CONSTRAINT hw_eligibility_eligible_has_evidence CHECK (status <> 'eligible' OR (config_hash IS NOT NULL AND gate_result_id IS NOT NULL AND cardinality(dataset_versions) > 0))
);

CREATE TABLE hw_eligibility_event (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  at                TIMESTAMPTZ  NOT NULL DEFAULT now(),
  group_key         TEXT         NOT NULL,
  from_status       TEXT         NOT NULL,
  to_status         TEXT         NOT NULL CHECK (to_status IN ('insufficient_data', 'not_yet', 'eligible')),
  config_hash       CHAR(64),
  gate_result_id    VARCHAR(36),
  dataset_versions  TEXT[]       NOT NULL DEFAULT ARRAY[]::text[],
  actor_id          TEXT         NOT NULL,
  automatic         BOOLEAN      NOT NULL DEFAULT false,
  reason            TEXT         NOT NULL
);
CREATE INDEX hw_eligibility_event_group_idx ON hw_eligibility_event (group_key, at DESC);

CREATE OR REPLACE FUNCTION hw_eligibility_event_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hw_eligibility_event is append-only: % is not allowed', TG_OP USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER hw_eligibility_event_no_change BEFORE UPDATE OR DELETE ON hw_eligibility_event
  FOR EACH ROW EXECUTE FUNCTION hw_eligibility_event_append_only();
CREATE TRIGGER hw_eligibility_event_no_truncate BEFORE TRUNCATE ON hw_eligibility_event
  FOR EACH STATEMENT EXECUTE FUNCTION hw_eligibility_event_append_only();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_eligibility OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_eligibility_event OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_eligibility_event_append_only() OWNER TO digiclassroom_app';
END $$;

COMMIT;
