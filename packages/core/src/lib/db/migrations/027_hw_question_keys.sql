-- 027_hw_question_keys.sql
--
-- Virat Evaluator, roadmap task 5.2 (decisions D2 and D3): answer keys in the product. A question says where it comes from (origin), may carry the
-- passage it is about, and has an answer key built by the key service (lib/hw/keys) and shown in place of a rubric. The "expand" step: new
-- columns with defaults, new tables, one widened check; nothing is renamed or dropped. Rollback: 027_hw_question_keys.down.sql.
--
-- Requires 014, 019, 024. Apply as the owning role; the last block hands the new tables to digiclassroom_app, as 014 to 026 do.
--
-- Decisions:
--   * Every existing question keeps today's behaviour: rubric_mode 'teacher' (the teacher's own rubric), origin 'custom', scheme_source 'teacher_rubric'.
--     Questions made after this change start in 'key' mode and get a key built.
--   * A key is a row of its own (hw_question_key), never edited: a rebuild is a new row and the old one is superseded. A suggestion records the id of the key
--     it used (hw_ai_grade_scheme), so "which key produced this suggestion" is always answerable.
--   * The key's value points become the question's rubric items (source 'key'), so marking, the teacher's review and the student's result keep working
--     on one representation. A key is applied to the rubric only while the assignment is a draft; after publishing the rubric is frozen.
--   * Key content (reference answer, value points, citations) lives only in hw_question_key and the rubric items; student endpoints never select either.
--   * What a key was built from (passage hashes) and for (key-service version, configuration hash, question hash) is stored, so the marking-time backstop can
--     tell, without calling a model, whether the key is still fully supported.
--   * Key spend is part of the month's cost (hw_ai_usage_monthly.cost_paise, so the budget counts it) and shown separately (key_cost_paise, key_builds).

BEGIN;

ALTER TABLE hw_question
  ADD COLUMN origin       TEXT  NOT NULL DEFAULT 'custom' CHECK (origin IN ('textbook_exercise', 'board_paper', 'custom')),
  -- textbook_exercise: {book, chapter, exercise}; board_paper: {paper, year, questionNo}. Free text, shown to the teacher, used to find the official scheme.
  ADD COLUMN origin_ref   JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(origin_ref) = 'object'),
  -- The passage the question is about (a case, a source, a reading text), printed with the question; a key may be built from it.
  ADD COLUMN passage      TEXT,
  ADD COLUMN rubric_mode  TEXT  NOT NULL DEFAULT 'teacher' CHECK (rubric_mode IN ('key', 'teacher')),
  -- The key whose value points are this question's rubric now (NULL in teacher mode).
  ADD COLUMN active_key_id VARCHAR(36);

ALTER TABLE hw_rubric_item DROP CONSTRAINT hw_rubric_item_source_check;
ALTER TABLE hw_rubric_item ADD CONSTRAINT hw_rubric_item_source_check CHECK (source IN ('teacher', 'ai_draft', 'key'));

CREATE TABLE hw_question_key (
  id                  VARCHAR(36)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id     VARCHAR(255) NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  question_id         VARCHAR(36)  NOT NULL REFERENCES hw_question(id) ON DELETE CASCADE,
  -- building: queued or being built. ready: fully supported. partial: some point only partly supported (never used for marking).
  -- no_grounding: no source supports a key. failed: the build failed (reason says why). not_available: the key service is not switched on.
  status              TEXT         NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'ready', 'partial', 'no_grounding', 'failed', 'not_available')),
  scheme_source       TEXT         CHECK (scheme_source IN ('board_scheme_key', 'passage_key', 'textbook_key')),
  reason              TEXT,
  detail              TEXT,
  question_hash       CHAR(64)     NOT NULL,                       -- of the question text, type, marks, passage, medium: a changed question makes the key stale
  key                 JSONB        CHECK (key IS NULL OR jsonb_typeof(key) = 'object'),              -- referenceAnswer, valuePoints
  citations           JSONB        CHECK (citations IS NULL OR jsonb_typeof(citations) = 'array'),
  verification        JSONB,
  key_service_version TEXT,
  config_hash         TEXT,
  r_min               NUMERIC(6,4),
  source_ref          TEXT,                                        -- book | edition | chapter | passages <hash>
  passage_hashes      JSONB        CHECK (passage_hashes IS NULL OR jsonb_typeof(passage_hashes) = 'object'),  -- {chunkId or 'given': sha256 of the text}
  from_shared         BOOLEAN      NOT NULL DEFAULT false,
  cost_paise          NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (cost_paise >= 0),
  attempts            SMALLINT     NOT NULL DEFAULT 0,
  locked_at           TIMESTAMPTZ,
  superseded_at       TIMESTAMPTZ,
  built_at            TIMESTAMPTZ,
  created_by          VARCHAR(255),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (id, organization_id),
  CONSTRAINT hw_question_key_ready_has_content CHECK (status NOT IN ('ready', 'partial') OR (key IS NOT NULL AND scheme_source IS NOT NULL AND key_service_version IS NOT NULL AND config_hash IS NOT NULL))
);
CREATE UNIQUE INDEX hw_question_key_current ON hw_question_key (question_id) WHERE superseded_at IS NULL;
CREATE INDEX hw_question_key_queue ON hw_question_key (status, created_at) WHERE status = 'building' AND superseded_at IS NULL;
CREATE INDEX hw_question_key_org ON hw_question_key (organization_id);
CREATE TRIGGER hw_question_key_touch BEFORE UPDATE ON hw_question_key
  FOR EACH ROW EXECUTE FUNCTION hw_touch_updated_at();

-- Where each AI suggestion's marking scheme came from, and which key (and which version of the key service) it used. One row per suggestion made by a model.
CREATE TABLE hw_ai_grade_scheme (
  ai_grade_id         VARCHAR(36)  PRIMARY KEY,
  organization_id     VARCHAR(255) NOT NULL,
  scheme_source       TEXT         NOT NULL CHECK (scheme_source IN ('board_scheme_key', 'passage_key', 'textbook_key', 'teacher_rubric')),
  question_key_id     VARCHAR(36),
  key_service_version TEXT,
  config_hash         TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  FOREIGN KEY (ai_grade_id, organization_id) REFERENCES hw_ai_grade (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT hw_ai_grade_scheme_key_has_version CHECK (scheme_source = 'teacher_rubric' OR (question_key_id IS NOT NULL AND key_service_version IS NOT NULL))
);
CREATE INDEX hw_ai_grade_scheme_org_idx ON hw_ai_grade_scheme (organization_id);
CREATE TRIGGER hw_ai_grade_scheme_append_only BEFORE UPDATE ON hw_ai_grade_scheme
  FOR EACH ROW EXECUTE FUNCTION hw_forbid_update();

ALTER TABLE hw_ai_usage_monthly
  ADD COLUMN key_builds     INTEGER       NOT NULL DEFAULT 0 CHECK (key_builds >= 0),
  ADD COLUMN key_cost_paise NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (key_cost_paise >= 0);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
    RETURN;
  END IF;
  EXECUTE 'ALTER TABLE public.hw_question_key OWNER TO digiclassroom_app';
  EXECUTE 'ALTER TABLE public.hw_ai_grade_scheme OWNER TO digiclassroom_app';
END $$;

COMMIT;
