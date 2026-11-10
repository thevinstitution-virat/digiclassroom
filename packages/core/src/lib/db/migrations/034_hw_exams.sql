-- 034_hw_exams.sql
--
-- Virat Evaluator, exam packages (docs/hw-eval/exam-packages.md): a super-admin sells a package ("CBSE Class 10, 2027 boards") holding past papers,
-- sample papers and in-house mock tests; a subscriber attempts each set a fixed number of times, against a clock, and uploads photographs of the
-- answer pages. Seven NEW tables, nothing existing is altered. Rollback: 034_hw_exams.down.sql.
--
-- Apply as a superuser (there is no migration ledger in this database). The last block hands every object to digiclassroom_app.
--
-- Decisions:
--   * An attempt materialises an ordinary hw_assignment (one per attempt), so reading, marking, eligibility, quotas and monitoring run on the
--     pipeline that has already been measured. hw_submission's UNIQUE (assignment_id, student_id) therefore needs no change: the attempt limit
--     lives here, as UNIQUE (user_id, set_id, attempt_no).
--   * Packages, sets and items are shared content, like the bank: no organization column. Entitlements, attempts, pages and reports are about a
--     person, so they carry user_id and cascade with the user.
--   * A set either IS a board paper (paper_id into hw_bank_paper) or is assembled; an item either references a CHECKED bank question or carries its
--     own authored question. Both are CHECK constraints, not conventions.
--   * The clock is the server's. started_at, expires_at and upload_deadline_at cannot be updated once the attempt row exists (guard trigger): a
--     timed test whose clock can be rewritten is not a timed test.
--   * attempt_no cannot exceed the effective allowance (the entitlement's override, else the package's attempts_per_set), enforced by a trigger so
--     no code path can skip it.
--   * Marks are NUMERIC(6,2) and the 0.5 grid is enforced where a board mark is stored, as in the bank.
--   * hw_exam_report is append-only and one per attempt: a report is never edited, and a second evaluation means a new attempt.
--   * Published content cannot go back to draft (that would unfreeze it), an attempt can only start on a published set of a published package,
--     and neither a set with attempts nor a bank paper a set is built on can be deleted (RESTRICT): a learner's history must not vanish.

BEGIN;

-- ---------------------------------------------------------------------------
-- Packages
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_package (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  board            TEXT         NOT NULL CHECK (board <> ''),
  class_level      INTEGER      NOT NULL CHECK (class_level BETWEEN 1 AND 12),
  exam_year        INTEGER      NOT NULL CHECK (exam_year BETWEEN 2020 AND 2100),
  slug             TEXT         NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title            TEXT         NOT NULL CHECK (title <> ''),
  blurb            TEXT         NOT NULL DEFAULT '',
  attempts_per_set INTEGER      NOT NULL DEFAULT 5 CHECK (attempts_per_set BETWEEN 1 AND 50),
  price_paise      INTEGER      NOT NULL DEFAULT 0 CHECK (price_paise >= 0),
  status           TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  published_at     TIMESTAMPTZ,
  created_by       TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_package_identity UNIQUE (board, class_level, exam_year, slug),
  CONSTRAINT hw_exam_package_published_at CHECK ((status = 'draft') = (published_at IS NULL))
);
CREATE INDEX hw_exam_package_open_idx ON hw_exam_package (board, class_level, exam_year) WHERE status = 'published';

CREATE TRIGGER hw_exam_package_touch BEFORE UPDATE ON hw_exam_package
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Sets: one attemptable paper inside a package
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_set (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_id       VARCHAR(36)  NOT NULL REFERENCES hw_exam_package(id) ON DELETE CASCADE,
  position         INTEGER      NOT NULL CHECK (position >= 0),
  kind             TEXT         NOT NULL CHECK (kind IN ('pyq', 'sqp', 'mock_half', 'mock_full')),
  subject          TEXT         NOT NULL CHECK (subject <> ''),
  subject_code     TEXT         NOT NULL CHECK (subject_code <> ''),
  title            TEXT         NOT NULL CHECK (title <> ''),
  paper_id         VARCHAR(36)  REFERENCES hw_bank_paper(id) ON DELETE RESTRICT,
  max_marks        NUMERIC(6,1) NOT NULL CHECK (max_marks > 0 AND (max_marks * 2) = round(max_marks * 2)),
  duration_minutes INTEGER      NOT NULL CHECK (duration_minutes BETWEEN 5 AND 360),
  grace_minutes    INTEGER      NOT NULL DEFAULT 20 CHECK (grace_minutes BETWEEN 0 AND 180),
  medium           TEXT         NOT NULL DEFAULT 'en' CHECK (medium IN ('en', 'hi')),
  syllabus_scope   JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(syllabus_scope) = 'array'),
  status           TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_set_order UNIQUE (package_id, position),
  -- a board set says which paper it is; an in-house mock never does
  CONSTRAINT hw_exam_set_paper_shape CHECK ((kind IN ('pyq', 'sqp')) = (paper_id IS NOT NULL)),
  -- a half-syllabus set must say what half it covers
  CONSTRAINT hw_exam_set_scope CHECK (kind <> 'mock_half' OR jsonb_array_length(syllabus_scope) > 0)
);
CREATE INDEX hw_exam_set_package_idx ON hw_exam_set (package_id);
CREATE INDEX hw_exam_set_subject_idx ON hw_exam_set (package_id, subject_code);

CREATE TRIGGER hw_exam_set_touch BEFORE UPDATE ON hw_exam_set
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Items: the questions of a set, in order
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_set_item (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  set_id           VARCHAR(36)  NOT NULL REFERENCES hw_exam_set(id) ON DELETE CASCADE,
  position         INTEGER      NOT NULL CHECK (position >= 0),
  number           INTEGER      NOT NULL CHECK (number >= 1),
  section          TEXT         NOT NULL DEFAULT '' ,
  marks            NUMERIC(4,1) NOT NULL CHECK (marks > 0 AND (marks * 2) = round(marks * 2)),
  qtype            TEXT         NOT NULL CHECK (qtype IN ('mcq', 'assertion_reason', 'very_short', 'short', 'long', 'case_based')),
  chapter          TEXT         NOT NULL DEFAULT '',
  -- a bank question, or an authored one; never both, never neither
  bank_question_id VARCHAR(36)  REFERENCES hw_bank_question(id) ON DELETE RESTRICT,
  stem             TEXT,
  options          JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(options) = 'array'),
  correct_option   TEXT         CHECK (correct_option ~ '^[A-D]$'),
  accepted_answers JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(accepted_answers) = 'array'),
  parts            JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(parts) = 'array'),
  scheme_text      TEXT         NOT NULL DEFAULT '',
  diagram_parts    JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(diagram_parts) = 'array'),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_set_item_order UNIQUE (set_id, position),
  CONSTRAINT hw_exam_set_item_source CHECK ((bank_question_id IS NULL) <> (stem IS NULL)),
  -- an authored written question carries its own scheme; an authored multiple choice carries a correct option
  CONSTRAINT hw_exam_set_item_authored_shape CHECK (
    bank_question_id IS NOT NULL
    OR (qtype IN ('mcq', 'assertion_reason') AND correct_option IS NOT NULL AND jsonb_array_length(options) = 4)
    OR (qtype NOT IN ('mcq', 'assertion_reason') AND correct_option IS NULL AND scheme_text <> '' AND jsonb_array_length(parts) > 0))
);
CREATE INDEX hw_exam_set_item_set_idx ON hw_exam_set_item (set_id);

CREATE TRIGGER hw_exam_set_item_touch BEFORE UPDATE ON hw_exam_set_item
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- A set item may only point at a bank question a person has checked.
CREATE OR REPLACE FUNCTION hw_exam_item_bank_checked() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s TEXT;
BEGIN
  IF NEW.bank_question_id IS NULL THEN RETURN NEW; END IF;
  SELECT status INTO s FROM hw_bank_question WHERE id = NEW.bank_question_id;
  IF s IS NULL OR s NOT IN ('checked', 'published') THEN
    RAISE EXCEPTION 'bank question % is %; only a checked or published question can go in a set', NEW.bank_question_id, COALESCE(s, 'missing')
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_exam_item_bank_checked BEFORE INSERT OR UPDATE OF bank_question_id ON hw_exam_set_item
  FOR EACH ROW EXECUTE FUNCTION hw_exam_item_bank_checked();

-- ---------------------------------------------------------------------------
-- Entitlements
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_entitlement (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id          VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  package_id       VARCHAR(36)  NOT NULL REFERENCES hw_exam_package(id) ON DELETE CASCADE,
  source           TEXT         NOT NULL CHECK (source IN ('purchase', 'trial', 'grant')),
  status           TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'refunded')),
  starts_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  attempts_per_set INTEGER      CHECK (attempts_per_set BETWEEN 1 AND 50),  -- NULL = the package's own allowance
  order_ref        TEXT,
  granted_by       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_entitlement_one UNIQUE (user_id, package_id),
  CONSTRAINT hw_exam_entitlement_window CHECK (expires_at IS NULL OR expires_at > starts_at),
  CONSTRAINT hw_exam_entitlement_purchase CHECK (source <> 'purchase' OR order_ref IS NOT NULL),
  CONSTRAINT hw_exam_entitlement_grant CHECK (source <> 'grant' OR granted_by IS NOT NULL)
);
CREATE INDEX hw_exam_entitlement_user_idx ON hw_exam_entitlement (user_id) WHERE status = 'active';

CREATE TRIGGER hw_exam_entitlement_touch BEFORE UPDATE ON hw_exam_entitlement
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Attempts: the timed run
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_attempt (
  id                 VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id            VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  set_id             VARCHAR(36)  NOT NULL REFERENCES hw_exam_set(id) ON DELETE RESTRICT,
  attempt_no         INTEGER      NOT NULL CHECK (attempt_no >= 1),
  assignment_id      VARCHAR(36)  REFERENCES hw_assignment(id) ON DELETE SET NULL,
  status             TEXT         NOT NULL DEFAULT 'started'
                     CHECK (status IN ('started', 'time_up', 'uploaded', 'evaluating', 'reported', 'abandoned')),
  -- the server's clock, never the client's
  started_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at         TIMESTAMPTZ  NOT NULL,
  upload_deadline_at TIMESTAMPTZ  NOT NULL,
  ended_at           TIMESTAMPTZ,
  submitted_at       TIMESTAMPTZ,
  reported_at        TIMESTAMPTZ,
  evaluation_mode    TEXT         NOT NULL DEFAULT 'batch' CHECK (evaluation_mode IN ('batch', 'standard')),
  ready_by           TIMESTAMPTZ,
  max_marks          NUMERIC(6,1) NOT NULL CHECK (max_marks > 0),
  marks_awarded      NUMERIC(6,2) CHECK (marks_awarded >= 0),
  failure_reason     TEXT,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_attempt_no UNIQUE (user_id, set_id, attempt_no),
  CONSTRAINT hw_exam_attempt_clock CHECK (expires_at > started_at AND upload_deadline_at >= expires_at),
  CONSTRAINT hw_exam_attempt_reported CHECK ((status = 'reported') = (reported_at IS NOT NULL)),
  CONSTRAINT hw_exam_attempt_marks CHECK (marks_awarded IS NULL OR marks_awarded <= max_marks)
);
CREATE INDEX hw_exam_attempt_user_idx ON hw_exam_attempt (user_id, set_id);
CREATE INDEX hw_exam_attempt_open_idx ON hw_exam_attempt (user_id) WHERE status IN ('started', 'time_up');
CREATE INDEX hw_exam_attempt_work_idx ON hw_exam_attempt (status) WHERE status IN ('uploaded', 'evaluating');

CREATE TRIGGER hw_exam_attempt_touch BEFORE UPDATE ON hw_exam_attempt
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- The clock cannot be rewritten after the attempt starts.
CREATE OR REPLACE FUNCTION hw_exam_attempt_clock_frozen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.started_at <> OLD.started_at OR NEW.expires_at <> OLD.expires_at OR NEW.upload_deadline_at <> OLD.upload_deadline_at THEN
    RAISE EXCEPTION 'an attempt clock cannot be changed' USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.attempt_no <> OLD.attempt_no OR NEW.set_id <> OLD.set_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'an attempt cannot move to another set, learner or attempt number' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_exam_attempt_clock_frozen BEFORE UPDATE ON hw_exam_attempt
  FOR EACH ROW EXECUTE FUNCTION hw_exam_attempt_clock_frozen();

-- attempt_no may not exceed the effective allowance: the entitlement's override, else the package's attempts_per_set.
CREATE OR REPLACE FUNCTION hw_exam_attempt_allowance() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE allowed INTEGER; set_status TEXT; pkg_status TEXT;
BEGIN
  SELECT COALESCE(e.attempts_per_set, p.attempts_per_set), s.status, p.status INTO allowed, set_status, pkg_status
  FROM hw_exam_set s
  JOIN hw_exam_package p ON p.id = s.package_id
  LEFT JOIN hw_exam_entitlement e ON e.package_id = p.id AND e.user_id = NEW.user_id
  WHERE s.id = NEW.set_id;
  IF allowed IS NULL THEN
    RAISE EXCEPTION 'set % has no package allowance', NEW.set_id USING ERRCODE = 'restrict_violation';
  END IF;
  IF set_status <> 'published' OR pkg_status <> 'published' THEN
    RAISE EXCEPTION 'set % is not published (set %, package %); no attempt can start', NEW.set_id, set_status, pkg_status
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.attempt_no > allowed THEN
    RAISE EXCEPTION 'attempt % is past the allowance of % for this set', NEW.attempt_no, allowed USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_exam_attempt_allowance BEFORE INSERT ON hw_exam_attempt
  FOR EACH ROW EXECUTE FUNCTION hw_exam_attempt_allowance();

-- ---------------------------------------------------------------------------
-- Uploaded answer pages
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_page (
  id             VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  attempt_id     VARCHAR(36)  NOT NULL REFERENCES hw_exam_attempt(id) ON DELETE CASCADE,
  position       INTEGER      NOT NULL CHECK (position >= 0),
  image_key      TEXT         NOT NULL CHECK (image_key LIKE 'hw-exams/%'),
  mime_type      TEXT         NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  width_px       INTEGER      NOT NULL CHECK (width_px > 0),
  height_px      INTEGER      NOT NULL CHECK (height_px > 0),
  bytes          INTEGER      NOT NULL CHECK (bytes > 0),
  sha256         CHAR(64)     NOT NULL,
  quality        JSONB        NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(quality) = 'object'),
  status         TEXT         NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'rejected')),
  reject_reason  TEXT,
  question_hint  INTEGER      CHECK (question_hint >= 1),  -- the number the learner says this page answers, when they say
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_page_order UNIQUE (attempt_id, position),
  CONSTRAINT hw_exam_page_once UNIQUE (attempt_id, sha256),
  CONSTRAINT hw_exam_page_reject CHECK ((status = 'rejected') = (reject_reason IS NOT NULL))
);
CREATE INDEX hw_exam_page_attempt_idx ON hw_exam_page (attempt_id);

-- ---------------------------------------------------------------------------
-- The report (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_exam_report (
  id              VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  attempt_id      VARCHAR(36)  NOT NULL REFERENCES hw_exam_attempt(id) ON DELETE CASCADE,
  marks_awarded   NUMERIC(6,2) NOT NULL CHECK (marks_awarded >= 0),
  max_marks       NUMERIC(6,1) NOT NULL CHECK (max_marks > 0),
  per_question    JSONB        NOT NULL CHECK (jsonb_typeof(per_question) = 'array'),
  profile         JSONB        NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(profile) = 'object'),
  weak_areas      JSONB        NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(weak_areas) = 'array'),
  reader_model    TEXT         NOT NULL,
  grader_model    TEXT         NOT NULL,
  prompt_version  TEXT         NOT NULL,
  cost_paise      NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT hw_exam_report_one UNIQUE (attempt_id),
  CONSTRAINT hw_exam_report_marks CHECK (marks_awarded <= max_marks)
);

CREATE OR REPLACE FUNCTION hw_exam_report_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'hw_exam_report rows are append-only' USING ERRCODE = 'restrict_violation';
END $$;
CREATE TRIGGER hw_exam_report_append_only BEFORE UPDATE ON hw_exam_report
  FOR EACH ROW EXECUTE FUNCTION hw_exam_report_append_only();

-- ---------------------------------------------------------------------------
-- A published package or set is frozen in the ways a past attempt depends on.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION hw_exam_package_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'a % package cannot go back to draft; retire it instead', OLD.status USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.board <> OLD.board OR NEW.class_level <> OLD.class_level OR NEW.exam_year <> OLD.exam_year
     OR NEW.slug <> OLD.slug OR NEW.attempts_per_set <> OLD.attempts_per_set THEN
    RAISE EXCEPTION 'a published package cannot change its identity or its attempt allowance' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_exam_package_guard BEFORE UPDATE ON hw_exam_package
  FOR EACH ROW EXECUTE FUNCTION hw_exam_package_guard();

CREATE OR REPLACE FUNCTION hw_exam_set_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'draft' THEN RETURN NEW; END IF;
  IF NEW.status = 'draft' THEN
    RAISE EXCEPTION 'a % set cannot go back to draft; retire it instead', OLD.status USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.package_id <> OLD.package_id OR NEW.position <> OLD.position OR NEW.kind <> OLD.kind
     OR NEW.max_marks <> OLD.max_marks OR NEW.duration_minutes <> OLD.duration_minutes
     OR NEW.subject_code <> OLD.subject_code OR NEW.medium <> OLD.medium THEN
    RAISE EXCEPTION 'a published set cannot change its paper, marks, duration or place' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_exam_set_guard BEFORE UPDATE ON hw_exam_set
  FOR EACH ROW EXECUTE FUNCTION hw_exam_set_guard();

-- The questions of a published set cannot change, and none can be added or removed: a learner's past attempt must still mean what it meant.
CREATE OR REPLACE FUNCTION hw_exam_set_item_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE s TEXT;
BEGIN
  SELECT status INTO s FROM hw_exam_set WHERE id = COALESCE(NEW.set_id, OLD.set_id);
  IF s IS DISTINCT FROM 'draft' AND s IS NOT NULL THEN
    RAISE EXCEPTION 'the questions of a % set cannot change', s USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER hw_exam_set_item_guard BEFORE INSERT OR UPDATE OR DELETE ON hw_exam_set_item
  FOR EACH ROW EXECUTE FUNCTION hw_exam_set_item_guard();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_exam_package OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_exam_set OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_exam_set_item OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_exam_entitlement OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_exam_attempt OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_exam_page OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_exam_report OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_item_bank_checked() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_attempt_clock_frozen() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_attempt_allowance() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_report_append_only() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_package_guard() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_set_guard() OWNER TO digiclassroom_app';
  EXECUTE 'ALTER FUNCTION public.hw_exam_set_item_guard() OWNER TO digiclassroom_app';
END $$;

COMMIT;
