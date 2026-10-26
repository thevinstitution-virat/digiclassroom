-- 016_learning_path.sql
--
-- What a learner is studying, in curriculum v2 (one onboarding in all four apps; library hub plan, Phase 6;
-- contract in docs/learning-path.md). Each goal keeps a snapshot of its node from the curriculum service, since
-- DigiClassroom has no taxonomy tables of its own. For a learner signed in with Vidyaverse this is a copy of
-- Vidyaverse's path; for every other account it is the only copy. The legacy board/grade/stream/medium in
-- enhanced_user_profiles are derived from the main goal by the app, never asked separately any more.
--
-- Adds one table and one column; touches no existing row. Apply by hand as a superuser (no migration ledger
-- here), after a schema backup. Undo: 016_learning_path.down.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS user_learning_goal (
  user_id          VARCHAR(255) NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  node_id          UUID         NOT NULL,
  is_primary       BOOLEAN      NOT NULL DEFAULT false,
  node_code        TEXT         NOT NULL CHECK (node_code ~ '^[A-Z0-9_]+(\.[A-Z0-9_]+)*$'),
  node_name        TEXT         NOT NULL,
  node_type        TEXT         NOT NULL,
  node_path        TEXT         NOT NULL,
  verification     TEXT         NOT NULL DEFAULT 'verify',
  grade_level      INTEGER      CHECK (grade_level BETWEEN 1 AND 12),
  -- The stream chosen for a Class 11-12 goal ("CBSE_SCI_PCM"), and its name.
  combination_code TEXT,
  combination_name TEXT,
  -- 'institution': the class a learner's Vidyaverse institution assigned.
  source           TEXT         NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'institution')),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, node_id)
);

-- One main goal per learner.
CREATE UNIQUE INDEX IF NOT EXISTS user_learning_goal_one_primary ON user_learning_goal (user_id) WHERE is_primary;

-- "I'm just exploring": no goals, and do not ask again.
ALTER TABLE enhanced_user_profiles ADD COLUMN IF NOT EXISTS learning_path_skipped_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'digiclassroom_app') THEN
    ALTER TABLE public.user_learning_goal OWNER TO digiclassroom_app;
  ELSE
    RAISE NOTICE 'role digiclassroom_app not found; ownership left unchanged';
  END IF;
END $$;

COMMIT;
