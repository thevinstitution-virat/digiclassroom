-- 014_hw_assignments.sql
--
-- Handwritten Assignments, Phase 1: every table the feature needs, created
-- empty. Purely additive: nothing existing is altered, renamed or dropped.
-- Rollback: 014_hw_assignments.down.sql.
--
-- Numbered 014 because feat/practest-exam-fidelity-10 adds 013.
--
-- Apply as a superuser (there is no migration ledger in this database). The
-- last block hands every object to digiclassroom_app, which owns all other
-- tables here.
--
-- Decisions:
--   * Tenant = organization. Every table carries organization_id, indexed.
--     Parent -> child links use composite FKs on (id, organization_id), so a
--     row can never point at a row in another institution.
--   * Classes are institution_classes / institution_sections, the model
--     students are enrolled in (student_enrollments). Teachers are linked to
--     them through hw_class_teacher, because nothing links them today.
--   * Statuses are TEXT + CHECK, matching how the rest of the schema stores
--     enums, but enforced in the database.
--   * Times are TIMESTAMPTZ (as in 012): due dates must survive timezones.
--   * Marks are NUMERIC(6,2) so half marks work.
--   * Rules that compare rows (rubric vs question marks, grade vs question,
--     total_marks) cannot be CHECK constraints, so they are triggers.
--   * Rubric items are never edited in place: an edit retires the old row and
--     inserts a new one with the next version, so AI grades keep pointing at
--     the exact wording they judged.
--   * hw_ai_grade, hw_grade_history and hw_transcript_revision are append-only.
--   * hw_grade has no AI write path in the database's eyes either: every
--     change is copied to hw_grade_history with who made it.

BEGIN;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION hw_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION hw_forbid_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END $$;

-- ---------------------------------------------------------------------------
-- Teacher <-> class link
-- ---------------------------------------------------------------------------

CREATE TABLE hw_class_teacher (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  class_id         VARCHAR(36)  NOT NULL REFERENCES institution_classes(id) ON DELETE CASCADE,
  section_id       VARCHAR(36)  REFERENCES institution_sections(id) ON DELETE CASCADE,  -- NULL = all sections
  teacher_id       VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  subject          VARCHAR(100),                                                         -- NULL = all subjects
  created_by       VARCHAR(255) REFERENCES "user"(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX hw_class_teacher_org_idx     ON hw_class_teacher (organization_id);
CREATE INDEX hw_class_teacher_teacher_idx ON hw_class_teacher (teacher_id);
CREATE UNIQUE INDEX hw_class_teacher_uq   ON hw_class_teacher
  (class_id, COALESCE(section_id, ''), teacher_id, COALESCE(lower(subject), ''));

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------

CREATE TABLE hw_assignment (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  class_id         VARCHAR(36)  NOT NULL REFERENCES institution_classes(id),
  section_id       VARCHAR(36)  REFERENCES institution_sections(id),  -- NULL = whole class
  subject          VARCHAR(100) NOT NULL,
  title            VARCHAR(300) NOT NULL,
  instructions     TEXT,
  due_at           TIMESTAMPTZ,
  status           TEXT         NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'published', 'closed')),
  allowed_modes    TEXT[]       NOT NULL DEFAULT ARRAY['typed', 'ink']::text[]
                   CHECK (cardinality(allowed_modes) > 0
                          AND allowed_modes <@ ARRAY['typed', 'ink', 'photo']::text[]),
  total_marks      NUMERIC(7,2) NOT NULL DEFAULT 0 CHECK (total_marks >= 0),  -- set by trigger on publish
  published_at     TIMESTAMPTZ,
  closed_at        TIMESTAMPTZ,
  returned_at      TIMESTAMPTZ,  -- marks visible to students only after this
  created_by       VARCHAR(255) NOT NULL REFERENCES "user"(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id)
);
CREATE INDEX hw_assignment_org_idx   ON hw_assignment (organization_id);
CREATE INDEX hw_assignment_class_idx ON hw_assignment (class_id, section_id, status);
CREATE TRIGGER hw_assignment_touch BEFORE UPDATE ON hw_assignment
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

CREATE TABLE hw_question (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL,
  assignment_id    VARCHAR(36)  NOT NULL,
  position         INTEGER      NOT NULL CHECK (position >= 0),
  type             TEXT         NOT NULL CHECK (type IN ('very_short', 'short', 'long', 'essay')),
  prompt           TEXT         NOT NULL,
  marks            NUMERIC(6,2) NOT NULL CHECK (marks > 0),
  model_answer     TEXT,
  accepted_answers JSONB        NOT NULL DEFAULT '[]'::jsonb
                   CHECK (jsonb_typeof(accepted_answers) = 'array'),
  language_hint    TEXT         NOT NULL DEFAULT 'en' CHECK (language_hint IN ('en', 'hi', 'mixed')),
  answer_lines     INTEGER      NOT NULL DEFAULT 4 CHECK (answer_lines BETWEEN 1 AND 200),
  rubric_version   INTEGER      NOT NULL DEFAULT 1 CHECK (rubric_version >= 1),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (assignment_id, organization_id)
    REFERENCES hw_assignment (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_question_org_idx        ON hw_question (organization_id);
CREATE INDEX hw_question_assignment_idx ON hw_question (assignment_id, position);
CREATE TRIGGER hw_question_touch BEFORE UPDATE ON hw_question
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

CREATE TABLE hw_rubric_item (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL,
  question_id      VARCHAR(36)  NOT NULL,
  position         INTEGER      NOT NULL CHECK (position >= 0),
  kind             TEXT         NOT NULL CHECK (kind IN ('key_point', 'content', 'structure', 'language')),
  description      TEXT         NOT NULL,
  marks            NUMERIC(6,2) NOT NULL CHECK (marks >= 0),
  version          INTEGER      NOT NULL DEFAULT 1 CHECK (version >= 1),  -- question.rubric_version it belongs to
  source           TEXT         NOT NULL DEFAULT 'teacher' CHECK (source IN ('teacher', 'ai_draft')),
  retired_at       TIMESTAMPTZ,  -- set when an edit supersedes this row; NULL = current
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  FOREIGN KEY (question_id, organization_id)
    REFERENCES hw_question (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_rubric_item_org_idx      ON hw_rubric_item (organization_id);
CREATE INDEX hw_rubric_item_question_idx ON hw_rubric_item (question_id, position) WHERE retired_at IS NULL;

-- ---------------------------------------------------------------------------
-- Submissions and answers
-- ---------------------------------------------------------------------------

CREATE TABLE hw_submission (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL,
  assignment_id    VARCHAR(36)  NOT NULL,
  student_id       VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  status           TEXT         NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'submitted', 'processing', 'ready_for_review', 'graded', 'returned')),
  submitted_at     TIMESTAMPTZ,
  is_late          BOOLEAN      NOT NULL DEFAULT false,
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (assignment_id, student_id),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL),
  FOREIGN KEY (assignment_id, organization_id)
    REFERENCES hw_assignment (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_submission_org_idx     ON hw_submission (organization_id);
CREATE INDEX hw_submission_student_idx ON hw_submission (student_id);
CREATE INDEX hw_submission_status_idx  ON hw_submission (assignment_id, status);
CREATE TRIGGER hw_submission_touch BEFORE UPDATE ON hw_submission
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

CREATE TABLE hw_answer (
  id                    VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id       VARCHAR(255) NOT NULL,
  submission_id         VARCHAR(36)  NOT NULL,
  question_id           VARCHAR(36)  NOT NULL,
  mode                  TEXT         NOT NULL CHECK (mode IN ('typed', 'ink', 'photo')),
  typed_text            TEXT,
  ink_key               TEXT,  -- R2: gzipped stroke JSON
  render_key            TEXT,  -- R2: PNG rendered from the ink, sent to the reader
  image_key             TEXT,  -- R2: photo (Phase 2)
  transcript            TEXT,
  transcript_status     TEXT         NOT NULL DEFAULT 'pending'
                        CHECK (transcript_status IN ('not_needed', 'pending', 'done', 'needs_review', 'failed')),
  transcript_confidence NUMERIC(4,3) CHECK (transcript_confidence BETWEEN 0 AND 1),
  unclear_count         INTEGER      NOT NULL DEFAULT 0 CHECK (unclear_count >= 0),
  reader_engine         TEXT,
  reader_tier           SMALLINT     CHECK (reader_tier BETWEEN 0 AND 2),  -- 0 reserved for on-device (Phase 4)
  student_flags         JSONB        NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(student_flags) = 'array'),
  time_spent_ms         BIGINT       NOT NULL DEFAULT 0 CHECK (time_spent_ms >= 0),
  ink_stats             JSONB        NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(ink_stats) = 'object'),
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  UNIQUE (submission_id, question_id),
  -- Every R2 key this feature writes lives under its own prefix (the bucket is shared).
  CHECK (ink_key    IS NULL OR ink_key    LIKE 'hw-assignments/%'),
  CHECK (render_key IS NULL OR render_key LIKE 'hw-assignments/%'),
  CHECK (image_key  IS NULL OR image_key  LIKE 'hw-assignments/%'),
  -- A failure or a needs_review state always says why.
  CHECK (transcript_status NOT IN ('failed', 'needs_review') OR failure_reason IS NOT NULL),
  FOREIGN KEY (submission_id, organization_id)
    REFERENCES hw_submission (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, organization_id)
    REFERENCES hw_question (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_answer_org_idx      ON hw_answer (organization_id);
CREATE INDEX hw_answer_question_idx ON hw_answer (question_id, transcript_status);
CREATE TRIGGER hw_answer_touch BEFORE UPDATE ON hw_answer
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- Every transcript an answer has had: the reader's, then any teacher fix.
CREATE TABLE hw_transcript_revision (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL,
  answer_id        VARCHAR(36)  NOT NULL,
  transcript       TEXT         NOT NULL,
  source           TEXT         NOT NULL CHECK (source IN ('typed', 'reader', 'teacher_edit', 'teacher_confirm')),
  reader_engine    TEXT,
  confidence       NUMERIC(4,3) CHECK (confidence BETWEEN 0 AND 1),
  created_by       VARCHAR(255) REFERENCES "user"(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (source NOT IN ('teacher_edit', 'teacher_confirm') OR created_by IS NOT NULL),
  FOREIGN KEY (answer_id, organization_id)
    REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_transcript_revision_org_idx    ON hw_transcript_revision (organization_id);
CREATE INDEX hw_transcript_revision_answer_idx ON hw_transcript_revision (answer_id, created_at);
CREATE TRIGGER hw_transcript_revision_append_only BEFORE UPDATE ON hw_transcript_revision
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

-- ---------------------------------------------------------------------------
-- Jobs (declared before grades, which reference them)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_ai_job (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id     VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  kind                TEXT         NOT NULL CHECK (kind IN ('read', 'grade', 'rubric_draft')),
  status              TEXT         NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued', 'running', 'batch_pending', 'done', 'failed')),
  submission_id       VARCHAR(36),  -- read jobs
  question_id         VARCHAR(36),  -- grade and rubric_draft jobs
  provider            TEXT,
  model               TEXT,
  batch_ref           TEXT,
  payload_ref         TEXT,
  attempts            INTEGER      NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts        INTEGER      NOT NULL DEFAULT 3 CHECK (max_attempts >= 1),
  run_after           TIMESTAMPTZ  NOT NULL DEFAULT now(),  -- retry backoff
  locked_at           TIMESTAMPTZ,
  locked_by           TEXT,
  error               TEXT,
  tokens_in           BIGINT       NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_cached       BIGINT       NOT NULL DEFAULT 0 CHECK (tokens_cached >= 0),
  tokens_out          BIGINT       NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  cost_estimate_paise NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (cost_estimate_paise >= 0),
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (status <> 'failed' OR error IS NOT NULL),
  CHECK (kind <> 'read' OR submission_id IS NOT NULL),
  CHECK (kind = 'read' OR question_id IS NOT NULL),
  FOREIGN KEY (submission_id, organization_id)
    REFERENCES hw_submission (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (question_id, organization_id)
    REFERENCES hw_question (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_ai_job_org_idx    ON hw_ai_job (organization_id);
CREATE INDEX hw_ai_job_status_idx ON hw_ai_job (status, created_at);
CREATE INDEX hw_ai_job_ready_idx  ON hw_ai_job (run_after) WHERE status IN ('queued', 'batch_pending');
CREATE TRIGGER hw_ai_job_touch BEFORE UPDATE ON hw_ai_job
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Grades: AI suggestions and final teacher marks are separate tables
-- ---------------------------------------------------------------------------

CREATE TABLE hw_ai_grade (
  id                VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id   VARCHAR(255) NOT NULL,
  answer_id         VARCHAR(36)  NOT NULL,
  job_id            VARCHAR(36)  REFERENCES hw_ai_job(id) ON DELETE SET NULL,  -- NULL for exact-match grades
  model             TEXT         NOT NULL,  -- 'exact_match' when no AI was used
  prompt_version    TEXT         NOT NULL,
  rubric_version    INTEGER      NOT NULL CHECK (rubric_version >= 1),
  items             JSONB        NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  suggested_marks   NUMERIC(6,2) NOT NULL CHECK (suggested_marks >= 0),
  confidence        NUMERIC(4,3) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  validation_notes  JSONB        NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(validation_notes) = 'array'),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (answer_id, organization_id)
    REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_ai_grade_org_idx    ON hw_ai_grade (organization_id);
CREATE INDEX hw_ai_grade_answer_idx ON hw_ai_grade (answer_id, created_at DESC);
CREATE TRIGGER hw_ai_grade_append_only BEFORE UPDATE ON hw_ai_grade
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

CREATE TABLE hw_grade (
  answer_id        VARCHAR(36)  PRIMARY KEY,
  organization_id  VARCHAR(255) NOT NULL,
  marks            NUMERIC(6,2) NOT NULL CHECK (marks >= 0),
  item_marks       JSONB        NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(item_marks) = 'array'),
  comment          TEXT,
  source           TEXT         NOT NULL CHECK (source IN ('accepted_ai', 'edited_ai', 'manual')),
  ai_grade_id      VARCHAR(36),
  graded_by        VARCHAR(255) NOT NULL REFERENCES "user"(id),
  graded_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK ((source = 'manual') = (ai_grade_id IS NULL)),
  FOREIGN KEY (answer_id, organization_id)
    REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (ai_grade_id, organization_id)
    REFERENCES hw_ai_grade (id, organization_id)
);
CREATE INDEX hw_grade_org_idx ON hw_grade (organization_id);

-- Every change to a final grade, with who made it.
CREATE TABLE hw_grade_history (
  id               BIGSERIAL    PRIMARY KEY,
  organization_id  VARCHAR(255) NOT NULL,
  answer_id        VARCHAR(36)  NOT NULL,
  marks            NUMERIC(6,2) NOT NULL,
  item_marks       JSONB        NOT NULL,
  comment          TEXT,
  source           TEXT         NOT NULL,
  ai_grade_id      VARCHAR(36),
  graded_by        VARCHAR(255) NOT NULL,
  graded_at        TIMESTAMPTZ  NOT NULL,
  recorded_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  FOREIGN KEY (answer_id, organization_id)
    REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_grade_history_org_idx    ON hw_grade_history (organization_id);
CREATE INDEX hw_grade_history_answer_idx ON hw_grade_history (answer_id, recorded_at);
CREATE TRIGGER hw_grade_history_append_only BEFORE UPDATE ON hw_grade_history
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

-- ---------------------------------------------------------------------------
-- Usage and quota
-- ---------------------------------------------------------------------------

CREATE TABLE hw_ai_usage_monthly (
  organization_id  VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  month            DATE         NOT NULL CHECK (month = date_trunc('month', month)::date),
  pages_read       INTEGER      NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
  answers_graded   INTEGER      NOT NULL DEFAULT 0 CHECK (answers_graded >= 0),
  tokens_in        BIGINT       NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_cached    BIGINT       NOT NULL DEFAULT 0 CHECK (tokens_cached >= 0),
  tokens_out       BIGINT       NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  cost_paise       NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, month)
);
CREATE TRIGGER hw_ai_usage_monthly_touch BEFORE UPDATE ON hw_ai_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- Also the feature flag: no row, or enabled = false, means the feature is off.
CREATE TABLE hw_tenant_quota (
  organization_id       VARCHAR(255) PRIMARY KEY REFERENCES organization(id) ON DELETE CASCADE,
  enabled               BOOLEAN      NOT NULL DEFAULT false,
  monthly_answer_quota  INTEGER      NOT NULL DEFAULT 0 CHECK (monthly_answer_quota >= 0),  -- 0 = no AI, manual marking only
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER hw_tenant_quota_touch BEFORE UPDATE ON hw_tenant_quota
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Reserved for later phases (created now, nothing is built on them yet)
-- ---------------------------------------------------------------------------

CREATE TABLE hw_writing_calibration (
  id                 VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id    VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  student_id         VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  samples            JSONB        NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(samples) = 'array'),
  readability_score  NUMERIC(4,3) CHECK (readability_score BETWEEN 0 AND 1),
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX hw_writing_calibration_org_idx     ON hw_writing_calibration (organization_id);
CREATE INDEX hw_writing_calibration_student_idx ON hw_writing_calibration (student_id);

CREATE TABLE hw_answer_group (
  id               VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id  VARCHAR(255) NOT NULL,
  question_id      VARCHAR(36)  NOT NULL,
  label            TEXT,
  suggested_marks  NUMERIC(6,2) CHECK (suggested_marks >= 0),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  FOREIGN KEY (question_id, organization_id)
    REFERENCES hw_question (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_answer_group_org_idx      ON hw_answer_group (organization_id);
CREATE INDEX hw_answer_group_question_idx ON hw_answer_group (question_id);

CREATE TABLE hw_answer_group_member (
  group_id         VARCHAR(36)  NOT NULL,
  answer_id        VARCHAR(36)  NOT NULL,
  organization_id  VARCHAR(255) NOT NULL,
  PRIMARY KEY (group_id, answer_id),
  FOREIGN KEY (group_id, organization_id)
    REFERENCES hw_answer_group (id, organization_id) ON DELETE CASCADE,
  FOREIGN KEY (answer_id, organization_id)
    REFERENCES hw_answer (id, organization_id) ON DELETE CASCADE
);
CREATE INDEX hw_answer_group_member_org_idx    ON hw_answer_group_member (organization_id);
CREATE INDEX hw_answer_group_member_answer_idx ON hw_answer_group_member (answer_id);

-- ---------------------------------------------------------------------------
-- Cross-row rules (cannot be CHECK constraints)
-- ---------------------------------------------------------------------------

-- A rubric item can't be worth more than its question.
CREATE OR REPLACE FUNCTION hw_rubric_item_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE q_marks NUMERIC;
BEGIN
  SELECT marks INTO q_marks FROM hw_question WHERE id = NEW.question_id;
  IF NEW.marks > q_marks THEN
    RAISE EXCEPTION 'rubric item marks (%) exceed question marks (%)', NEW.marks, q_marks
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_rubric_item_check BEFORE INSERT OR UPDATE ON hw_rubric_item
  FOR EACH ROW EXECUTE FUNCTION hw_rubric_item_check();

-- Lowering a question's marks can't leave a current rubric item worth more.
-- Questions of a published or closed assignment are frozen, which is what
-- keeps total_marks true after publishing.
CREATE OR REPLACE FUNCTION hw_question_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE a_status TEXT; max_item NUMERIC;
BEGIN
  SELECT status INTO a_status FROM hw_assignment
   WHERE id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  IF a_status IN ('published', 'closed')
     AND (TG_OP <> 'UPDATE'
          OR NEW.marks <> OLD.marks OR NEW.type <> OLD.type OR NEW.position <> OLD.position) THEN
    RAISE EXCEPTION 'questions of a % assignment cannot be added, removed, re-marked or reordered', a_status
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT max(marks) INTO max_item FROM hw_rubric_item
     WHERE question_id = NEW.id AND retired_at IS NULL;
    IF max_item > NEW.marks THEN
      RAISE EXCEPTION 'question marks (%) are below a rubric item worth %', NEW.marks, max_item
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER hw_question_check BEFORE INSERT OR UPDATE OR DELETE ON hw_question
  FOR EACH ROW EXECUTE FUNCTION hw_question_check();

-- Status transitions; on publish, total_marks is derived from the questions and
-- the current rubric of every question must fit inside its marks.
CREATE OR REPLACE FUNCTION hw_assignment_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE n_questions INTEGER; total NUMERIC; bad_question TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    IF NEW.status <> 'draft' AND NEW.total_marks <> OLD.total_marks THEN
      RAISE EXCEPTION 'total_marks is fixed once an assignment is published'
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT ((OLD.status = 'draft'     AND NEW.status = 'published')
       OR (OLD.status = 'published' AND NEW.status = 'closed')
       OR (OLD.status = 'closed'    AND NEW.status = 'published')) THEN
    RAISE EXCEPTION 'assignment status cannot go from % to %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'published' AND OLD.status = 'draft' THEN
    SELECT count(*), COALESCE(sum(marks), 0) INTO n_questions, total
      FROM hw_question WHERE assignment_id = NEW.id;
    IF n_questions = 0 THEN
      RAISE EXCEPTION 'an assignment needs at least one question to be published'
        USING ERRCODE = 'check_violation';
    END IF;
    SELECT q.id INTO bad_question
      FROM hw_question q
      JOIN hw_rubric_item r ON r.question_id = q.id AND r.retired_at IS NULL
     WHERE q.assignment_id = NEW.id
     GROUP BY q.id, q.marks
    HAVING sum(r.marks) > q.marks
     LIMIT 1;
    IF bad_question IS NOT NULL THEN
      RAISE EXCEPTION 'rubric of question % is worth more than the question', bad_question
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.total_marks  := total;
    NEW.published_at := COALESCE(NEW.published_at, now());
  ELSIF NEW.status = 'closed' THEN
    NEW.closed_at := COALESCE(NEW.closed_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_assignment_check BEFORE UPDATE ON hw_assignment
  FOR EACH ROW EXECUTE FUNCTION hw_assignment_check();

-- A published or closed assignment holds students' work: close it, don't
-- delete it. Only a direct DELETE is refused (trigger depth 1); deleting the
-- whole institution still cascades through.
CREATE OR REPLACE FUNCTION hw_assignment_delete_check() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() = 1 AND OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'a % assignment cannot be deleted; close it instead', OLD.status
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER hw_assignment_delete_check BEFORE DELETE ON hw_assignment
  FOR EACH ROW EXECUTE FUNCTION hw_assignment_delete_check();

-- A final grade fits inside its question, and so do its item marks.
CREATE OR REPLACE FUNCTION hw_grade_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE q_marks NUMERIC; items_sum NUMERIC;
BEGIN
  SELECT q.marks INTO q_marks
    FROM hw_answer a JOIN hw_question q ON q.id = a.question_id
   WHERE a.id = NEW.answer_id;
  IF NEW.marks > q_marks THEN
    RAISE EXCEPTION 'grade (%) exceeds question marks (%)', NEW.marks, q_marks
      USING ERRCODE = 'check_violation';
  END IF;
  SELECT COALESCE(sum((e->>'marks')::numeric), 0) INTO items_sum
    FROM jsonb_array_elements(NEW.item_marks) e;
  IF items_sum > q_marks THEN
    RAISE EXCEPTION 'item marks (%) exceed question marks (%)', items_sum, q_marks
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_grade_check BEFORE INSERT OR UPDATE ON hw_grade
  FOR EACH ROW EXECUTE FUNCTION hw_grade_check();

CREATE OR REPLACE FUNCTION hw_grade_record_history() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO hw_grade_history
    (organization_id, answer_id, marks, item_marks, comment, source, ai_grade_id, graded_by, graded_at)
  VALUES
    (NEW.organization_id, NEW.answer_id, NEW.marks, NEW.item_marks, NEW.comment, NEW.source,
     NEW.ai_grade_id, NEW.graded_by, NEW.graded_at);
  RETURN NEW;
END $$;
CREATE TRIGGER hw_grade_record_history AFTER INSERT OR UPDATE ON hw_grade
  FOR EACH ROW EXECUTE FUNCTION hw_grade_record_history();

-- An AI suggestion can't exceed the question either (the grader validates
-- first; this is the backstop).
CREATE OR REPLACE FUNCTION hw_ai_grade_check() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE q_marks NUMERIC;
BEGIN
  SELECT q.marks INTO q_marks
    FROM hw_answer a JOIN hw_question q ON q.id = a.question_id
   WHERE a.id = NEW.answer_id;
  IF NEW.suggested_marks > q_marks THEN
    RAISE EXCEPTION 'suggested marks (%) exceed question marks (%)', NEW.suggested_marks, q_marks
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER hw_ai_grade_check BEFORE INSERT ON hw_ai_grade
  FOR EACH ROW EXECUTE FUNCTION hw_ai_grade_check();

-- ---------------------------------------------------------------------------
-- Ownership: everything else in this database belongs to digiclassroom_app.
-- ---------------------------------------------------------------------------

DO $$
DECLARE obj RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'hw\_%' LOOP
    EXECUTE format('ALTER TABLE public.%I OWNER TO digiclassroom_app', obj.tablename);
  END LOOP;
  FOR obj IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname LIKE 'hw\_%' LOOP
    EXECUTE format('ALTER FUNCTION %s OWNER TO digiclassroom_app', obj.sig);
  END LOOP;
END $$;

COMMIT;
