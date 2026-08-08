-- 004_work_key_renditions_per_asset_runs.sql
--
-- Target database: `trio`. Superuser.
--
-- Applied while content.* is still empty, so none of this needs a backfill and
-- none of it can corrupt existing rows. That window closes with the first real
-- ingestion.
--
-- Three changes, each making room for readers/players/catalog WITHOUT building
-- them:
--   (a) an ingest run is per ASSET, not per work
--   (b) an asset states which rendition it is
--   (c) a work has an identity that survives having no file at all

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- (a) One active run per (content_item, content_asset)
-- ─────────────────────────────────────────────────────────────────────────────
-- 003's `ingest_run_one_active` allowed one active run per content_item. That
-- breaks as soon as a work is grouped from parts: fifteen chapter files under
-- one book means chapter 2's run either fails the unique index or steals
-- chapter 1's active slot, silently retiring chapter 1's vectors. The run
-- belongs to the file it embedded, not to the work.

ALTER TABLE content.ingest_run
  ADD COLUMN IF NOT EXISTS content_asset_id uuid
    REFERENCES content.content_asset(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS ingest_run_asset_idx
  ON content.ingest_run (content_asset_id);

DROP INDEX IF EXISTS content.ingest_run_one_active;

-- NULLS NOT DISTINCT matters here. Postgres treats NULLs as distinct in a unique
-- index by default, so without it a work whose runs have no asset recorded could
-- accumulate unlimited "active" runs — exactly the ambiguity this replaces.
CREATE UNIQUE INDEX ingest_run_one_active_per_asset
  ON content.ingest_run (content_item_id, content_asset_id)
  NULLS NOT DISTINCT
  WHERE status = 'active';


-- ─────────────────────────────────────────────────────────────────────────────
-- (b) Renditions
-- ─────────────────────────────────────────────────────────────────────────────
-- `role` was free text. A reader choosing its file by extension or row order is
-- wrong eventually and wrong silently — it renders the cover as the book, or
-- picks the un-paginated EPUB when the citation needs printed pages.
ALTER TABLE content.content_asset
  DROP CONSTRAINT IF EXISTS content_asset_role_check;

ALTER TABLE content.content_asset
  ADD CONSTRAINT content_asset_role_check
  CHECK (role IN (
    'source',          -- the original uploaded file, whatever its format
    'pdf_paginated',   -- a PDF whose page numbers are citation-grade
    'epub',            -- reflowable text
    'audio',           -- audiobook narration
    'audio_sync',      -- timing map aligning audio to text
    'cover',
    'thumbnail'
  ));

-- Printed page 1 is rarely file page 1: front matter, a scanned jacket, roman
-- numerals. Without an offset the reader jumps to the wrong page and the
-- citation is quietly a few pages off — worse than an obvious failure, because
-- the text still looks plausible.
ALTER TABLE content.content_asset
  ADD COLUMN IF NOT EXISTS page_offset integer;


-- ─────────────────────────────────────────────────────────────────────────────
-- (c) Work key: (isbn, edition)
-- ─────────────────────────────────────────────────────────────────────────────
-- canonical_sha256 identifies a FILE. A physical library holding has no file, so
-- it cannot be identified that way — yet it is the same work as the PDF, and a
-- catalog must be able to say so. isbn+edition is the identity that survives
-- having no bytes.
--
-- Both nullable, deliberately: Indian textbook reprints frequently carry no
-- usable ISBN, and a holding that never links to a digital copy is a valid
-- permanent state, not an error to be cleaned up later.
ALTER TABLE content.content_item ADD COLUMN IF NOT EXISTS isbn text;
ALTER TABLE content.content_item ADD COLUMN IF NOT EXISTS edition text;

-- Unique WHERE isbn IS NOT NULL: when an ISBN is known, one row owns that
-- (isbn, edition) and everything else links to it. Rows without an ISBN are
-- unconstrained and may coexist freely.
-- NULLS NOT DISTINCT so ('978-x', NULL) cannot be inserted twice — otherwise the
-- common case of a known ISBN with an unrecorded edition would silently
-- duplicate the work.
CREATE UNIQUE INDEX IF NOT EXISTS content_item_work_key_uq
  ON content.content_item (isbn, edition)
  NULLS NOT DISTINCT
  WHERE isbn IS NOT NULL;

COMMIT;
