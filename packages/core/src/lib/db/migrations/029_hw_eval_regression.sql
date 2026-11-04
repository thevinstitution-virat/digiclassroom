-- 029_hw_eval_regression.sql
--
-- Virat Evaluator, roadmap-remaining.md workstream C: the regression gate's result on the "Runs & gates" tab, imported from the command's own
-- regression.json (npm run hw:eval:regression writes it next to the candidate run), never recomputed. The "expand" step: one NEW table.
-- Append-only, like hw_eval_run and hw_eval_gate_result (023): a new import is a new row; an old one is never rewritten. Rollback: 029_hw_eval_regression.down.sql.
--
-- Requires 023 (hw_eval_results_append_only()).

BEGIN;

CREATE TABLE hw_eval_regression (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  baseline_run_id   TEXT         NOT NULL CHECK (baseline_run_id ~ '^run_[A-Za-z0-9_]{3,100}$'),
  candidate_run_id  TEXT         NOT NULL CHECK (candidate_run_id ~ '^run_[A-Za-z0-9_]{3,100}$'),
  dataset_ref       TEXT         NOT NULL CHECK (dataset_ref ~ '^[a-z0-9][a-z0-9_-]*@v[0-9]+$'),
  ok                BOOLEAN      NOT NULL,
  -- The command's checks, unchanged: metric, baseline, candidate, limit, ok, delta (estimate and interval), n.
  checks            JSONB        NOT NULL CHECK (jsonb_typeof(checks) = 'array'),
  source_sha256     CHAR(64)     NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  imported_by       VARCHAR(255) NOT NULL,
  imported_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (baseline_run_id, candidate_run_id, source_sha256)
);
CREATE INDEX hw_eval_regression_recent_idx ON hw_eval_regression (imported_at DESC);
CREATE TRIGGER hw_eval_regression_no_change BEFORE UPDATE OR DELETE ON hw_eval_regression
  FOR EACH ROW EXECUTE FUNCTION hw_eval_results_append_only();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_eval_regression OWNER TO digiclassroom_app';
END $$;

COMMIT;
