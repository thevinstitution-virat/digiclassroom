-- 018_tutor_token_usage.sql
--
-- The tutor's token windows (TUTOR_TOKEN_QUOTA_ENABLED): what each answer cost in tokens, so a student's allowance is
-- counted per 4-hour window instead of questions per day. Written only while that flag is on.
--
-- A new table; touches nothing that exists. Apply by hand as a superuser (no migration ledger here), BEFORE turning
-- the flag on. Undo: 018_tutor_token_usage.down.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS tutor_token_usage (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar(255) NOT NULL,
  tier varchar(10) NOT NULL DEFAULT 'basic',
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tutor_token_usage_user_created_idx ON tutor_token_usage (user_id, created_at);

COMMIT;
