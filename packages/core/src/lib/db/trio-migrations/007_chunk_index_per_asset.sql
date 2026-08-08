-- 007_chunk_index_per_asset.sql
--
-- Target database: `trio`. Superuser.
--
-- PHASE 1 of 3 — MIGRATE (additive only). Nothing is dropped here.
--   phase 1  this file: add content_asset_id + the new unique index
--   phase 2  deploy code that writes content_asset_id and uses the new key
--   phase 3  008: drop the old (content_item_id, chunk_index) unique
--
-- The order is forced, not stylistic. An `ON CONFLICT (content_asset_id,
-- chunk_index)` clause can only name an index that already exists, so the index
-- must land before the code. And dropping the old constraint before the new code
-- ships would break the deployed `ON CONFLICT (content_item_id, chunk_index)` —
-- which is precisely the 005 mistake.
--
-- WHY
--
-- chunk_index is contiguous 0..N-1 WITHIN AN ASSET; book order is
-- (part_index, chunk_index). Under the old key, UNIQUE (content_item_id,
-- chunk_index), chapter 1 writes 0..40 and chapter 2 writes 0..38 — and
-- insertContentChunks' ON CONFLICT ... DO UPDATE would then silently OVERWRITE
-- chapter 1's rows with chapter 2's text. No error; a book that quietly loses
-- every chapter but the last one ingested. The same shape as the bridgeChunkIndex
-- reset fixed earlier.

BEGIN;

-- Which file this chunk came from. Nullable in this phase: the deployed code
-- does not write it yet, and a NOT NULL column would reject every insert until
-- phase 2 lands.
ALTER TABLE content.content_chunk
  ADD COLUMN IF NOT EXISTS content_asset_id uuid
    REFERENCES content.content_asset(id) ON DELETE CASCADE;

-- Safe to add alongside the old constraint: NULLs are DISTINCT in a unique
-- index by default, so pre-phase-2 rows (all NULL) never collide here. That
-- permissiveness is exactly what makes the additive step non-breaking — and it
-- is also why phase 3 must eventually make this the real key.
CREATE UNIQUE INDEX IF NOT EXISTS content_chunk_asset_index_uq
  ON content.content_chunk (content_asset_id, chunk_index);

CREATE INDEX IF NOT EXISTS content_chunk_asset_idx
  ON content.content_chunk (content_asset_id);

COMMIT;
