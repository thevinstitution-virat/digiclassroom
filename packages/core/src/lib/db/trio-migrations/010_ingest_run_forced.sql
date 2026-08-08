-- 010_ingest_run_forced.sql
--
-- Target database: `trio`. Superuser.
--
-- MIGRATE phase (additive). Deployed code does not write this column; the
-- ingest script that does ships after. Defaulting to false means every existing
-- and in-flight run is correctly recorded as not-forced without a backfill.
--
-- WHY
--
-- The curated lane refuses a chapter whose validation_status is not APPROVED,
-- and refuses one its own linter rejects. Both refusals can be overridden with
-- --force, because a verification run against synthetic parts has to be able to
-- proceed. What must not happen is that the override leaves no trace: a forced
-- chapter looks identical to a validated one from the moment it is indexed, and
-- the only way anyone would learn the difference is by noticing a wrong answer.
--
-- Recording it on the RUN rather than the item or the asset is deliberate. Force
-- is a property of one ingestion event: the same chapter forced today and
-- ingested properly next week is one slot, one asset, two runs, and the second
-- supersedes the first. That is exactly the query "which live content got in
-- without passing its gates" needs — active runs where forced is true.

BEGIN;

ALTER TABLE content.ingest_run
  ADD COLUMN IF NOT EXISTS forced boolean NOT NULL DEFAULT false;

-- What was overridden, in the operator's words. Null when forced is false.
ALTER TABLE content.ingest_run
  ADD COLUMN IF NOT EXISTS force_reason text;

-- The question this column exists to answer is "what is live that should not
-- be", so index the case that matters rather than the whole column.
CREATE INDEX IF NOT EXISTS ingest_run_forced_active_idx
  ON content.ingest_run (content_item_id)
  WHERE forced AND status = 'active';

COMMIT;
