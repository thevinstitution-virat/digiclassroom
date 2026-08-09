-- 008_drop_chunk_item_index_uq.sql
--
-- Target database: `trio`. Superuser.
--
-- PHASE 3 of 3 — CONTRACT. Run only after phase 2 is deployed and live.
--   phase 1  007: added content_asset_id + UNIQUE (content_asset_id, chunk_index)
--   phase 2  commit 518a403, deployed 2026-08-08: insertContentChunks writes
--            content_asset_id and its ON CONFLICT names the new key
--   phase 3  this file: drop the old UNIQUE (content_item_id, chunk_index)
--
-- WHY THIS MUST BE LAST
--
-- Dropping it before the code shipped would have broken the deployed
-- `ON CONFLICT (content_item_id, chunk_index)` clause, which can only name an
-- index that exists — that is the 005 mistake exactly. Running it now, with
-- phase 2 live, removes a constraint no deployed code references.
--
-- WHY IT MUST GO AT ALL, RATHER THAN BEING LEFT AS A HARMLESS EXTRA
--
-- It is not harmless. chunk_index is contiguous 0..N-1 within a FILE, so a book
-- assembled from fifteen chapter files has fifteen chunks numbered 0. Every one
-- of them collides under (content_item_id, chunk_index). With phase 2 live and
-- this constraint still present, the second chapter of any multi-part work
-- raises a unique violation instead of inserting — loudly, not silently, which
-- is why this transitional state was safe to sit in for a few minutes but is
-- not a place to stop. The whole multi-chapter model is blocked until it is
-- gone.
--
-- content_item_id STAYS on the table as a plain indexed column
-- (content_chunk_item_idx, content_chunk_item_chapter_idx). Retrieval still
-- filters by work — "every chunk of this book", "this book's chapter 3" — and
-- dropping the column would break every one of those reads. Only the
-- UNIQUENESS moves to the asset.

BEGIN;

ALTER TABLE content.content_chunk
  DROP CONSTRAINT IF EXISTS content_chunk_content_item_id_chunk_index_key;

COMMIT;
