-- 001_content_dedupe_run_lifecycle_grants.sql
--
-- Target database: `trio` (NOT digiclassroom — see README.md in this directory).
-- Connect as a Postgres superuser; the GRANT and the constraint changes are not
-- available to content_app itself.
--
-- Makes two mechanisms real that the shared-retrieval design assumes but the
-- Step 5 ad-hoc schema never implemented:
--   1. content-hash dedupe, so "upload once, both apps answer" is enforced by a
--      unique index rather than by hoping nobody uploads the same PDF twice
--   2. an ingest-run lifecycle with exactly one live run per item, so a
--      re-ingest supersedes its predecessor instead of silently doubling the
--      collection
--
-- Idempotent: safe to re-run.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- A.1  Dedupe on file content hash
-- ─────────────────────────────────────────────────────────────────────────────
-- Nullable + partial unique index: pre-existing rows and any future non-file
-- content (a URL, a generated item) don't need a hash and must not be blocked.
ALTER TABLE content.content_item
  ADD COLUMN IF NOT EXISTS canonical_sha256 char(64);

CREATE UNIQUE INDEX IF NOT EXISTS content_item_sha_uq
  ON content.content_item (canonical_sha256)
  WHERE canonical_sha256 IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- A.2  Ingest-run lifecycle
-- ─────────────────────────────────────────────────────────────────────────────
-- `active` is terminal success and REPLACES `completed` — the two do not coexist.
-- Order matters: the old constraint has to go before rows can be migrated to a
-- value it forbids, and rows have to be migrated before the new constraint (which
-- forbids 'completed') can be added.
ALTER TABLE content.ingest_run
  DROP CONSTRAINT IF EXISTS ingest_run_status_check;

-- Newest completed run per item becomes 'active'; any older ones become
-- 'superseded'. Written as a ranked update rather than a blanket
-- `SET status='active' WHERE status='completed'` so that an item with a history
-- of completed runs migrates to a state the one-active index actually permits,
-- instead of failing the index creation below.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY content_item_id
           ORDER BY completed_at DESC NULLS LAST, started_at DESC
         ) AS rn
  FROM content.ingest_run
  WHERE status = 'completed'
)
UPDATE content.ingest_run r
   SET status = CASE WHEN ranked.rn = 1 THEN 'active' ELSE 'superseded' END
  FROM ranked
 WHERE r.id = ranked.id;

ALTER TABLE content.ingest_run
  ADD CONSTRAINT ingest_run_status_check
  CHECK (status IN ('pending', 'running', 'active', 'superseded', 'failed'));

-- Which collection this run's vectors were written to. Without it, a future
-- model/collection change leaves no record of where a run's points actually live.
ALTER TABLE content.ingest_run
  ADD COLUMN IF NOT EXISTS collection text;

-- The constraint that makes supersede real rather than conventional.
CREATE UNIQUE INDEX IF NOT EXISTS ingest_run_one_active
  ON content.ingest_run (content_item_id)
  WHERE status = 'active';


-- ─────────────────────────────────────────────────────────────────────────────
-- A.3  Grants
-- ─────────────────────────────────────────────────────────────────────────────
-- content_app may manage an item's taxonomy LINKS, but must remain unable to
-- write taxonomy_nodes itself — the tree is seeded centrally, not by ingestion.
GRANT INSERT, UPDATE, DELETE ON taxonomy.content_taxonomy_link TO content_app;


-- ─────────────────────────────────────────────────────────────────────────────
-- A.4  content_asset completeness
-- ─────────────────────────────────────────────────────────────────────────────
-- storage_account already exists (two R2 accounts with different credentials are
-- in play, so a bare storage_uri cannot say which one to authenticate against).
-- These three are what the asset row still lacked to be self-describing.
-- NOTE: the existing role-ish column is named `kind`, not `role` — it is used
-- with the value 'source' for the uploaded original.
ALTER TABLE content.content_asset ADD COLUMN IF NOT EXISTS sha256 char(64);
ALTER TABLE content.content_asset ADD COLUMN IF NOT EXISTS bytes bigint;
ALTER TABLE content.content_asset ADD COLUMN IF NOT EXISTS page_count integer;

COMMIT;
