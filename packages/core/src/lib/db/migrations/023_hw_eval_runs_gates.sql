-- 023_hw_eval_runs_gates.sql
--
-- Virat Evaluator, roadmap tasks 5.3 and 5.5: the results of evaluation runs and gate tables, imported from the command line's own
-- outputs so the screens show exactly what `npm run hw:eval:report` produced, never a second calculation. The "expand" step: two new
-- tables, nothing existing is altered. Rollback: 023_hw_eval_runs_gates.down.sql.
--
-- Imported by `npm run hw:eval:gates -- import --report <report.json> --scheme-source <board_scheme_key|passage_key|textbook_key|teacher_rubric>`. Rows are
-- append-only: a new report is a new row, an old one is never rewritten. hw_eval_gate_result is what a promotion (024) rests on.
--
-- Apply as a superuser or the owning role; the last block hands the new tables to digiclassroom_app, as 014, 015, 019 to 022 do.

BEGIN;

CREATE TABLE hw_eval_run (
  run_id            TEXT         PRIMARY KEY CHECK (run_id ~ '^run_[A-Za-z0-9_]{3,100}$'),
  mode              TEXT         NOT NULL CHECK (mode IN ('read', 'key', 'mark', 'e2e')),
  status            TEXT         NOT NULL,
  dataset_ref       TEXT         NOT NULL CHECK (dataset_ref ~ '^[a-z0-9][a-z0-9_-]*@v[0-9]+$'),
  manifest_sha256   CHAR(64)     CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'),
  config_hash       TEXT,
  git_commit        TEXT,
  repeat            SMALLINT     CHECK (repeat IS NULL OR repeat >= 1),
  cost_paise        BIGINT       NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  counts            JSONB        NOT NULL DEFAULT '{}'::jsonb,
  summary           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  imported_by       VARCHAR(255) NOT NULL,
  imported_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  source_sha256     CHAR(64)     NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$')
);
CREATE INDEX hw_eval_run_dataset_idx ON hw_eval_run (dataset_ref, imported_at DESC);

CREATE TABLE hw_eval_gate_result (
  id                      VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  group_key               TEXT         NOT NULL,
  subject                 VARCHAR(100) NOT NULL,
  question_type           TEXT         NOT NULL CHECK (question_type IN ('very_short', 'short', 'long', 'essay')),
  language                TEXT         NOT NULL CHECK (language IN ('en', 'hi', 'mixed')),
  scheme_source           TEXT         NOT NULL CHECK (scheme_source IN ('board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric')),
  verdict                 TEXT         NOT NULL CHECK (verdict IN ('eligible', 'not_yet', 'insufficient_data')),
  checks                  JSONB        NOT NULL CHECK (jsonb_typeof(checks) = 'array'),
  run_ids                 TEXT[]       NOT NULL,
  dataset_versions        TEXT[]       NOT NULL CHECK (cardinality(dataset_versions) > 0),
  -- The marking configuration the measured runs correspond to (lib/hw/eligibility/fingerprint.ts); a promotion needs it to equal
  -- the configuration running now.
  production_fingerprint  CHAR(64)     CHECK (production_fingerprint IS NULL OR production_fingerprint ~ '^[0-9a-f]{64}$'),
  fingerprint_parts       JSONB,
  report_sha256           CHAR(64)     NOT NULL CHECK (report_sha256 ~ '^[0-9a-f]{64}$'),
  imported_by             VARCHAR(255) NOT NULL,
  imported_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (group_key, report_sha256)
);
CREATE INDEX hw_eval_gate_result_group_idx ON hw_eval_gate_result (group_key, imported_at DESC);

CREATE OR REPLACE FUNCTION hw_eval_results_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '%: imported results are append-only (% is not allowed); import a new report instead', TG_TABLE_NAME, TG_OP USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER hw_eval_run_no_change BEFORE UPDATE OR DELETE ON hw_eval_run
  FOR EACH ROW EXECUTE FUNCTION hw_eval_results_append_only();
CREATE TRIGGER hw_eval_gate_result_no_change BEFORE UPDATE OR DELETE ON hw_eval_gate_result
  FOR EACH ROW EXECUTE FUNCTION hw_eval_results_append_only();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_eval_run OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_eval_gate_result OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_eval_results_append_only() OWNER TO digiclassroom_app';
END $$;

COMMIT;
