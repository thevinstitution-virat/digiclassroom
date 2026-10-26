-- 016_learning_path.down.sql
--
-- Rolls back 016_learning_path.sql: the learners' saved goals and "just exploring" marks are lost (the legacy
-- board/grade/stream/medium already written to enhanced_user_profiles stay).

BEGIN;

DROP TABLE IF EXISTS user_learning_goal;
ALTER TABLE enhanced_user_profiles DROP COLUMN IF EXISTS learning_path_skipped_at;

COMMIT;
