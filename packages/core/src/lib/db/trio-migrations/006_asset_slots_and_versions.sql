-- 006_asset_slots_and_versions.sql
--
-- Target database: `trio`. Superuser.
--
-- PHASE: this is the MIGRATE step. The EXPAND step shipped first — commit
-- 7bc64d9 replaced the plain INSERT in recordSourceAsset with registerAsset,
-- which resolves the slot and then creates or updates it, writes part_index and
-- variant explicitly, and deliberately avoids ON CONFLICT so it is correct under
-- both the old key and the one installed here. That code is deployed and live
-- before this runs. No CONTRACT step is needed: nothing is dropped that deployed
-- code reads.
--
-- WHAT WENT WRONG IN 005
--
-- 005 keyed content_asset on (content_item_id, role, part_index, variant,
-- asset_sha256) — the FILE was the row identity. So editing a chapter produced a
-- NEW row, 004's asset-scoped supersede looked for a run against an asset id
-- that had never had one, found nothing, and left the previous run active.
-- Demonstrated: two active runs for one chapter, both editions retrievable.
--
-- A chapter is a SLOT that different files occupy over time. Fixing the key is
-- the fix; scoping supersede around it downstream would have been compensating
-- for a wrong model in every consumer that ever touches it.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) Slot coordinates become NOT NULL
-- ─────────────────────────────────────────────────────────────────────────────
-- This is load-bearing, not tidiness. Postgres treats NULLs as DISTINCT in a
-- unique index by default, so with either column nullable two rows that are
-- semantically the same slot both satisfy the constraint and duplicate silently.
-- NULLS NOT DISTINCT would also work, but a slot that has no part is genuinely
-- part 0, not "unknown" — so the honest fix is that the column always has a
-- value.
--
--   part_index 0 = a whole-work asset (the source PDF, the cover)
--   variant 'default' = the only edition; reserved for language editions later
UPDATE content.content_asset SET part_index = 0 WHERE part_index IS NULL;
UPDATE content.content_asset SET variant = 'default' WHERE variant IS NULL;

ALTER TABLE content.content_asset ALTER COLUMN part_index SET DEFAULT 0;
ALTER TABLE content.content_asset ALTER COLUMN part_index SET NOT NULL;
ALTER TABLE content.content_asset ALTER COLUMN variant SET DEFAULT 'default';
ALTER TABLE content.content_asset ALTER COLUMN variant SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- (b) The slot IS the identity
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS content.content_asset_identity_uq;

CREATE UNIQUE INDEX content_asset_slot_uq
  ON content.content_asset (content_item_id, role, part_index, variant);

-- ─────────────────────────────────────────────────────────────────────────────
-- (c) File history, since the slot row is now updated in place
-- ─────────────────────────────────────────────────────────────────────────────
-- Updating the slot loses the record of what used to occupy it. Append-only, so
-- "which file did we publish in March" stays answerable after a correction —
-- and so a bad edit can be traced to the exact bytes that caused it.
CREATE TABLE IF NOT EXISTS content.content_asset_version (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      uuid NOT NULL REFERENCES content.content_asset(id) ON DELETE CASCADE,
  asset_sha256  char(64) NOT NULL,
  r2_key        text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_asset_version_asset_idx
  ON content.content_asset_version (asset_id, created_at DESC);

-- Same bytes recorded twice for one slot is not a new version.
CREATE UNIQUE INDEX IF NOT EXISTS content_asset_version_uq
  ON content.content_asset_version (asset_id, asset_sha256);

GRANT SELECT, INSERT ON content.content_asset_version TO content_app;

-- ─────────────────────────────────────────────────────────────────────────────
-- (d) ingest_run: unchanged, deliberately
-- ─────────────────────────────────────────────────────────────────────────────
-- ingest_run_one_active_per_asset from 004 now behaves as originally intended,
-- because asset_id is stable across edits. Denormalising role/part_index/variant
-- onto ingest_run would duplicate the slot definition in a second place and let
-- the two drift.

COMMIT;
