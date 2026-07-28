-- ============================================================================
-- Migration: Fix user_id UUID → VARCHAR(255) for Better Auth compatibility
-- 
-- Better Auth generates alphanumeric string IDs (e.g., "rLPDt94b22gUigpzMb4iqlNG2EHJldST")
-- which are NOT valid UUIDs. Tables created before migration used uuid type.
-- 
-- The Better Auth "user" table stores id as TEXT — varchar(255) is compatible.
-- ============================================================================

BEGIN;

-- ---- user_subscriptions ----
ALTER TABLE user_subscriptions
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- free_trials ----
ALTER TABLE free_trials
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- ai_tutor_usage ----
ALTER TABLE ai_tutor_usage
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- notifications ----
ALTER TABLE notifications
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- quota_alerts ----
ALTER TABLE quota_alerts
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- sarvagya_credit_transactions ----
ALTER TABLE sarvagya_credit_transactions
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- sarvagya_queries ----
ALTER TABLE sarvagya_queries
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- sarvagya_spaces ----
ALTER TABLE sarvagya_spaces
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- subscription_history ----
ALTER TABLE subscription_history
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- ---- user_profiles ----
-- This table has a FK constraint: user_profiles_user_id_users_id_fk -> users.id
-- Drop the FK first, alter, then re-add
ALTER TABLE user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_user_id_users_id_fk;

ALTER TABLE user_profiles
  ALTER COLUMN user_id TYPE varchar(255) USING user_id::text;

-- Re-create the FK to "user".id (text type) if applicable
-- Note: user_profiles originally referenced "users" table, not "user" table.
-- Skipping FK re-creation since the reference table may differ from Better Auth's table.
-- This can be added back once schema is fully stabilized.

-- ---- Seed: FREE_TRIAL plan if missing ----
INSERT INTO subscription_plans
  (plan_code, plan_name, plan_type, board, class_access_type,
   daily_question_limit, monthly_price, display_name, description, is_active)
VALUES
  ('FREE_TRIAL', 'Free Trial', 'free_trial'::plan_type, 'ALL'::board, 'single'::class_access_type,
   30, 0, 'Free Trial', '30 questions total for your selected board and class. Valid for 7 days.', TRUE)
ON CONFLICT (plan_code) DO NOTHING;

COMMIT;
