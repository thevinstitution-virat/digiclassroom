-- 015_hw_eval.sql
--
-- Virat Evaluator: tables for the human tools (transcription, blind marking, key audit,
-- de-identification), consent records, shadow-mode results and daily monitoring
-- (docs/hw-eval/stage1-design.md §4, §9). Datasets and run records stay as files.
--
-- Purely additive: nothing existing is altered, renamed or dropped.
-- Rollback: 015_hw_eval.down.sql. Requires 014 (hw_answer, hw_touch_updated_at,
-- hw_forbid_update). Apply as a superuser; the last block hands every new object to
-- digiclassroom_app, as 014 does.
--
-- Decisions:
--   * The "evaluator role" is NOT a new value of "user".role or member.role: those drive
--     every dashboard and route in the app. An evaluator is a user with an ACTIVE row in
--     hw_eval_rater, and the tools are also behind HW_EVAL_TOOLS_ENABLED. Students,
--     parents and ordinary teachers never see them; a student or parent account can never
--     become a rater (trigger), because raters are adults doing paid or volunteer work.
--   * Raters are known to each other and in every payload only by pseudonym. The link to
--     the account (user_id) is read only by super_admin endpoints.
--   * Rater and task tables are platform-level (no organization_id): raters may come from
--     several partner schools, and the work is on de-identified dataset items.
--     Shadow results and monitoring are tenant data and carry organization_id.
--   * Independence is enforced in the database where it can be:
--       - one assignment per (task, rater); never more raters than the task needs;
--       - a rater only gets tasks their skills cover;
--       - the adjudicator is never one of the task's own raters;
--       - submissions and adjudications are append-only.
--     "A rater never sees another rater's work, and blind marking never shows AI output"
--     is enforced by the API that serves tasks (it is about reads, not rows).
--   * Consent rows hold no names: the signed form stays with the school; evidence, when
--     scanned, is an R2 key under hw-assignments/evals/consent/.
--   * hw_eval_shadow_result is never read by product code (enforced by a test), and once
--     written only the final-marks comparison columns may be filled in.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Skills: transcribe | deidentify | adjudicate | mark:<subject> | audit:<subject>
CREATE OR REPLACE FUNCTION hw_eval_valid_skills(skills TEXT[]) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(s ~ '^(transcribe|deidentify|adjudicate|(mark|audit):[a-z][a-z ]{1,60})$'), true)
    FROM unnest(skills) AS s
$$;

-- The skill a task needs from its raters.
CREATE OR REPLACE FUNCTION hw_eval_skill_for(kind TEXT, subject TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE kind
    WHEN 'transcribe' THEN 'transcribe'
    WHEN 'deidentify' THEN 'deidentify'
    WHEN 'blind_mark' THEN 'mark:' || lower(subject)
    WHEN 'key_audit'  THEN 'audit:' || lower(subject)
  END
$$;

-- ---------------------------------------------------------------------------
-- Raters
-- ---------------------------------------------------------------------------

CREATE TABLE hw_eval_rater (
  id          VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pseudonym   VARCHAR(40)  NOT NULL UNIQUE CHECK (pseudonym ~ '^[A-Za-z0-9_-]{3,40}$'),
  user_id     VARCHAR(255) NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE RESTRICT,
  skills      TEXT[]       NOT NULL DEFAULT ARRAY[]::text[] CHECK (hw_eval_valid_skills(skills)),
  active      BOOLEAN      NOT NULL DEFAULT true,
  created_by  VARCHAR(255) NOT NULL REFERENCES "user"(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER hw_eval_rater_touch BEFORE UPDATE ON hw_eval_rater
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

CREATE OR REPLACE FUNCTION hw_eval_rater_check_account() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r TEXT;
BEGIN
  SELECT role INTO r FROM "user" WHERE id = NEW.user_id;
  IF coalesce(r, 'student') IN ('student', 'parent') THEN
    RAISE EXCEPTION 'a % account cannot be a rater', coalesce(r, 'student')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_rater_account BEFORE INSERT OR UPDATE OF user_id ON hw_eval_rater
  FOR EACH ROW EXECUTE FUNCTION hw_eval_rater_check_account();

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

CREATE TABLE hw_eval_task (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind             TEXT         NOT NULL CHECK (kind IN ('transcribe', 'blind_mark', 'key_audit', 'deidentify')),
  dataset_ref      VARCHAR(80)  NOT NULL CHECK (dataset_ref ~ '^[a-z0-9][a-z0-9_-]*@v[0-9]+$'),
  -- An eval item (evitem_…) for transcribe / blind_mark / deidentify; a key id (sha-256 hex) for key_audit.
  target_id        VARCHAR(80)  NOT NULL CHECK (target_id ~ '^(evitem_[a-z2-7]{16,}|[0-9a-f]{64})$'),
  subject          VARCHAR(100),
  required_raters  SMALLINT     NOT NULL,
  status           TEXT         NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'needs_adjudication', 'done', 'cancelled')),
  created_by       VARCHAR(255) NOT NULL REFERENCES "user"(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (kind, dataset_ref, target_id),
  -- Transcription and blind marking are always done by two people independently.
  CHECK ((kind IN ('transcribe', 'blind_mark') AND required_raters = 2)
      OR (kind IN ('key_audit', 'deidentify') AND required_raters BETWEEN 1 AND 3)),
  CHECK (kind NOT IN ('blind_mark', 'key_audit') OR subject IS NOT NULL)
);
CREATE INDEX hw_eval_task_queue_idx ON hw_eval_task (kind, status);
CREATE INDEX hw_eval_task_dataset_idx ON hw_eval_task (dataset_ref);
CREATE TRIGGER hw_eval_task_touch BEFORE UPDATE ON hw_eval_task
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

CREATE TABLE hw_eval_assignment (
  id            VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id       VARCHAR(36)  NOT NULL REFERENCES hw_eval_task(id) ON DELETE CASCADE,
  rater_id      VARCHAR(36)  NOT NULL REFERENCES hw_eval_rater(id) ON DELETE RESTRICT,
  -- Random position in the rater's queue, so raters do not all see items in one order.
  order_index   INTEGER      NOT NULL CHECK (order_index >= 0),
  assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  submitted_at  TIMESTAMPTZ,
  UNIQUE (task_id, rater_id),
  CHECK (started_at IS NULL OR started_at >= assigned_at),
  CHECK (submitted_at IS NULL OR (started_at IS NOT NULL AND submitted_at >= started_at))
);
CREATE INDEX hw_eval_assignment_rater_idx ON hw_eval_assignment (rater_id, submitted_at, order_index);

CREATE OR REPLACE FUNCTION hw_eval_assignment_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE t hw_eval_task%ROWTYPE; r hw_eval_rater%ROWTYPE; n INTEGER;
BEGIN
  -- Serialise assignment of one task, so two concurrent inserts cannot both pass the count.
  SELECT * INTO t FROM hw_eval_task WHERE id = NEW.task_id FOR UPDATE;
  SELECT * INTO r FROM hw_eval_rater WHERE id = NEW.rater_id;
  IF t.status IN ('done', 'cancelled') THEN
    RAISE EXCEPTION 'task % is %', t.id, t.status USING ERRCODE = 'check_violation';
  END IF;
  IF NOT r.active THEN
    RAISE EXCEPTION 'rater % is not active', r.pseudonym USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (hw_eval_skill_for(t.kind, t.subject) = ANY (r.skills)) THEN
    RAISE EXCEPTION 'rater % lacks skill %', r.pseudonym, hw_eval_skill_for(t.kind, t.subject)
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT count(*) INTO n FROM hw_eval_assignment WHERE task_id = NEW.task_id;
  IF n >= t.required_raters THEN
    RAISE EXCEPTION 'task % already has % raters', t.id, n USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_assignment_check BEFORE INSERT ON hw_eval_assignment
  FOR EACH ROW EXECUTE FUNCTION hw_eval_assignment_check();

-- Who did a task, and when it was started and submitted, is history: only the two
-- timestamps may move, each once.
CREATE OR REPLACE FUNCTION hw_eval_assignment_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.task_id <> OLD.task_id OR NEW.rater_id <> OLD.rater_id OR NEW.order_index <> OLD.order_index
     OR NEW.assigned_at <> OLD.assigned_at
     OR (OLD.started_at IS NOT NULL AND NEW.started_at IS DISTINCT FROM OLD.started_at)
     OR (OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS DISTINCT FROM OLD.submitted_at) THEN
    RAISE EXCEPTION 'hw_eval_assignment: only started_at and submitted_at may be set, once'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_assignment_guard BEFORE UPDATE ON hw_eval_assignment
  FOR EACH ROW EXECUTE FUNCTION hw_eval_assignment_guard();

-- ---------------------------------------------------------------------------
-- Submissions and adjudications (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_eval_submission (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id  VARCHAR(36)  NOT NULL UNIQUE REFERENCES hw_eval_assignment(id) ON DELETE CASCADE,
  -- transcribe: {text}; blind_mark: {byPoint, total, note}; key_audit: {points: [{id, verdict, note}], missing: [...]};
  -- deidentify: {confirmed, blankedRegions}. Shapes are validated by the API.
  payload        JSONB        NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  time_ms        BIGINT       NOT NULL CHECK (time_ms BETWEEN 0 AND 86400000),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER hw_eval_submission_append_only BEFORE UPDATE ON hw_eval_submission
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

-- Submitting marks the assignment submitted (and started, if the client never said so).
CREATE OR REPLACE FUNCTION hw_eval_submission_stamp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE hw_eval_assignment
     SET started_at = coalesce(started_at, NEW.created_at), submitted_at = NEW.created_at
   WHERE id = NEW.assignment_id AND submitted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'assignment % is already submitted', NEW.assignment_id USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_submission_stamp AFTER INSERT ON hw_eval_submission
  FOR EACH ROW EXECUTE FUNCTION hw_eval_submission_stamp();

CREATE TABLE hw_eval_adjudication (
  id                    VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  task_id               VARCHAR(36)  NOT NULL UNIQUE REFERENCES hw_eval_task(id) ON DELETE CASCADE,
  adjudicator_rater_id  VARCHAR(36)  NOT NULL REFERENCES hw_eval_rater(id) ON DELETE RESTRICT,
  payload               JSONB        NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  reason                TEXT         NOT NULL CHECK (length(trim(reason)) > 0),
  time_ms               BIGINT       NOT NULL CHECK (time_ms BETWEEN 0 AND 86400000),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER hw_eval_adjudication_append_only BEFORE UPDATE ON hw_eval_adjudication
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

CREATE OR REPLACE FUNCTION hw_eval_adjudication_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE r hw_eval_rater%ROWTYPE; submitted INTEGER; needed SMALLINT;
BEGIN
  SELECT * INTO r FROM hw_eval_rater WHERE id = NEW.adjudicator_rater_id;
  IF NOT r.active OR NOT ('adjudicate' = ANY (r.skills)) THEN
    RAISE EXCEPTION 'rater % cannot adjudicate', r.pseudonym USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM hw_eval_assignment WHERE task_id = NEW.task_id AND rater_id = NEW.adjudicator_rater_id) THEN
    RAISE EXCEPTION 'the adjudicator was one of this task''s raters' USING ERRCODE = 'check_violation';
  END IF;
  SELECT required_raters INTO needed FROM hw_eval_task WHERE id = NEW.task_id;
  SELECT count(*) INTO submitted FROM hw_eval_assignment WHERE task_id = NEW.task_id AND submitted_at IS NOT NULL;
  IF submitted < needed THEN
    RAISE EXCEPTION 'task % has % of % submissions; nothing to adjudicate yet', NEW.task_id, submitted, needed
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_adjudication_check BEFORE INSERT ON hw_eval_adjudication
  FOR EACH ROW EXECUTE FUNCTION hw_eval_adjudication_check();

-- ---------------------------------------------------------------------------
-- Consent (no names; the signed form stays with the school)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_eval_consent (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) REFERENCES organization(id) ON DELETE RESTRICT,  -- the partner school, if any
  subject_kind     TEXT         NOT NULL CHECK (subject_kind IN ('student', 'parent', 'teacher', 'volunteer')),
  form_version     VARCHAR(40)  NOT NULL,
  language         TEXT         NOT NULL CHECK (language IN ('en', 'hi')),
  -- What the person agreed to, e.g. {handwriting_eval, marks_eval, retain_3y}.
  scope            TEXT[]       NOT NULL CHECK (cardinality(scope) > 0),
  signed_at        DATE         NOT NULL,
  evidence_key     TEXT         CHECK (evidence_key IS NULL OR (evidence_key LIKE 'hw-assignments/evals/consent/%' AND evidence_key NOT LIKE '%..%')),
  withdrawn_at     TIMESTAMPTZ,
  recorded_by      VARCHAR(255) NOT NULL REFERENCES "user"(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- A student's work needs a parent's consent too; that is a second row with subject_kind 'parent'
  -- linked here.
  guardian_consent_id VARCHAR(36) REFERENCES hw_eval_consent(id),
  CHECK (subject_kind <> 'student' OR guardian_consent_id IS NOT NULL)
);
CREATE INDEX hw_eval_consent_org_idx ON hw_eval_consent (organization_id);

-- Only withdrawal may change after recording.
CREATE OR REPLACE FUNCTION hw_eval_consent_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'withdrawn_at') <> (to_jsonb(OLD) - 'withdrawn_at')
     OR (OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at) THEN
    RAISE EXCEPTION 'hw_eval_consent: only withdrawn_at may be set, once' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_consent_guard BEFORE UPDATE ON hw_eval_consent
  FOR EACH ROW EXECUTE FUNCTION hw_eval_consent_guard();

-- ---------------------------------------------------------------------------
-- Shadow mode (tenant data; never read by product code)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_eval_shadow_result (
  id                     VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id        VARCHAR(255) NOT NULL,
  answer_id              VARCHAR(36)  NOT NULL,
  kind                   TEXT         NOT NULL CHECK (kind IN ('read', 'mark')),
  candidate_config_hash  CHAR(64)     NOT NULL CHECK (candidate_config_hash ~ '^[0-9a-f]{64}$'),
  predicted_transcript   TEXT,
  predicted_marks        NUMERIC(6,2) CHECK (predicted_marks >= 0),
  predicted_items        JSONB        CHECK (predicted_items IS NULL OR jsonb_typeof(predicted_items) = 'array'),
  production_transcript  TEXT,
  production_marks       NUMERIC(6,2) CHECK (production_marks >= 0),
  status                 TEXT         NOT NULL CHECK (status IN ('ok', 'failed')),
  failure_reason         TEXT,
  tokens_in              INTEGER      NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_cached          INTEGER      NOT NULL DEFAULT 0 CHECK (tokens_cached >= 0),
  tokens_out             INTEGER      NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  cost_paise             NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  -- Filled in later, when the teacher's final marks exist.
  final_marks            NUMERIC(6,2) CHECK (final_marks >= 0),
  compared_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT now(),
  FOREIGN KEY (answer_id, organization_id) REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE,
  UNIQUE (answer_id, kind, candidate_config_hash),
  CHECK ((kind = 'read' AND predicted_marks IS NULL) OR (kind = 'mark' AND predicted_transcript IS NULL)),
  CHECK (status = 'ok' OR failure_reason IS NOT NULL)
);
CREATE INDEX hw_eval_shadow_org_idx ON hw_eval_shadow_result (organization_id, created_at);
CREATE INDEX hw_eval_shadow_config_idx ON hw_eval_shadow_result (candidate_config_hash, kind);

CREATE OR REPLACE FUNCTION hw_eval_shadow_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'final_marks' - 'compared_at') <> (to_jsonb(OLD) - 'final_marks' - 'compared_at') THEN
    RAISE EXCEPTION 'hw_eval_shadow_result: only final_marks and compared_at may change'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_eval_shadow_guard BEFORE UPDATE ON hw_eval_shadow_result
  FOR EACH ROW EXECUTE FUNCTION hw_eval_shadow_guard();

-- ---------------------------------------------------------------------------
-- Daily monitoring (tenant data)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_eval_monitor_daily (
  day                  DATE         NOT NULL,
  organization_id      VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  subject              VARCHAR(100) NOT NULL,
  question_type        TEXT         NOT NULL CHECK (question_type IN ('very_short', 'short', 'long', 'essay')),
  answers_marked       INTEGER      NOT NULL DEFAULT 0 CHECK (answers_marked >= 0),
  ai_suggested         INTEGER      NOT NULL DEFAULT 0 CHECK (ai_suggested >= 0),
  overrides            INTEGER      NOT NULL DEFAULT 0 CHECK (overrides >= 0),
  override_abs_sum     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (override_abs_sum >= 0),  -- mean |Δ| = sum / overrides
  transcript_fixes     INTEGER      NOT NULL DEFAULT 0 CHECK (transcript_fixes >= 0),
  misread_flags        INTEGER      NOT NULL DEFAULT 0 CHECK (misread_flags >= 0),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (day, organization_id, subject, question_type),
  CHECK (overrides <= ai_suggested AND ai_suggested <= answers_marked)
);
CREATE INDEX hw_eval_monitor_org_idx ON hw_eval_monitor_daily (organization_id, day);
CREATE TRIGGER hw_eval_monitor_touch BEFORE UPDATE ON hw_eval_monitor_daily
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership: same as every other table here
-- ---------------------------------------------------------------------------

DO $$
DECLARE obj RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'hw\_eval\_%' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO digiclassroom_app', obj.tablename);
  END LOOP;
  FOR obj IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname LIKE 'hw\_eval\_%' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO digiclassroom_app', obj.sig);
  END LOOP;
END $$;

COMMIT;
